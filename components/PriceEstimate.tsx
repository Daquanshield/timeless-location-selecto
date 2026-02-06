'use client'

import type {
  PricingResult,
  RouteInfo,
  VehicleClass,
  ServiceType,
  DayRateDuration,
  WaitTimeTier,
  LongDistanceDestination,
  TripDirection
} from '@/types'
import {
  formatPrice,
  getVehicleDisplayName,
  getServiceTypeDisplayName,
  getVehicleCapacity,
  HOURLY_MINIMUM,
  LONG_DISTANCE_RATES
} from '@/lib/pricing'

interface PriceEstimateProps {
  pricing: PricingResult | null
  route: RouteInfo | null
  vehicleClass: VehicleClass
  serviceType: ServiceType
  estimatedHours: number
  dayRateDuration: DayRateDuration
  waitTimeTier: WaitTimeTier
  longDistanceDestination: LongDistanceDestination | null
  tripDirection: TripDirection
  onVehicleClassChange: (vc: VehicleClass) => void
  onServiceTypeChange: (st: ServiceType) => void
  onEstimatedHoursChange: (h: number) => void
  onDayRateDurationChange: (d: DayRateDuration) => void
  onWaitTimeTierChange: (w: WaitTimeTier) => void
  onLongDistanceDestinationChange: (d: LongDistanceDestination) => void
  onTripDirectionChange: (t: TripDirection) => void
  isCalculating: boolean
}

