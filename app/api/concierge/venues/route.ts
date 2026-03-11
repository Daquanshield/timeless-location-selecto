import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit, validateContentType, sanitizeString, sanitizeCoordinate } from '@/lib/security'
import type { Venue } from '@/types'

// GET - List all active venues (public)
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, 'venues-list', {
      maxRequests: 60,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const zone = searchParams.get('zone')

    const supabase = createServerClient()
    let query = supabase
      .from('venues')
      .select('*')
      .eq('active', true)
      .order('name')

    if (category) query = query.eq('category', category)
    if (zone) query = query.eq('zone', zone)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 })
    }

    return NextResponse.json({ success: true, venues: data as Venue[] })
  } catch (error) {
    console.error('Venues list error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

// POST - Add a new venue (admin)
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, 'venues-create', {
      maxRequests: 10,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    if (!validateContentType(request)) {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.category || !body.address || !body.description) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: name, category, address, description' },
        { status: 400 }
      )
    }

    if (body.lat === undefined || body.lng === undefined || !body.zone) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: lat, lng, zone' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('venues')
      .insert({
        name: sanitizeString(body.name, 200),
        category: body.category,
        price_level: body.price_level || '$$$$',
        address: sanitizeString(body.address, 300),
        lat: sanitizeCoordinate(body.lat, 'lat'),
        lng: sanitizeCoordinate(body.lng, 'lng'),
        zone: body.zone,
        phone: body.phone || null,
        website: body.website || null,
        description: sanitizeString(body.description, 500),
        dress_code: body.dress_code || null,
        reservation_required: body.reservation_required || false,
        best_for: body.best_for || [],
        hours: body.hours || null,
        active: true,
      })
      .select()
      .single()

    if (error) {
      console.error('Venue create error:', error)
      return NextResponse.json({ success: false, message: 'Failed to create venue' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      venue: data as Venue,
      message: `Venue "${data.name}" added`,
    })
  } catch (error) {
    console.error('Venues create error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
