import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

const PAGE_SIZE = 20

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-rides:${ip}`, { maxRequests: 60, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { user } = auth
  const supabase = createServerClient()
  const params = request.nextUrl.searchParams

  // Parse params
  const status = params.get('status')
  const confirmationStatus = params.get('confirmation_status')
  const driverPhone = params.get('driver_phone')
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const page = Math.max(1, parseInt(params.get('page') || '1'))
  const limit = Math.min(50, parseInt(params.get('limit') || String(PAGE_SIZE)))
  const offset = (page - 1) * limit

  // Build query
  let query = supabase
    .from('rides')
    .select(
      'id, trip_id, driver_name, driver_phone, client_name, client_phone, pickup_datetime, pickup_address, dropoff_address, vehicle_type, service_option, total_amount, status, confirmation_status, payment_status, is_vip, number_of_passengers',
      { count: 'exact' }
    )

  // Driver: scope to own rides only
  if (user.role === 'driver') {
    query = query.eq('driver_phone', user.phone)
  } else if (driverPhone) {
    // Dispatcher: optional driver filter
    query = query.eq('driver_phone', driverPhone)
  }

  // Status filter
  if (status) {
    const statuses = status.split(',').map(s => s.trim())
    query = query.in('status', statuses)
  }

  // Confirmation status filter
  if (confirmationStatus) {
    query = query.eq('confirmation_status', confirmationStatus)
  }

  // Date range
  if (dateFrom) {
    query = query.gte('pickup_datetime', dateFrom)
  }
  if (dateTo) {
    query = query.lte('pickup_datetime', dateTo)
  }

  // Order and paginate
  query = query.order('pickup_datetime', { ascending: false }).range(offset, offset + limit - 1)

  const { data: rides, count, error } = await query

  if (error) {
    console.error('Failed to fetch rides:', error)
    return NextResponse.json({ error: 'Failed to fetch rides' }, { status: 500 })
  }

  return NextResponse.json({
    rides: rides || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  })
}
