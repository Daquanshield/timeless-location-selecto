import type { SofiaZone, ServiceType } from '@/types'

/**
 * Auto-detect the SOFIA v4 service type based on zones and context.
 *
 * Priority:
 * 1. Explicit user choice (DAY_RATE, HOURLY) always wins
 * 2. If either zone is AIRPORT → AIRPORT or MULTI_STOP
 * 3. If either zone is OUT_OF_AREA → LONG_DISTANCE
 * 4. Otherwise → HOURLY (local non-airport = as-directed, 3-hr min)
 */
export function detectServiceType(input: {
  pickupZone: SofiaZone
  dropoffZone: SofiaZone
  explicitServiceType?: ServiceType
  numStops?: number
}): ServiceType {
  const { pickupZone, dropoffZone, explicitServiceType, numStops = 0 } = input

  // 1. Honor explicit user choice for non-airport types
  if (explicitServiceType === 'DAY_RATE') return 'DAY_RATE'
  if (explicitServiceType === 'HOURLY') return 'HOURLY'
  if (explicitServiceType === 'LONG_DISTANCE') return 'LONG_DISTANCE'

  const hasAirport = pickupZone === 'AIRPORT' || dropoffZone === 'AIRPORT'
  const hasOutOfArea = pickupZone === 'OUT_OF_AREA' || dropoffZone === 'OUT_OF_AREA'

  // 2. Airport transfers
  if (hasAirport) {
    // If there are additional stops, it's MULTI_STOP
    if (numStops > 0) return 'MULTI_STOP'
    // If user explicitly chose MULTI_STOP, honor it
    if (explicitServiceType === 'MULTI_STOP') return 'MULTI_STOP'
    return 'AIRPORT'
  }

  // 3. Out-of-area triggers long distance
  if (hasOutOfArea) return 'LONG_DISTANCE'

  // 4. Local non-airport trip → hourly service
  return 'HOURLY'
}
