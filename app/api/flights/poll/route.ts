import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import {
  getFlightStatus,
  getDTWWeather,
  shouldStartPolling,
  generateFlightNotificationSMS,
} from '@/lib/flight-tracking'
import { sendSMS } from '@/lib/sms'

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

      // Send notification if needed
      if (shouldNotify) {
        const smsText = generateFlightNotificationSMS(status, weather)
        if (smsText.trim()) {
          const sent = await sendSMS({
            contactId: tracked.contact_id,
            phone: tracked.contact_phone,
            message: smsText,
            from: 'sofia',
          })
          if (sent) notificationCount++
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
