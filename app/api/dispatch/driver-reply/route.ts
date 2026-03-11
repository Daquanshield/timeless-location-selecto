import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Processes inbound driver SMS replies routed from n8n
// Handles: CONFIRM/YES/1, ON THE WAY, ARRIVED, LATE, DECLINE/NO
// Updates ride status, logs events, triggers notifications

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-dispatch-secret')
  if (secret !== process.env.DISPATCH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { driver_phone, message, contact_id } = body

  if (!driver_phone && !contact_id) {
    return NextResponse.json({ error: 'driver_phone or contact_id required' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  const supabase = createServerClient()
  const normalizedMsg = message.trim().toUpperCase()

  // Find the driver's active ride (most recent pending/confirmed ride)
  const lookupField = driver_phone ? 'driver_phone' : 'driver_contact_id'
  const lookupValue = driver_phone || contact_id

  const { data: ride } = await supabase
    .from('rides')
    .select('*')
    .eq(lookupField, lookupValue)
    .in('status', ['pending', 'confirmed', 'en_route'])
    .order('pickup_datetime', { ascending: true })
    .limit(1)
    .single()

  if (!ride) {
    return NextResponse.json({
      success: false,
      action: 'no_active_ride',
      message: 'No active ride found for this driver'
    })
  }

  // Parse reply and determine action
  const action = parseDriverReply(normalizedMsg)

  switch (action) {
    case 'CONFIRM':
      return await handleConfirm(supabase, ride)
    case 'ON_THE_WAY':
      return await handleOnTheWay(supabase, ride)
    case 'ARRIVED':
      return await handleArrived(supabase, ride)
    case 'LATE':
      return await handleLate(supabase, ride, message)
    case 'DECLINE':
      return await handleDecline(supabase, ride)
    default:
      return NextResponse.json({
        success: false,
        action: 'unknown_reply',
        message: `Could not parse reply: "${message}"`,
        ride_id: ride.id,
        trip_id: ride.trip_id
      })
  }
}

function parseDriverReply(msg: string): string {
  // CONFIRM patterns
  if (/^(1|YES|CONFIRM|CONFIRMED|OK|COPY|GOT IT|ROGER|ACCEPT|ACCEPTED)$/.test(msg)) {
    return 'CONFIRM'
  }

  // ON THE WAY patterns
  if (/^(ON THE WAY|OTW|ON MY WAY|OMW|EN ROUTE|ENROUTE|HEADING|HEADING OUT|LEAVING NOW)$/.test(msg)) {
    return 'ON_THE_WAY'
  }

  // ARRIVED patterns
  if (/^(ARRIVED|HERE|I'M HERE|IM HERE|AT LOCATION|AT PICKUP|WAITING)$/.test(msg)) {
    return 'ARRIVED'
  }

  // LATE patterns
  if (/^(LATE|RUNNING LATE|DELAYED|BEHIND)/.test(msg) || /\bLATE\b.*\b\d+\b/.test(msg) || /\b\d+\b.*\bMIN/.test(msg)) {
    return 'LATE'
  }

  // DECLINE patterns
  if (/^(NO|DECLINE|DECLINED|CANT|CAN'T|CANNOT|UNAVAILABLE|PASS)$/.test(msg)) {
    return 'DECLINE'
  }

  return 'UNKNOWN'
}

async function handleConfirm(
  supabase: ReturnType<typeof createServerClient>,
  ride: any
) {
  const now = new Date().toISOString()

  await supabase.from('rides').update({
    confirmation_status: 'confirmed',
    status: ride.status === 'pending' ? 'confirmed' : ride.status,
    confirmation_timestamp: now,
    sla_status: 'resolved',
    updated_at: now
  }).eq('id', ride.id)

  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id: ride.trip_id,
    event_type: 'CONFIRMATION',
    driver_name: ride.driver_name,
    driver_phone: ride.driver_phone,
    details: { method: 'sms_reply', confirmed_at: now }
  })

  // Update scorecard
  await supabase.from('driver_scorecards')
    .select('total_confirmations')
    .eq('driver_phone', ride.driver_phone)
    .single()
    .then(({ data }) => {
      if (data) {
        const assignedAt = ride.updated_at || ride.created_at
        const confirmMinutes = (Date.now() - new Date(assignedAt).getTime()) / (1000 * 60)
        supabase.from('driver_scorecards')
          .update({
            total_confirmations: (data.total_confirmations || 0) + 1,
            updated_at: now
          })
          .eq('driver_phone', ride.driver_phone)
          .then(() => {})
      }
    })

  return NextResponse.json({
    success: true,
    action: 'confirmed',
    ride_id: ride.id,
    trip_id: ride.trip_id,
    message: `${ride.driver_name} confirmed ${ride.trip_id}`
  })
}

async function handleOnTheWay(
  supabase: ReturnType<typeof createServerClient>,
  ride: any
) {
  const now = new Date().toISOString()

  await supabase.from('rides').update({
    status: 'en_route',
    confirmation_status: 'confirmed',
    updated_at: now
  }).eq('id', ride.id)

  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id: ride.trip_id,
    event_type: 'EN_ROUTE',
    driver_name: ride.driver_name,
    driver_phone: ride.driver_phone,
    details: { method: 'sms_reply', en_route_at: now }
  })

  return NextResponse.json({
    success: true,
    action: 'en_route',
    ride_id: ride.id,
    trip_id: ride.trip_id,
    message: `${ride.driver_name} is en route for ${ride.trip_id}`
  })
}

async function handleArrived(
  supabase: ReturnType<typeof createServerClient>,
  ride: any
) {
  const now = new Date().toISOString()

  // Check if on-time or late
  const pickupTime = new Date(ride.pickup_datetime)
  const arrivedTime = new Date()
  const minutesEarly = (pickupTime.getTime() - arrivedTime.getTime()) / (1000 * 60)
  const onTime = minutesEarly >= -5 // within 5 min grace period

  await supabase.from('rides').update({
    status: 'arrived',
    updated_at: now
  }).eq('id', ride.id)

  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id: ride.trip_id,
    event_type: 'ARRIVED',
    driver_name: ride.driver_name,
    driver_phone: ride.driver_phone,
    details: { method: 'sms_reply', arrived_at: now, on_time: onTime, minutes_early: Math.round(minutesEarly) }
  })

  // Update scorecard
  await supabase.from('driver_scorecards')
    .select('total_on_time, total_late')
    .eq('driver_phone', ride.driver_phone)
    .single()
    .then(({ data }) => {
      if (data) {
        const update = onTime
          ? { total_on_time: (data.total_on_time || 0) + 1 }
          : { total_late: (data.total_late || 0) + 1 }
        supabase.from('driver_scorecards')
          .update({ ...update, updated_at: now })
          .eq('driver_phone', ride.driver_phone)
          .then(() => {})
      }
    })

  // Notify client via Sofia that driver has arrived
  let clientNotified = false
  if (ride.client_contact_id) {
    try {
      const driverFirst = ride.driver_name?.split(' ')[0] || 'Your driver'
      const arrivalMsg = `Your driver ${driverFirst} has arrived at the pickup location. Please head outside when ready. 🚗`

      const ghlRes = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-04-15',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'SMS',
          contactId: ride.client_contact_id,
          message: arrivalMsg
        })
      })
      clientNotified = ghlRes.ok
    } catch { /* continue */ }
  }

  return NextResponse.json({
    success: true,
    action: 'arrived',
    ride_id: ride.id,
    trip_id: ride.trip_id,
    on_time: onTime,
    client_notified: clientNotified,
    message: `${ride.driver_name} arrived for ${ride.trip_id}${onTime ? ' (on time)' : ' (late)'}`
  })
}

