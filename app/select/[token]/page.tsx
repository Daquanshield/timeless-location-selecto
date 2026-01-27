'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import AddressSearch from '@/components/AddressSearch'
import SortableStop from '@/components/SortableStop'
import PriceEstimate from '@/components/PriceEstimate'
import { geocodeAddress } from '@/lib/mapbox'
import type {
  Location,
  LocationSession,
  RouteInfo,
  PricingResult,
  VehicleType,
  RideType,
  Stop
} from '@/types'

// Selection mode type
type SelectionMode = 'pickup' | 'dropoff' | { type: 'stop'; index: number }

// Dynamic import for map (no SSR - Mapbox GL needs browser)
const MapContainer = dynamic(() => import('@/components/MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="spinner" />
    </div>
  )
})

export default function SelectLocationPage() {
  const router = useRouter()
  const params = useParams()
  const token = params.token as string

  // Session state
  const [session, setSession] = useState<LocationSession | null>(null)
  const [isValidating, setIsValidating] = useState(true)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Location state
  const [pickup, setPickup] = useState<Location | null>(null)
  const [dropoff, setDropoff] = useState<Location | null>(null)
  const [stops, setStops] = useState<Stop[]>([])
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('pickup')

  // Helper to check if selecting pickup
  const selectingPickup = selectionMode === 'pickup'

  // Max 3 stops allowed
  const MAX_STOPS = 3

  // Route & pricing state
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [pricing, setPricing] = useState<PricingResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)

  // Options state
  const [vehicleType, setVehicleType] = useState<VehicleType>('black_sedan')
  const [rideType, setRideType] = useState<RideType>('one_way')

  // Scheduling state
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [scheduledTime, setScheduledTime] = useState<string>('')
  const [specialInstructions, setSpecialInstructions] = useState<string>('')

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Handle drag end for stop reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setStops((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }, [])

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Bottom sheet state
  const [isSheetExpanded, setIsSheetExpanded] = useState(true)

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      try {
        const response = await fetch(`/api/validate-token?token=${token}`)
        const data = await response.json()

        if (!data.valid || !data.session) {
          setValidationError(data.error || 'This link has expired or is invalid.')
          setIsValidating(false)
          return
        }

        setSession(data.session)
        setIsValidating(false)
      } catch (error) {
        console.error('Token validation failed:', error)
        setValidationError('Unable to validate your link. Please try again.')
        setIsValidating(false)
      }
    }

    validateToken()
  }, [token])

  // Prefill pickup/dropoff from session data (from Sofia conversation)
  useEffect(() => {
    if (!session) return

    const { prefillPickup, prefillDropoff } = session

    async function prefillLocations() {
      // Geocode prefill pickup address
      if (prefillPickup) {
        try {
          const location = await geocodeAddress(prefillPickup)
          if (location) {
            setPickup(location)
            // Auto-advance to dropoff if no prefill dropoff
            if (!prefillDropoff) {
              setSelectionMode('dropoff')
            }
          }
        } catch (error) {
          console.error('Failed to geocode prefill pickup:', error)
        }
      }

      // Geocode prefill dropoff address
      if (prefillDropoff) {
        try {
          const location = await geocodeAddress(prefillDropoff)
          if (location) {
            setDropoff(location)
          }
        } catch (error) {
          console.error('Failed to geocode prefill dropoff:', error)
        }
      }
    }

    prefillLocations()
  }, [session]) // Only run when session changes

  // Calculate route when both locations are set or options change
  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute(null)
      setPricing(null)
      return
    }

    async function calculateRoute() {
      setIsCalculating(true)
      try {
        const response = await fetch('/api/calculate-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            pickup,
            dropoff,
            stops: stops.filter(s => s.address && s.lat && s.lng),
            vehicleType,
            rideType
          })
        })

        const data = await response.json()

        if (response.ok) {
          setRoute(data.route)
          setPricing(data.pricing)
        } else {
          console.error('Route calculation failed:', data.error)
        }
      } catch (error) {
        console.error('Route calculation error:', error)
      } finally {
        setIsCalculating(false)
      }
    }

    calculateRoute()
  }, [pickup, dropoff, stops, vehicleType, rideType, token])

  // Handle map click
  const handleMapClick = useCallback((lat: number, lng: number, address: string) => {
    const location: Location = { address, lat, lng }

    if (selectionMode === 'pickup') {
      setPickup(location)
      // Auto-switch to first stop if exists, otherwise dropoff
      if (stops.length > 0) {
        setSelectionMode({ type: 'stop', index: 0 })
      } else {
        setSelectionMode('dropoff')
      }
    } else if (selectionMode === 'dropoff') {
      setDropoff(location)
    } else if (typeof selectionMode === 'object' && selectionMode.type === 'stop') {
      const idx = selectionMode.index
      setStops(prev => {
        const newStops = [...prev]
        newStops[idx] = { ...newStops[idx], ...location }
        return newStops
      })
      // Auto-switch to next stop or dropoff
      if (idx < stops.length - 1) {
        setSelectionMode({ type: 'stop', index: idx + 1 })
      } else {
        setSelectionMode('dropoff')
      }
    }
  }, [selectionMode, stops.length])

  // Handle pickup selection from search
  const handlePickupSelect = useCallback((location: Location) => {
    if (location.address && location.lat && location.lng) {
      setPickup(location)
    } else {
      setPickup(null)
    }
  }, [])

  // Handle dropoff selection from search
  const handleDropoffSelect = useCallback((location: Location) => {
    if (location.address && location.lat && location.lng) {
      setDropoff(location)
    } else {
      setDropoff(null)
    }
  }, [])

  // Handle stop selection from search
  const handleStopSelect = useCallback((index: number, location: Location) => {
    if (location.address && location.lat && location.lng) {
      setStops(prev => {
        const newStops = [...prev]
        newStops[index] = { ...newStops[index], ...location }
        return newStops
      })
    }
  }, [])

  // Add a new stop
  const addStop = useCallback(() => {
    if (stops.length >= MAX_STOPS) return
    const newStop: Stop = {
      id: `stop-${Date.now()}`,
      address: '',
      lat: 0,
      lng: 0
    }
    setStops(prev => [...prev, newStop])
    setSelectionMode({ type: 'stop', index: stops.length })
  }, [stops.length])

  // Remove a stop
  const removeStop = useCallback((index: number) => {
    setStops(prev => prev.filter((_, i) => i !== index))
    // Reset selection mode if we were selecting this stop
    if (typeof selectionMode === 'object' && selectionMode.type === 'stop') {
      if (selectionMode.index >= index) {
        setSelectionMode('dropoff')
      }
    }
  }, [selectionMode])

  // Get current selection label for indicator
  const getSelectionLabel = () => {
    if (selectionMode === 'pickup') return 'pickup'
    if (selectionMode === 'dropoff') return 'drop-off'
    if (typeof selectionMode === 'object') return `stop ${selectionMode.index + 1}`
    return 'location'
  }

  // Get indicator color based on selection mode
  const getSelectionColor = () => {
    if (selectionMode === 'pickup') return '#22c55e'
    if (selectionMode === 'dropoff') return '#ef4444'
    return '#f59e0b' // Orange for stops
  }

  // Handle "Use My Location" from map
  const handleUseMyLocation = useCallback((lat: number, lng: number, address: string) => {
    const location: Location = { address, lat, lng }

    if (selectionMode === 'pickup') {
      setPickup(location)
      if (stops.length > 0) {
        setSelectionMode({ type: 'stop', index: 0 })
      } else {
        setSelectionMode('dropoff')
      }
    } else if (selectionMode === 'dropoff') {
      setDropoff(location)
    } else if (typeof selectionMode === 'object' && selectionMode.type === 'stop') {
      const idx = selectionMode.index
      setStops(prev => {
        const newStops = [...prev]
        newStops[idx] = { ...newStops[idx], ...location }
        return newStops
      })
      if (idx < stops.length - 1) {
        setSelectionMode({ type: 'stop', index: idx + 1 })
      } else {
        setSelectionMode('dropoff')
      }
    }
  }, [selectionMode, stops.length])

  // Get minimum date (today)
  const getMinDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  // Submit selection
  const handleSubmit = async () => {
    if (!pickup || !dropoff || !pricing) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Combine date and time if both are set
      let scheduledDateTime: string | undefined
      if (scheduledDate && scheduledTime) {
        scheduledDateTime = `${scheduledDate}T${scheduledTime}:00`
      } else if (scheduledDate) {
        scheduledDateTime = `${scheduledDate}T09:00:00` // Default to 9 AM
      }

      const response = await fetch('/api/submit-selection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          pickup,
          dropoff,
          stops: stops.filter(s => s.address && s.lat && s.lng),
          route,
          pricing,
          vehicleType,
          rideType,
          scheduledDate: scheduledDateTime,
          specialInstructions: specialInstructions.trim() || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        router.push('/confirmed')
      } else {
        setSubmitError(data.message || 'Failed to save your selection.')
      }
    } catch (error) {
      console.error('Submit error:', error)
      setSubmitError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-900">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-cream-100 font-light">Loading your booking...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-charcoal-900 p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 border-2 border-gold-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gold-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <h1 className="text-xl font-display text-gold-400 mb-2">Link Expired</h1>
          <p className="text-cream-100 mb-6">{validationError}</p>
          <p className="text-sm text-charcoal-400">
            Please text Sofia again to get a new link.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col relative">
      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          pickup={pickup}
          dropoff={dropoff}
          stops={stops}
          routeGeometry={route?.polyline || null}
          onMapClick={handleMapClick}
          selectingPickup={selectingPickup}
          onUseMyLocation={handleUseMyLocation}
        />

        {/* Selection mode indicator */}
        <div className="absolute top-4 left-4 right-4">
          <div className="selection-indicator flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: getSelectionColor() }}
            />
            <span className="text-sm font-medium text-cream-100">
              Tap the map to select your {getSelectionLabel()} location
            </span>
          </div>
        </div>
      </div>

      {/* Bottom sheet */}
      <div className={`bottom-sheet ${isSheetExpanded ? 'bottom-sheet-expanded' : 'bottom-sheet-collapsed'}`}>
        {/* Clickable handle to toggle */}
        <button
          onClick={() => setIsSheetExpanded(!isSheetExpanded)}
          className="w-full py-3 flex flex-col items-center"
          aria-label={isSheetExpanded ? 'Minimize panel' : 'Expand panel'}
        >
          <div className="bottom-sheet-handle" />
          <span className="text-xs text-charcoal-400 mt-1">
            {isSheetExpanded ? 'Tap to minimize' : 'Tap to expand'}
          </span>
        </button>

        {/* Collapsed view - just show summary */}
        {!isSheetExpanded && (
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-sm text-cream-100 truncate">
                    {pickup?.address || 'Select pickup'}
                  </span>
                </div>
                {stops.map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#f59e0b' }} />
                    <span className="text-sm text-cream-100 truncate">
                      {stop.address || `Stop ${i + 1}`}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#ef4444' }} />
                  <span className="text-sm text-cream-100 truncate">
                    {dropoff?.address || 'Select drop-off'}
                  </span>
                </div>
              </div>
              {pricing && (
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-display text-gold-400">${pricing.total}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expanded view - full form */}
        {isSheetExpanded && (
          <div className="px-4 pb-6 space-y-4">
            {/* Header */}
            <div className="text-center pb-2">
              <h1 className="text-xl font-display text-gold-400">
                Select Your Locations
              </h1>
              {session?.contactName && (
                <p className="text-sm text-charcoal-400 mt-1">Welcome, {session.contactName}</p>
              )}
            </div>

            {/* Location inputs */}
            <div className="space-y-3">
              <AddressSearch
                label="Pickup Location"
                placeholder="Enter pickup address"
                value={pickup}
                onSelect={handlePickupSelect}
                isActive={selectionMode === 'pickup'}
                onFocus={() => setSelectionMode('pickup')}
                icon="pickup"
              />

              {/* Stops with drag-and-drop */}
              {stops.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={stops.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3 pl-8">
                      {stops.map((stop, index) => (
                        <SortableStop
                          key={stop.id}
                          stop={stop}
                          index={index}
                          onSelect={(loc) => handleStopSelect(index, loc)}
                          onRemove={() => removeStop(index)}
                          isActive={typeof selectionMode === 'object' && selectionMode.type === 'stop' && selectionMode.index === index}
                          onFocus={() => setSelectionMode({ type: 'stop', index })}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}

              {/* Add stop button */}
              {stops.length < MAX_STOPS && (
                <button
                  type="button"
                  onClick={addStop}
                  className="w-full py-3 px-4 border-2 border-dashed border-charcoal-600 rounded-lg text-charcoal-400 hover:border-gold-400 hover:text-gold-400 transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                  </svg>
                  <span>Add a stop</span>
                </button>
              )}

              <AddressSearch
                label="Drop-off Location"
                placeholder="Enter drop-off address"
                value={dropoff}
                onSelect={handleDropoffSelect}
                isActive={selectionMode === 'dropoff'}
                onFocus={() => setSelectionMode('dropoff')}
                icon="dropoff"
              />
            </div>

            {/* Date/Time Picker */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-cream-100">
                When do you need the ride?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-charcoal-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={getMinDate()}
                    className="w-full px-3 py-3 bg-charcoal-800 border-2 border-charcoal-700 rounded-lg text-cream-100 focus:border-gold-400 focus:outline-none transition-colors"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-charcoal-400 mb-1">Time</label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3 py-3 bg-charcoal-800 border-2 border-charcoal-700 rounded-lg text-cream-100 focus:border-gold-400 focus:outline-none transition-colors"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </div>
              <p className="text-xs text-charcoal-500">
                Leave blank for ASAP pickup
              </p>
            </div>

            {/* Special Instructions */}
            <div>
              <label className="block text-sm font-medium text-cream-100 mb-1.5">
                Special Instructions <span className="text-charcoal-500">(optional)</span>
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Airport terminal, gate number, building entrance, flight number, etc."
                rows={2}
                maxLength={500}
                className="w-full px-3 py-3 bg-charcoal-800 border-2 border-charcoal-700 rounded-lg text-cream-100 placeholder-charcoal-500 focus:border-gold-400 focus:outline-none transition-colors resize-none"
              />
              <p className="text-xs text-charcoal-500 mt-1 text-right">
                {specialInstructions.length}/500
              </p>
            </div>

            {/* Price estimate */}
            <PriceEstimate
              pricing={pricing}
              route={route}
              vehicleType={vehicleType}
              rideType={rideType}
              onVehicleTypeChange={setVehicleType}
              onRideTypeChange={setRideType}
              isCalculating={isCalculating}
            />

            {/* Error message */}
            {submitError && (
              <div className="error-box text-sm">
                {submitError}
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!pickup || !dropoff || !pricing || isSubmitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner spinner-light" />
                  <span>Confirming...</span>
                </>
              ) : (
                <span>Confirm Locations</span>
              )}
            </button>

            {/* Help text */}
            <p className="text-xs text-charcoal-400 text-center">
              After confirming, Sofia will continue your booking via text.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
