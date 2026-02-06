import { NextRequest, NextResponse } from 'next/server'

const GHL_CALENDAR_ID = 'SuCiIaa9kJOjTlwirO74'
const GHL_API_KEY = 'pit-43964b83-eaaf-4d1c-9296-79ca285270d8'
const GHL_LOCATION_ID = '9f8lj2gn9ldOJVzae8bT'
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
const TRAVEL_BUFFER_MINUTES = 15 // Safety buffer for traffic, accidents, etc.

// GHL returns slots as array of ISO datetime strings
interface GHLSlotsResponse {
  [date: string]: {
    slots: string[]  // Array of ISO datetime strings like "2026-02-19T09:00:00-05:00"
  }
}

// GHL appointment structure
interface GHLAppointment {
  id: string
  calendarId: string
  contactId: string
  startTime: string  // ISO datetime
  endTime: string    // ISO datetime
  title: string
  appointmentStatus: string
  notes?: string
}

// Extract dropoff coordinates from appointment notes
function extractDropoffCoordinates(notes: string | undefined): { lat: number; lng: number } | null {
  if (!notes) return null

  // Notes format includes: [DROPOFF_COORDS]lat,lng[/DROPOFF_COORDS]
  const match = notes.match(/\[DROPOFF_COORDS\]([-\d.]+),([-\d.]+)\[\/DROPOFF_COORDS\]/)

  if (!match) return null

  const lat = parseFloat(match[1])
  const lng = parseFloat(match[2])

  if (isNaN(lat) || isNaN(lng)) return null

  return { lat, lng }
}

