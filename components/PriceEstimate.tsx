'use client'

import type { PricingResult, RouteInfo, VehicleType, RideType } from '@/types'
import { formatPrice, getVehicleDisplayName, getRideTypeDisplayName } from '@/lib/pricing'

interface PriceEstimateProps {
  pricing: PricingResult | null
  route: RouteInfo | null
  vehicleType: VehicleType
  rideType: RideType
  onVehicleTypeChange: (type: VehicleType) => void
  onRideTypeChange: (type: RideType) => void
  isCalculating: boolean
}

export default function PriceEstimate({
  pricing,
  route,
  vehicleType,
  rideType,
  onVehicleTypeChange,
  onRideTypeChange,
  isCalculating
}: PriceEstimateProps) {
  return (
    <div className="space-y-4">
      {/* Vehicle Type Selection - Hidden for hourly service */}
      {rideType !== 'hourly' && (
        <div>
          <label className="block text-sm font-medium text-cream-100 mb-2">
            Vehicle
          </label>
          <div className="grid grid-cols-2 gap-2">
            <VehicleButton
              type="black_sedan"
              label="Black Sedan"
              icon="sedan"
              selected={vehicleType === 'black_sedan'}
              onClick={() => onVehicleTypeChange('black_sedan')}
            />
            <VehicleButton
              type="black_suv"
              label="Black SUV"
              icon="suv"
              selected={vehicleType === 'black_suv'}
              onClick={() => onVehicleTypeChange('black_suv')}
            />
          </div>
        </div>
      )}

      {/* Ride Type Selection */}
      <div>
        <label className="block text-sm font-medium text-cream-100 mb-2">
          Trip Type
        </label>
        <div className="grid grid-cols-3 gap-2">
          <RideTypeButton
            type="one_way"
            label="One Way"
            selected={rideType === 'one_way'}
            onClick={() => onRideTypeChange('one_way')}
          />
          <RideTypeButton
            type="round_trip"
            label="Round Trip"
            selected={rideType === 'round_trip'}
            onClick={() => onRideTypeChange('round_trip')}
          />
          <RideTypeButton
            type="hourly"
            label="Hourly"
            selected={rideType === 'hourly'}
            onClick={() => onRideTypeChange('hourly')}
          />
        </div>
        {rideType === 'hourly' && (
          <p className="text-xs text-gold-400 mt-2">
            Chauffeur service: $100/hr (2 hr minimum)
          </p>
        )}
      </div>

      {/* Route Info & Price */}
      {(route || isCalculating) && (
        <div className="bg-charcoal-800 rounded-lg border border-charcoal-700 p-4 mt-4">
          {isCalculating ? (
            <div className="flex items-center justify-center py-4">
              <div className="spinner mr-3" />
              <span className="text-charcoal-400">Calculating route...</span>
            </div>
          ) : route && pricing ? (
            <div className="space-y-3">
              {/* Distance & Duration */}
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

              {/* Price */}
              <div className="border-t border-charcoal-700 pt-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-sm text-charcoal-400">Estimated fare</p>
                    <p className="text-xs text-charcoal-500">{pricing.breakdown.description}</p>
                  </div>
                  <p className="price-display">
                    {formatPrice(pricing.total)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

// Vehicle selection button - Dark luxury theme
function VehicleButton({
  type,
  label,
  icon,
  selected,
  onClick
}: {
  type: VehicleType
  label: string
  icon: 'sedan' | 'suv'
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
      {icon === 'sedan' ? (
        <svg className={`w-8 h-8 ${selected ? 'text-gold-400' : 'text-charcoal-400'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
        </svg>
      ) : (
        <svg className={`w-8 h-8 ${selected ? 'text-gold-400' : 'text-charcoal-400'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.92 5.01C18.72 4.42 18.16 4 17.5 4h-11c-.66 0-1.21.42-1.42 1.01L3 11v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 15c-.83 0-1.5-.67-1.5-1.5S5.67 12 6.5 12s1.5.67 1.5 1.5S7.33 15 6.5 15zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 10l1.5-4.5h11L19 10H5z" />
        </svg>
      )}
      <span className={`font-medium ${selected ? 'text-gold-400' : 'text-charcoal-300'}`}>
        {label}
      </span>
    </button>
  )
}

// Ride type selection button - Dark luxury theme
function RideTypeButton({
  type,
  label,
  selected,
  onClick
}: {
  type: RideType
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
