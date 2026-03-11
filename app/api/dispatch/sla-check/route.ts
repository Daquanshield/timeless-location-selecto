import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Called by n8n every 5 minutes to enforce SLA timers
// SLA Buckets:
//   Pickup >12 hours away: reassign after 45 min no confirmation
//   Pickup 2-12 hours away: reassign after 20 min no confirmation
//   Pickup <2 hours away: reassign after 10 min no confirmation

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-dispatch-secret')
  if (secret !== process.env.DISPATCH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()
  const results: Array<{ ride_id: string; trip_id: string; action: string; details: string }> = []

  // Get all pending rides (unconfirmed) with drivers assigned
  const { data: rides } = await supabase
    .from('rides')
    .select('id, trip_id, status, confirmation_status, pickup_datetime, driver_name, driver_phone, driver_contact_id, client_name, client_phone, client_contact_id, pickup_address, dropoff_address, vehicle_type, sla_deadline_at, sla_status, escalated, assignment_count, assignment_history, created_at, updated_at')
    .eq('status', 'pending')
    .eq('confirmation_status', 'unconfirmed')
    .not('driver_phone', 'is', null)

  if (!rides || rides.length === 0) {
    return NextResponse.json({ checked: 0, actions: 0, results: [] })
  }

  for (const ride of rides) {
    const pickupTime = new Date(ride.pickup_datetime)
    const hoursUntilPickup = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Determine SLA window based on pickup urgency
    let slaMinutes: number
    if (hoursUntilPickup > 12) {
      slaMinutes = 45
    } else if (hoursUntilPickup >= 2) {
      slaMinutes = 20
    } else {
      slaMinutes = 10
    }

    // Calculate SLA deadline from last assignment time
    const assignedAt = ride.updated_at || ride.created_at
    const slaDeadline = new Date(new Date(assignedAt).getTime() + slaMinutes * 60 * 1000)
    const minutesSinceAssignment = (now.getTime() - new Date(assignedAt).getTime()) / (1000 * 60)

    // Update SLA deadline if not set
    if (!ride.sla_deadline_at) {
      await supabase.from('rides').update({ sla_deadline_at: slaDeadline.toISOString() }).eq('id', ride.id)
    }

    // Check if SLA is about to breach (75% through window) - send warning
    if (minutesSinceAssignment >= slaMinutes * 0.75 && ride.sla_status === 'ok') {
      await supabase.from('rides').update({ sla_status: 'warning' }).eq('id', ride.id)

      await supabase.from('dispatch_events').insert({
        ride_id: ride.id,
        trip_id: ride.trip_id,
        event_type: 'SLA_WARNING',
        driver_name: ride.driver_name,
        driver_phone: ride.driver_phone,
        details: { sla_minutes: slaMinutes, minutes_elapsed: Math.round(minutesSinceAssignment), hours_until_pickup: Math.round(hoursUntilPickup * 10) / 10 }
      })

      results.push({
        ride_id: ride.id,
        trip_id: ride.trip_id,
        action: 'SLA_WARNING',
        details: `${ride.driver_name} has ${Math.round(slaMinutes - minutesSinceAssignment)} min left to confirm`
      })
    }

    // SLA BREACHED - trigger escalation + reassignment
    if (minutesSinceAssignment >= slaMinutes) {
      // 1. Mark as breached
      await supabase.from('rides').update({ sla_status: 'breached' }).eq('id', ride.id)

      // 2. Log breach event
      await supabase.from('dispatch_events').insert({
        ride_id: ride.id,
        trip_id: ride.trip_id,
        event_type: 'SLA_BREACH',
        driver_name: ride.driver_name,
        driver_phone: ride.driver_phone,
        details: { sla_minutes: slaMinutes, minutes_elapsed: Math.round(minutesSinceAssignment), will_escalate: true }
      })

      // 3. Update driver scorecard - increment no_response
      const { data: scorecard } = await supabase
        .from('driver_scorecards')
        .select('total_no_response')
        .eq('driver_phone', ride.driver_phone)
        .single()

      if (scorecard) {
        await supabase.from('driver_scorecards')
          .update({ total_no_response: (scorecard.total_no_response || 0) + 1, updated_at: new Date().toISOString() })
          .eq('driver_phone', ride.driver_phone)
      }

      // 4. Escalate to dispatcher if not already escalated
      if (!ride.escalated) {
        await escalateToDispatcher(supabase, ride, slaMinutes)
        await supabase.from('rides').update({ escalated: true }).eq('id', ride.id)
      }

      // 5. Attempt auto-reassign to backup driver
      const reassigned = await attemptReassign(supabase, ride)

      results.push({
        ride_id: ride.id,
        trip_id: ride.trip_id,
        action: 'SLA_BREACH',
        details: `${ride.driver_name} did not confirm in ${slaMinutes}min. ${reassigned ? 'Reassigned to backup.' : 'No backup available - dispatcher notified.'}`
      })
    }
  }

  return NextResponse.json({
    checked: rides.length,
    actions: results.length,
    results
  })
}

