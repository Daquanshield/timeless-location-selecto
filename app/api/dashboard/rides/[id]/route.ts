import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-ride:${ip}`, { maxRequests: 60, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data: ride, error } = await supabase
    .from('rides')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  // Driver can only see own rides
  if (auth.user.role === 'driver' && ride.driver_phone !== auth.user.phone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Driver privacy: strip pricing, limit client name for pre-en_route
  if (auth.user.role === 'driver') {
    ride.total_amount = null
    ride.invoice_id = null
    const preEnRouteStatuses = ['pending', 'confirmed']
    if (preEnRouteStatuses.includes(ride.status) && ride.client_name) {
      ride.client_name = ride.client_name.split(' ')[0]
      ride.client_phone = null
      ride.client_email = null
    }
  }

  return NextResponse.json({ ride })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  // Fetch current ride
  const { data: ride } = await supabase
    .from('rides')
    .select('id, driver_phone')
    .eq('id', params.id)
    .single()

  if (!ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  if (auth.user.role === 'driver' && ride.driver_phone !== auth.user.phone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  // Only allow updating notes and metadata
  if (body.notes !== undefined) updates.notes = String(body.notes)
  if (body.metadata !== undefined) updates.metadata = body.metadata

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase
    .from('rides')
    .update(updates)
    .eq('id', params.id)

  if (error) {
    console.error('Failed to update ride:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
