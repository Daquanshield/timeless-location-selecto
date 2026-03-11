import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import {
  getFlightStatus,
  getDTWWeather,
  shouldStartPolling,
  generateFlightNotificationSMS,
  type ParsedFlightStatus,
} from '@/lib/flight-tracking'
import { sendSMS } from '@/lib/sms'

/**
 * Generate driver-specific flight status SMS
 */
function generateDriverFlightSMS(flight: ParsedFlightStatus, driverName: string): string | null {
  if (flight.status === 'cancelled') {
    return `Elena Dispatch: ${driverName}, flight ${flight.flight_number} has been CANCELLED. Please standby — we will update you on whether the ride is still needed.`
  }
  if (flight.delay_minutes >= 30) {
    return `Elena Dispatch: ${driverName}, flight ${flight.flight_number} is delayed ~${flight.delay_minutes} min. Adjust your arrival time accordingly. We'll keep you updated.`
  }
  if (flight.status === 'landed') {
    return `Elena Dispatch: ${driverName}, flight ${flight.flight_number} has landed! ${flight.dtw_pickup_instructions || 'Please proceed to the terminal.'} ${flight.baggage_claim ? `Baggage: ${flight.baggage_claim}` : ''}`
  }
  return null
}

const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY!
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY!

/**
 * Flight polling endpoint - called by n8n Schedule Trigger every 15 minutes.
 * Checks all active tracked flights and sends notifications for status changes.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is called from n8n (simple shared secret)
    const authHeader = request.headers.get('x-polling-secret')
    const expectedSecret = process.env.FLIGHT_POLLING_SECRET
    if (expectedSecret && authHeader !== expectedSecret) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Fetch flights that need polling:
    // - Status is 'scheduled' or 'tracking'
    // - Scheduled arrival is within next 4 hours or in the past (might have landed)
    const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()

    const { data: flights, error } = await supabase
      .from('tracked_flights')
      .select('*')
      .in('status', ['scheduled', 'tracking'])
      .lte('scheduled_arrival', fourHoursFromNow)
      .order('scheduled_arrival', { ascending: true })

    if (error) {
      console.error('Flight poll query error:', error)
      return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 })
    }

    if (!flights || flights.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No flights to poll',
        polled: 0,
        notifications: 0,
      })
    }

    // Get DTW weather once for all flights
    const weather = await getDTWWeather(OPENWEATHER_API_KEY)

    let polledCount = 0
    let notificationCount = 0
    const results: Array<{ flight: string; status: string; notified: boolean }> = []

    for (const tracked of flights) {
      // Check if we should be polling this flight
      if (tracked.status === 'scheduled' && !shouldStartPolling(tracked.scheduled_arrival)) {
        continue
      }

      const flightDate = tracked.scheduled_arrival.split('T')[0]
      const status = await getFlightStatus(tracked.flight_number, flightDate, FLIGHTAWARE_API_KEY)

      if (!status) {
        results.push({ flight: tracked.flight_number, status: 'api_error', notified: false })
        continue
      }

      polledCount++

      // Determine if we need to notify the client
      const prevStatus = tracked.status
      const prevDelay = tracked.delay_minutes
      const prevGate = tracked.gate
      let shouldNotify = false

      // Notify on: status change, significant delay change (>15min diff), gate assignment
      if (status.status !== prevStatus) shouldNotify = true
      if (Math.abs(status.delay_minutes - prevDelay) >= 15) shouldNotify = true
      if (status.gate && status.gate !== prevGate) shouldNotify = true

      // Update the tracking record
      const updateData: Record<string, unknown> = {
        actual_departure: status.actual_departure,
        actual_arrival: status.actual_arrival,
        terminal: status.terminal,
        gate: status.gate,
        baggage_claim: status.baggage_claim,
        delay_minutes: status.delay_minutes,
        status: status.status,
        dtw_pickup_instructions: status.dtw_pickup_instructions,
        weather_conditions: weather,
        last_polled_at: new Date().toISOString(),
      }

      if (tracked.status === 'scheduled' && status.status === 'tracking') {
        updateData.polling_started_at = new Date().toISOString()
      }

      await supabase
        .from('tracked_flights')
        .update(updateData)
        .eq('id', tracked.id)

      // Send notification if needed — to client, driver, and dispatcher (Leah)
      if (shouldNotify) {
        const clientSMS = generateFlightNotificationSMS(status, weather)
        if (clientSMS.trim()) {
          // 1. Notify client
          const sent = await sendSMS({
            contactId: tracked.contact_id,
            phone: tracked.contact_phone,
            message: clientSMS,
            from: 'sofia',
          })
          if (sent) notificationCount++

          // 2. Notify driver (if ride is linked)
          if (tracked.ride_id) {
            const { data: ride } = await supabase
              .from('rides')
              .select('driver_phone, driver_name, driver_contact_id')
              .eq('id', tracked.ride_id)
              .single()

            if (!ride) {
              // Try location_selections if no rides table match
              const { data: sel } = await supabase
                .from('location_selections')
                .select('id')
                .eq('id', tracked.ride_id)
                .single()
              // If ride record exists but no driver assigned yet, skip driver notify
              if (sel) console.log(`Flight ${tracked.flight_number}: ride found but no driver assigned yet`)
            }

            if (ride?.driver_phone) {
              const driverMsg = generateDriverFlightSMS(status, ride.driver_name || 'Driver')
              if (driverMsg) {
                await sendSMS({
                  phone: ride.driver_phone,
                  ...(ride.driver_contact_id ? { contactId: ride.driver_contact_id } : {}),
                  message: driverMsg,
                  from: 'elena',
                })
              }
            }
          }

          // 3. Notify dispatcher Leah on cancellations or major delays (30+ min)
          if (status.status === 'cancelled' || status.delay_minutes >= 30) {
            const leahMsg = `🚨 FLIGHT ALERT: ${tracked.flight_number} ${status.status === 'cancelled' ? 'CANCELLED' : `delayed ${status.delay_minutes}min`}.\n\nClient: ${tracked.contact_phone}\n${tracked.ride_id ? `Ride ID: ${tracked.ride_id}` : 'No ride linked'}\n\nPlease check if ride needs rescheduling.`
            await sendSMS({
              phone: '+12488044747',
              message: leahMsg,
              from: 'elena',
            })
          }
        }
      }

      results.push({
        flight: tracked.flight_number,
        status: status.status,
        notified: shouldNotify,
      })
    }

    return NextResponse.json({
      success: true,
      polled: polledCount,
      notifications: notificationCount,
      weather,
      results,
    })
  } catch (error) {
    console.error('Flight poll error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
