import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit, isValidToken } from '@/lib/security'
import type { ValidateTokenResponse, LocationSession } from '@/types'

export async function GET(request: NextRequest) {
  // Rate limiting: 30 requests per minute per IP
  const rateLimitResponse = rateLimit(request, 'validate-token', {
    maxRequests: 30,
    windowMs: 60000
  })
  if (rateLimitResponse) return rateLimitResponse

  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json<ValidateTokenResponse>(
      { valid: false, error: 'Token is required' },
      { status: 400 }
    )
  }

  // Validate token format
  if (!isValidToken(token)) {
    return NextResponse.json<ValidateTokenResponse>(
      { valid: false, error: 'Invalid token format' },
      { status: 400 }
    )
  }

  try {
    const supabase = createServerClient()

    // Query the location_selections table
    const { data, error } = await supabase
      .from('location_selections')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      return NextResponse.json<ValidateTokenResponse>(
        { valid: false, error: 'Token expired or invalid' },
        { status: 404 }
      )
    }

    // Transform to session object
    const session: LocationSession = {
      id: data.id,
      token: data.token,
      contactPhone: data.contact_phone,
      contactName: data.contact_name,
      contactId: data.contact_id,
      conversationId: data.conversation_id,
      prefillPickup: data.prefill_pickup,
      prefillDropoff: data.prefill_dropoff,
      prefillDatetime: data.prefill_datetime,
      status: data.status,
      expiresAt: data.expires_at,
      createdAt: data.created_at
    }

    return NextResponse.json<ValidateTokenResponse>({
      valid: true,
      session
    })
  } catch (error) {
    console.error('Token validation error:', error)
    return NextResponse.json<ValidateTokenResponse>(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