async function escalateToDispatcher(
  supabase: ReturnType<typeof createServerClient>,
  ride: any,
  slaMinutes: number
) {
  const pickupTime = new Date(ride.pickup_datetime).toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  })

  const message = `🚨 DISPATCH ALERT: Driver ${ride.driver_name} has NOT confirmed ride ${ride.trip_id} after ${slaMinutes} minutes.\n\n📍 ${ride.pickup_address}\n🕐 ${pickupTime}\n👤 ${ride.client_name}\n\nPlease reassign or contact driver immediately.`

  // Send to dispatcher (Daquan) via GHL
  try {
    await fetch('https://services.leadconnectorhq.com/conversations/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'SMS',
        contactId: process.env.DISPATCHER_CONTACT_ID || '',
        message
      })
    })
  } catch { /* log but don't fail */ }

  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id: ride.trip_id,
    event_type: 'ESCALATION',
    driver_name: ride.driver_name,
    driver_phone: ride.driver_phone,
    details: { reason: 'sla_breach', sla_minutes: slaMinutes, dispatcher_notified: true }
  })
}

async function attemptReassign(
  supabase: ReturnType<typeof createServerClient>,
  ride: any
): Promise<boolean> {
  // Get available drivers (not the current one)
  const { data: drivers } = await supabase
    .from('drivers')
    .select('first_name, last_name, phone, email')
    .eq('status', 'active')
    .neq('phone', ride.driver_phone)

  if (!drivers || drivers.length === 0) return false

  // Pick the first available backup driver
  // In future: use scorecard to rank by reliability
  const backup = drivers[0]
  const previousDriver = ride.driver_name

  // Update ride with new driver
  const history = ride.assignment_history || []
  history.push({
    driver_name: previousDriver,
    driver_phone: ride.driver_phone,
    action: 'sla_breach_reassign',
    timestamp: new Date().toISOString()
  })

  await supabase.from('rides').update({
    driver_name: `${backup.first_name} ${backup.last_name}`,
    driver_phone: backup.phone,
    driver_email: backup.email,
    confirmation_status: 'unconfirmed',
    sla_status: 'ok',
    sla_deadline_at: null,
    escalated: false,
    assignment_count: (ride.assignment_count || 1) + 1,
    assignment_history: history
  }).eq('id', ride.id)

  // Log reassignment
  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id: ride.trip_id,
    event_type: 'REASSIGNMENT',
    driver_name: `${backup.first_name} ${backup.last_name}`,
    driver_phone: backup.phone,
    details: { previous_driver: previousDriver, previous_phone: ride.driver_phone, reason: 'sla_breach' }
  })

  // Update scorecard for reassignment
  await supabase.from('driver_scorecards')
    .select('total_reassignments')
    .eq('driver_phone', ride.driver_phone)
    .single()
    .then(({ data }) => {
      if (data) {
        supabase.from('driver_scorecards')
          .update({ total_reassignments: (data.total_reassignments || 0) + 1, updated_at: new Date().toISOString() })
          .eq('driver_phone', ride.driver_phone)
          .then(() => {})
      }
    })

  return true
}
