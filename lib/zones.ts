import type { SofiaZone, Zone } from '@/types'

// ============================================================
// SOFIA v4.0 Zone System
// ============================================================

// City/keyword lists per zone (from spec section 7)
const ZONE_KEYWORDS: Record<Exclude<SofiaZone, 'OUT_OF_AREA'>, string[]> = {
  AIRPORT: [
    'dtw', 'metro airport', 'detroit metropolitan', 'romulus',
    'wayne county airport', 'mcnamara', 'north terminal',
    'belleville', 'airport'
  ],
  DOWNTOWN: [
    'downtown detroit', 'downtown', 'midtown', 'corktown',
    'dearborn', 'indian village', 'comerica', 'ford field',
    'renaissance center', 'greektown', 'campus martius',
    'woodward ave', 'mexicantown', 'eastern market',
    'rivertown', 'palmer park', 'university district'
  ],
  WEST: [
    'west bloomfield', 'novi', 'farmington hills', 'farmington',
    'orchard lake', 'northville', 'plymouth', 'livonia'
  ],
  NORTH: [
    'troy', 'birmingham', 'bloomfield hills', 'bloomfield',
    'beverly hills', 'franklin', 'royal oak',
    'bingham farms', 'bloomfield township'
  ],
  EAST: [
    'grosse pointe', 'grosse pointe park', 'grosse pointe woods',
    'grosse pointe farms', 'grosse pointe shores',
    'st. clair shores', 'st clair shores', 'harper woods'
  ],
  NORTHEAST: [
    'rochester', 'rochester hills', 'auburn hills',
    'lake orion', 'oxford', 'orion township'
  ]
}

// Geographic bounding boxes for coordinate-based detection
const ZONE_BOUNDS: Record<Exclude<SofiaZone, 'OUT_OF_AREA'>, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  AIRPORT:   { minLat: 42.18, maxLat: 42.25, minLng: -83.40, maxLng: -83.30 },
  DOWNTOWN:  { minLat: 42.28, maxLat: 42.40, minLng: -83.20, maxLng: -83.00 },
  WEST:      { minLat: 42.38, maxLat: 42.55, minLng: -83.55, maxLng: -83.30 },
  NORTH:     { minLat: 42.48, maxLat: 42.60, minLng: -83.30, maxLng: -83.10 },
  EAST:      { minLat: 42.35, maxLat: 42.45, minLng: -82.95, maxLng: -82.85 },
  NORTHEAST: { minLat: 42.60, maxLat: 42.78, minLng: -83.25, maxLng: -83.05 }
}

// Metro Detroit bounding box (anything inside but not matching a specific zone)
const METRO_DETROIT = {
  minLat: 42.0,
  maxLat: 42.8,
  minLng: -84.0,
  maxLng: -82.8
}

/**
 * Detect SOFIA v4 zone from address text
 */
function detectZoneFromAddress(address: string): SofiaZone {
  const lower = address.toLowerCase()

  // Check specific zones first (order matters — more specific before less specific)
  // AIRPORT first (highest priority keyword "airport" might appear in many addresses)
  for (const keyword of ZONE_KEYWORDS.AIRPORT) {
    if (lower.includes(keyword)) return 'AIRPORT'
  }

  // Then specific Metro Detroit zones
  for (const keyword of ZONE_KEYWORDS.NORTHEAST) {
    if (lower.includes(keyword)) return 'NORTHEAST'
  }
  for (const keyword of ZONE_KEYWORDS.EAST) {
    if (lower.includes(keyword)) return 'EAST'
  }
  for (const keyword of ZONE_KEYWORDS.NORTH) {
    if (lower.includes(keyword)) return 'NORTH'
  }
  for (const keyword of ZONE_KEYWORDS.WEST) {
    if (lower.includes(keyword)) return 'WEST'
  }

  // DOWNTOWN last among specific zones (broad keyword "downtown" could match many things)
  for (const keyword of ZONE_KEYWORDS.DOWNTOWN) {
    if (lower.includes(keyword)) return 'DOWNTOWN'
  }

  return 'OUT_OF_AREA'
}

/**
 * Detect SOFIA v4 zone from coordinates
 */
function detectZoneFromCoords(lat: number, lng: number): SofiaZone {
  // Check each specific zone's bounding box
  for (const [zone, bounds] of Object.entries(ZONE_BOUNDS) as [Exclude<SofiaZone, 'OUT_OF_AREA'>, typeof ZONE_BOUNDS[keyof typeof ZONE_BOUNDS]][]) {
    if (
      lat >= bounds.minLat && lat <= bounds.maxLat &&
      lng >= bounds.minLng && lng <= bounds.maxLng
    ) {
      return zone
    }
  }

  // If inside Metro Detroit but no specific zone matched, default to DOWNTOWN
  // (most general urban area)
  if (
    lat >= METRO_DETROIT.minLat && lat <= METRO_DETROIT.maxLat &&
    lng >= METRO_DETROIT.minLng && lng <= METRO_DETROIT.maxLng
  ) {
    return 'DOWNTOWN'
  }

  return 'OUT_OF_AREA'
}

/**
 * Detect SOFIA v4 zone from address + coordinates.
 * Address keywords take priority; coordinates are fallback.
 */
export function detectSofiaZone(address: string, lat?: number, lng?: number): SofiaZone {
  const addressZone = detectZoneFromAddress(address)
  if (addressZone !== 'OUT_OF_AREA') {
    return addressZone
  }

  if (lat !== undefined && lng !== undefined) {
    return detectZoneFromCoords(lat, lng)
  }

  return 'OUT_OF_AREA'
}

/**
 * Display name for SOFIA zones
 */
export function getZoneDisplayName(zone: SofiaZone): string {
  const names: Record<SofiaZone, string> = {
    AIRPORT: 'DTW Airport',
    DOWNTOWN: 'Downtown Detroit',
    WEST: 'West Metro (Novi/Plymouth)',
    NORTH: 'North Metro (Troy/Birmingham)',
    EAST: 'East Metro (Grosse Pointe)',
    NORTHEAST: 'Northeast Metro (Rochester/Auburn Hills)',
    OUT_OF_AREA: 'Out of Area'
  }
  return names[zone]
}

// ============================================================
// DEPRECATED — backward compatibility
// ============================================================

/** @deprecated Use detectSofiaZone instead */
export function detectZone(address: string, lat?: number, lng?: number): Zone {
  const sofiaZone = detectSofiaZone(address, lat, lng)
  // Map back to old zone system for legacy code
  const mapping: Record<SofiaZone, Zone> = {
    AIRPORT: 'airport',
    DOWNTOWN: 'downtown',
    WEST: 'suburbs',
    NORTH: 'birmingham',
    EAST: 'suburbs',
    NORTHEAST: 'suburbs',
    OUT_OF_AREA: 'general'
  }
  return mapping[sofiaZone]
}
