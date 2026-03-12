import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Called by n8n every 10 minutes to send client reminders
// Day-before (6-9 PM evening before), 2-hour before

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-dispatch-secret')
  if (secret !== process.env.DISPATCH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()
  const results: Array<{ ride_id: string; trip_id: string; reminder_type: string; client_name: string; sent: boolean }> = []

  // Get all confirmed rides with client contact IDs
  let { data: rides } = await supabase
    .from('rides')
    .select('id, trip_id, status, pickup_datetime, client_name, client_contact_id, pickup_address, dropoff_address, vehicle_type, driver_name, driver_phone, service_type, flight_number, terminal, client_reminder_daybefore_sent, client_reminder_2hr_sent')
    .in('status', ['confirmed'])
    .not('client_contact_id', 'is', null)

  // Fallback if new columns don't exist yet (pre-migration)
  if (!rides) {
    const fallback = await supabase
      .from('rides')
      .select('id, trip_id, status, pickup_datetime, client_name, client_contact_id, pickup_address, dropoff_address, vehicle_type, driver_name, driver_phone, service_type, flight_number')
      .in('status', ['confirmed'])
      .not('client_contact_id', 'is', null)
    rides = (fallback.data || []).map(r => ({ ...r, terminal: null, client_reminder_daybefore_sent: false, client_reminder_2hr_sent: false })) as any
  }

  if (!rides || rides.length === 0) {
    return NextResponse.json({ checked: 0, reminders_sent: 0, results: [] })
  }

  for (const ride of rides) {
    const pickupTime = new Date(ride.pickup_datetime)
    const hoursUntil = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60)

    // Day-before reminder: 6-9 PM the night before (12-24 hours before)
    if (!ride.client_reminder_daybefore_sent && hoursUntil > 10 && hoursUntil <= 24) {
      const nowDetroit = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }))
      const hour = nowDetroit.getHours()
      if (hour >= 18 && hour < 21) {
        const sent = await sendClientReminder(supabase, ride, 'day_before')
        if (sent) {
          await supabase.from('rides').update({ client_reminder_daybefore_sent: true }).eq('id', ride.id)
          results.push({ ride_id: ride.id, trip_id: ride.trip_id, reminder_type: 'day_before', client_name: ride.client_name, sent: true })
        }
      }
    }

    // 2-hour reminder: 110-130 minutes before
    if (!ride.client_reminder_2hr_sent && hoursUntil > 1.83 && hoursUntil <= 2.17) {
      const sent = await sendClientReminder(supabase, ride, '2_hour')
      if (sent) {
        await supabase.from('rides').update({ client_reminder_2hr_sent: true }).eq('id', ride.id)
        results.push({ ride_id: ride.id, trip_id: ride.trip_id, reminder_type: '2_hour', client_name: ride.client_name, sent: true })
      }
    }
  }

  return NextResponse.json({
    checked: rides.length,
    reminders_sent: results.length,
    results
  })
}

async function sendClientReminder(
  supabase: ReturnType<typeof createServerClient>,
  ride: any,
  reminderType: string
): Promise<boolean> {
  const pickupTime = new Date(ride.pickup_datetime)
  const timeStr = pickupTime.toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })

  const clientFirst = ride.client_name?.split(' ')[0] || 'there'

  const messages: Record<string, string> = {
    day_before: `Hi ${clientFirst}, reminder: your Timeless Rides pickup is tomorrow at ${timeStr} from ${ride.pickup_address}.\n\nYour driver details will be sent closer to pickup time.\n\nQuestions? Reply to this message or call (248) 940-3262.\n\n- Timeless Rides`,

    '2_hour': `Hi ${clientFirst}, your Timeless Rides pickup is in 2 hours at ${timeStr} from ${ride.pickup_address}.${ride.driver_name ? `\n\nYour driver ${ride.driver_name} will arrive in a ${ride.vehicle_type || 'luxury SUV'}.` : ''}\n\nQuestions? Reply to this message or call (248) 940-3262.\n\n- Timeless Rides`
  }

  const message = messages[reminderType]
  if (!message || !ride.client_contact_id) return false

  try {
    // Send SMS via GHL from Sofia's number
    const ghlRes = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'SMS',
        fromNumber: '+12484407357',
        contactId: ride.client_contact_id,
        message
      })
    })

    const sent = ghlRes.ok

    // Log dispatch event
    await supabase.from('dispatch_events').insert({
      ride_id: ride.id,
      trip_id: ride.trip_id,
      event_type: 'CLIENT_REMINDER_SENT',
      driver_name: ride.driver_name,
      details: { reminder_type: reminderType, sent, client_name: ride.client_name, message_preview: message.substring(0, 80) }
    })

    return sent
  } catch {
    return false
  }
}
