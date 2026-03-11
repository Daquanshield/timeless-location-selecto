import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit, validateContentType } from '@/lib/security'
import type { ConciergeRecommendRequest, ConciergeRecommendResponse, Venue, SofiaZone } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, 'concierge-recommend', {
      maxRequests: 30,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    if (!validateContentType(request)) {
      return NextResponse.json<ConciergeRecommendResponse>(
        { success: false, venues: [], transportation_note: '', message: 'Invalid request' },
        { status: 400 }
      )
    }

    const body: ConciergeRecommendRequest = await request.json()
    const limit = Math.min(body.limit || 3, 3) // Max 2-3 recommendations per spec

    const supabase = createServerClient()

    let query = supabase
      .from('venues')
      .select('*')
      .eq('active', true)
      .limit(limit)

    // Filter by category if specified
    if (body.category) {
      query = query.eq('category', body.category)
    }

    // Filter by zone if specified
    if (body.zone) {
      query = query.eq('zone', body.zone)
    }

    // Filter by occasion using best_for array overlap
    if (body.occasion) {
      query = query.contains('best_for', [body.occasion.toLowerCase()])
    }

    const { data: venues, error } = await query

    if (error) {
      console.error('Concierge query error:', error)
      return NextResponse.json<ConciergeRecommendResponse>(
        { success: false, venues: [], transportation_note: '', message: 'Database error' },
        { status: 500 }
      )
    }

    // If no results with filters, broaden search
    let finalVenues = venues as Venue[]
    if (finalVenues.length === 0 && (body.category || body.zone || body.occasion)) {
      const { data: broader } = await supabase
        .from('venues')
        .select('*')
        .eq('active', true)
        .limit(limit)

      finalVenues = (broader || []) as Venue[]
    }

    // Generate transportation note - always tie back to transportation per spec
    const transportationNote = generateTransportationNote(finalVenues, body.zone)

    return NextResponse.json<ConciergeRecommendResponse>({
      success: true,
      venues: finalVenues,
      transportation_note: transportationNote,
    })
  } catch (error) {
    console.error('Concierge recommend error:', error)
    return NextResponse.json<ConciergeRecommendResponse>(
      { success: false, venues: [], transportation_note: '', message: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateTransportationNote(venues: Venue[], fromZone?: SofiaZone): string {
  if (venues.length === 0) {
    return 'We can arrange luxury transportation to any destination in the metro Detroit area. Just let us know!'
  }

  const zones = Array.from(new Set(venues.map(v => v.zone)))

  if (zones.length === 1 && zones[0] === 'DOWNTOWN') {
    return 'All recommendations are in downtown Detroit. We can drop you off and pick you up whenever you\'re ready — no need to worry about parking or driving.'
  }

  if (fromZone) {
    return `We'll handle all the transportation so you can enjoy your evening. Your driver will have the exact addresses and can adjust the route for multiple stops if needed.`
  }

  return 'Timeless Rides can provide door-to-door luxury transportation to any of these venues. Book an Hourly charter for a seamless evening out.'
}
