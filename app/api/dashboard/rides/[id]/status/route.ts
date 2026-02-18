import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { STATUS_TRANSITIONS, type RideStatus } from '@/lib/dashboard-types'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-status:${ip}`, { maxRequests: 20, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const newStatus = body.status as RideStatus

  if (!newStatus || !STATUS_TRANSITIONS[newStatus as keyof typeof STATUS_TRANSITIONS] === undefined) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Fetch current ride
  const { data: ride } = await supabase
    .from('rides')
    .select('id, status, driver_phone')
    .eq('id', params.id)
    .single()

  if (!ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  // Driver can only update own rides
  if (auth.user.role === 'driver' && ride.driver_phone !== auth.user.phone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Validate transition
  const currentStatus = ride.status as RideStatus
  const validNext = STATUS_TRANSITIONS[currentStatus] || []
  if (!validNext.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot change from ${currentStatus} to ${newStatus}` },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('rides')
    .update({ status: newStatus })
    .eq('id', params.id)

  if (error) {
    console.error('Failed to update status:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: newStatus })
}