export default function PriceEstimate({
  pricing,
  route,
  vehicleClass,
  serviceType,
  estimatedHours,
  dayRateDuration,
  waitTimeTier,
  longDistanceDestination,
  tripDirection,
  onVehicleClassChange,
  onServiceTypeChange,
  onEstimatedHoursChange,
  onDayRateDurationChange,
  onWaitTimeTierChange,
  onLongDistanceDestinationChange,
  onTripDirectionChange,
  isCalculating
}: PriceEstimateProps) {
  return (
    <div className="space-y-4">
      {/* Vehicle Class Selection */}
      <div>
        <label className="block text-sm font-medium text-cream-100 mb-2">
          Vehicle
        </label>
        <div className="grid grid-cols-2 gap-2">
          <VehicleButton
            vehicleClass="EXECUTIVE_SUV"
            label="Executive SUV"
            sublabel={`Up to ${getVehicleCapacity('EXECUTIVE_SUV')} passengers`}
            selected={vehicleClass === 'EXECUTIVE_SUV'}
            onClick={() => onVehicleClassChange('EXECUTIVE_SUV')}
          />
          <VehicleButton
            vehicleClass="PREMIER_SUV"
            label="Premier SUV"
            sublabel={`Up to ${getVehicleCapacity('PREMIER_SUV')} passengers`}
            selected={vehicleClass === 'PREMIER_SUV'}
            onClick={() => onVehicleClassChange('PREMIER_SUV')}
          />
        </div>
      </div>

      {/* Service Type Selection */}
      <div>
        <label className="block text-sm font-medium text-cream-100 mb-2">
          Service Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          <ServiceButton
            type="AIRPORT"
            label="Airport"
            selected={serviceType === 'AIRPORT' || serviceType === 'MULTI_STOP'}
            onClick={() => onServiceTypeChange('AIRPORT')}
          />
          <ServiceButton
            type="HOURLY"
            label="Hourly"
            selected={serviceType === 'HOURLY'}
            onClick={() => onServiceTypeChange('HOURLY')}
          />
          <ServiceButton
            type="DAY_RATE"
            label="Day Rate"
            selected={serviceType === 'DAY_RATE'}
            onClick={() => onServiceTypeChange('DAY_RATE')}
          />
          <ServiceButton
            type="LONG_DISTANCE"
            label="Long Distance"
            selected={serviceType === 'LONG_DISTANCE'}
            onClick={() => onServiceTypeChange('LONG_DISTANCE')}
          />
        </div>
      </div>

      {/* --- Conditional Options --- */}

      {/* HOURLY: Hours Selector */}
      {serviceType === 'HOURLY' && (
        <div>
          <label className="block text-sm font-medium text-cream-100 mb-2">
            Hours ({HOURLY_MINIMUM}-hr minimum)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onEstimatedHoursChange(Math.max(HOURLY_MINIMUM, estimatedHours - 1))}
              className="w-10 h-10 rounded-lg border-2 border-charcoal-700 bg-charcoal-800 text-charcoal-300 hover:border-charcoal-600 font-bold text-lg"
            >
              -
            </button>
            <span className="text-gold-400 font-semibold text-lg w-12 text-center">
              {estimatedHours}hr
            </span>
            <button
              type="button"
              onClick={() => onEstimatedHoursChange(Math.min(12, estimatedHours + 1))}
              className="w-10 h-10 rounded-lg border-2 border-charcoal-700 bg-charcoal-800 text-charcoal-300 hover:border-charcoal-600 font-bold text-lg"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* DAY_RATE: Duration Toggle */}
      {serviceType === 'DAY_RATE' && (
        <div>
          <label className="block text-sm font-medium text-cream-100 mb-2">
            Day Rate Duration
          </label>
          <div className="grid grid-cols-2 gap-2">
            <OptionButton
              label="8-Hour Day"
              selected={dayRateDuration === '8hr'}
              onClick={() => onDayRateDurationChange('8hr')}
            />
            <OptionButton
              label="12-Hour Day"
              selected={dayRateDuration === '12hr'}
              onClick={() => onDayRateDurationChange('12hr')}
            />
          </div>
        </div>
      )}

      {/* LONG_DISTANCE: Destination + Direction + Wait Time */}
      {serviceType === 'LONG_DISTANCE' && (
        <div className="space-y-3">
          {/* Destination Dropdown */}
          <div>
            <label className="block text-sm font-medium text-cream-100 mb-2">
              Destination
            </label>
            <select
              value={longDistanceDestination || ''}
              onChange={e => onLongDistanceDestinationChange(e.target.value as LongDistanceDestination)}
              className="w-full px-3 py-2.5 rounded-lg border-2 border-charcoal-700 bg-charcoal-800 text-cream-100 focus:border-gold-400 focus:outline-none"
            >
              <option value="">Select destination...</option>
              {(Object.keys(LONG_DISTANCE_RATES) as LongDistanceDestination[]).map(dest => (
                <option key={dest} value={dest}>
                  {getDestLabel(dest)} ({LONG_DISTANCE_RATES[dest].distance} mi)
                </option>
              ))}
            </select>
          </div>

          {/* Trip Direction */}
          <div>
            <label className="block text-sm font-medium text-cream-100 mb-2">
              Trip Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton
                label="One Way"
                selected={tripDirection === 'one_way'}
                onClick={() => onTripDirectionChange('one_way')}
              />
              <OptionButton
                label="Round Trip"
                selected={tripDirection === 'round_trip'}
                onClick={() => onTripDirectionChange('round_trip')}
              />
            </div>
          </div>

          {/* Wait Time Tier */}
          <div>
            <label className="block text-sm font-medium text-cream-100 mb-2">
              Wait Time at Destination
            </label>
            <div className="grid grid-cols-2 gap-2">
              <OptionButton
                label="No wait"
                selected={waitTimeTier === 'NONE'}
                onClick={() => onWaitTimeTierChange('NONE')}
              />
              <OptionButton
                label="Short (≤1hr)"
                selected={waitTimeTier === 'SHORT'}
                onClick={() => onWaitTimeTierChange('SHORT')}
              />
              <OptionButton
                label="Dinner (1-3hr)"
                selected={waitTimeTier === 'DINNER'}
                onClick={() => onWaitTimeTierChange('DINNER')}
              />
              <OptionButton
                label="Extended (3-6hr)"
                selected={waitTimeTier === 'EXTENDED'}
                onClick={() => onWaitTimeTierChange('EXTENDED')}
              />
            </div>
          </div>
        </div>
      )}

      {/* Route Info & Price */}
      {(route || pricing || isCalculating) && (
        <div className="bg-charcoal-800 rounded-lg border border-charcoal-700 p-4 mt-4">
          {isCalculating ? (
            <div className="flex items-center justify-center py-4">
              <div className="spinner mr-3" />
              <span className="text-charcoal-400">Calculating...</span>
            </div>
          ) : pricing ? (
            <div className="space-y-3">
              {/* Distance & Duration (only for routed services) */}
              {route && (serviceType === 'AIRPORT' || serviceType === 'MULTI_STOP') && (
                <div className="flex justify-between text-sm text-charcoal-300">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gold-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z" />
                    </svg>
                    <span>{route.distanceText}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gold-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                    <span>{route.durationText}</span>
                  </div>
                </div>
              )}

              {/* Price */}
              <div className={route && (serviceType === 'AIRPORT' || serviceType === 'MULTI_STOP') ? 'border-t border-charcoal-700 pt-3' : ''}>
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-charcoal-400">Estimated fare</p>
                    <p className="text-xs text-charcoal-500">{pricing.breakdown.description}</p>
                  </div>
                  <p className="price-display">
                    {pricing.total > 0 ? formatPrice(pricing.total) : '—'}
                  </p>
                </div>

                {/* Breakdown details for complex pricing */}
                {(pricing.breakdown.stopSurcharge > 0 || pricing.breakdown.waitTimeSurcharge > 0) && (
                  <div className="mt-2 pt-2 border-t border-charcoal-700 text-xs text-charcoal-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Base fare</span>
                      <span>{formatPrice(pricing.breakdown.base)}</span>
                    </div>
                    {pricing.breakdown.stopSurcharge > 0 && (
                      <div className="flex justify-between">
                        <span>Stop surcharge</span>
                        <span>+{formatPrice(pricing.breakdown.stopSurcharge)}</span>
                      </div>
                    )}
                    {pricing.breakdown.waitTimeSurcharge > 0 && (
                      <div className="flex justify-between">
                        <span>Wait time</span>
                        <span>+{formatPrice(pricing.breakdown.waitTimeSurcharge)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// --- Sub-Components ---

function VehicleButton({
  vehicleClass,
  label,
  sublabel,
  selected,
  onClick
}: {
  vehicleClass: VehicleClass
  label: string
  sublabel: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
        selected
          ? 'border-gold-400 bg-charcoal-800'
          : 'border-charcoal-700 bg-charcoal-800 hover:border-charcoal-600'
      }`}
    >
      <svg className={`w-8 h-8 ${selected ? 'text-gold-400' : 'text-charcoal-400'}`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.92 5.01C18.72 4.42 18.16 4 17.5 4h-11c-.66 0-1.21.42-1.42 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 15c-.83 0-1.5-.67-1.5-1.5S5.67 12 6.5 12s1.5.67 1.5 1.5S7.33 15 6.5 15zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 10l1.5-4.5h11L19 10H5z" />
      </svg>
      <div className="text-left">
        <span className={`font-medium block ${selected ? 'text-gold-400' : 'text-charcoal-300'}`}>
          {label}
        </span>
        <span className="text-xs text-charcoal-500">{sublabel}</span>
      </div>
    </button>
  )
}

function ServiceButton({
  type,
  label,
  selected,
  onClick
}: {
  type: ServiceType
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
        selected
          ? 'border-gold-400 bg-charcoal-800 text-gold-400'
          : 'border-charcoal-700 bg-charcoal-800 text-charcoal-300 hover:border-charcoal-600'
      }`}
    >
      {label}
    </button>
  )
}

function OptionButton({
  label,
  selected,
  onClick
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all ${
        selected
          ? 'border-gold-400 bg-charcoal-800 text-gold-400'
          : 'border-charcoal-700 bg-charcoal-800 text-charcoal-300 hover:border-charcoal-600'
      }`}
    >
      {label}
    </button>
  )
}

function getDestLabel(dest: LongDistanceDestination): string {
  const labels: Record<LongDistanceDestination, string> = {
    ANN_ARBOR: 'Ann Arbor', LANSING: 'Lansing', GRAND_RAPIDS: 'Grand Rapids',
    HOLLAND: 'Holland, MI', TOLEDO: 'Toledo, OH', COLUMBUS: 'Columbus, OH',
    CLEVELAND: 'Cleveland, OH', CHICAGO: 'Chicago, IL',
    INDIANAPOLIS: 'Indianapolis, IN', CINCINNATI: 'Cincinnati, OH'
  }
  return labels[dest]
}
