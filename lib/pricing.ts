import type {
  SofiaZone,
  VehicleClass,
  ServiceType,
  DayRateDuration,
  WaitTimeTier,
  LongDistanceDestination,
  TripDirection,
  PricingResult,
  PriceBreakdown,
  VehicleType,
  RideType,
  Zone
} from '@/types'

// ============================================================
// SOFIA v4.0 Pricing Engine
// ============================================================

// --- Airport Transfer Rates (flat rate by zone) ---

type AirportZone = Exclude<SofiaZone, 'AIRPORT' | 'OUT_OF_AREA'>

const AIRPORT_RATES: Record<AirportZone, Record<VehicleClass, number>> = {
  DOWNTOWN:  { EXECUTIVE_SUV: 95,  PREMIER_SUV: 120 },
  WEST:      { EXECUTIVE_SUV: 110, PREMIER_SUV: 135 },
  NORTH:     { EXECUTIVE_SUV: 125, PREMIER_SUV: 150 },
  EAST:      { EXECUTIVE_SUV: 125, PREMIER_SUV: 150 },
  NORTHEAST: { EXECUTIVE_SUV: 140, PREMIER_SUV: 175 },
}

// --- Hourly Rates ---

const HOURLY_RATES: Record<VehicleClass, number> = {
  EXECUTIVE_SUV: 85,
  PREMIER_SUV: 110
}

const HOURLY_MINIMUM = 3 // hours

// --- Day Rates ---

const DAY_RATES: Record<DayRateDuration, Record<VehicleClass, number>> = {
  '8hr':  { EXECUTIVE_SUV: 600,  PREMIER_SUV: 800 },
  '12hr': { EXECUTIVE_SUV: 850,  PREMIER_SUV: 1100 },
}

const FUEL_INCLUDED_MILES = 150
const FUEL_OVERAGE_PER_MILE = 0.50

// --- Long Distance Rates ---

const LONG_DISTANCE_RATES: Record<LongDistanceDestination, {
  distance: number
  oneWay: Record<VehicleClass, number>
  roundTrip: Record<VehicleClass, number>
}> = {
  ANN_ARBOR:     { distance: 45,  oneWay: { EXECUTIVE_SUV: 125, PREMIER_SUV: 150 }, roundTrip: { EXECUTIVE_SUV: 225, PREMIER_SUV: 275 } },
  LANSING:       { distance: 90,  oneWay: { EXECUTIVE_SUV: 275, PREMIER_SUV: 350 }, roundTrip: { EXECUTIVE_SUV: 500, PREMIER_SUV: 650 } },
  GRAND_RAPIDS:  { distance: 150, oneWay: { EXECUTIVE_SUV: 400, PREMIER_SUV: 500 }, roundTrip: { EXECUTIVE_SUV: 725, PREMIER_SUV: 900 } },
  HOLLAND:       { distance: 180, oneWay: { EXECUTIVE_SUV: 450, PREMIER_SUV: 550 }, roundTrip: { EXECUTIVE_SUV: 800, PREMIER_SUV: 1000 } },
  TOLEDO:        { distance: 60,  oneWay: { EXECUTIVE_SUV: 175, PREMIER_SUV: 225 }, roundTrip: { EXECUTIVE_SUV: 325, PREMIER_SUV: 400 } },
  COLUMBUS:      { distance: 200, oneWay: { EXECUTIVE_SUV: 500, PREMIER_SUV: 600 }, roundTrip: { EXECUTIVE_SUV: 900, PREMIER_SUV: 1100 } },
  CLEVELAND:     { distance: 170, oneWay: { EXECUTIVE_SUV: 400, PREMIER_SUV: 500 }, roundTrip: { EXECUTIVE_SUV: 725, PREMIER_SUV: 900 } },
  CHICAGO:       { distance: 280, oneWay: { EXECUTIVE_SUV: 700, PREMIER_SUV: 875 }, roundTrip: { EXECUTIVE_SUV: 1250, PREMIER_SUV: 1550 } },
  INDIANAPOLIS:  { distance: 280, oneWay: { EXECUTIVE_SUV: 700, PREMIER_SUV: 875 }, roundTrip: { EXECUTIVE_SUV: 1250, PREMIER_SUV: 1550 } },
  CINCINNATI:    { distance: 270, oneWay: { EXECUTIVE_SUV: 650, PREMIER_SUV: 800 }, roundTrip: { EXECUTIVE_SUV: 1150, PREMIER_SUV: 1400 } },
}

