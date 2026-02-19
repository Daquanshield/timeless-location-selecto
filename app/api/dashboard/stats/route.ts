import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-stats:${ip}`, { maxRequests: 30, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (auth.user.role !== 'dispatcher') {
    return NextResponse.json({ error: 'Dispatcher access only' }, { status: 403 })
  }

  const supabase = createServerClient()

  // Get today's boundaries in Detroit time
  const now = new Date()
  const detroitNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }))
  const todayStart = new Date(detroitNow)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(detroitNow)
  todayEnd.setHours(23, 59, 59, 999)

  // Run queries in parallel
  const [
    todayResult,
    upcomingResult,
    completedTodayResult,
    earningsResult,
    unconfirmedResult,
    projectedResult,
    paymentResult,
  ] = await Promise.all([
    // Rides today
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .gte('pickup_datetime', todayStart.toISOString())
      .lte('pickup_datetime', todayEnd.toISOString()),

    // Upcoming rides
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'confirmed'])
      .gt('pickup_datetime', now.toISOString()),

    // Completed today
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('pickup_datetime', todayStart.toISOString())
      .lte('pickup_datetime', todayEnd.toISOString()),

    // Earnings today (completed rides)
    supabase
      .from('rides')
      .select('total_amount')
      .eq('status', 'completed')
      .gte('pickup_datetime', todayStart.toISOString())
      .lte('pickup_datetime', todayEnd.toISOString()),

    // Unconfirmed rides
    supabase
      .from('rides')
      .select('id', { count: 'exact', head: true })
      .eq('confirmation_status', 'unconfirmed')
      .in('status', ['pending', 'confirmed']),

    // Projected earnings (pending + confirmed rides total_amount)
    supabase
      .from('rides')
      .select('total_amount')
      .in('status', ['pending', 'confirmed', 'en_route', 'arrived', 'in_progress']),

    // Payment breakdown (all non-cancelled rides)
    supabase
      .from('rides')
      .select('payment_status')
      .not('status', 'in', '("cancelled","no_show")'),
  ])

  const totalEarnings = (earningsResult.data || []).reduce(
    (sum, r) => sum + (Number(r.total_amount) || 0),
    0
  )

  const projectedEarnings = (projectedResult.data || []).reduce(
    (sum, r) => sum + (Number(r.total_amount) || 0),
    0
  )

  const paymentData = paymentResult.data || []
  const paymentBreakdown = {
    paid: paymentData.filter(r => r.payment_status === 'paid').length,
    deposit: paymentData.filter(r => r.payment_status === 'deposit').length,
    unpaid: paymentData.filter(r => !r.payment_status || r.payment_status === 'unpaid').length,
  }

  return NextResponse.json({
    rides_today: todayResult.count || 0,
    rides_upcoming: upcomingResult.count || 0,
    rides_completed_today: completedTodayResult.count || 0,
    total_earnings_today: totalEarnings,
    unconfirmed_count: unconfirmedResult.count || 0,
    projected_earnings: projectedEarnings,
    payment_breakdown: paymentBreakdown,
  })
}
