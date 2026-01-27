// Location types
export interface Location {
  address: string
  placeId?: string
  lat: number
  lng: number
  zone?: string
}

// Stop for multi-stop routes
export interface Stop extends Location {
  id: string  // Unique identifier for React keys
}

export interface RouteInfo {
  distanceMeters: number
  distanceText: string
  durationSeconds: number
  durationText: string
  polyline?: string
}

export interface PriceBreakdown {
  base: number
  zoneSurcharge: number
  total: number
  description: string
}

export interface PricingResult {
  total: number
  breakdown: PriceBreakdown
}

export type VehicleType = 'black_sedan' | 'black_suv' | 'chauffeur'
export type RideType = 'one_way' | 'round_trip' | 'hourly'
export type Zone = 'airport' | 'downtown' | 'birmingham' | 'suburbs' | 'detroit' | 'ann-arbor' | 'general'

// Session types
export interface LocationSession {
  id: string
  token: string
  contactPhone: string
  contactName?: string
  contactId?: string
  conversationId?: string
  prefillPickup?: string
  prefillDropoff?: string
  status: 'pending' | 'selected' | 'expired' | 'used'
  expiresAt: string
  createdAt: string
}

// API types
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
  vehicleType?: VehicleType
  rideType?: RideType
}

export interface CalculateRouteResponse {
  route: RouteInfo
  zones: {
    pickup: Zone
    dropoff: Zone
  }
  pricing: PricingResult
}

export interface SubmitSelectionRequest {
  token: string
  pickup: Location
  dropoff: Location
  stops?: Stop[]
  route: RouteInfo
  pricing: PricingResult
  vehicleType: VehicleType
  rideType: RideType
  scheduledDate?: string  // ISO date string for scheduled pickup
  specialInstructions?: string  // Airport terminal, gate, building entrance, etc.
}

export interface SubmitSelectionResponse {
  success: boolean
  message: string
  redirect?: string
}

// Customer memory (from Sofia)
export interface CustomerMemory {
  usualPickupAddress?: string
  usualDropoffAddress?: string
  preferredVehicle?: VehicleType
}
