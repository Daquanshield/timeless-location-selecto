import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit, validateContentType, sanitizeString } from '@/lib/security'
import type { ClientProfile, ClientProfileResponse, UpdateClientProfileRequest } from '@/types'

// GET - Fetch client profile
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResponse = rateLimit(request, 'client-profile-get', {
      maxRequests: 60,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    const supabase = createServerClient()

    const { data, error } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('contact_id', params.id)
      .single()

    if (error || !data) {
      return NextResponse.json<ClientProfileResponse>(
        { success: false, message: 'Client profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json<ClientProfileResponse>({
      success: true,
      profile: data as ClientProfile,
    })
  } catch (error) {
    console.error('Client profile fetch error:', error)
    return NextResponse.json<ClientProfileResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Create or update client profile
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResponse = rateLimit(request, 'client-profile-update', {
      maxRequests: 30,
      windowMs: 60000,
    })
    if (rateLimitResponse) return rateLimitResponse

    if (!validateContentType(request)) {
      return NextResponse.json<ClientProfileResponse>(
        { success: false, message: 'Invalid request' },
        { status: 400 }
      )
    }

    const body: UpdateClientProfileRequest & {
      contact_phone?: string
    } = await request.json()

    const supabase = createServerClient()

    // Check if profile exists
    const { data: existing } = await supabase
      .from('client_profiles')
      .select('id')
      .eq('contact_id', params.id)
      .single()

    const profileData: Record<string, unknown> = {}

    // Only include fields that are present in the request
    if (body.contact_name) profileData.contact_name = sanitizeString(body.contact_name, 100)
    if (body.contact_email) profileData.contact_email = body.contact_email
    if (body.vip_tier) profileData.vip_tier = body.vip_tier
    if (body.preferred_vehicle) profileData.preferred_vehicle = body.preferred_vehicle
    if (body.preferred_driver !== undefined) profileData.preferred_driver = body.preferred_driver
    if (body.usual_pickup !== undefined) profileData.usual_pickup = body.usual_pickup
    if (body.usual_dropoff !== undefined) profileData.usual_dropoff = body.usual_dropoff
    if (body.dietary_restrictions !== undefined) profileData.dietary_restrictions = body.dietary_restrictions
    if (body.preferred_restaurants) profileData.preferred_restaurants = body.preferred_restaurants
    if (body.communication_preference) profileData.communication_preference = body.communication_preference
    if (body.special_dates) profileData.special_dates = body.special_dates
    if (body.notes !== undefined) profileData.notes = body.notes ? sanitizeString(body.notes, 1000) : null

    let result

    if (existing) {
      // Update existing profile
      const { data, error } = await supabase
        .from('client_profiles')
        .update(profileData)
        .eq('contact_id', params.id)
        .select()
        .single()

      if (error) {
        console.error('Profile update error:', error)
        return NextResponse.json<ClientProfileResponse>(
          { success: false, message: 'Failed to update profile' },
          { status: 500 }
        )
      }
      result = data
    } else {
      // Create new profile - need required fields
      if (!body.contact_name || !body.contact_phone) {
        return NextResponse.json<ClientProfileResponse>(
          { success: false, message: 'New profiles require contact_name and contact_phone' },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('client_profiles')
        .insert({
          contact_id: params.id,
          contact_name: sanitizeString(body.contact_name, 100),
          contact_phone: body.contact_phone,
          ...profileData,
        })
        .select()
        .single()

      if (error) {
        console.error('Profile create error:', error)
        return NextResponse.json<ClientProfileResponse>(
          { success: false, message: 'Failed to create profile' },
          { status: 500 }
        )
      }
      result = data
    }

    return NextResponse.json<ClientProfileResponse>({
      success: true,
      profile: result as ClientProfile,
      message: existing ? 'Profile updated' : 'Profile created',
    })
  } catch (error) {
    console.error('Client profile error:', error)
    return NextResponse.json<ClientProfileResponse>(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
