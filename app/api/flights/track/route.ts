import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit, validateContentType } from '@/lib/security'
import { getFlightStatus } from '@/lib/flight-tracking'
import type { TrackFlightRequest, FlightStatusResponse } from '@/types'

const FLIGHTAWARE_API_KEY = process.env.FLIGHTAWARE_API_KEY!

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, 'flight-track', {
      maxRequests: 20,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    if (!validateContentType(request)) {
      return NextResponse.json<FlightStatusResponse>(
        { success: false, message: 'Invalid request' },
        { status: 400 }
      )
    }

    const body: TrackFlightRequest = await request.json()

    if (!body.contact_id || !body.contact_phone || !body.flight_number || !body.flight_date) {
      return NextResponse.json<FlightStatusResponse>(
        { success: false, message: 'Missing required fields: contact_id, contact_phone, flight_number, flight_date' },
        { status: 400 }
      )
    }

    // Validate flight number format (e.g., DL1234, AA100, UA567)
    const flightRegex = /^[A-Z]{2}\d{1,4}$/
    const normalized = body.flight_number.replace(/\s+/g, '').toUpperCase()
    if (!flightRegex.test(normalized)) {
      return NextResponse.json<FlightStatusResponse>(
        { success: false, message: 'Invalid flight number format. Expected: DL1234, AA100, etc.' },
        { status: 400 }
      )
    }

    // Fetch initial flight info from FlightAware
    const flightStatus = await getFlightStatus(normalized, body.flight_date, FLIGHTAWARE_API_KEY)

    if (!flightStatus) {
      return NextResponse.json<FlightStatusResponse>(
        { success: false, message: `Flight ${normalized} not found for ${body.flight_date}. Please verify the flight number and date.` },
        { status: 404 }
      )
    }

    const supabase = createServerClient()

    // Check for existing tracking record
    const { data: existing } = await supabase
      .from('tracked_flights')
      .select('id')
      .eq('flight_number', normalized)
      .eq('contact_id', body.contact_id)
      .gte('scheduled_arrival', `${body.flight_date}T00:00:00Z`)
      .lte('scheduled_arrival', `${body.flight_date}T23:59:59Z`)
      .single()

    if (existing) {
      // Update existing record
      const { data, error } = await supabase
        .from('tracked_flights')
        .update({
          ...flightStatus,
          ride_id: body.ride_id || null,
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        console.error('Flight update error:', error)
        return NextResponse.json<FlightStatusResponse>(
          { success: false, message: 'Failed to update flight tracking' },
          { status: 500 }
        )
      }

      return NextResponse.json<FlightStatusResponse>({
        success: true,
        flight: data,
        message: 'Flight tracking updated',
      })
    }

    // Create new tracking record
    const { data, error } = await supabase
      .from('tracked_flights')
      .insert({
        contact_id: body.contact_id,
        contact_phone: body.contact_phone,
        ride_id: body.ride_id || null,
        ...flightStatus,
        last_polled_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Flight insert error:', error)
      return NextResponse.json<FlightStatusResponse>(
        { success: false, message: 'Failed to create flight tracking' },
        { status: 500 }
      )
    }

    return NextResponse.json<FlightStatusResponse>({
      success: true,
      flight: data,
      message: `Now tracking ${normalized}. You'll receive updates as your flight approaches.`,
    })
  } catch (error) {
    console.error('Flight track error:', error)
    return NextResponse.json<FlightStatusResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
