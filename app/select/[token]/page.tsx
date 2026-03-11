'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
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
import { getVehicleCapacity } from '@/lib/pricing'
import { detectServiceType } from '@/lib/service-detection'
import type {
  Location,
  LocationSession,
  RouteInfo,
  PricingResult,
  VehicleClass,
  ServiceType,
  DayRateDuration,
  WaitTimeTier,
  LongDistanceDestination,
  TripDirection,
  SofiaZone,
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

  // Max 2 stops for MULTI_STOP (per SOFIA v4 spec)
  const MAX_STOPS = 2

  // Route & pricing state
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const [pricing, setPricing] = useState<PricingResult | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [detectedZones, setDetectedZones] = useState<{ pickup: SofiaZone; dropoff: SofiaZone } | null>(null)

  // SOFIA v4 Options state
  const [vehicleClass, setVehicleClass] = useState<VehicleClass>('EXECUTIVE_SUV')
  const [serviceType, setServiceType] = useState<ServiceType>('AIRPORT')
  const [estimatedHours, setEstimatedHours] = useState<number>(3)
  const [dayRateDuration, setDayRateDuration] = useState<DayRateDuration>('8hr')
  const [waitTimeTier, setWaitTimeTier] = useState<WaitTimeTier>('NONE')
  const [longDistanceDestination, setLongDistanceDestination] = useState<LongDistanceDestination | null>(null)
  const [tripDirection, setTripDirection] = useState<TripDirection>('one_way')

  // Auto-adjust passenger count max when vehicle class changes
  const maxPassengers = getVehicleCapacity(vehicleClass)

  // Scheduling state
  const [scheduledDate, setScheduledDate] = useState<string>('')
  const [scheduledTime, setScheduledTime] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<{ time: string; startTime: string; endTime: string } | null>(null)
  const [availableSlots, setAvailableSlots] = useState<{ time: string; startTime: string; endTime: string }[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = useState(false)
  const [passengerCount, setPassengerCount] = useState<number>(1)
  const [specialInstructions, setSpecialInstructions] = useState<string>('')
  const [flightNumber, setFlightNumber] = useState<string>('')

  // User location for biasing search results
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)

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
  const [sheetHeight, setSheetHeight] = useState(60) // percentage of viewport - reduced for better UX
  const [isDragging, setIsDragging] = useState(false)
  const dragStartY = useRef<number | null>(null)
  const dragStartHeight = useRef<number | null>(null)

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

  // Request user location on mount (for biasing search results)
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.log('Location permission denied or unavailable:', error.message)
          // Silent fail - will use Detroit area as default
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000 // Cache for 5 minutes
        }
      )
    }
  }, [])

  // Prefill locations from session if AI recognized them
  useEffect(() => {
    if (!session) return

    const prefillLocation = async (address: string): Promise<Location | null> => {
      if (!address || address.trim() === '') return null
      try {
        const result = await geocodeAddress(address)
        if (result) {
          return { address: result.address, lat: result.lat, lng: result.lng }
        }
      } catch (error) {
        console.error('Geocoding error:', error)
      }
      return null
    }

    const doPrefill = async () => {
      // Prefill pickup if provided
      if (session.prefillPickup && !pickup) {
        const loc = await prefillLocation(session.prefillPickup)
        if (loc) {
          setPickup(loc)
          setSelectionMode('dropoff')
        }
      }

      // Prefill dropoff if provided
      if (session.prefillDropoff && !dropoff) {
        const loc = await prefillLocation(session.prefillDropoff)
        if (loc) {
          setDropoff(loc)
        }
      }

      // Prefill date/time if provided (e.g., "2026-02-14T06:00:00-05:00")
      if (session.prefillDatetime && !scheduledDate) {
        try {
          const dt = new Date(session.prefillDatetime)
          if (!isNaN(dt.getTime())) {
            // Extract date in YYYY-MM-DD format (local Detroit time)
            const detroitStr = dt.toLocaleString('en-US', { timeZone: 'America/Detroit' })
            const detroitDate = new Date(detroitStr)
            const year = detroitDate.getFullYear()
            const month = String(detroitDate.getMonth() + 1).padStart(2, '0')
            const day = String(detroitDate.getDate()).padStart(2, '0')
            const dateStr = `${year}-${month}-${day}`
            setScheduledDate(dateStr)

            // Store the requested time so we can auto-select the closest slot
            const hours = String(detroitDate.getHours()).padStart(2, '0')
            const minutes = String(detroitDate.getMinutes()).padStart(2, '0')
            setScheduledTime(`${hours}:${minutes}`)
          }
        } catch (e) {
          console.error('Failed to parse prefill datetime:', e)
        }
      }
    }

    doPrefill()
  }, [session])

  // Fetch available slots when date changes
  useEffect(() => {
    if (!scheduledDate) {
      setAvailableSlots([])
      setSelectedSlot(null)
      return
    }

    async function fetchSlots() {
      setIsLoadingSlots(true)
      setSelectedSlot(null)
      try {
        // Build URL with optional pickup coordinates for dynamic travel buffer
        let url = `/api/get-available-slots?date=${scheduledDate}`
        if (pickup?.lat && pickup?.lng) {
          url += `&pickupLat=${pickup.lat}&pickupLng=${pickup.lng}`
        }

        const response = await fetch(url)
        const data = await response.json()
        if (data.slots) {
          setAvailableSlots(data.slots)

          // Auto-select closest slot if we have a prefilled time
          if (scheduledTime && data.slots.length > 0) {
            const [prefillH, prefillM] = scheduledTime.split(':').map(Number)
            const prefillMinutes = prefillH * 60 + prefillM

            let closest = data.slots[0]
            let closestDiff = Infinity

            for (const slot of data.slots) {
              // Extract hour/minute from slot time string (e.g., "6:00 AM")
              const slotDate = new Date(slot.startTime)
              const slotDetroit = new Date(slotDate.toLocaleString('en-US', { timeZone: 'America/Detroit' }))
              const slotMinutes = slotDetroit.getHours() * 60 + slotDetroit.getMinutes()
              const diff = Math.abs(slotMinutes - prefillMinutes)

              if (diff < closestDiff) {
                closestDiff = diff
                closest = slot
              }
            }

            setSelectedSlot(closest)
          }
        } else {
          setAvailableSlots([])
        }
      } catch (error) {
        console.error('Error fetching slots:', error)
        setAvailableSlots([])
      } finally {
        setIsLoadingSlots(false)
      }
    }

    fetchSlots()
  }, [scheduledDate, pickup?.lat, pickup?.lng])

  // Calculate route when both locations are set or options change
  useEffect(() => {
    if (!pickup || !dropoff) {
      setRoute(null)
      setPricing(null)
      setDetectedZones(null)
      return
    }

    async function calculateRoute() {
      setIsCalculating(true)
      try {
        const validStops = stops.filter(s => s.address && s.lat && s.lng)
        const response = await fetch('/api/calculate-route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            pickup,
            dropoff,
            stops: validStops,
            vehicleClass,
            serviceType,
            estimatedHours,
            dayRateDuration,
            waitTimeTier,
            longDistanceDestination,
            tripDirection
          })
        })

        const data = await response.json()

        if (response.ok) {
          setRoute(data.route)
          setPricing(data.pricing)
          // Store detected zones for service type auto-detection
          if (data.zones) {
            setDetectedZones(data.zones)
            // Auto-detect service type from zones (unless user explicitly set it)
            const detected = detectServiceType({
              pickupZone: data.zones.pickup,
              dropoffZone: data.zones.dropoff,
              explicitServiceType: serviceType,
              numStops: validStops.length
            })
            if (data.detectedServiceType) {
              setServiceType(data.detectedServiceType)
            }
          }
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
  }, [pickup, dropoff, stops, vehicleClass, serviceType, estimatedHours, dayRateDuration, waitTimeTier, longDistanceDestination, tripDirection, token])

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

  // Handle sheet drag start
  const handleSheetDragStart = useCallback((clientY: number) => {
    setIsDragging(true)
    dragStartY.current = clientY
    dragStartHeight.current = sheetHeight
  }, [sheetHeight])

  // Handle sheet drag move
  const handleSheetDragMove = useCallback((clientY: number) => {
    if (!isDragging || dragStartY.current === null || dragStartHeight.current === null) return

    const deltaY = dragStartY.current - clientY
    const deltaPercent = (deltaY / window.innerHeight) * 100
    const newHeight = Math.min(90, Math.max(20, dragStartHeight.current + deltaPercent))

    setSheetHeight(newHeight)
    setIsSheetExpanded(newHeight > 30)
  }, [isDragging])

  // Handle sheet drag end
  const handleSheetDragEnd = useCallback(() => {
    setIsDragging(false)
    dragStartY.current = null
    dragStartHeight.current = null

    // Snap to expanded or collapsed
    if (sheetHeight < 30) {
      setSheetHeight(20)
      setIsSheetExpanded(false)
    } else if (sheetHeight < 50) {
      setSheetHeight(60) // Medium height - good for viewing form
      setIsSheetExpanded(true)
    } else if (sheetHeight > 75) {
      setSheetHeight(85) // Max height for full view
      setIsSheetExpanded(true)
    } else {
      setSheetHeight(60) // Default to medium
      setIsSheetExpanded(true)
    }
  }, [sheetHeight])

  // Touch event handlers for sheet
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault() // Prevent pull-to-refresh
    handleSheetDragStart(e.touches[0].clientY)
  }, [handleSheetDragStart])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault() // Prevent pull-to-refresh
    handleSheetDragMove(e.touches[0].clientY)
  }, [handleSheetDragMove])

  const onTouchEnd = useCallback(() => {
    handleSheetDragEnd()
  }, [handleSheetDragEnd])

  // Mouse event handlers for sheet
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    handleSheetDragStart(e.clientY)
  }, [handleSheetDragStart])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      handleSheetDragMove(e.clientY)
    }
    const onMouseUp = () => {
      handleSheetDragEnd()
    }

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isDragging, handleSheetDragMove, handleSheetDragEnd])

  // Submit selection
  const handleSubmit = async () => {
    if (!pickup || !dropoff || !pricing) return

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Use the selected slot's datetime if available
      let scheduledDateTime: string | undefined
      if (selectedSlot) {
        scheduledDateTime = selectedSlot.startTime
      } else if (scheduledDate && scheduledTime) {
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
          route: route ? {
            distanceMeters: route.distanceMeters,
            distanceText: route.distanceText,
            durationSeconds: route.durationSeconds,
            durationText: route.durationText
          } : null,
          pricing,
          vehicleClass,
          serviceType,
          passengerCount: Math.min(passengerCount, maxPassengers),
          scheduledDate: scheduledDateTime,
          specialInstructions: specialInstructions.trim() || undefined,
          flightNumber: flightNumber.trim() || undefined,
          estimatedHours: serviceType === 'HOURLY' ? estimatedHours : undefined,
          dayRateDuration: serviceType === 'DAY_RATE' ? dayRateDuration : undefined,
          waitTimeTier: serviceType === 'LONG_DISTANCE' ? waitTimeTier : undefined,
          longDistanceDestination: serviceType === 'LONG_DISTANCE' ? longDistanceDestination : undefined,
          tripDirection: serviceType === 'LONG_DISTANCE' ? tripDirection : undefined
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
      <div
        className="bottom-sheet"
        style={{
          maxHeight: `${sheetHeight}vh`,
          transition: isDragging ? 'none' : 'max-height 0.3s ease-out',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Draggable handle */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onClick={() => !isDragging && setIsSheetExpanded(!isSheetExpanded)}
          className="drag-handle w-full py-4 flex flex-col items-center cursor-grab active:cursor-grabbing select-none"
          style={{ flexShrink: 0 }}
          aria-label={isSheetExpanded ? 'Drag or tap to minimize' : 'Drag or tap to expand'}
        >
          <div className="bottom-sheet-handle" />
          <span className="text-xs text-charcoal-400 mt-1">
            Drag to resize
          </span>
        </div>

        {/* Collapsed view - just show summary */}
        {!isSheetExpanded && (
          <div className="px-4 pb-4" style={{ flexShrink: 0 }}>
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
              {pricing && pricing.total > 0 && (
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-display text-gold-400">${pricing.total}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Expanded view - full form */}
        {isSheetExpanded && (
          <div
            className="px-4 pb-6 space-y-4 bottom-sheet-content"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
              touchAction: 'pan-y' // Allow vertical scrolling
            }}
          >
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
                userLocation={userLocation}
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
                userLocation={userLocation}
              />
            </div>

            {/* Date/Time Picker */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-cream-100">
                When do you need the ride? <span className="text-gold-400">*</span>
              </label>

              {/* Date picker */}
              <div>
                <label className="block text-xs text-charcoal-400 mb-1">Select Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => {
                    setScheduledDate(e.target.value)
                    setScheduledTime('')
                    setSelectedSlot(null)
                  }}
                  min={getMinDate()}
                  className="w-full px-3 py-3 bg-charcoal-800 border-2 border-charcoal-700 rounded-lg text-cream-100 focus:border-gold-400 focus:outline-none transition-colors"
                  style={{ colorScheme: 'dark' }}
                />
              </div>

              {/* Available time slots */}
              {scheduledDate && (
                <div>
                  <label className="block text-xs text-charcoal-400 mb-2">
                    {isLoadingSlots ? 'Loading available times...' : 'Select Time'}
                  </label>

                  {isLoadingSlots ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="spinner" />
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                      {availableSlots.map((slot, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setSelectedSlot(slot)
                            // Extract time from startTime for the scheduledTime state
                            const time = new Date(slot.startTime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                              timeZone: 'America/Detroit'
                            })
                            setScheduledTime(time)
                          }}
                          className={`px-2 py-2 text-sm rounded-lg border-2 transition-colors ${
                            selectedSlot?.startTime === slot.startTime
                              ? 'bg-gold-400 border-gold-400 text-charcoal-900 font-medium'
                              : 'bg-charcoal-800 border-charcoal-700 text-cream-100 hover:border-gold-400'
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-charcoal-500 py-2">
                      No available slots for this date. Please select another date.
                    </p>
                  )}
                </div>
              )}

              {!scheduledDate && (
                <p className="text-xs text-gold-400">
                  * Required - Please select a date
                </p>
              )}

              {selectedSlot && (
                <p className="text-xs text-gold-400">
                  ✓ Selected: {scheduledDate} at {selectedSlot.time}
                </p>
              )}
            </div>

            {/* Passenger Count */}
            <div>
              <label className="block text-sm font-medium text-cream-100 mb-2">
                Number of Passengers
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPassengerCount(Math.max(1, passengerCount - 1))}
                  disabled={passengerCount <= 1}
                  className="w-12 h-12 rounded-lg border-2 border-charcoal-700 bg-charcoal-800 text-cream-100 text-xl font-bold flex items-center justify-center hover:border-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  <span className="text-2xl font-display text-gold-400">{passengerCount}</span>
                  <p className="text-xs text-charcoal-400 mt-1">
                    {passengerCount === 1 ? 'passenger' : 'passengers'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPassengerCount(Math.min(maxPassengers, passengerCount + 1))}
                  disabled={passengerCount >= maxPassengers}
                  className="w-12 h-12 rounded-lg border-2 border-charcoal-700 bg-charcoal-800 text-cream-100 text-xl font-bold flex items-center justify-center hover:border-gold-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  +
                </button>
              </div>
              <p className="text-xs text-charcoal-500 mt-2 text-center">
                {vehicleClass === 'EXECUTIVE_SUV' ? 'Executive SUV — max 4 passengers' : 'Premier SUV — max 6 passengers'}
              </p>
            </div>

            {/* Flight Number (required for airport rides) */}
            {(serviceType === 'AIRPORT' || serviceType === 'MULTI_STOP') && (
              <div>
                <label className="block text-sm font-medium text-cream-100 mb-1.5">
                  Flight Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={flightNumber}
                  onChange={(e) => setFlightNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="e.g. DL1234, AA100, UA567"
                  maxLength={10}
                  className={`w-full px-3 py-3 bg-charcoal-800 border-2 rounded-lg text-cream-100 placeholder-charcoal-500 focus:border-gold-400 focus:outline-none transition-colors ${
                    !flightNumber && serviceType === 'AIRPORT' ? 'border-red-500/50' : 'border-charcoal-700'
                  }`}
                />
                <p className="text-xs text-charcoal-500 mt-1">Required for airport rides. We&apos;ll track your flight and adjust pickup if delayed.</p>
              </div>
            )}

            {/* Special Instructions */}
            <div>
              <label className="block text-sm font-medium text-cream-100 mb-1.5">
                Special Instructions <span className="text-charcoal-500">(optional)</span>
              </label>
              <textarea
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                placeholder="Airport terminal, gate number, building entrance, etc."
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
              vehicleClass={vehicleClass}
              serviceType={serviceType}
              estimatedHours={estimatedHours}
              dayRateDuration={dayRateDuration}
              waitTimeTier={waitTimeTier}
              longDistanceDestination={longDistanceDestination}
              tripDirection={tripDirection}
              onVehicleClassChange={(vc) => {
                setVehicleClass(vc)
                // Clamp passenger count to new vehicle max
                const newMax = getVehicleCapacity(vc)
                if (passengerCount > newMax) setPassengerCount(newMax)
              }}
              onServiceTypeChange={setServiceType}
              onEstimatedHoursChange={setEstimatedHours}
              onDayRateDurationChange={setDayRateDuration}
              onWaitTimeTierChange={setWaitTimeTier}
              onLongDistanceDestinationChange={setLongDistanceDestination}
              onTripDirectionChange={setTripDirection}
              isCalculating={isCalculating}
            />

            {/* Error message */}
            {submitError && (
              <div className="error-box text-sm">
                {submitError}
              </div>
            )}

            {/* Date/time required warning */}
            {(!scheduledDate || !selectedSlot) && pickup && dropoff && (
              <div className="bg-charcoal-800 border-2 border-gold-400/50 rounded-lg p-3 text-center">
                <p className="text-sm text-gold-400">
                  ⚠️ Please select a date and time for your ride
                </p>
              </div>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={!pickup || !dropoff || !pricing || pricing.total <= 0 || !selectedSlot || isSubmitting || ((serviceType === 'AIRPORT' || serviceType === 'MULTI_STOP') && !flightNumber.trim())}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="spinner spinner-light" />
                  <span>Confirming...</span>
                </>
              ) : (
                <span>Confirm Booking</span>
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