// Calculate route duration between two points using Google Maps API
async function calculateTravelTime(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<number | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key not configured')
    return null
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`

    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' && data.routes[0]) {
      const durationSeconds = data.routes[0].legs[0].duration.value
      return Math.ceil(durationSeconds / 60) // Convert to minutes
    }

    return null
  } catch (error) {
    console.error('Error calculating travel time:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date')
  const pickupLat = request.nextUrl.searchParams.get('pickupLat')
  const pickupLng = request.nextUrl.searchParams.get('pickupLng')
  // SOFIA v4: Accept vehicleClass for future per-vehicle calendar filtering
  const _vehicleClass = request.nextUrl.searchParams.get('vehicleClass') // reserved for V1.1

  if (!date) {
    return NextResponse.json(
      { error: 'Date is required (YYYY-MM-DD format)' },
      { status: 400 }
    )
  }

  // Parse pickup coordinates if provided
  const hasPickupCoords = pickupLat && pickupLng
  const pickupCoords = hasPickupCoords ? {
    lat: parseFloat(pickupLat),
    lng: parseFloat(pickupLng)
  } : null

  try {
    // Calculate start and end timestamps for the requested date
    const startOfDay = new Date(date + 'T00:00:00-05:00') // Detroit timezone
    const endOfDay = new Date(date + 'T23:59:59-05:00')

    const startDate = startOfDay.getTime()
    const endDate = endOfDay.getTime()

    // Fetch available slots from GHL
    const slotsUrl = `https://services.leadconnectorhq.com/calendars/${GHL_CALENDAR_ID}/free-slots?startDate=${startDate}&endDate=${endDate}&timezone=America/Detroit`

    const slotsResponse = await fetch(slotsUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-04-15'
      }
    })

    if (!slotsResponse.ok) {
      console.error('GHL API error:', slotsResponse.status, await slotsResponse.text())
      return NextResponse.json(
        { error: 'Failed to fetch available slots' },
        { status: 500 }
      )
    }

    const data: GHLSlotsResponse = await slotsResponse.json()

    // Log raw GHL response for debugging
    console.log(`GHL free-slots response for ${date}:`, JSON.stringify(data, null, 2))

    // Fetch existing appointments for the day (for travel buffer calculation)
    let existingAppointments: GHLAppointment[] = []
    if (hasPickupCoords) {
      try {
        const appointmentsUrl = `https://services.leadconnectorhq.com/calendars/events/appointments?locationId=${GHL_LOCATION_ID}&startTime=${startDate}&endTime=${endDate}`

        const appointmentsResponse = await fetch(appointmentsUrl, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Version': '2021-04-15'
          }
        })

        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json()
          existingAppointments = appointmentsData.events || []
          console.log(`Found ${existingAppointments.length} existing appointments for ${date}`)
        }
      } catch (error) {
        console.error('Error fetching existing appointments:', error)
        // Continue without appointments data - will fall back to showing all free slots
      }
    }

    // Transform the response to a simpler format
    const slots: { time: string; startTime: string; endTime: string }[] = []

    // GHL returns slots grouped by date as array of ISO strings
    for (const dateKey of Object.keys(data)) {
      // Skip non-date keys like 'traceId'
      if (dateKey === 'traceId') continue

      const daySlots = data[dateKey]?.slots || []
      for (const slotTime of daySlots) {
        // slotTime is an ISO datetime string like "2026-02-19T09:00:00-05:00"
        const startDateTime = new Date(slotTime)

        // Skip invalid dates
        if (isNaN(startDateTime.getTime())) continue

        const timeString = startDateTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/Detroit'
        })

        slots.push({
          time: timeString,
          startTime: slotTime,
          endTime: slotTime  // GHL doesn't provide end time, using same as start
        })
      }
    }

    // Sort by time
    slots.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    // Filter to only show reasonable hours (6 AM - 11 PM) and reduce granularity
    // IMPORTANT: Use Detroit timezone for hour/minute extraction, not server timezone (UTC)
    let filteredSlots = slots.filter(slot => {
      const date = new Date(slot.startTime)
      // Get hour and minute in Detroit timezone specifically
      const detroitHour = parseInt(date.toLocaleString('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: 'America/Detroit'
      }))
      const detroitMinute = parseInt(date.toLocaleString('en-US', {
        minute: 'numeric',
        timeZone: 'America/Detroit'
      }))
      // Only keep slots between 6 AM and 11 PM, at 30-minute intervals
      const isValid = detroitHour >= 6 && detroitHour <= 23 && (detroitMinute === 0 || detroitMinute === 30)
      if (!isValid) {
        console.log(`Filtering out slot ${slot.startTime} - Detroit hour: ${detroitHour}, minute: ${detroitMinute}`)
      }
      return isValid
    })

    console.log(`After time filtering: ${filteredSlots.length} slots (from ${slots.length} total)`)

    // Apply dynamic travel buffer filtering if pickup coordinates are provided
    if (pickupCoords && existingAppointments.length > 0) {
      console.log(`Applying dynamic travel buffer for ${filteredSlots.length} slots`)

      const filteredWithBuffer = []

      for (const slot of filteredSlots) {
        const slotTime = new Date(slot.startTime).getTime()

        // Find the most recent appointment before this slot
        const previousAppointment = existingAppointments
          .filter(apt => new Date(apt.endTime).getTime() <= slotTime)
          .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0]

        if (!previousAppointment) {
          // No previous appointment, slot is available
          filteredWithBuffer.push(slot)
          continue
        }

        // Try to extract dropoff coordinates from appointment notes
        const dropoffCoords = extractDropoffCoordinates(previousAppointment.notes)

        if (!dropoffCoords) {
          // Can't calculate travel time without dropoff coords
          // Use conservative approach: require minimum time gap
          const appointmentEndTime = new Date(previousAppointment.endTime).getTime()
          const timeDifferenceMinutes = (slotTime - appointmentEndTime) / (1000 * 60)

          // Require at least 60 minutes between appointments (default buffer)
          if (timeDifferenceMinutes >= 60) {
            filteredWithBuffer.push(slot)
          } else {
            console.log(`Slot ${slot.time} filtered: only ${timeDifferenceMinutes}min after previous appointment (need 60min)`)
          }
          continue
        }

        // Calculate actual travel time from previous dropoff to new pickup
        const travelTimeMinutes = await calculateTravelTime(
          dropoffCoords.lat,
          dropoffCoords.lng,
          pickupCoords.lat,
          pickupCoords.lng
        )

        if (travelTimeMinutes === null) {
          // Error calculating route, use conservative default
          const appointmentEndTime = new Date(previousAppointment.endTime).getTime()
          const timeDifferenceMinutes = (slotTime - appointmentEndTime) / (1000 * 60)

          if (timeDifferenceMinutes >= 60) {
            filteredWithBuffer.push(slot)
          }
          continue
        }

        // Check if there's enough time: travel time + safety buffer
        const requiredBufferMinutes = travelTimeMinutes + TRAVEL_BUFFER_MINUTES
        const appointmentEndTime = new Date(previousAppointment.endTime).getTime()
        const availableMinutes = (slotTime - appointmentEndTime) / (1000 * 60)

        if (availableMinutes >= requiredBufferMinutes) {
          filteredWithBuffer.push(slot)
          console.log(`Slot ${slot.time} available: ${availableMinutes}min gap (need ${requiredBufferMinutes}min)`)
        } else {
          console.log(`Slot ${slot.time} filtered: only ${availableMinutes}min gap (need ${requiredBufferMinutes}min = ${travelTimeMinutes}min travel + ${TRAVEL_BUFFER_MINUTES}min buffer)`)
        }
      }

      filteredSlots = filteredWithBuffer
      console.log(`After dynamic filtering: ${filteredSlots.length} slots available`)
    }

    return NextResponse.json({
      date,
      slots: filteredSlots,
      timezone: 'America/Detroit'
    })
  } catch (error) {
    console.error('Error fetching slots:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
