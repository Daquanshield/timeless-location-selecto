import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { sendSMS } from '@/lib/sms'
import { checkRateLimit, getClientIp } from '@/lib/security'

const TEMPLATES: Record<string, (ride: Record<string, string | null>) => string> = {
  five_min: () =>
    `Your driver is approximately 5 minutes away. Please be ready. - Timeless Rides`,
  arrived: (ride) =>
    `Your driver has arrived${ride.vehicle_type ? ` — look for the ${ride.vehicle_type}` : ''}. - Timeless Rides`,
  delayed: (ride) =>
    `Your driver is running approximately ${ride.delay_minutes || '10'} minutes behind schedule. We apologize for the inconvenience. - Timeless Rides`,
  custom: (ride) =>
    ride.custom_message || '',
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-notify:${ip}`, { maxRequests: 10, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const template = body.template as string
  const delayMinutes = body.delay_minutes as string | undefined
  const customMessage = body.custom_message as string | undefined

  if (!template || !TEMPLATES[template]) {
    return NextResponse.json({ error: 'Invalid template' }, { status: 400 })
  }

  if (template === 'custom' && !customMessage) {
    return NextResponse.json({ error: 'Custom message required' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: ride } = await supabase
    .from('rides')
    .select('id, client_phone, client_contact_id, vehicle_type, driver_phone')
    .eq('id', params.id)
    .single()

  if (!ride) {
    return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  }

  // Driver can only notify for own rides
  if (auth.user.role === 'driver' && ride.driver_phone !== auth.user.phone) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  if (!ride.client_phone && !ride.client_contact_id) {
    return NextResponse.json({ error: 'No client contact information' }, { status: 400 })
  }

  const message = TEMPLATES[template]({
    vehicle_type: ride.vehicle_type,
    delay_minutes: delayMinutes || '10',
    custom_message: customMessage || '',
  })

  if (!message) {
    return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  }

  const sent = await sendSMS({
    contactId: ride.client_contact_id || undefined,
    phone: ride.client_phone || undefined,
    message,
  })

  if (!sent) {
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'Notification sent' })
}
