import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getRoute } from '@/lib/mapbox'
import { detectSofiaZone } from '@/lib/zones'
import { calculatePrice } from '@/lib/pricing'
import { detectServiceType } from '@/lib/service-detection'
import {
  rateLimit,
  isValidToken,
  sanitizeAddress,
  sanitizeCoordinate,
  validateContentType,
  isRequestTooLarge
} from '@/lib/security'
import type { CalculateRouteRequest, CalculateRouteResponse, VehicleClass, ServiceType } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 60 requests per minute per IP (route calc is frequently called)
    const rateLimitResponse = rateLimit(request, 'calculate-route', {
      maxRequests: 60,
      windowMs: 60000
    })
    if (rateLimitResponse) return rateLimitResponse

    // Validate content type
    if (!validateContentType(request)) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      )
    }

    // Check request size
    if (isRequestTooLarge(request.headers.get('content-length'), 50000)) {
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      )
    }

    const body: CalculateRouteRequest = await request.json()
    const {
      token, pickup, dropoff, stops = [],
      // SOFIA v4 fields
      vehicleClass: rawVehicleClass,
      serviceType: rawServiceType,
      estimatedHours,
      dayRateDuration,
      waitTimeTier,
      longDistanceDestination,
      tripDirection,
      // Deprecated fields (backward compat)
      vehicleType,
      rideType
    } = body

    // Validate token format
    if (!isValidToken(token)) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!pickup || !dropoff) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Sanitize and validate coordinates
    const pickupLat = sanitizeCoordinate(pickup.lat, 'lat')
    const pickupLng = sanitizeCoordinate(pickup.lng, 'lng')
    const dropoffLat = sanitizeCoordinate(dropoff.lat, 'lat')
    const dropoffLng = sanitizeCoordinate(dropoff.lng, 'lng')

    if (!pickupLat || !pickupLng || !dropoffLat || !dropoffLng) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      )
    }

    // Sanitize locations
    const sanitizedPickup = {
      ...pickup,
      address: sanitizeAddress(pickup.address),
      lat: pickupLat,
      lng: pickupLng
    }

    const sanitizedDropoff = {
      ...dropoff,
      address: sanitizeAddress(dropoff.address),
      lat: dropoffLat,
      lng: dropoffLng
    }

    // Validate token against database
    const supabase = createServerClient()
    const { data: session, error: sessionError } = await supabase
      .from('location_selections')
      .select('id, status, expires_at')
      .eq('token', token)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      )
    }

    // Sanitize and validate stops (max 2 per SOFIA v4)
    const validStops = stops
      .filter(s => s.lat && s.lng && s.address)
      .slice(0, 2)
      .map(s => ({
        ...s,
        address: sanitizeAddress(s.address),
        lat: sanitizeCoordinate(s.lat, 'lat') || 0,
        lng: sanitizeCoordinate(s.lng, 'lng') || 0
      }))
      .filter(s => s.lat !== 0 && s.lng !== 0)

    // Resolve vehicle class (support old vehicleType field)
    const validVehicleClasses: VehicleClass[] = ['EXECUTIVE_SUV', 'PREMIER_SUV']
    let safeVehicleClass: VehicleClass = 'EXECUTIVE_SUV'
    if (rawVehicleClass && validVehicleClasses.includes(rawVehicleClass)) {
      safeVehicleClass = rawVehicleClass
    } else if (vehicleType === 'luxury_black_suv') {
      safeVehicleClass = 'PREMIER_SUV'
    }

    // Get route from Mapbox
    const route = await getRoute(sanitizedPickup, sanitizedDropoff, validStops)

    if (!route) {
      return NextResponse.json(
        { error: 'Could not calculate route between these locations' },
        { status: 400 }
      )
    }

    // Detect SOFIA v4 zones
    const pickupZone = detectSofiaZone(sanitizedPickup.address, sanitizedPickup.lat, sanitizedPickup.lng)
    const dropoffZone = detectSofiaZone(sanitizedDropoff.address, sanitizedDropoff.lat, sanitizedDropoff.lng)

    // Auto-detect or validate service type
    const detectedServiceType = detectServiceType({
      pickupZone,
      dropoffZone,
      explicitServiceType: rawServiceType,
      numStops: validStops.length
    })

    // Calculate pricing with SOFIA v4 engine
    const pricing = calculatePrice({
      serviceType: detectedServiceType,
      vehicleClass: safeVehicleClass,
      pickupZone,
      dropoffZone,
      numStops: validStops.length,
      estimatedHours,
      dayRateDuration,
      waitTimeTier,
      longDistanceDestination,
      tripDirection
    })

    const response: CalculateRouteResponse = {
      route,
      zones: {
        pickup: pickupZone,
        dropoff: dropoffZone
      },
      pricing,
      detectedServiceType
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Route calculation error:', error)
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    )
  }
}
