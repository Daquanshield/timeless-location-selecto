import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { triggerStatusNotification } from '@/lib/ghl-notifications'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-confirm:${ip}`, { maxRequests: 20, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const action = body.action as 'accept' | 'decline'

  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'Action must be accept or decline' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: ride } = await supabase
    .from('rides')
    .select('id, driver_phone, driver_name, confirmation_status, assignment_history, client_phone, client_name, client_contact_id, vehicle_type, pickup_datetime, pickup_address')
    .eq('id', params.id)
    .single()

  if (!ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  // Driver can only confirm own rides
  if (auth.user.role === 'driver' && ride.driver_phone !== auth.user.phone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const newConfirmation = action === 'accept' ? 'confirmed' : 'declined'
  const history = Array.isArray(ride.assignment_history) ? ride.assignment_history : []

  history.push({
    action: newConfirmation,
    by: auth.user.name,
    timestamp: new Date().toISOString(),
  })

  const updates: Record<string, unknown> = {
    confirmation_status: newConfirmation,
    confirmation_timestamp: new Date().toISOString(),
    assignment_history: history,
  }

  // If accepted, also set status to confirmed if pending
  if (action === 'accept' && ride.confirmation_status === 'unconfirmed') {
    updates.status = 'confirmed'
  }

  const { error } = await supabase
    .from('rides')
    .update(updates)
    .eq('id', params.id)

  if (error) {
    console.error('Failed to confirm ride:', error)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }

  // Notify client on confirmation
  if (action === 'accept') {
    triggerStatusNotification(ride, 'confirmed').catch(() => {})
  }

  return NextResponse.json({ success: true, confirmation_status: newConfirmation })
}
