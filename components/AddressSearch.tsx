'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Location } from '@/types'
import { METRO_DETROIT } from '@/lib/mapbox'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

interface AddressSearchProps {
  label: string
  placeholder: string
  value: Location | null
  onSelect: (location: Location) => void
  isActive: boolean
  onFocus: () => void
  icon: 'pickup' | 'dropoff'
}

interface Suggestion {
  id: string
  placeName: string
  lat: number
  lng: number
}

export default function AddressSearch({
  label,
  placeholder,
  value,
  onSelect,
  isActive,
  onFocus,
  icon
}: AddressSearchProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isUserTyping, setIsUserTyping] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  // Update input when value changes externally (from map click)
  // Allow update even when active, as long as user isn't actively typing
  useEffect(() => {
    if (value && value.address && !isUserTyping) {
      setQuery(value.address)
      // Hide suggestions when value comes from map
      setShowSuggestions(false)
    }
  }, [value, isUserTyping])

  const searchPlaces = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setSuggestions([])
      return
    }

    setIsLoading(true)

    try {
      const bbox = `${METRO_DETROIT.bounds.sw.lng},${METRO_DETROIT.bounds.sw.lat},${METRO_DETROIT.bounds.ne.lng},${METRO_DETROIT.bounds.ne.lat}`

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `bbox=${bbox}&` +
        `country=US&` +
        `types=address,poi,place&` +
        `limit=5`
      )

      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()

      const results: Suggestion[] = data.features.map((feature: any) => ({
        id: feature.id,
        placeName: feature.place_name,
        lat: feature.center[1],
        lng: feature.center[0]
      }))

      setSuggestions(results)
      setShowSuggestions(true)
    } catch (error) {
      console.error('Search error:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    setIsUserTyping(true)

    // Reset typing flag after user stops typing
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsUserTyping(false)
    }, 1000)

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(newQuery)
    }, 300)
  }

  const handleSelect = (suggestion: Suggestion) => {
    setQuery(suggestion.placeName)
    setShowSuggestions(false)
    setSuggestions([])
    setIsUserTyping(false)

    onSelect({
      address: suggestion.placeName,
      placeId: suggestion.id,
      lat: suggestion.lat,
      lng: suggestion.lng
    })
  }

  const handleFocus = () => {
    onFocus()
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  const handleBlur = () => {
    // Delay hiding suggestions to allow click to register
    setTimeout(() => {
      setShowSuggestions(false)
    }, 200)
  }

  const handleClear = () => {
    setQuery('')
    setSuggestions([])
    setIsUserTyping(false)
    onSelect({ address: '', lat: 0, lng: 0 })
    inputRef.current?.focus()
  }

  // Gold for pickup, charcoal with gold border for dropoff
  const isPickup = icon === 'pickup'

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-cream-100 mb-1.5">
        {label}
      </label>

      <div className={`relative flex items-center rounded-lg border-2 transition-all duration-200 ${
        isActive
          ? 'border-gold-400 bg-charcoal-800'
          : 'border-charcoal-700 bg-charcoal-800 hover:border-charcoal-600'
      }`}>
        {/* Icon */}
        <div className="pl-4">
          <div
            className="w-4 h-4 rounded-full border-2"
            style={{
              backgroundColor: isPickup ? '#22c55e' : '#ef4444',
              borderColor: isPickup ? '#22c55e' : '#ef4444'
            }}
          />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 py-4 px-3 bg-transparent outline-none text-base text-cream-100 placeholder-charcoal-400"
          style={{ fontSize: '16px' }}
        />

        {/* Loading or Clear button */}
        <div className="pr-4">
          {isLoading ? (
            <div className="spinner" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-charcoal-400 hover:text-gold-400 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      {/* Suggestions dropdown - Dark theme */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-charcoal-800 rounded-lg shadow-xl border border-charcoal-700 max-h-60 overflow-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-charcoal-700 border-b border-charcoal-700 last:border-b-0 transition-colors"
            >
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-gold-400 mt-0.5 flex-shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span className="text-sm text-cream-100 leading-tight">
                  {suggestion.placeName}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
