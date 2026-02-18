// ============================================================
// SOFIA v4.0 Type System
// ============================================================

// --- Core Enums ---

export type VehicleClass = 'EXECUTIVE_SUV' | 'PREMIER_SUV'

export type ServiceType = 'AIRPORT' | 'HOURLY' | 'DAY_RATE' | 'LONG_DISTANCE' | 'MULTI_STOP'

export type SofiaZone = 'DOWNTOWN' | 'WEST' | 'NORTH' | 'EAST' | 'NORTHEAST' | 'AIRPORT' | 'OUT_OF_AREA'

export type DayRateDuration = '8hr' | '12hr'

export type WaitTimeTier = 'NONE' | 'SHORT' | 'DINNER' | 'EXTENDED' | 'ALL_DAY'

export type TripDirection = 'one_way' | 'round_trip'

export type LongDistanceDestination =
  | 'ANN_ARBOR'
  | 'LANSING'
  | 'GRAND_RAPIDS'
  | 'HOLLAND'
  | 'TOLEDO'
  | 'COLUMBUS'
  | 'CLEVELAND'
  | 'CHICAGO'
  | 'INDIANAPOLIS'
  | 'CINCINNATI'

// --- Location Types ---

export interface Location {
  address: string
  placeId?: string
  lat: number
  lng: number
  zone?: string
}

export interface Stop extends Location {
  id: string
}

// --- Route & Pricing ---

export interface RouteInfo {
  distanceMeters: number
  distanceText: string
  durationSeconds: number
  durationText: string
  polyline?: string
}

export interface PriceBreakdown {
  base: number
  stopSurcharge: number
  waitTimeSurcharge: number
  total: number
  description: string
}

export interface PricingResult {
  total: number
  fareCents: number
  breakdown: PriceBreakdown
}

// --- Session ---

export interface LocationSession {
  id: string
  token: string
  contactPhone: string
  contactName?: string
  contactId?: string
  conversationId?: string
  prefillPickup?: string
  prefillDropoff?: string
  prefillDatetime?: string
  status: 'pending' | 'selected' | 'expired' | 'used'
  expiresAt: string
  createdAt: string
}

// --- API Request/Response Types ---

export interface ValidateTokenResponse {
  valid: boolean
  session?: LocationSession
  error?: string
}

export interface CalculateRouteRequest {
  token: string
  pickup: Location
  dropoff: Location
  stops?: Stop[]
  vehicleClass?: VehicleClass
  serviceType?: ServiceType
  estimatedHours?: number
  dayRateDuration?: DayRateDuration
  waitTimeTier?: WaitTimeTier
  longDistanceDestination?: LongDistanceDestination
  tripDirection?: TripDirection
  // Deprecated fields for backward compat
  vehicleType?: VehicleType
  rideType?: RideType
}

export interface CalculateRouteResponse {
  route: RouteInfo
  zones: {
    pickup: SofiaZone
    dropoff: SofiaZone
  }
  pricing: PricingResult
  detectedServiceType: ServiceType
}

export interface SubmitSelectionRequest {
  token: string
  pickup: Location
  dropoff: Location
  stops?: Stop[]
  route: RouteInfo
  pricing: PricingResult
  vehicleClass: VehicleClass
  serviceType: ServiceType
  passengerCount?: number
  scheduledDate?: string
  specialInstructions?: string
  estimatedHours?: number
  dayRateDuration?: DayRateDuration
  waitTimeTier?: WaitTimeTier
  longDistanceDestination?: LongDistanceDestination
  tripDirection?: TripDirection
  // Deprecated fields for backward compat
  vehicleType?: VehicleType
  rideType?: RideType
}

export interface SubmitSelectionResponse {
  success: boolean
  message: string
  redirect?: string
}

// --- Customer Memory ---

export interface CustomerMemory {
  usualPickupAddress?: string
  usualDropoffAddress?: string
  preferredVehicle?: VehicleClass
}

// ============================================================
// DEPRECATED — kept for backward compatibility during migration
// ============================================================

/** @deprecated Use VehicleClass instead */
export type VehicleType = 'black_suv' | 'luxury_black_suv' | 'chauffeur'

/** @deprecated Use ServiceType instead */
export type RideType = 'one_way' | 'round_trip' | 'hourly'

/** @deprecated Use SofiaZone instead */
export type Zone = 'airport' | 'downtown' | 'birmingham' | 'suburbs' | 'detroit' | 'ann-arbor' | 'general'

// --- Migration Helpers ---

export function migrateVehicleType(old: VehicleType): VehicleClass {
  switch (old) {
    case 'luxury_black_suv': return 'PREMIER_SUV'
    case 'black_suv':
    case 'chauffeur':
    default: return 'EXECUTIVE_SUV'
  }
}

export function migrateZone(old: Zone): SofiaZone {
  switch (old) {
    case 'airport': return 'AIRPORT'
    case 'downtown': return 'DOWNTOWN'
    case 'detroit': return 'DOWNTOWN'
    case 'birmingham': return 'NORTH'
    case 'ann-arbor': return 'OUT_OF_AREA'
    case 'suburbs': return 'WEST' // best default; real detection uses address
    case 'general':
    default: return 'OUT_OF_AREA'
  }
}