// --- Wait Time Rates (Long Distance add-on) ---

const WAIT_TIME_RATES: Record<Exclude<WaitTimeTier, 'NONE' | 'ALL_DAY'>, Record<VehicleClass, number>> = {
  SHORT:    { EXECUTIVE_SUV: 50,  PREMIER_SUV: 65 },
  DINNER:   { EXECUTIVE_SUV: 125, PREMIER_SUV: 175 },
  EXTENDED: { EXECUTIVE_SUV: 225, PREMIER_SUV: 300 },
}

// --- Multi-Stop ---

const MULTI_STOP_SURCHARGE = 15 // $15 per additional stop
const MAX_MULTI_STOPS = 2

// ============================================================
// Pricing Input
// ============================================================

export interface PricingInput {
  serviceType: ServiceType
  vehicleClass: VehicleClass
  pickupZone: SofiaZone
  dropoffZone: SofiaZone
  numStops?: number
  estimatedHours?: number
  dayRateDuration?: DayRateDuration
  longDistanceDestination?: LongDistanceDestination
  tripDirection?: TripDirection
  waitTimeTier?: WaitTimeTier
  overtimeMinutes?: number
  totalMiles?: number
}

// ============================================================
// Main Pricing Function
// ============================================================

export function calculatePrice(input: PricingInput): PricingResult {
  switch (input.serviceType) {
    case 'AIRPORT':
      return calculateAirportPrice(input)
    case 'HOURLY':
      return calculateHourlyPrice(input)
    case 'DAY_RATE':
      return calculateDayRatePrice(input)
    case 'LONG_DISTANCE':
      return calculateLongDistancePrice(input)
    case 'MULTI_STOP':
      return calculateMultiStopPrice(input)
    default:
      return calculateHourlyPrice(input)
  }
}

// ============================================================
// Service-Specific Calculators
// ============================================================

function calculateAirportPrice(input: PricingInput): PricingResult {
  const { vehicleClass, pickupZone, dropoffZone } = input

  // Determine which zone is non-airport (the client's zone)
  const clientZone = pickupZone === 'AIRPORT' ? dropoffZone : pickupZone

  // If both zones are AIRPORT or client zone is OUT_OF_AREA, fallback
  if (clientZone === 'AIRPORT' || clientZone === 'OUT_OF_AREA') {
    // Edge case: airport-to-airport or OUT_OF_AREA airport transfer
    // Use DOWNTOWN rate as default
    const base = AIRPORT_RATES.DOWNTOWN[vehicleClass]
    return buildResult(base, 0, 0, `Airport Transfer (${getVehicleDisplayName(vehicleClass)})`)
  }

  const base = AIRPORT_RATES[clientZone][vehicleClass]
  const zoneName = getZoneLabel(clientZone)
  return buildResult(base, 0, 0, `Airport Transfer — ${zoneName} (${getVehicleDisplayName(vehicleClass)})`)
}

function calculateHourlyPrice(input: PricingInput): PricingResult {
  const { vehicleClass, estimatedHours = HOURLY_MINIMUM } = input
  const hours = Math.max(estimatedHours, HOURLY_MINIMUM)
  const rate = HOURLY_RATES[vehicleClass]
  const base = rate * hours

  return buildResult(base, 0, 0, `Hourly Service — ${hours}hr × $${rate}/hr (${getVehicleDisplayName(vehicleClass)})`)
}

