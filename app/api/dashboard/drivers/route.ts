import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp, sanitizeString } from '@/lib/security'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-drivers:${ip}`, { maxRequests: 60, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()

  const { data: drivers, error } = await supabase
    .from('drivers')
    .select('*')
    .order('first_name', { ascending: true })

  if (error) {
    console.error('Failed to fetch drivers:', error)
    return NextResponse.json({ error: 'Failed to fetch drivers' }, { status: 500 })
  }

  return NextResponse.json({ drivers: drivers || [] })
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-drivers-create:${ip}`, { maxRequests: 10, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth || auth.user.role !== 'dispatcher') {
    return NextResponse.json({ error: 'Dispatcher access required' }, { status: 403 })
  }

  const body = await request.json()

  const firstName = sanitizeString(body.first_name || '').trim()
  const lastName = sanitizeString(body.last_name || '').trim()
  let phone = sanitizeString(body.phone || '').trim()
  const email = sanitizeString(body.email || '').trim().toLowerCase() || null
  const employmentType = body.employment_type === 'W2' ? 'W2' : '1099'
  const payRate = body.pay_rate ? parseFloat(body.pay_rate) : null
  const vehicleAssigned = sanitizeString(body.vehicle_assigned || '').trim() || null

  if (!firstName || !lastName) {
    return NextResponse.json({ error: 'First and last name required' }, { status: 400 })
  }

  if (!email) {
    return NextResponse.json({ error: 'Business email required (drivers login via email)' }, { status: 400 })
  }

  // Normalize phone to E.164
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    phone = `+1${digits}`
  } else if (digits.length === 11 && digits[0] === '1') {
    phone = `+${digits}`
  } else if (!phone.startsWith('+')) {
    phone = `+${digits}`
  }

  if (!phone || phone.length < 10) {
    return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Create dashboard_user first (for login access)
  const { data: dashUser, error: userError } = await supabase
    .from('dashboard_users')
    .insert({
      phone,
      name: `${firstName} ${lastName}`,
      email,
      role: 'driver',
      is_active: true,
    })
    .select('id')
    .single()

  if (userError) {
    if (userError.code === '23505') {
      return NextResponse.json({ error: 'A user with this phone number already exists' }, { status: 409 })
    }
    console.error('Failed to create dashboard user:', userError)
    return NextResponse.json({ error: 'Failed to create driver account' }, { status: 500 })
  }

  // Create driver record
  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .insert({
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      employment_type: employmentType,
      pay_rate: payRate,
      vehicle_assigned: vehicleAssigned,
      dashboard_user_id: dashUser.id,
    })
    .select('*')
    .single()

  if (driverError) {
    // Rollback: delete the dashboard_user we just created
    await supabase.from('dashboard_users').delete().eq('id', dashUser.id)
    if (driverError.code === '23505') {
      return NextResponse.json({ error: 'A driver with this phone number already exists' }, { status: 409 })
    }
    console.error('Failed to create driver:', driverError)
    return NextResponse.json({ error: 'Failed to create driver' }, { status: 500 })
  }

  return NextResponse.json({ driver }, { status: 201 })
}
