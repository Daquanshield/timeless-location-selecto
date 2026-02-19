import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-notif:${ip}`, { maxRequests: 60, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (auth.user.role !== 'dispatcher') {
    return NextResponse.json({ error: 'Dispatcher only' }, { status: 403 })
  }

  const since = request.nextUrl.searchParams.get('since')
  const supabase = createServerClient()

  // Fetch recent status log entries (last 50 or since timestamp)
  let logQuery = supabase
    .from('ride_status_log')
    .select('id, ride_id, status, changed_by_name, timestamp')
    .order('timestamp', { ascending: false })
    .limit(50)

  if (since) {
    logQuery = logQuery.gt('timestamp', since)
  }

  const { data: logs } = await logQuery

  // Fetch recent rides created in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let ridesQuery = supabase
    .from('rides')
    .select('id, trip_id, client_name, created_at, status, confirmation_status')
    .order('created_at', { ascending: false })
    .limit(20)

  if (since) {
    ridesQuery = ridesQuery.gt('created_at', since)
  } else {
    ridesQuery = ridesQuery.gte('created_at', oneDayAgo)
  }

  const { data: newRides } = await ridesQuery

  // Build notification items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notifications: any[] = []

  // New ride bookings
  for (const ride of (newRides || [])) {
    notifications.push({
      id: `ride-${ride.id}`,
      type: 'new_ride',
      message: `New ride booked: ${ride.client_name || 'Unknown client'} (${ride.trip_id})`,
      timestamp: ride.created_at,
      ride_id: ride.id,
    })
  }

  // Status changes (filter out duplicates with new rides)
  for (const log of (logs || [])) {
    const statusLabel = log.status === 'no_show' ? 'No Show' : log.status
    const by = log.changed_by_name || 'System'
    notifications.push({
      id: `log-${log.id}`,
      type: 'status_change',
      message: `${by} changed ride to ${statusLabel}`,
      timestamp: log.timestamp,
      ride_id: log.ride_id,
    })
  }

  // Sort by timestamp descending
  notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return NextResponse.json({
    notifications: notifications.slice(0, 30),
    count: notifications.length,
  })
}