function calculateDayRatePrice(input: PricingInput): PricingResult {
  const { vehicleClass, dayRateDuration = '8hr', overtimeMinutes = 0, totalMiles = 0 } = input
  const base = DAY_RATES[dayRateDuration][vehicleClass]

  // Overtime in 30-min increments at hourly rate
  let overtime = 0
  if (overtimeMinutes > 0) {
    const blocks = Math.ceil(overtimeMinutes / 30)
    overtime = blocks * (HOURLY_RATES[vehicleClass] / 2) // half-hour rate
  }

  // Fuel surcharge beyond included miles
  let fuel = 0
  if (totalMiles > FUEL_INCLUDED_MILES) {
    fuel = Math.round((totalMiles - FUEL_INCLUDED_MILES) * FUEL_OVERAGE_PER_MILE)
  }

  const total = base + overtime + fuel
  const durationLabel = dayRateDuration === '8hr' ? '8-Hour Day' : '12-Hour Day'
  let desc = `${durationLabel} Rate (${getVehicleDisplayName(vehicleClass)})`
  if (overtime > 0) desc += ` + $${overtime} overtime`
  if (fuel > 0) desc += ` + $${fuel} fuel surcharge`

  return {
    total,
    fareCents: total * 100,
    breakdown: {
      base,
      stopSurcharge: 0,
      waitTimeSurcharge: overtime + fuel,
      total,
      description: desc
    }
  }
}

function calculateLongDistancePrice(input: PricingInput): PricingResult {
  const {
    vehicleClass,
    longDistanceDestination,
    tripDirection = 'one_way',
    waitTimeTier = 'NONE'
  } = input

  if (!longDistanceDestination || !LONG_DISTANCE_RATES[longDistanceDestination]) {
    // Unknown destination — return a placeholder
    return buildResult(0, 0, 0, 'Long Distance — Select destination for quote')
  }

  const destRates = LONG_DISTANCE_RATES[longDistanceDestination]
  const base = tripDirection === 'round_trip'
    ? destRates.roundTrip[vehicleClass]
    : destRates.oneWay[vehicleClass]

  // Wait time add-on
  let waitCharge = 0
  if (waitTimeTier === 'ALL_DAY') {
    // Convert to day rate
    const dayRate = DAY_RATES['8hr'][vehicleClass]
    return buildResult(dayRate, 0, 0,
      `Long Distance — ${getDestinationLabel(longDistanceDestination)} (converted to Day Rate, ${getVehicleDisplayName(vehicleClass)})`)
  }
  if (waitTimeTier !== 'NONE') {
    waitCharge = WAIT_TIME_RATES[waitTimeTier][vehicleClass]
  }

  const total = base + waitCharge
  const tripLabel = tripDirection === 'round_trip' ? 'Round Trip' : 'One Way'
  const destLabel = getDestinationLabel(longDistanceDestination)
  let desc = `Long Distance — ${destLabel} ${tripLabel} (${getVehicleDisplayName(vehicleClass)})`
  if (waitCharge > 0) {
    desc += ` + ${getWaitTimeLabel(waitTimeTier)} wait`
  }

  return {
    total,
    fareCents: total * 100,
    breakdown: {
      base,
      stopSurcharge: 0,
      waitTimeSurcharge: waitCharge,
      total,
      description: desc
    }
  }
}

