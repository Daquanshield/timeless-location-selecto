'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import type { Location, Stop } from '@/types'
import { METRO_DETROIT, getBoundsForLocations, reverseGeocode } from '@/lib/mapbox'

// Set the Mapbox access token
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface MapContainerProps {
  pickup: Location | null
  dropoff: Location | null
  stops?: Stop[]
  routeGeometry: string | null
  onMapClick: (lat: number, lng: number, address: string) => void
  selectingPickup: boolean
  onUseMyLocation?: (lat: number, lng: number, address: string) => void
}

export default function MapContainer({
  pickup,
  dropoff,
  stops = [],
  routeGeometry,
  onMapClick,
  selectingPickup,
  onUseMyLocation
}: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const pickupMarker = useRef<mapboxgl.Marker | null>(null)
  const dropoffMarker = useRef<mapboxgl.Marker | null>(null)
  const stopMarkers = useRef<mapboxgl.Marker[]>([])
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)

  // Handle "Use My Location" button click
  const handleUseMyLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }

    setIsGettingLocation(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords

        // Reverse geocode to get address
        const address = await reverseGeocode(lat, lng)

        if (address && onUseMyLocation) {
          onUseMyLocation(lat, lng, address)

          // Center map on user location
          if (map.current) {
            map.current.flyTo({
              center: [lng, lat],
              zoom: 15,
              duration: 1000
            })
          }
        } else {
          setLocationError('Could not determine your address')
        }

        setIsGettingLocation(false)
      },
      (error) => {
        setIsGettingLocation(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied')
            break
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location unavailable')
            break
          case error.TIMEOUT:
            setLocationError('Location request timed out')
            break
          default:
            setLocationError('Could not get your location')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    )
  }, [onUseMyLocation])

  // Use ref to always have the latest callback (fixes stale closure issue)
  const onMapClickRef = useRef(onMapClick)
  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [METRO_DETROIT.center.lng, METRO_DETROIT.center.lat],
      zoom: METRO_DETROIT.zoom,
      attributionControl: false
    })

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'top-right'
    )

    // Add geolocate control
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
        showUserHeading: false
      }),
      'top-right'
    )

    // Handle map clicks - use ref to always get latest callback
    map.current.on('click', async (e) => {
      const { lat, lng } = e.lngLat
      const address = await reverseGeocode(lat, lng)
      if (address) {
        onMapClickRef.current(lat, lng, address)
      }
    })

    // Change cursor based on selection mode
    map.current.getCanvas().style.cursor = 'crosshair'

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Update cursor based on selection mode
  useEffect(() => {
    if (!map.current) return
    map.current.getCanvas().style.cursor = 'crosshair'
  }, [selectingPickup])

  // Update pickup marker
  useEffect(() => {
    if (!map.current) return

    // Remove existing marker
    if (pickupMarker.current) {
      pickupMarker.current.remove()
      pickupMarker.current = null
    }

    // Add new marker if pickup exists - Green for visibility
    if (pickup) {
      const el = document.createElement('div')
      el.className = 'marker-pickup'
      el.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <circle cx="12" cy="12" r="5"/>
          </svg>
        </div>
      `

      pickupMarker.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([pickup.lng, pickup.lat])
        .addTo(map.current)
    }
  }, [pickup])

  // Update dropoff marker
  useEffect(() => {
    if (!map.current) return

    // Remove existing marker
    if (dropoffMarker.current) {
      dropoffMarker.current.remove()
      dropoffMarker.current = null
    }

    // Add new marker if dropoff exists - Red for visibility
    if (dropoff) {
      const el = document.createElement('div')
      el.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          </svg>
        </div>
      `

      dropoffMarker.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([dropoff.lng, dropoff.lat])
        .addTo(map.current)
    }
  }, [dropoff])

  // Update stop markers
  useEffect(() => {
    if (!map.current) return

    // Remove existing stop markers
    stopMarkers.current.forEach(marker => marker.remove())
    stopMarkers.current = []

    // Add new markers for each stop - Orange for visibility
    stops.forEach((stop, index) => {
      if (!stop.lat || !stop.lng || !map.current) return

      const el = document.createElement('div')
      el.innerHTML = `
        <div style="
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          border: 4px solid white;
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: 14px;
        ">
          ${index + 1}
        </div>
      `

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([stop.lng, stop.lat])
        .addTo(map.current)

      stopMarkers.current.push(marker)
    })
  }, [stops])

  // Update route layer
  useEffect(() => {
    if (!map.current) return

    const sourceId = 'route'
    const layerId = 'route-line'

    // Wait for map to load
    if (!map.current.isStyleLoaded()) {
      map.current.once('style.load', () => updateRoute())
      return
    }

    updateRoute()

    function updateRoute() {
      if (!map.current) return

      // Remove existing route
      if (map.current.getLayer(layerId)) {
        map.current.removeLayer(layerId)
      }
      if (map.current.getSource(sourceId)) {
        map.current.removeSource(sourceId)
      }

      // Add new route if geometry exists
      if (routeGeometry) {
        try {
          const geometry = JSON.parse(routeGeometry)

          map.current.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry
            }
          })

          map.current.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
              'line-join': 'round',
              'line-cap': 'round'
            },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 6,
              'line-opacity': 0.9
            }
          })
        } catch (e) {
          console.error('Failed to parse route geometry:', e)
        }
      }
    }
  }, [routeGeometry])

  // Fit map to markers when both exist
  useEffect(() => {
    if (!map.current || !pickup || !dropoff) return

    // Include all locations in bounds
    const allLocations: Location[] = [pickup, dropoff]
    stops.forEach(stop => {
      if (stop.lat && stop.lng) {
        allLocations.push(stop)
      }
    })

    const bounds = getBoundsForLocations(allLocations)
    map.current.fitBounds(bounds, {
      padding: { top: 100, bottom: 350, left: 50, right: 50 },
      duration: 500
    })
  }, [pickup, dropoff, stops])

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Use My Location button */}
      {onUseMyLocation && (
        <button
          onClick={handleUseMyLocation}
          disabled={isGettingLocation}
          className="absolute bottom-4 right-4 bg-charcoal-800 border-2 border-gold-400 text-gold-400 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 hover:bg-charcoal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ zIndex: 10 }}
          aria-label="Use my current location"
        >
          {isGettingLocation ? (
            <>
              <div className="spinner spinner-sm" />
              <span className="text-sm font-medium">Getting location...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
              </svg>
              <span className="text-sm font-medium">Use My Location</span>
            </>
          )}
        </button>
      )}

      {/* Location error toast */}
      {locationError && (
        <div
          className="absolute bottom-20 right-4 bg-red-900/90 text-red-100 px-4 py-2 rounded-lg shadow-lg text-sm max-w-xs"
          style={{ zIndex: 10 }}
        >
          {locationError}
          <button
            onClick={() => setLocationError(null)}
            className="ml-2 text-red-300 hover:text-white"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  )
}
