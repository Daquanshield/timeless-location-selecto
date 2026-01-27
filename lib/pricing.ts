import type { Zone, VehicleType, RideType, PricingResult } from '@/types'

/**
 * Pricing tiers based on Sofia's configuration
 * From sofia_simplified.json system prompt
 */
const PRICING_TIERS = {
  black_sedan: {
    // Up to 45 minutes
    tier1: { maxMinutes: 45, oneWay: 60, roundTrip: 108 },
    // 45-60 minutes
    tier2: { maxMinutes: 60, oneWay: 80, roundTrip: 144 },
    // Special: Downtown Detroit to DTW
    dtwDowntown: { oneWay: 50, roundTrip: 90 },
    // 60+ minutes: base + per mile
    longDistance: { base: 80, perMile: 2.50 }
  },
  black_suv: {
    tier1: { maxMinutes: 45, oneWay: 100, roundTrip: 180 },
    tier2: { maxMinutes: 60, oneWay: 125, roundTrip: 225 },
    dtwDowntown: { oneWay: 75, roundTrip: 135 },
    longDistance: { base: 125, perMile: 3.50 }
  },
  chauffeur: {
    hourlyRate: 100,
    minimumHours: 2
  }
}

// Round trip multiplier (10% discount from 2x)
const ROUND_TRIP_MULTIPLIER = 1.8

// Per stop surcharge (for wait time)
const STOP_SURCHARGE = 5

interface PricingInput {
  pickupZone: Zone
  dropoffZone: Zone
  durationMinutes: number
  distanceKm: number
  vehicleType: VehicleType
  rideType: RideType
  numStops?: number
}

/**
 * Check if route is DTW-Downtown special pricing
 */
function isDtwDowntownRoute(pickupZone: Zone, dropoffZone: Zone): boolean {
  return (
    (pickupZone === 'airport' && dropoffZone === 'downtown') ||
    (pickupZone === 'downtown' && dropoffZone === 'airport')
  )
}

/**
 * Calculate price based on Sofia's pricing structure
 */
export function calculatePrice(input: PricingInput): PricingResult {
  const { pickupZone, dropoffZone, durationMinutes, distanceKm, vehicleType, rideType, numStops = 0 } = input
  const stopSurcharge = numStops * STOP_SURCHARGE

  // Chauffeur service (hourly)
  if (vehicleType === 'chauffeur' || rideType === 'hourly') {
    const tiers = PRICING_TIERS.chauffeur
    const hours = Math.max(tiers.minimumHours, Math.ceil(durationMinutes / 60))
    const baseTotal = hours * tiers.hourlyRate
    const total = baseTotal + stopSurcharge
    const stopsNote = numStops > 0 ? ` + ${numStops} stop${numStops > 1 ? 's' : ''}` : ''

    return {
      total,
      breakdown: {
        base: baseTotal,
        zoneSurcharge: stopSurcharge,
        total,
        description: `Chauffeur Service - ${hours} hours @ $${tiers.hourlyRate}/hr${stopsNote}`
      }
    }
  }

  const tiers = PRICING_TIERS[vehicleType]
  const isRoundTrip = rideType === 'round_trip'

  // Check for DTW-Downtown special pricing
  if (isDtwDowntownRoute(pickupZone, dropoffZone)) {
    const basePrice = isRoundTrip ? tiers.dtwDowntown.roundTrip : tiers.dtwDowntown.oneWay
    const total = basePrice + stopSurcharge
    const vehicleLabel = vehicleType === 'black_sedan' ? 'Black Sedan' : 'Black SUV'
    const stopsNote = numStops > 0 ? ` + ${numStops} stop${numStops > 1 ? 's' : ''}` : ''

    return {
      total,
      breakdown: {
        base: tiers.dtwDowntown.oneWay,
        zoneSurcharge: stopSurcharge,
        total,
        description: `${vehicleLabel} - DTW ↔ Downtown${isRoundTrip ? ' (Round Trip)' : ''}${stopsNote}`
      }
    }
  }

  // Standard tier pricing based on duration
  let basePrice: number
  let tierDescription: string

  if (durationMinutes <= 45) {
    basePrice = tiers.tier1.oneWay
    tierDescription = 'Up to 45 min'
  } else if (durationMinutes <= 60) {
    basePrice = tiers.tier2.oneWay
    tierDescription = '45-60 min'
  } else {
    // Long distance calculation
    const distanceMiles = distanceKm * 0.621371
    const extraMiles = Math.max(0, distanceMiles - 30) // Over 30 miles
    const extraCharge = extraMiles * tiers.longDistance.perMile
    basePrice = Math.round(tiers.longDistance.base + extraCharge)
    tierDescription = `Long distance (${Math.round(distanceMiles)} mi)`
  }

  // Apply round trip multiplier
  const tripPrice = isRoundTrip ? Math.round(basePrice * ROUND_TRIP_MULTIPLIER) : basePrice
  const total = tripPrice + stopSurcharge
  const vehicleLabel = vehicleType === 'black_sedan' ? 'Black Sedan' : 'Black SUV'
  const stopsNote = numStops > 0 ? ` + ${numStops} stop${numStops > 1 ? 's' : ''}` : ''

  return {
    total,
    breakdown: {
      base: basePrice,
      zoneSurcharge: stopSurcharge,
      total,
      description: `${vehicleLabel} - ${tierDescription}${isRoundTrip ? ' (Round Trip)' : ''}${stopsNote}`
    }
  }
}

/**
 * Format price for display
 */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Get vehicle type display name
 */
export function getVehicleDisplayName(vehicleType: VehicleType): string {
  const names: Record<VehicleType, string> = {
    black_sedan: 'Black Sedan',
    black_suv: 'Black SUV',
    chauffeur: 'Chauffeur Service'
  }
  return names[vehicleType]
}

/**
 * Get ride type display name
 */
export function getRideTypeDisplayName(rideType: RideType): string {
  const names: Record<RideType, string> = {
    one_way: 'One Way',
    round_trip: 'Round Trip',
    hourly: 'Hourly'
  }
  return names[rideType]
}
