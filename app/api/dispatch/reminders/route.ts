import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Called by n8n every 10 minutes to send driver reminders
// Evening-before (6-9 PM night before), 1-hour before, 30-min before

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-dispatch-secret')
  if (secret !== process.env.DISPATCH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerClient()
  const now = new Date()
  const results: Array<{ ride_id: string; trip_id: string; reminder_type: string; driver_name: string; sent: boolean }> = []

  // Get all confirmed/pending rides with drivers assigned that aren't completed/cancelled
  const { data: rides } = await supabase
    .from('rides')
    .select('id, trip_id, status, pickup_datetime, driver_name, driver_phone, driver_contact_id, client_name, pickup_address, dropoff_address, vehicle_type, service_type, reminder_evening_sent, reminder_1hr_sent, reminder_30min_sent')
    .in('status', ['pending', 'confirmed'])
    .not('driver_phone', 'is', null)

  if (!rides || rides.length === 0) {
    return NextResponse.json({ checked: 0, reminders_sent: 0, results: [] })
  }

  for (const ride of rides) {
    const pickupTime = new Date(ride.pickup_datetime)
    const hoursUntil = (pickupTime.getTime() - now.getTime()) / (1000 * 60 * 60)
    const minutesUntil = hoursUntil * 60

    // Evening-before reminder: 6-9 PM the night before (12-24 hours before)
    if (!ride.reminder_evening_sent && hoursUntil > 10 && hoursUntil <= 24) {
      const nowDetroit = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }))
      const hour = nowDetroit.getHours()
      if (hour >= 18 && hour < 21) {
        const sent = await sendDriverReminder(supabase, ride, 'evening_before')
        if (sent) {
          await supabase.from('rides').update({ reminder_evening_sent: true }).eq('id', ride.id)
          results.push({ ride_id: ride.id, trip_id: ride.trip_id, reminder_type: 'evening_before', driver_name: ride.driver_name, sent: true })
        }
      }
    }

    // 1-hour reminder: 50-70 minutes before
    if (!ride.reminder_1hr_sent && minutesUntil > 50 && minutesUntil <= 70) {
      const sent = await sendDriverReminder(supabase, ride, '1_hour')
      if (sent) {
        await supabase.from('rides').update({ reminder_1hr_sent: true }).eq('id', ride.id)
        results.push({ ride_id: ride.id, trip_id: ride.trip_id, reminder_type: '1_hour', driver_name: ride.driver_name, sent: true })
      }
    }

    // 30-min reminder: 25-35 minutes before
    if (!ride.reminder_30min_sent && minutesUntil > 25 && minutesUntil <= 35) {
      const sent = await sendDriverReminder(supabase, ride, '30_min')
      if (sent) {
        await supabase.from('rides').update({ reminder_30min_sent: true }).eq('id', ride.id)
        results.push({ ride_id: ride.id, trip_id: ride.trip_id, reminder_type: '30_min', driver_name: ride.driver_name, sent: true })
      }
    }
  }

  return NextResponse.json({
    checked: rides.length,
    reminders_sent: results.length,
    results
  })
}

async function sendDriverReminder(
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

  const messages: Record<string, string> = {
    evening_before: `🚗 Reminder: You have a ride tomorrow.\n\n${ride.trip_id}\n📍 Pickup: ${ride.pickup_address}\n📍 Dropoff: ${ride.dropoff_address}\n🕐 ${timeStr}\n👤 ${ride.client_name?.split(' ')[0] || 'Guest'}\n🚘 ${ride.vehicle_type || 'SUV'}\n\nPlease confirm you're available by replying YES.`,

    '1_hour': `⏰ 1 HOUR until pickup.\n\n${ride.trip_id}\n📍 ${ride.pickup_address}\n🕐 ${timeStr}\n👤 ${ride.client_name?.split(' ')[0] || 'Guest'}\n\nPlease start heading to the pickup location.`,

    '30_min': `🔴 30 MINUTES until pickup!\n\n${ride.trip_id}\n📍 ${ride.pickup_address}\n🕐 ${timeStr}\n\nYou should be en route now. Update your status when you arrive.`
  }

  const message = messages[reminderType]
  if (!message || !ride.driver_contact_id) return false

  try {
    // Send SMS via GHL
    const ghlRes = await fetch('https://services.leadconnectorhq.com/conversations/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
        'Version': '2021-04-15',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'SMS',
        contactId: ride.driver_contact_id,
        message
      })
    })

    const sent = ghlRes.ok

    // Log dispatch event
    await supabase.from('dispatch_events').insert({
      ride_id: ride.id,
      trip_id: ride.trip_id,
      event_type: 'REMINDER_SENT',
      driver_name: ride.driver_name,
      driver_phone: ride.driver_phone,
      details: { reminder_type: reminderType, sent, message_preview: message.substring(0, 80) }
    })

    return sent
  } catch {
    return false
  }
}
