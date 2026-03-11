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
// SOFIA v6.0 — Invoicing Module
// ============================================================

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface Invoice {
  id: string
  invoice_number: string // TR-YYYY-NNNN
  ride_id: string | null
  contact_id: string
  contact_name: string
  contact_email: string | null
  contact_phone: string
  service_type: ServiceType
  vehicle_class: VehicleClass
  pickup_address: string
  dropoff_address: string
  trip_date: string
  fare_cents: number
  gratuity_cents: number
  extras_cents: number
  total_cents: number
  price_breakdown: PriceBreakdown
  notes: string | null
  status: InvoiceStatus
  sent_at: string | null
  paid_at: string | null
  created_at: string
}

export interface CreateInvoiceRequest {
  ride_id?: string
  contact_id: string
  contact_name: string
  contact_email?: string
  contact_phone: string
  service_type: ServiceType
  vehicle_class: VehicleClass
  pickup_address: string
  dropoff_address: string
  trip_date: string
  fare_cents: number
  gratuity_cents?: number
  extras_cents?: number
  notes?: string
  price_breakdown: PriceBreakdown
}

export interface InvoiceResponse {
  success: boolean
  invoice?: Invoice
  message?: string
}

// ============================================================
// SOFIA v6.0 — Flight Tracking Module
// ============================================================

export type FlightTrackingStatus = 'scheduled' | 'tracking' | 'landed' | 'cancelled' | 'completed'

export interface TrackedFlight {
  id: string
  contact_id: string
  contact_phone: string
  ride_id: string | null
  flight_number: string // e.g. "DL1234"
  airline: string
  departure_airport: string
  arrival_airport: string
  scheduled_departure: string
  scheduled_arrival: string
  actual_departure: string | null
  actual_arrival: string | null
  terminal: string | null
  gate: string | null
  baggage_claim: string | null
  delay_minutes: number
  status: FlightTrackingStatus
  dtw_pickup_instructions: string | null
  weather_conditions: string | null
  last_polled_at: string | null
  polling_started_at: string | null
  created_at: string
}

export interface TrackFlightRequest {
  contact_id: string
  contact_phone: string
  ride_id?: string
  flight_number: string
  flight_date: string // YYYY-MM-DD
}

export interface FlightStatusResponse {
  success: boolean
  flight?: TrackedFlight
  message?: string
}

// ============================================================
// SOFIA v6.0 — Local Concierge Module
// ============================================================

export type VenueCategory =
  | 'fine_dining'
  | 'upscale_casual'
  | 'steakhouse'
  | 'cocktail_bar'
  | 'rooftop'
  | 'live_music'
  | 'theater'
  | 'sports'
  | 'spa'
  | 'hotel'

export type VenuePriceLevel = '$$$' | '$$$$'

export interface Venue {
  id: string
  name: string
  category: VenueCategory
  price_level: VenuePriceLevel
  address: string
  lat: number
  lng: number
  zone: SofiaZone
  phone: string | null
  website: string | null
  description: string
  dress_code: string | null
  reservation_required: boolean
  best_for: string[] // e.g. ["date night", "business dinner", "celebration"]
  hours: string | null
  active: boolean
  created_at: string
}

export interface ConciergeRecommendRequest {
  occasion?: string
  category?: VenueCategory
  zone?: SofiaZone
  party_size?: number
  limit?: number // max recommendations (default 3)
}

export interface ConciergeRecommendResponse {
  success: boolean
  venues: Venue[]
  transportation_note: string
  message?: string
}

// ============================================================
// SOFIA v6.0 — Personal EA Module
// ============================================================

export type VIPTier = 'STANDARD' | 'PREFERRED' | 'VIP'

export interface ClientProfile {
  id: string
  contact_id: string
  contact_name: string
  contact_phone: string
  contact_email: string | null
  vip_tier: VIPTier
  preferred_vehicle: VehicleClass | null
  preferred_driver: string | null
  usual_pickup: string | null
  usual_dropoff: string | null
  dietary_restrictions: string | null
  preferred_restaurants: string[]
  communication_preference: 'sms' | 'email' | 'both'
  special_dates: Record<string, string> // e.g. {"anniversary": "2026-06-15", "birthday": "1985-03-22"}
  notes: string | null
  total_rides: number
  total_spent_cents: number
  last_ride_date: string | null
  last_checkin_date: string | null
  created_at: string
  updated_at: string
}

export interface UpdateClientProfileRequest {
  contact_name?: string
  contact_email?: string
  vip_tier?: VIPTier
  preferred_vehicle?: VehicleClass
  preferred_driver?: string
  usual_pickup?: string
  usual_dropoff?: string
  dietary_restrictions?: string
  preferred_restaurants?: string[]
  communication_preference?: 'sms' | 'email' | 'both'
  special_dates?: Record<string, string>
  notes?: string
}

export interface ClientProfileResponse {
  success: boolean
  profile?: ClientProfile
  message?: string
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
