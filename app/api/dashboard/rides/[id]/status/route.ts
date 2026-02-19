import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { STATUS_TRANSITIONS, STATUS_UNDO_TRANSITIONS, type RideStatus } from '@/lib/dashboard-types'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { triggerStatusNotification } from '@/lib/ghl-notifications'

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
    .select('id, status, driver_phone, driver_name, client_phone, client_name, client_contact_id, vehicle_type, pickup_datetime, pickup_address')
    .eq('id', params.id)
    .single()

  if (!ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  // Driver can only update own rides
  if (auth.user.role === 'driver' && ride.driver_phone !== auth.user.phone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  // Validate transition (forward or undo)
  const currentStatus = ride.status as RideStatus
  const validNext = STATUS_TRANSITIONS[currentStatus] || []
  const undoTarget = STATUS_UNDO_TRANSITIONS[currentStatus]
  const isUndo = undoTarget === newStatus

  if (!validNext.includes(newStatus) && !isUndo) {
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

  // Audit log: record status change
  await supabase.from('ride_status_log').insert({
    ride_id: params.id,
    status: isUndo ? `undo_to_${newStatus}` : newStatus,
    changed_by: auth.user.id,
    changed_by_name: auth.user.name,
  }).then(({ error: logErr }) => {
    if (logErr) console.error('Failed to log status change:', logErr)
  })

  // Fire-and-forget: notify client via GHL SMS (skip for undo)
  if (!isUndo) {
    triggerStatusNotification(ride, newStatus).catch(() => {})
  }

  return NextResponse.json({ success: true, status: newStatus })
}
