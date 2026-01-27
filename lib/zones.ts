import type { Zone } from '@/types'

// Zone detection keywords - matching Sofia's driver_assignment_code_node.js
const zoneKeywords: Record<Zone, string[]> = {
  airport: [
    'airport', 'dtw', 'metro airport', 'terminal', 'mcnamara',
    'north terminal', 'romulus', 'wayne county airport'
  ],
  downtown: [
    'downtown', 'downtown detroit', 'city center', 'comerica',
    'ford field', 'renaissance center', 'cobo', 'greektown',
    'campus martius', 'woodward ave'
  ],
  birmingham: [
    'birmingham', 'bloomfield', 'bloomfield hills', 'bloomfield township',
    'beverly hills', 'bingham farms'
  ],
  suburbs: [
    'novi', 'farmington', 'farmington hills', 'livonia', 'troy',
    'rochester', 'rochester hills', 'auburn hills', 'southfield',
    'royal oak', 'berkley', 'ferndale', 'oak park', 'madison heights',
    'sterling heights', 'warren', 'clawson', 'pleasant ridge',
    'huntington woods', 'west bloomfield', 'commerce township',
    'waterford', 'pontiac', 'lake orion', 'orion township'
  ],
  detroit: [
    'detroit', 'midtown', 'corktown', 'mexicantown', 'eastern market',
    'rivertown', 'indian village', 'palmer park', 'university district',
    'rosedale park', 'grandmont', 'bagley', 'boston edison'
  ],
  'ann-arbor': [
    'ann arbor', 'ann-arbor', 'ypsilanti', 'u of m', 'university of michigan',
    'michigan stadium', 'briarwood', 'washtenaw'
  ],
  general: []
}

// Geographic boundaries for zones (approximate bounding boxes)
const zoneBoundaries: Record<Zone, { minLat: number, maxLat: number, minLng: number, maxLng: number } | null> = {
  airport: { minLat: 42.18, maxLat: 42.25, minLng: -83.40, maxLng: -83.30 },
  downtown: { minLat: 42.32, maxLat: 42.35, minLng: -83.06, maxLng: -83.02 },
  birmingham: { minLat: 42.52, maxLat: 42.58, minLng: -83.28, maxLng: -83.18 },
  'ann-arbor': { minLat: 42.22, maxLat: 42.32, minLng: -83.80, maxLng: -83.68 },
  detroit: { minLat: 42.28, maxLat: 42.45, minLng: -83.15, maxLng: -82.90 },
  suburbs: null, // Suburbs is everything else in the metro area
  general: null
}

/**
 * Detect zone from address text
 */
export function detectZoneFromAddress(address: string): Zone {
  const lowerAddress = address.toLowerCase()

  // Check each zone's keywords
  for (const [zone, keywords] of Object.entries(zoneKeywords)) {
    if (zone === 'general') continue
    for (const keyword of keywords) {
      if (lowerAddress.includes(keyword.toLowerCase())) {
        return zone as Zone
      }
    }
  }

  return 'general'
}

/**
 * Detect zone from coordinates
 */
export function detectZoneFromCoords(lat: number, lng: number): Zone {
  // Check specific zone boundaries
  for (const [zone, bounds] of Object.entries(zoneBoundaries)) {
    if (bounds && zone !== 'suburbs' && zone !== 'general') {
      if (
        lat >= bounds.minLat && lat <= bounds.maxLat &&
        lng >= bounds.minLng && lng <= bounds.maxLng
      ) {
        return zone as Zone
      }
    }
  }

  // Check if in general Metro Detroit area (suburbs)
  const metroDetroit = {
    minLat: 42.0,
    maxLat: 42.8,
    minLng: -84.0,
    maxLng: -82.8
  }

  if (
    lat >= metroDetroit.minLat && lat <= metroDetroit.maxLat &&
    lng >= metroDetroit.minLng && lng <= metroDetroit.maxLng
  ) {
    return 'suburbs'
  }

  return 'general'
}

/**
 * Detect zone from both address and coordinates
 * Address takes priority, coordinates used as fallback
 */
export function detectZone(address: string, lat?: number, lng?: number): Zone {
  // Try address-based detection first
  const addressZone = detectZoneFromAddress(address)
  if (addressZone !== 'general') {
    return addressZone
  }

  // Fall back to coordinate-based detection
  if (lat !== undefined && lng !== undefined) {
    return detectZoneFromCoords(lat, lng)
  }

  return 'general'
}

/**
 * Get display name for zone
 */
export function getZoneDisplayName(zone: Zone): string {
  const displayNames: Record<Zone, string> = {
    airport: 'DTW Airport',
    downtown: 'Downtown Detroit',
    birmingham: 'Birmingham/Bloomfield',
    suburbs: 'Metro Detroit Suburbs',
    detroit: 'Detroit',
    'ann-arbor': 'Ann Arbor',
    general: 'Metro Detroit'
  }
  return displayNames[zone]
}
