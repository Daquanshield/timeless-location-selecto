import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/security'
import type { FlightStatusResponse } from '@/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { flightNumber: string } }
) {
  try {
    const rateLimitResponse = rateLimit(request, 'flight-status', {
      maxRequests: 60,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const normalized = params.flightNumber.replace(/\s+/g, '').toUpperCase()

    const supabase = createServerClient()

    // Get the most recent tracking record for this flight
    const { data, error } = await supabase
      .from('tracked_flights')
      .select('*')
      .eq('flight_number', normalized)
      .order('scheduled_arrival', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json<FlightStatusResponse>(
        { success: false, message: `No tracking record found for ${normalized}` },
        { status: 404 }
      )
    }

    return NextResponse.json<FlightStatusResponse>({
      success: true,
      flight: data,
    })
  } catch (error) {
    console.error('Flight status error:', error)
    return NextResponse.json<FlightStatusResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
