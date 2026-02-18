import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-assign:${ip}`, { maxRequests: 20, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Dispatcher only
  if (auth.user.role !== 'dispatcher') {
    return NextResponse.json({ error: 'Dispatcher access only' }, { status: 403 })
  }

  const body = await request.json()
  const driverPhone = body.driver_phone

  if (!driverPhone) {
    return NextResponse.json({ error: 'driver_phone required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Look up new driver
  const { data: newDriver } = await supabase
    .from('dashboard_users')
    .select('name, phone, email, ghl_contact_id')
    .eq('phone', driverPhone)
    .eq('is_active', true)
    .single()

  if (!newDriver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  }

  // Fetch current ride
  const { data: ride } = await supabase
    .from('rides')
    .select('id, driver_name, driver_phone, assignment_history')
    .eq('id', params.id)
    .single()

  if (!ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  // Build assignment history
  const history = Array.isArray(ride.assignment_history) ? ride.assignment_history : []
  history.push({
    from_driver: ride.driver_name || null,
    to_driver: newDriver.name,
    assigned_by: auth.user.name,
    timestamp: new Date().toISOString(),
  })

  // Update ride
  const { error } = await supabase
    .from('rides')
    .update({
      driver_name: newDriver.name,
      driver_phone: newDriver.phone,
      driver_email: newDriver.email,
      driver_contact_id: newDriver.ghl_contact_id,
      confirmation_status: 'unconfirmed',
      confirmation_timestamp: null,
      assignment_history: history,
    })
    .eq('id', params.id)

  if (error) {
    console.error('Failed to assign driver:', error)
    return NextResponse.json({ error: 'Failed to assign' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    assigned_to: newDriver.name,
  })
}
