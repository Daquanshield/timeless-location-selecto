import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { detectSofiaZone } from '@/lib/zones'
import {
  rateLimit,
  isValidToken,
  sanitizeAddress,
  sanitizeString,
  sanitizeCoordinate,
  validateContentType,
  isRequestTooLarge,
  createWebhookHeaders,
  getClientIp
} from '@/lib/security'
import { getVehicleCapacity, getVehicleDisplayName, getServiceTypeDisplayName, formatPrice } from '@/lib/pricing'
import type {
  SubmitSelectionRequest,
  SubmitSelectionResponse,
  VehicleClass,
  ServiceType,
  DayRateDuration,
  WaitTimeTier,
  LongDistanceDestination,
  TripDirection
} from '@/types'

// GHL appointment creation constants
const GHL_CALENDAR_ID = 'SuCiIaa9kJOjTlwirO74'
const GHL_API_KEY = 'pit-43964b83-eaaf-4d1c-9296-79ca285270d8'
const GHL_LOCATION_ID = '9f8lj2gn9ldOJVzae8bT'

/**
 * Calculate appointment end time based on service type.
 */
function calculateEndTime(startTime: string, serviceType: ServiceType, opts: {
  routeDurationSeconds?: number
  estimatedHours?: number | null
  dayRateDuration?: string | null
}): string {
  const start = new Date(startTime)
  let durationMinutes: number

  switch (serviceType) {
    case 'AIRPORT':
    case 'MULTI_STOP':
      // Route duration + 30min for airport logistics, minimum 90min
      durationMinutes = Math.max(
        Math.ceil((opts.routeDurationSeconds || 3600) / 60) + 30,
        90
      )
      break
    case 'HOURLY':
      durationMinutes = Math.max(opts.estimatedHours || 3, 3) * 60
      break
    case 'DAY_RATE':
      durationMinutes = opts.dayRateDuration === '12hr' ? 720 : 480
      break
    case 'LONG_DISTANCE':
      // Route duration × 2 (round trip) + 60min buffer, minimum 3 hours
      durationMinutes = Math.max(
        Math.ceil((opts.routeDurationSeconds || 7200) / 60) * 2 + 60,
        180
      )
      break
    default:
      durationMinutes = 120
  }

  return new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString()
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 10 requests per minute per IP (submission should be rare)
    const rateLimitResponse = rateLimit(request, 'submit-selection', {
      maxRequests: 10,
      windowMs: 60000
    })
    if (rateLimitResponse) return rateLimitResponse

    // Validate content type
    if (!validateContentType(request)) {
      return NextResponse.json<SubmitSelectionResponse>(
        { success: false, message: 'Invalid request' },
        { status: 400 }
      )
    }

    // Check request size
    if (isRequestTooLarge(request.headers.get('content-length'), 100000)) {
      return NextResponse.json<SubmitSelectionResponse>(
        { success: false, message: 'Request too large' },
        { status: 413 }
      )
    }

    const body: SubmitSelectionRequest = await request.json()
    const {
      token, pickup, dropoff, stops = [], route, pricing,
      // SOFIA v4 fields
      vehicleClass: rawVehicleClass,
      serviceType: rawServiceType,
      estimatedHours,
      dayRateDuration,
      waitTimeTier,
      longDistanceDestination,
      tripDirection,
      passengerCount, scheduledDate, specialInstructions,
      flightNumber,
      departureAirline,
      airportDirection,
      terminal,
      // Deprecated fields (backward compat)
      vehicleType,
      rideType
    } = body

    // Validate token format
    if (!isValidToken(token)) {
      return NextResponse.json<SubmitSelectionResponse>(
        { success: false, message: 'Invalid request' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!pickup || !dropoff || !pricing) {
      return NextResponse.json<SubmitSelectionResponse>(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Sanitize and validate coordinates
    const pickupLat = sanitizeCoordinate(pickup.lat, 'lat')
    const pickupLng = sanitizeCoordinate(pickup.lng, 'lng')
    const dropoffLat = sanitizeCoordinate(dropoff.lat, 'lat')
    const dropoffLng = sanitizeCoordinate(dropoff.lng, 'lng')

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return NextResponse.json<SubmitSelectionResponse>(
        { success: false, message: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    // Sanitize all inputs
    const sanitizedPickup = {
      address: sanitizeAddress(pickup.address),
      placeId: pickup.placeId,
      lat: pickupLat,
      lng: pickupLng
    }

    const sanitizedDropoff = {
      address: sanitizeAddress(dropoff.address),
      placeId: dropoff.placeId,
      lat: dropoffLat,
      lng: dropoffLng
    }

    // Max 2 stops per SOFIA v4 spec
    const sanitizedStops = stops
      .filter(s => s.lat && s.lng && s.address)
      .slice(0, 2)
      .map(s => ({
        address: sanitizeAddress(s.address),
        lat: sanitizeCoordinate(s.lat, 'lat') || 0,
        lng: sanitizeCoordinate(s.lng, 'lng') || 0
      }))
      .filter(s => s.lat !== 0 && s.lng !== 0)

    const sanitizedInstructions = sanitizeString(specialInstructions, 500)
    const sanitizedFlightNumber = flightNumber ? sanitizeString(flightNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase(), 10) : null

    // Resolve vehicle class (support old vehicleType field)
    const validVehicleClasses: VehicleClass[] = ['EXECUTIVE_SUV', 'PREMIER_SUV']
    let safeVehicleClass: VehicleClass = 'EXECUTIVE_SUV'
    if (rawVehicleClass && validVehicleClasses.includes(rawVehicleClass)) {
      safeVehicleClass = rawVehicleClass
    } else if (vehicleType === 'luxury_black_suv') {
      safeVehicleClass = 'PREMIER_SUV'
    }

    // Resolve service type (support old rideType field)
    const validServiceTypes: ServiceType[] = ['AIRPORT', 'HOURLY', 'DAY_RATE', 'LONG_DISTANCE', 'MULTI_STOP']
    let safeServiceType: ServiceType = 'AIRPORT'
    if (rawServiceType && validServiceTypes.includes(rawServiceType)) {
      safeServiceType = rawServiceType
    } else if (rideType === 'hourly') {
      safeServiceType = 'HOURLY'
    }

    // Validate optional SOFIA v4 fields
    const validDayRateDurations: DayRateDuration[] = ['8hr', '12hr']
    const safeDayRateDuration = dayRateDuration && validDayRateDurations.includes(dayRateDuration) ? dayRateDuration : null

    const validWaitTimeTiers: WaitTimeTier[] = ['NONE', 'SHORT', 'DINNER', 'EXTENDED', 'ALL_DAY']
    const safeWaitTimeTier = waitTimeTier && validWaitTimeTiers.includes(waitTimeTier) ? waitTimeTier : 'NONE'

    const validLongDistanceDestinations: LongDistanceDestination[] = [
      'ANN_ARBOR', 'LANSING', 'GRAND_RAPIDS', 'HOLLAND', 'TOLEDO',
      'COLUMBUS', 'CLEVELAND', 'CHICAGO', 'INDIANAPOLIS', 'CINCINNATI'
    ]
    const safeLongDistanceDest = longDistanceDestination && validLongDistanceDestinations.includes(longDistanceDestination) ? longDistanceDestination : null

    const validTripDirections: TripDirection[] = ['one_way', 'round_trip']
    const safeTripDirection = tripDirection && validTripDirections.includes(tripDirection) ? tripDirection : 'one_way'

    const safeEstimatedHours = typeof estimatedHours === 'number' && estimatedHours >= 1 && estimatedHours <= 24 ? estimatedHours : null

    // Validate and sanitize passenger count (capped by vehicle capacity)
    const maxPassengers = getVehicleCapacity(safeVehicleClass)
    const safePassengerCount = Math.min(maxPassengers, Math.max(1, Math.floor(Number(passengerCount) || 1)))

    // Validate pricing (basic sanity check)
    if (typeof pricing.total !== 'number' || pricing.total < 0 || pricing.total > 10000) {
      return NextResponse.json<SubmitSelectionResponse>(
        { success: false, message: 'Invalid pricing data' },
        { status: 400 }
      )
    }

    const supabase = createServerClient()

    // Validate and get the session
    const { data: session, error: sessionError } = await supabase
      .from('location_selections')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !session) {
      return NextResponse.json<SubmitSelectionResponse>(
        { success: false, message: 'Session expired. Please request a new link.' },
        { status: 401 }
      )
    }

    // Detect SOFIA v4 zones
    const pickupZone = detectSofiaZone(sanitizedPickup.address, sanitizedPickup.lat, sanitizedPickup.lng)
    const dropoffZone = detectSofiaZone(sanitizedDropoff.address, sanitizedDropoff.lat, sanitizedDropoff.lng)

    // Get client IP safely
    const clientIp = getClientIp(request)

    // Update the location_selections record
    const { error: updateError } = await supabase
      .from('location_selections')
      .update({
        pickup_address: sanitizedPickup.address,
        pickup_place_id: sanitizedPickup.placeId,
        pickup_lat: sanitizedPickup.lat,
        pickup_lng: sanitizedPickup.lng,
        pickup_zone: pickupZone,
        dropoff_address: sanitizedDropoff.address,
        dropoff_place_id: sanitizedDropoff.placeId,
        dropoff_lat: sanitizedDropoff.lat,
        dropoff_lng: sanitizedDropoff.lng,
        dropoff_zone: dropoffZone,
        distance_meters: route?.distanceMeters ? Math.round(route.distanceMeters) : null,
        distance_text: route?.distanceText,
        duration_seconds: route?.durationSeconds ? Math.round(route.durationSeconds) : null,
        duration_text: route?.durationText,
        route_polyline: route?.polyline,
        stops: sanitizedStops.length > 0 ? sanitizedStops : null,
        estimated_price: Math.round(pricing.total),
        price_breakdown: pricing.breakdown,
        // SOFIA v4 fields
        vehicle_class: safeVehicleClass,
        service_type: safeServiceType,
        fare_cents: pricing.fareCents || Math.round(pricing.total * 100),
        estimated_hours: safeEstimatedHours,
        day_rate_duration: safeDayRateDuration,
        wait_time_tier: safeWaitTimeTier !== 'NONE' ? safeWaitTimeTier : null,
        long_distance_destination: safeLongDistanceDest,
        trip_direction: safeServiceType === 'LONG_DISTANCE' ? safeTripDirection : null,
        // Legacy fields (backward compat)
        vehicle_type: vehicleType || (safeVehicleClass === 'PREMIER_SUV' ? 'luxury_black_suv' : 'black_suv'),
        ride_type: rideType || (safeServiceType === 'HOURLY' ? 'hourly' : 'one_way'),
        passenger_count: safePassengerCount,
        scheduled_date: scheduledDate || null,
        special_instructions: sanitizedInstructions || null,
        flight_number: sanitizedFlightNumber || null,
        departure_airline: departureAirline || null,
        airport_direction: airportDirection || null,
        terminal: terminal || null,
        status: 'selected',
        completed_at: new Date().toISOString(),
        user_agent: request.headers.get('user-agent')?.slice(0, 500),
        ip_address: clientIp !== 'unknown' ? clientIp : null
      })
      .eq('token', token)

    if (updateError) {
      console.error('Failed to update selection:', updateError)
      return NextResponse.json<SubmitSelectionResponse>(
        { success: false, message: 'Failed to save. Please try again.' },
        { status: 500 }
      )
    }

    // Create GHL appointment as UNCONFIRMED (payment not yet collected)
    let ghlAppointmentId: string | null = null
    if (scheduledDate && session.contact_id) {
      try {
        const appointmentEndTime = calculateEndTime(scheduledDate, safeServiceType, {
          routeDurationSeconds: route?.durationSeconds,
          estimatedHours: safeEstimatedHours,
          dayRateDuration: safeDayRateDuration
        })

        // Build descriptive title and notes
        const vehicleLabel = getVehicleDisplayName(safeVehicleClass)
        const serviceLabel = getServiceTypeDisplayName(safeServiceType)
        const priceLabel = formatPrice(pricing.total)
        const appointmentTitle = `${serviceLabel} — ${vehicleLabel} — ${priceLabel} (UNCONFIRMED)`

        const noteLines = [
          `Service: ${serviceLabel}`,
          `Vehicle: ${vehicleLabel}`,
          `Passengers: ${safePassengerCount}`,
          `Price: ${priceLabel}`,
          `Status: UNCONFIRMED — Awaiting Payment`,
          '',
          `Pickup: ${sanitizedPickup.address}`,
          `Dropoff: ${sanitizedDropoff.address}`,
          ...(sanitizedStops.length > 0 ? sanitizedStops.map((s, i) => `Stop ${i + 1}: ${s.address}`) : []),
          ...(route ? [`Distance: ${route.distanceText}`, `ETA: ${route.durationText}`] : []),
          ...(safeLongDistanceDest ? [`Destination: ${safeLongDistanceDest}`] : []),
          ...(safeTripDirection !== 'one_way' && safeServiceType === 'LONG_DISTANCE' ? [`Direction: Round Trip`] : []),
          ...(safeWaitTimeTier !== 'NONE' && safeServiceType === 'LONG_DISTANCE' ? [`Wait Time: ${safeWaitTimeTier}`] : []),
          ...(sanitizedFlightNumber ? [`Flight: ${sanitizedFlightNumber}`] : []),
          ...(sanitizedInstructions ? [`\nSpecial Instructions: ${sanitizedInstructions}`] : []),
          '',
          `[DROPOFF_COORDS]${sanitizedDropoff.lat},${sanitizedDropoff.lng}[/DROPOFF_COORDS]`,
          `[PICKUP_ZONE]${pickupZone}[/PICKUP_ZONE]`,
          `[DROPOFF_ZONE]${dropoffZone}[/DROPOFF_ZONE]`
        ]

        const ghlResponse = await fetch('https://services.leadconnectorhq.com/calendars/events/appointments', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Version': '2021-04-15'
          },
          body: JSON.stringify({
            calendarId: GHL_CALENDAR_ID,
            locationId: GHL_LOCATION_ID,
            contactId: session.contact_id,
            startTime: scheduledDate,
            endTime: appointmentEndTime,
            title: appointmentTitle,
            appointmentStatus: 'new',
            address: sanitizedPickup.address,
            notes: noteLines.join('\n')
          })
        })

        if (ghlResponse.ok) {
          const ghlData = await ghlResponse.json()
          ghlAppointmentId = ghlData.id || ghlData.appointmentId || null
          console.log(`GHL appointment created (unconfirmed): ${ghlAppointmentId}`)

          // Store appointment ID back in Supabase
          if (ghlAppointmentId) {
            await supabase
              .from('location_selections')
              .update({ ghl_appointment_id: ghlAppointmentId })
              .eq('token', token)
          }
        } else {
          const errText = await ghlResponse.text()
          console.error(`GHL appointment creation failed: ${ghlResponse.status}`, errText)
        }
      } catch (err) {
        console.error('Failed to create GHL appointment:', err)
        // Don't fail the submission — appointment can be created manually
      }
    } else {
      if (!scheduledDate) console.log('No scheduled date — skipping GHL appointment creation')
      if (!session.contact_id) console.log('No contact_id — skipping GHL appointment creation')
    }

    // Send webhook to n8n with HMAC signature
    // IMPORTANT: Must await this call - Vercel serverless functions terminate after response,
    // killing any pending fire-and-forget requests
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET
    if (webhookUrl && webhookSecret) {
      const webhookPayload = JSON.stringify({
        event: 'location_selected',
        session_id: session.id,
        token,
        contact_phone: session.contact_phone,
        contact_name: session.contact_name,
        contact_id: session.contact_id,
        conversation_id: session.conversation_id,
        pickup: {
          address: sanitizedPickup.address,
          lat: sanitizedPickup.lat,
          lng: sanitizedPickup.lng,
          zone: pickupZone
        },
        dropoff: {
          address: sanitizedDropoff.address,
          lat: sanitizedDropoff.lat,
          lng: sanitizedDropoff.lng,
          zone: dropoffZone
        },
        stops: sanitizedStops,
        route: route ? {
          distance_meters: route.distanceMeters,
          distance_text: route.distanceText,
          duration_seconds: route.durationSeconds,
          duration_text: route.durationText
        } : null,
        // SOFIA v4 pricing fields
        pricing: {
          total: pricing.total,
          fare_cents: pricing.fareCents || Math.round(pricing.total * 100),
          breakdown: {
            base: pricing.breakdown.base,
            stop_surcharge: pricing.breakdown.stopSurcharge,
            wait_time_surcharge: pricing.breakdown.waitTimeSurcharge,
            description: pricing.breakdown.description
          }
        },
        // SOFIA v4 booking fields
        vehicle_class: safeVehicleClass,
        service_type: safeServiceType,
        passenger_count: safePassengerCount,
        estimated_hours: safeEstimatedHours,
        day_rate_duration: safeDayRateDuration,
        wait_time_tier: safeWaitTimeTier,
        long_distance_destination: safeLongDistanceDest,
        trip_direction: safeTripDirection,
        scheduled_date: scheduledDate || null,
        special_instructions: sanitizedInstructions || null,
        flight_number: sanitizedFlightNumber || null,
        departure_airline: departureAirline || null,
        airport_direction: airportDirection || null,
        terminal: terminal || null,
        ghl_appointment_id: ghlAppointmentId,
        timestamp: new Date().toISOString()
      })

      // Create signed headers
      const webhookHeaders = createWebhookHeaders(webhookPayload, webhookSecret)

      try {
        const webhookResponse = await fetch(webhookUrl, {
          method: 'POST',
          headers: webhookHeaders,
          body: webhookPayload
        })
        console.log(`Webhook sent to n8n: ${webhookResponse.status} ${webhookResponse.statusText}`)
      } catch (err) {
        console.error('Failed to send webhook to n8n:', err)
      }
    } else {
      console.error('Webhook not sent: N8N_WEBHOOK_URL or N8N_WEBHOOK_SECRET not configured')
    }

    // Auto-register flight tracking if flight number provided
    if (sanitizedFlightNumber && session.contact_id && scheduledDate) {
      try {
        const flightDate = new Date(scheduledDate).toISOString().split('T')[0]
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_VERCEL_URL
            ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
            : 'http://localhost:3000'
        await fetch(`${baseUrl}/api/flights/track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_id: session.contact_id,
            contact_phone: session.contact_phone,
            flight_number: sanitizedFlightNumber,
            flight_date: flightDate,
            ride_id: session.id,
          })
        })
        console.log(`Flight tracking registered for ${sanitizedFlightNumber}`)
      } catch (err) {
        console.error('Failed to register flight tracking:', err)
      }
    }

    return NextResponse.json<SubmitSelectionResponse>({
      success: true,
      message: 'Locations saved! Sofia will continue your booking.',
      redirect: '/confirmed'
    })
  } catch (error) {
    console.error('Submit selection error:', error)
    return NextResponse.json<SubmitSelectionResponse>(
      { success: false, message: 'An error occurred. Please try again.' },
      { status: 500 }
    )
  }
}
