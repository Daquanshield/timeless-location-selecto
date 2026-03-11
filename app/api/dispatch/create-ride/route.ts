import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

// Called by n8n after driver assignment to create a ride record
// Links location_selection → ride with driver info

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-dispatch-secret')
  if (secret !== process.env.DISPATCH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    location_selection_id,
    driver_name,
    driver_phone,
    driver_contact_id,
    driver_email,
    client_name,
    client_phone,
    client_contact_id,
    pickup_datetime,
    pickup_address,
    dropoff_address,
    pickup_zone,
    dropoff_zone,
    vehicle_type,
    service_type,
    flight_number,
    special_instructions,
    total_amount,
    number_of_passengers,
    is_vip
  } = body

  if (!driver_phone || !pickup_datetime || !pickup_address) {
    return NextResponse.json({ error: 'driver_phone, pickup_datetime, and pickup_address are required' }, { status: 400 })
  }

  const supabase = createServerClient()

  // Generate trip ID
  const { data: tripIdResult } = await supabase.rpc('generate_trip_id')
  const trip_id = tripIdResult || `TRP-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`

  // Create ride record
  const { data: ride, error } = await supabase
    .from('rides')
    .insert({
      location_selection_id: location_selection_id || null,
      trip_id,
      status: 'pending',
      confirmation_status: 'unconfirmed',
      driver_name,
      driver_phone,
      driver_contact_id: driver_contact_id || null,
      driver_email: driver_email || null,
      client_name: client_name || null,
      client_phone: client_phone || null,
      client_contact_id: client_contact_id || null,
      pickup_datetime,
      pickup_address,
      dropoff_address: dropoff_address || null,
      pickup_zone: pickup_zone || null,
      dropoff_zone: dropoff_zone || null,
      vehicle_type: vehicle_type || 'EXECUTIVE_SUV',
      service_type: service_type || null,
      flight_number: flight_number || null,
      special_instructions: special_instructions || null,
      total_amount: total_amount || null,
      number_of_passengers: number_of_passengers || 1,
      is_vip: is_vip || false
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create ride:', error)
    return NextResponse.json({ error: 'Failed to create ride', details: error.message }, { status: 500 })
  }

  // Log the assignment event
  await supabase.from('dispatch_events').insert({
    ride_id: ride.id,
    trip_id,
    event_type: 'ASSIGNMENT',
    driver_name,
    driver_phone,
    details: {
      client_name,
      pickup_address,
      pickup_datetime,
      vehicle_type,
      service_type,
      is_vip: is_vip || false
    }
  })

  // Update driver scorecard
  const { data: scorecard } = await supabase
    .from('driver_scorecards')
    .select('total_assignments')
    .eq('driver_phone', driver_phone)
    .single()

  if (scorecard) {
    await supabase.from('driver_scorecards')
      .update({
        total_assignments: (scorecard.total_assignments || 0) + 1,
        last_assignment_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('driver_phone', driver_phone)
  }

  return NextResponse.json({
    success: true,
    ride_id: ride.id,
    trip_id,
    status: ride.status,
    driver_name,
    driver_phone,
    pickup_datetime
  })
}
