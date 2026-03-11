import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Called by n8n or manually to escalate at-risk trips to dispatcher
// Also handles: VIP with no backup, driver flagged issue, manual override requests

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-dispatch-secret')
  if (secret !== process.env.DISPATCH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { ride_id, reason, details } = body

  if (!ride_id || !reason) {
    return NextResponse.json({ error: 'ride_id and reason required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Get ride details
  const { data: ride } = await supabase
    .from('rides')
    .select('id, trip_id, status, confirmation_status, driver_name, driver_phone, client_name, client_phone, pickup_address, dropoff_address, pickup_datetime, vehicle_type, is_vip')
    .eq('id', ride_id)
    .single()

  if (!ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  const pickupTime = new Date(ride.pickup_datetime).toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  })

  // Build escalation message based on reason
  const reasonMessages: Record<string, string> = {
    vip_no_backup: `🚨 VIP ESCALATION: ${ride.client_name} (VIP) has no backup driver available!\n\n${ride.trip_id}\n📍 ${ride.pickup_address} → ${ride.dropoff_address}\n🕐 ${pickupTime}\n🚘 ${ride.vehicle_type}\n\nImmediate manual intervention required.`,

    driver_issue: `⚠️ DRIVER ISSUE: ${ride.driver_name} confirmed but flagged an issue.\n\n${ride.trip_id}\n📍 ${ride.pickup_address}\n🕐 ${pickupTime}\nDetails: ${details || 'No details provided'}\n\nPlease review and take action.`,

    conflict: `🔴 CONFLICT DETECTED on ${ride.trip_id}.\n\n${ride.driver_name} may have conflicting assignments.\n📍 ${ride.pickup_address}\n🕐 ${pickupTime}\n\nPlease verify driver availability.`,

    manual_override: `📋 MANUAL OVERRIDE REQUESTED for ${ride.trip_id}.\n\n📍 ${ride.pickup_address}\n🕐 ${pickupTime}\nDriver: ${ride.driver_name}\nReason: ${details || 'Override requested'}\n\nPlease review in dashboard.`,

    sla_breach: `🚨 SLA BREACH: ${ride.driver_name} did not confirm ${ride.trip_id}.\n\n📍 ${ride.pickup_address}\n🕐 ${pickupTime}\n👤 ${ride.client_name}${ride.is_vip ? ' (VIP)' : ''}\n\nAuto-reassignment ${details?.reassigned ? 'completed' : 'FAILED - no backup available'}.`
  }

  const message = reasonMessages[reason] || `⚠️ ESCALATION: ${ride.trip_id}\nReason: ${reason}\n${details || ''}`

  // Send SMS to dispatcher
  let dispatcherNotified = false
  try {
    const ghlRes = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
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
    dispatcherNotified = ghlRes.ok
  } catch { /* continue */ }

  // Log escalation event
  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id: ride.trip_id,
    event_type: 'ESCALATION',
    driver_name: ride.driver_name,
    driver_phone: ride.driver_phone,
    details: { reason, details, dispatcher_notified: dispatcherNotified, is_vip: ride.is_vip }
  })

  // Mark ride as escalated
  await supabase.from('rides').update({ escalated: true }).eq('id', ride.id)

  return NextResponse.json({
    success: true,
    escalated: true,
    dispatcher_notified: dispatcherNotified,
    reason,
    ride_id: ride.id,
    trip_id: ride.trip_id
  })
}
