import type { Location, RouteInfo } from '@/types'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

// Metro Detroit center and bounds for map initialization
export const METRO_DETROIT = {
  center: { lat: 42.4, lng: -83.1 } as const,
  zoom: 10,
  bounds: {
    sw: { lat: 42.0, lng: -84.0 },
    ne: { lat: 42.8, lng: -82.8 }
  }
}

/**
 * Geocode an address using Mapbox Geocoding API
 */
export async function geocodeAddress(query: string): Promise<Location | null> {
  const bbox = `${METRO_DETROIT.bounds.sw.lng},${METRO_DETROIT.bounds.sw.lat},${METRO_DETROIT.bounds.ne.lng},${METRO_DETROIT.bounds.ne.lat}`

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
    `access_token=${MAPBOX_TOKEN}&` +
    `bbox=${bbox}&` +
    `country=US&` +
    `types=address,poi&` +
    `limit=1`
  )

  if (!response.ok) {
    console.error('Geocoding failed:', await response.text())
    return null
  }

  const data = await response.json()

  if (data.features && data.features.length > 0) {
    const feature = data.features[0]
    return {
      address: feature.place_name,
      placeId: feature.id,
      lat: feature.center[1],
      lng: feature.center[0]
    }
  }

  return null
}

/**
 * Reverse geocode coordinates to address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
    `access_token=${MAPBOX_TOKEN}&` +
    `types=address,poi&` +
    `limit=1`
  )

  if (!response.ok) {
    console.error('Reverse geocoding failed:', await response.text())
    return null
  }

  const data = await response.json()

  if (data.features && data.features.length > 0) {
    return data.features[0].place_name
  }

  return null
}

/**
 * Get route between two points using Mapbox Directions API
 * Supports optional waypoints (stops) between pickup and dropoff
 */
export async function getRoute(
  pickup: Location,
  dropoff: Location,
  waypoints: Location[] = []
): Promise<RouteInfo | null> {
  // Build coordinates string: pickup;waypoint1;waypoint2;...;dropoff
  const coordinates = [
    `${pickup.lng},${pickup.lat}`,
    ...waypoints.filter(w => w.lat && w.lng).map(w => `${w.lng},${w.lat}`),
    `${dropoff.lng},${dropoff.lat}`
  ].join(';')

  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/` +
    `${coordinates}?` +
    `access_token=${MAPBOX_TOKEN}&` +
    `geometries=geojson&` +
    `overview=full`
  )

  if (!response.ok) {
    console.error('Directions failed:', await response.text())
    return null
  }

  const data = await response.json()

  if (data.routes && data.routes.length > 0) {
    const route = data.routes[0]
    const distanceMeters = route.distance
    const durationSeconds = route.duration

    return {
      distanceMeters,
      distanceText: formatDistance(distanceMeters),
      durationSeconds,
      durationText: formatDuration(durationSeconds),
      polyline: JSON.stringify(route.geometry)
    }
  }

  return null
}

/**
 * Format distance in meters to human-readable string
 */
export function formatDistance(meters: number): string {
  const miles = meters * 0.000621371
  if (miles < 1) {
    return `${Math.round(miles * 10) / 10} mi`
  }
  return `${Math.round(miles)} mi`
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (remainingMinutes === 0) {
    return `${hours} hr`
  }
  return `${hours} hr ${remainingMinutes} min`
}

/**
 * Calculate bounds to fit both markers with padding
 */
export function getBoundsForLocations(
  locations: Array<{ lat: number; lng: number }>
): [[number, number], [number, number]] {
  if (locations.length === 0) {
    return [
      [METRO_DETROIT.bounds.sw.lng, METRO_DETROIT.bounds.sw.lat],
      [METRO_DETROIT.bounds.ne.lng, METRO_DETROIT.bounds.ne.lat]
    ]
  }

  let minLng = locations[0].lng
  let maxLng = locations[0].lng
  let minLat = locations[0].lat
  let maxLat = locations[0].lat

  for (const loc of locations) {
    minLng = Math.min(minLng, loc.lng)
    maxLng = Math.max(maxLng, loc.lng)
    minLat = Math.min(minLat, loc.lat)
    maxLat = Math.max(maxLat, loc.lat)
  }

  // Add padding
  const lngPadding = (maxLng - minLng) * 0.2 || 0.01
  const latPadding = (maxLat - minLat) * 0.2 || 0.01

  return [
    [minLng - lngPadding, minLat - latPadding],
    [maxLng + lngPadding, maxLat + latPadding]
  ]
}
