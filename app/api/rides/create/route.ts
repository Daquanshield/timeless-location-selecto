import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { validateApiKey } from '@/lib/api-auth'
import { checkRateLimit, getClientIp, sanitizeString, sanitizeAddress } from '@/lib/security'

function generateTripId(): string {
  const year = new Date().getFullYear()
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, '0')
  return `TRP-${year}-${seq}`
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`rides-create:${ip}`, { maxRequests: 20, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // Auth: API key (SOFIA/n8n) OR session cookie (dispatcher)
  const hasApiKey = validateApiKey(request)
  let isDispatcher = false

  if (!hasApiKey) {
    const auth = await getSessionUser(request)
    if (!auth || auth.user.role !== 'dispatcher') {
      return NextResponse.json({ error: 'Unauthorized. Provide X-API-Key or dispatcher session.' }, { status: 401 })
    }
    isDispatcher = true
  }

  const body = await request.json()

  // Required fields
  const clientName = sanitizeString(body.client_name || '').trim()
  const clientPhone = sanitizeString(body.client_phone || '').trim()
  const pickupAddress = sanitizeAddress(body.pickup_address || '').trim()
  const dropoffAddress = sanitizeAddress(body.dropoff_address || '').trim()
  const pickupDatetime = body.pickup_datetime

  if (!clientName || !pickupAddress || !dropoffAddress || !pickupDatetime) {
    return NextResponse.json(
      { error: 'Missing required fields: client_name, pickup_address, dropoff_address, pickup_datetime' },
      { status: 400 }
    )
  }

  // Validate datetime format
  const dt = new Date(pickupDatetime)
  if (isNaN(dt.getTime())) {
    return NextResponse.json({ error: 'Invalid pickup_datetime format. Use ISO 8601.' }, { status: 400 })
  }

  // Optional fields
  const clientEmail = sanitizeString(body.client_email || '').trim().toLowerCase() || null
  const serviceType = sanitizeString(body.service_type || '').trim() || null
  const vehicleClass = sanitizeString(body.vehicle_class || '').trim() || null
  const passengers = body.number_of_passengers ? parseInt(body.number_of_passengers) : null
  const notes = sanitizeString(body.special_instructions || body.notes || '').trim() || null
  const totalAmount = body.quoted_price ? parseFloat(body.quoted_price) : null
  const paymentStatus = sanitizeString(body.payment_status || '').trim() || 'unpaid'
  const pickupZone = sanitizeString(body.pickup_zone || '').trim() || null
  const dropoffZone = sanitizeString(body.dropoff_zone || '').trim() || null
  const distance = sanitizeString(body.distance || '').trim() || null
  const duration = sanitizeString(body.duration || '').trim() || null
  const clientContactId = sanitizeString(body.client_contact_id || '').trim() || null

  // Normalize phone
  let normalizedPhone = clientPhone
  if (normalizedPhone) {
    const digits = normalizedPhone.replace(/\D/g, '')
    if (digits.length === 10) normalizedPhone = `+1${digits}`
    else if (digits.length === 11 && digits[0] === '1') normalizedPhone = `+${digits}`
  }

  const tripId = generateTripId()

  const supabase = createServerClient()

  const { data: ride, error } = await supabase
    .from('rides')
    .insert({
      trip_id: tripId,
      client_name: clientName,
      client_phone: normalizedPhone || null,
      client_email: clientEmail,
      client_contact_id: clientContactId,
      pickup_datetime: dt.toISOString(),
      pickup_address: pickupAddress,
      dropoff_address: dropoffAddress,
      pickup_zone: pickupZone,
      dropoff_zone: dropoffZone,
      service_class: vehicleClass,
      vehicle_type: vehicleClass,
      service_option: serviceType,
      number_of_passengers: passengers,
      total_amount: totalAmount,
      payment_status: paymentStatus,
      status: 'pending',
      confirmation_status: 'unconfirmed',
      notes,
      distance,
      duration,
    })
    .select('id, trip_id, status')
    .single()

  if (error) {
    console.error('Failed to create ride:', error)
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Duplicate trip ID, please retry' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Failed to create ride' }, { status: 500 })
  }

  return NextResponse.json({ ride }, { status: 201 })
}
