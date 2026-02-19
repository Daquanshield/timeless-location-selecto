import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp, sanitizeString } from '@/lib/security'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const { data: driver, error } = await supabase
    .from('drivers')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  }

  return NextResponse.json({ driver })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-drivers-update:${ip}`, { maxRequests: 20, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth || auth.user.role !== 'dispatcher') {
    return NextResponse.json({ error: 'Dispatcher access required' }, { status: 403 })
  }

  const supabase = createServerClient()

  // Fetch existing driver
  const { data: existing } = await supabase
    .from('drivers')
    .select('id, dashboard_user_id')
    .eq('id', params.id)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  }

  const body = await request.json()
  const updates: Record<string, unknown> = {}

  if (body.first_name !== undefined) updates.first_name = sanitizeString(body.first_name).trim()
  if (body.last_name !== undefined) updates.last_name = sanitizeString(body.last_name).trim()
  if (body.email !== undefined) updates.email = sanitizeString(body.email).trim().toLowerCase() || null
  if (body.employment_type !== undefined) updates.employment_type = body.employment_type === 'W2' ? 'W2' : '1099'
  if (body.pay_rate !== undefined) updates.pay_rate = body.pay_rate ? parseFloat(body.pay_rate) : null
  if (body.vehicle_assigned !== undefined) updates.vehicle_assigned = sanitizeString(body.vehicle_assigned).trim() || null
  if (body.status !== undefined) updates.status = body.status === 'active' ? 'active' : 'inactive'

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: driver, error } = await supabase
    .from('drivers')
    .update(updates)
    .eq('id', params.id)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update driver:', error)
    return NextResponse.json({ error: 'Failed to update driver' }, { status: 500 })
  }

  // Also update dashboard_user if name or status changed
  if (existing.dashboard_user_id && (updates.first_name || updates.last_name || updates.status !== undefined)) {
    const userUpdates: Record<string, unknown> = {}
    if (updates.first_name || updates.last_name) {
      userUpdates.name = `${driver.first_name} ${driver.last_name}`
    }
    if (updates.status !== undefined) {
      userUpdates.is_active = updates.status === 'active'
    }
    if (Object.keys(userUpdates).length > 0) {
      await supabase.from('dashboard_users').update(userUpdates).eq('id', existing.dashboard_user_id)
    }
  }

  return NextResponse.json({ driver })
}
