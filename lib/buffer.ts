import type { SofiaZone } from '@/types'

// ============================================================
// SOFIA v4.0 Deadhead Matrix & Buffer System
// Data module for V1.1 — not wired into slot filtering yet
// ============================================================

// Zones that appear in the deadhead matrix (excludes OUT_OF_AREA)
type BufferZone = Exclude<SofiaZone, 'OUT_OF_AREA'>

// 6×6 deadhead travel time matrix (minutes)
// FROM (row) → TO (column)
const DEADHEAD_MATRIX: Record<BufferZone, Record<BufferZone, number>> = {
  NORTH:     { NORTH: 15, NORTHEAST: 20, WEST: 30, EAST: 35, DOWNTOWN: 30, AIRPORT: 50 },
  NORTHEAST: { NORTH: 20, NORTHEAST: 15, WEST: 35, EAST: 45, DOWNTOWN: 40, AIRPORT: 60 },
  WEST:      { NORTH: 30, NORTHEAST: 35, WEST: 20, EAST: 45, DOWNTOWN: 30, AIRPORT: 40 },
  EAST:      { NORTH: 35, NORTHEAST: 45, WEST: 45, EAST: 15, DOWNTOWN: 20, AIRPORT: 40 },
  DOWNTOWN:  { NORTH: 30, NORTHEAST: 40, WEST: 30, EAST: 20, DOWNTOWN: 15, AIRPORT: 35 },
  AIRPORT:   { NORTH: 50, NORTHEAST: 60, WEST: 40, EAST: 40, DOWNTOWN: 35, AIRPORT: 15 },
}

// Fixed buffer added on top of deadhead travel time
const BUFFER_PADDING_MINUTES = 20

/**
 * Get deadhead travel time between two zones in minutes.
 * Returns null if either zone is OUT_OF_AREA (no deadhead data).
 */
export function getDeadheadMinutes(fromZone: SofiaZone, toZone: SofiaZone): number | null {
  if (fromZone === 'OUT_OF_AREA' || toZone === 'OUT_OF_AREA') {
    return null
  }
  return DEADHEAD_MATRIX[fromZone][toZone]
}

/**
 * Calculate when a vehicle becomes available after completing a job.
 *
 * Formula: vehicle.available_at = job.end_time + deadhead(dropoff, next_pickup) + 20min
 *
 * @param jobEndTime - When the current job ends (ISO string or Date)
 * @param dropoffZone - Zone where the current job drops off
 * @param nextPickupZone - Zone where the next job would pick up
 * @returns Date when vehicle is available, or null if zones are OUT_OF_AREA
 */
export function calculateAvailableAt(
  jobEndTime: string | Date,
  dropoffZone: SofiaZone,
  nextPickupZone: SofiaZone
): Date | null {
  const deadhead = getDeadheadMinutes(dropoffZone, nextPickupZone)
  if (deadhead === null) return null

  const endTime = typeof jobEndTime === 'string' ? new Date(jobEndTime) : jobEndTime
  const bufferMinutes = deadhead + BUFFER_PADDING_MINUTES
  return new Date(endTime.getTime() + bufferMinutes * 60 * 1000)
}

/**
 * Check if a vehicle is available for a new job at a given time.
 *
 * @param jobEndTime - When the vehicle's current job ends
 * @param dropoffZone - Zone where the current job drops off
 * @param requestedPickupTime - When the new job would start
 * @param requestedPickupZone - Zone where the new job picks up
 * @returns true if the vehicle can make it in time
 */
export function isVehicleAvailable(
  jobEndTime: string | Date,
  dropoffZone: SofiaZone,
  requestedPickupTime: string | Date,
  requestedPickupZone: SofiaZone
): boolean {
  const availableAt = calculateAvailableAt(jobEndTime, dropoffZone, requestedPickupZone)
  if (!availableAt) return false // OUT_OF_AREA — can't determine

  const pickupTime = typeof requestedPickupTime === 'string'
    ? new Date(requestedPickupTime)
    : requestedPickupTime

  return availableAt.getTime() <= pickupTime.getTime()
}

/**
 * Estimate trip end time based on service type and duration.
 * Used to calculate vehicle availability after a booking.
 *
 * @param startTime - Trip start time
 * @param durationMinutes - Route duration in minutes (from Mapbox)
 * @param serviceType - SOFIA v4 service type
 * @param estimatedHours - For HOURLY/DAY_RATE, the booked hours
 * @returns Estimated end time
 */
export function estimateEndTime(
  startTime: string | Date,
  durationMinutes: number,
  serviceType: string,
  estimatedHours?: number
): Date {
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime

  let tripMinutes: number

  switch (serviceType) {
    case 'AIRPORT':
    case 'MULTI_STOP':
      // Airport transfers: route duration + 30 min buffer for airport logistics
      tripMinutes = durationMinutes + 30
      break
    case 'HOURLY':
      // Hourly: booked hours (minimum 3)
      tripMinutes = Math.max(estimatedHours || 3, 3) * 60
      break
    case 'DAY_RATE':
      // Day rate: 8 or 12 hours
      tripMinutes = (estimatedHours || 8) * 60
      break
    case 'LONG_DISTANCE':
      // Long distance: route duration × 2 (round trip assumption) + 30 min buffer
      tripMinutes = durationMinutes * 2 + 30
      break
    default:
      tripMinutes = durationMinutes + 30
  }

  return new Date(start.getTime() + tripMinutes * 60 * 1000)
}

// Export constants for testing/reference
export { DEADHEAD_MATRIX, BUFFER_PADDING_MINUTES }
