import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { rateLimit } from '@/lib/security'
import { sendSMS } from '@/lib/sms'
import type { ClientProfile, VIPTier } from '@/types'

/**
 * Monday check-in endpoint - called by n8n Schedule Trigger every Monday at 9 AM ET.
 * Sends personalized check-in messages to PREFERRED and VIP clients.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify this is called from n8n
    const authHeader = request.headers.get('x-polling-secret')
    const expectedSecret = process.env.CHECKIN_POLLING_SECRET
    if (expectedSecret && authHeader !== expectedSecret) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Get all PREFERRED and VIP clients who haven't been checked in this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: clients, error } = await supabase
      .from('client_profiles')
      .select('*')
      .in('vip_tier', ['PREFERRED', 'VIP'])
      .or(`last_checkin_date.is.null,last_checkin_date.lt.${oneWeekAgo}`)
      .order('vip_tier', { ascending: false }) // VIP first

    if (error) {
      console.error('Check-in query error:', error)
      return NextResponse.json({ success: false, message: 'Database error' }, { status: 500 })
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No clients need check-in this week',
        checked_in: 0,
      })
    }

    let checkedIn = 0
    const results: Array<{ name: string; tier: VIPTier; sent: boolean }> = []

    for (const client of clients as ClientProfile[]) {
      const message = generateCheckinMessage(client)

      // Only send if client prefers SMS or both
      if (client.communication_preference !== 'email') {
        const sent = await sendSMS({
          contactId: client.contact_id,
          phone: client.contact_phone,
          message,
          from: 'sofia',
        })

        if (sent) {
          checkedIn++
          // Update last_checkin_date
          await supabase
            .from('client_profiles')
            .update({ last_checkin_date: new Date().toISOString() })
            .eq('id', client.id)
        }

        results.push({ name: client.contact_name, tier: client.vip_tier, sent })
      }
    }

    return NextResponse.json({
      success: true,
      checked_in: checkedIn,
      total_eligible: clients.length,
      results,
    })
  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

function generateCheckinMessage(client: ClientProfile): string {
  const firstName = client.contact_name.split(' ')[0]

  // Check for upcoming special dates this week
  const now = new Date()
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  let specialDateNote = ''

  if (client.special_dates) {
    for (const [label, dateStr] of Object.entries(client.special_dates)) {
      const date = new Date(dateStr as string)
      // Set to current year for comparison
      date.setFullYear(now.getFullYear())
      if (date >= now && date <= weekFromNow) {
        specialDateNote = `\n\nP.S. We noticed your ${label} is coming up — let us know if we can arrange anything special!`
      }
    }
  }

  if (client.vip_tier === 'VIP') {
    return [
      `Good morning, ${firstName}!`,
      ``,
      `This is Sofia from Timeless Rides checking in. Hope your week is off to a great start.`,
      ``,
      `Do you have any upcoming trips or events this week where we can assist? We're always happy to arrange transportation or make dining recommendations.`,
      specialDateNote,
      ``,
      `Just reply here or call (248) 440-7357 anytime.`,
    ].filter(Boolean).join('\n')
  }

  // PREFERRED tier
  return [
    `Hi ${firstName}!`,
    ``,
    `Sofia from Timeless Rides here. Just wanted to check if you have any transportation needs this week.`,
    ``,
    `We're here whenever you need us — just reply or call (248) 440-7357.`,
    specialDateNote,
  ].filter(Boolean).join('\n')
}