function calculateMultiStopPrice(input: PricingInput): PricingResult {
  const { vehicleClass, pickupZone, dropoffZone, numStops = 0 } = input

  // Base is the airport transfer rate
  const clientZone = pickupZone === 'AIRPORT' ? dropoffZone : pickupZone
  const safeZone: AirportZone = (clientZone === 'AIRPORT' || clientZone === 'OUT_OF_AREA') ? 'DOWNTOWN' : clientZone
  const base = AIRPORT_RATES[safeZone][vehicleClass]

  const stops = Math.min(numStops, MAX_MULTI_STOPS)
  const stopSurcharge = stops * MULTI_STOP_SURCHARGE
  const total = base + stopSurcharge

  const zoneName = getZoneLabel(safeZone)
  const stopsNote = stops > 0 ? ` + ${stops} stop${stops > 1 ? 's' : ''}` : ''
  return {
    total,
    fareCents: total * 100,
    breakdown: {
      base,
      stopSurcharge,
      waitTimeSurcharge: 0,
      total,
      description: `Airport Transfer — ${zoneName}${stopsNote} (${getVehicleDisplayName(vehicleClass)})`
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function buildResult(base: number, stopSurcharge: number, waitTimeSurcharge: number, description: string): PricingResult {
  const total = base + stopSurcharge + waitTimeSurcharge
  return {
    total,
    fareCents: total * 100,
    breakdown: { base, stopSurcharge, waitTimeSurcharge, total, description }
  }
}

function getZoneLabel(zone: SofiaZone): string {
  const labels: Record<SofiaZone, string> = {
    DOWNTOWN: 'Downtown', WEST: 'West', NORTH: 'North',
    EAST: 'East', NORTHEAST: 'Northeast',
    AIRPORT: 'Airport', OUT_OF_AREA: 'Out of Area'
  }
  return labels[zone]
}

function getDestinationLabel(dest: LongDistanceDestination): string {
  const labels: Record<LongDistanceDestination, string> = {
    ANN_ARBOR: 'Ann Arbor', LANSING: 'Lansing', GRAND_RAPIDS: 'Grand Rapids',
    HOLLAND: 'Holland, MI', TOLEDO: 'Toledo, OH', COLUMBUS: 'Columbus, OH',
    CLEVELAND: 'Cleveland, OH', CHICAGO: 'Chicago, IL',
    INDIANAPOLIS: 'Indianapolis, IN', CINCINNATI: 'Cincinnati, OH'
  }
  return labels[dest]
}

function getWaitTimeLabel(tier: WaitTimeTier): string {
  const labels: Record<WaitTimeTier, string> = {
    NONE: '', SHORT: 'short (≤1hr)', DINNER: 'dinner (1-3hr)',
    EXTENDED: 'extended (3-6hr)', ALL_DAY: 'all-day'
  }
  return labels[tier]
}

// ============================================================
// Display Helpers
// ============================================================

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export function getVehicleDisplayName(vehicleClass: VehicleClass): string {
  const names: Record<VehicleClass, string> = {
    EXECUTIVE_SUV: 'Executive SUV',
    PREMIER_SUV: 'Premier SUV'
  }
  return names[vehicleClass]
}

export function getServiceTypeDisplayName(serviceType: ServiceType): string {
  const names: Record<ServiceType, string> = {
    AIRPORT: 'Airport Transfer',
    HOURLY: 'Hourly Service',
    DAY_RATE: 'Day Rate',
    LONG_DISTANCE: 'Long Distance',
    MULTI_STOP: 'Airport + Stops'
  }
  return names[serviceType]
}

export function getVehicleCapacity(vehicleClass: VehicleClass): number {
  return vehicleClass === 'PREMIER_SUV' ? 6 : 4
}

// Export rate tables for UI components that need them
export { AIRPORT_RATES, HOURLY_RATES, DAY_RATES, LONG_DISTANCE_RATES, WAIT_TIME_RATES }
export { HOURLY_MINIMUM, MAX_MULTI_STOPS, MULTI_STOP_SURCHARGE }

// ============================================================
// DEPRECATED — backward compatibility
// ============================================================

/** @deprecated Use VehicleClass-based getVehicleDisplayName */
export function getVehicleDisplayNameLegacy(vehicleType: VehicleType): string {
  const names: Record<VehicleType, string> = {
    black_suv: 'Black SUV',
    luxury_black_suv: 'Luxury Black SUV',
    chauffeur: 'Chauffeur Service'
  }
  return names[vehicleType]
}

/** @deprecated Use ServiceType-based getServiceTypeDisplayName */
export function getRideTypeDisplayName(rideType: RideType): string {
  const names: Record<RideType, string> = {
    one_way: 'One Way',
    round_trip: 'Round Trip',
    hourly: 'Hourly'
  }
  return names[rideType]
}
