import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// GET: Retrieve driver scorecards
// POST: Recalculate scorecards from dispatch_events (called by n8n daily or on-demand)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const driverPhone = searchParams.get('driver_phone')

  const supabase = createServerClient()

  if (driverPhone) {
    const { data } = await supabase
      .from('driver_scorecards')
      .select('*')
      .eq('driver_phone', driverPhone)
      .single()

    if (!data) return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
    return NextResponse.json({ success: true, scorecard: data })
  }

  const { data } = await supabase
    .from('driver_scorecards')
    .select('*')
    .order('confirmation_rate', { ascending: false })

  return NextResponse.json({ success: true, scorecards: data || [] })
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-dispatch-secret')
  if (secret !== process.env.DISPATCH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()

  // Get all drivers
  const { data: scorecards } = await supabase
    .from('driver_scorecards')
    .select('driver_phone, driver_name')

  if (!scorecards) return NextResponse.json({ error: 'No scorecards found' }, { status: 404 })

  const results = []

  for (const sc of scorecards) {
    // Get all dispatch events for this driver
    const { data: events } = await supabase
      .from('dispatch_events')
      .select('event_type, created_at, details')
      .eq('driver_phone', sc.driver_phone)
      .order('created_at', { ascending: false })

    if (!events || events.length === 0) {
      results.push({ driver: sc.driver_name, updated: false, reason: 'no events' })
      continue
    }

    // Calculate lifetime metrics
    const assignments = events.filter(e => e.event_type === 'ASSIGNMENT').length
    const confirmations = events.filter(e => e.event_type === 'CONFIRMATION').length
    const noResponses = events.filter(e => e.event_type === 'SLA_BREACH').length
    const reassignments = events.filter(e => e.event_type === 'REASSIGNMENT').length
    const completions = events.filter(e => e.event_type === 'COMPLETED').length
    const noShows = events.filter(e => e.event_type === 'NO_SHOW').length

    // Calculate on-time vs late from ARRIVED events
    const arrivals = events.filter(e => e.event_type === 'ARRIVED')
    let onTime = 0
    let late = 0
    let totalLateMinutes = 0

    for (const arrival of arrivals) {
      const details = arrival.details as any
      if (details?.minutes_late && details.minutes_late > 0) {
        late++
        totalLateMinutes += details.minutes_late
      } else {
        onTime++
      }
    }

    // Calculate confirmation time from events
    const confirmationEvents = events.filter(e => e.event_type === 'CONFIRMATION')
    let totalConfirmMinutes = 0
    for (const ce of confirmationEvents) {
      const details = ce.details as any
      if (details?.confirmation_minutes) {
        totalConfirmMinutes += details.confirmation_minutes
      }
    }

    const totalAssignments = Math.max(assignments, 1)
    const avgConfirmMinutes = confirmations > 0 ? totalConfirmMinutes / confirmations : 0
    const avgLateMinutes = late > 0 ? totalLateMinutes / late : 0

    // Calculate rolling windows
    const rolling7d = calculateWindow(events, 7, now)
    const rolling30d = calculateWindow(events, 30, now)
    const rolling90d = calculateWindow(events, 90, now)

    // Update scorecard
    await supabase.from('driver_scorecards').update({
      total_assignments: assignments,
      total_confirmations: confirmations,
      total_on_time: onTime,
      total_late: late,
      total_no_response: noResponses,
      total_reassignments: reassignments,
      total_completed: completions,
      total_no_show: noShows,
      confirmation_rate: Math.round((confirmations / totalAssignments) * 10000) / 100,
      on_time_rate: arrivals.length > 0 ? Math.round((onTime / arrivals.length) * 10000) / 100 : 0,
      late_rate: arrivals.length > 0 ? Math.round((late / arrivals.length) * 10000) / 100 : 0,
      no_response_rate: Math.round((noResponses / totalAssignments) * 10000) / 100,
      reassignment_rate: Math.round((reassignments / totalAssignments) * 10000) / 100,
      avg_confirmation_minutes: Math.round(avgConfirmMinutes * 100) / 100,
      avg_late_minutes: Math.round(avgLateMinutes * 100) / 100,
      rolling_7d: rolling7d,
      rolling_30d: rolling30d,
      rolling_90d: rolling90d,
      updated_at: now.toISOString()
    }).eq('driver_phone', sc.driver_phone)

    results.push({
      driver: sc.driver_name,
      updated: true,
      confirmation_rate: Math.round((confirmations / totalAssignments) * 100),
      on_time_rate: arrivals.length > 0 ? Math.round((onTime / arrivals.length) * 100) : 0,
      total_completed: completions
    })
  }

  return NextResponse.json({ success: true, updated: results.length, results })
}

function calculateWindow(events: any[], days: number, now: Date) {
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const windowEvents = events.filter(e => new Date(e.created_at) >= cutoff)

  const assignments = windowEvents.filter(e => e.event_type === 'ASSIGNMENT').length
  const confirmations = windowEvents.filter(e => e.event_type === 'CONFIRMATION').length
  const noResponses = windowEvents.filter(e => e.event_type === 'SLA_BREACH').length
  const completions = windowEvents.filter(e => e.event_type === 'COMPLETED').length

  return {
    assignments,
    confirmations,
    no_responses: noResponses,
    completions,
    confirmation_rate: assignments > 0 ? Math.round((confirmations / assignments) * 100) : 0
  }
}
