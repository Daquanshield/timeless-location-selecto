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
import { getVehicleCapacity } from '@/lib/pricing'
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