async function handleLate(
  supabase: ReturnType<typeof createServerClient>,
  ride: any,
  rawMessage: string
) {
  const now = new Date().toISOString()

  // Try to extract ETA from message (e.g., "LATE 10 min", "running late 15")
  const etaMatch = rawMessage.match(/(\d+)/)?.[1]
  const etaMinutes = etaMatch ? parseInt(etaMatch) : null

  await supabase.from('rides').update({
    status: 'confirmed',  // keep confirmed but flag delay
    updated_at: now
  }).eq('id', ride.id)

  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id: ride.trip_id,
    event_type: 'SMS_SENT',
    driver_name: ride.driver_name,
    driver_phone: ride.driver_phone,
    details: { type: 'driver_late_notification', eta_minutes: etaMinutes, raw_message: rawMessage }
  })

  // Escalate to dispatcher
  const pickupTime = new Date(ride.pickup_datetime).toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  })

  const escalationMsg = `⚠️ DRIVER DELAY: ${ride.driver_name} reports running late for ${ride.trip_id}.\n\n📍 ${ride.pickup_address}\n🕐 ${pickupTime}\n👤 ${ride.client_name}\n⏱️ ETA: ${etaMinutes ? `${etaMinutes} min delayed` : 'Unknown'}\n\nDriver message: "${rawMessage}"`

  // Notify dispatcher (Leah)
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
        message: escalationMsg
      })
    })
  } catch { /* continue */ }

  return NextResponse.json({
    success: true,
    action: 'late',
    ride_id: ride.id,
    trip_id: ride.trip_id,
    eta_minutes: etaMinutes,
    dispatcher_notified: true,
    message: `${ride.driver_name} running late for ${ride.trip_id}. Dispatcher notified.`
  })
}

async function handleDecline(
  supabase: ReturnType<typeof createServerClient>,
  ride: any
) {
  const now = new Date().toISOString()

  await supabase.from('rides').update({
    confirmation_status: 'declined',
    sla_status: 'breached',
    updated_at: now
  }).eq('id', ride.id)

  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id: ride.trip_id,
    event_type: 'SLA_BREACH',
    driver_name: ride.driver_name,
    driver_phone: ride.driver_phone,
    details: { reason: 'driver_declined', declined_at: now }
  })

  // Escalate immediately
  const pickupTime = new Date(ride.pickup_datetime).toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  })

  const escalationMsg = `🚨 DRIVER DECLINED: ${ride.driver_name} declined ${ride.trip_id}.\n\n📍 ${ride.pickup_address}\n🕐 ${pickupTime}\n👤 ${ride.client_name}\n\nImmediate reassignment needed.`

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
        message: escalationMsg
      })
    })
  } catch { /* continue */ }

  return NextResponse.json({
    success: true,
    action: 'declined',
    ride_id: ride.id,
    trip_id: ride.trip_id,
    dispatcher_notified: true,
    message: `${ride.driver_name} declined ${ride.trip_id}. Dispatcher notified for reassignment.`
  })
}
