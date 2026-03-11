/**
 * FlightAware AeroAPI integration for SOFIA v6.0 Flight Tracking Module.
 * Polls flight status and provides DTW-specific pickup instructions.
 */

const FLIGHTAWARE_API_URL = 'https://aeroapi.flightaware.com/aeroapi'

// DTW Terminal mapping
const DTW_TERMINAL_MAP: Record<string, { terminal: string; door: string; instructions: string }> = {
  DL: {
    terminal: 'McNamara Terminal',
    door: 'Door 6',
    instructions: 'McNamara Terminal, Door 6 (Ground Transportation level). Your driver will be waiting at the curb.',
  },
  DEFAULT: {
    terminal: 'North Terminal',
    door: 'Door 4',
    instructions: 'North Terminal, Door 4 (Ground Transportation level). Your driver will be waiting at the curb.',
  },
}

export interface FlightAwareResponse {
  flights: Array<{
    ident: string
    operator: string | null
    origin: { code: string; city: string; name: string }
    destination: { code: string; city: string; name: string }
    scheduled_out: string
    scheduled_in: string
    estimated_out: string | null
    estimated_in: string | null
    actual_out: string | null
    actual_in: string | null
    gate_origin: string | null
    gate_destination: string | null
    terminal_origin: string | null
    terminal_destination: string | null
    baggage_claim: string | null
    status: string
    delay_minutes: number | null
  }>
}

export interface ParsedFlightStatus {
  flight_number: string
  airline: string
  departure_airport: string
  arrival_airport: string
  scheduled_departure: string
  scheduled_arrival: string
  actual_departure: string | null
  actual_arrival: string | null
  terminal: string | null
  gate: string | null
  baggage_claim: string | null
  delay_minutes: number
  status: 'scheduled' | 'tracking' | 'landed' | 'cancelled'
  dtw_pickup_instructions: string | null
}

/**
 * Fetch flight status from FlightAware AeroAPI.
 */
export async function getFlightStatus(
  flightNumber: string,
  flightDate: string,
  apiKey: string
): Promise<ParsedFlightStatus | null> {
  try {
    // Normalize flight number (remove spaces, uppercase)
    const normalized = flightNumber.replace(/\s+/g, '').toUpperCase()

    const response = await fetch(
      `${FLIGHTAWARE_API_URL}/flights/${normalized}?start=${flightDate}T00:00:00Z&end=${flightDate}T23:59:59Z`,
      {
        headers: {
          'x-apikey': apiKey,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.error('FlightAware API error:', response.status, await response.text())
      return null
    }

    const data: FlightAwareResponse = await response.json()

    if (!data.flights || data.flights.length === 0) {
      return null
    }

    const flight = data.flights[0]
    const airlineCode = normalized.replace(/\d+/g, '')

    // Determine flight status
    let status: ParsedFlightStatus['status'] = 'scheduled'
    if (flight.actual_in) {
      status = 'landed'
    } else if (flight.status === 'Cancelled') {
      status = 'cancelled'
    } else if (flight.actual_out || flight.estimated_in) {
      status = 'tracking'
    }

    // DTW pickup instructions (only if arriving at DTW)
    let dtw_pickup_instructions: string | null = null
    if (flight.destination.code === 'KDTW' || flight.destination.code === 'DTW') {
      const terminalInfo = DTW_TERMINAL_MAP[airlineCode] || DTW_TERMINAL_MAP.DEFAULT
      dtw_pickup_instructions = terminalInfo.instructions
    }

    return {
      flight_number: normalized,
      airline: airlineCode,
      departure_airport: flight.origin.code.replace(/^K/, ''),
      arrival_airport: flight.destination.code.replace(/^K/, ''),
      scheduled_departure: flight.scheduled_out,
      scheduled_arrival: flight.scheduled_in,
      actual_departure: flight.actual_out,
      actual_arrival: flight.actual_in,
      terminal: flight.terminal_destination,
      gate: flight.gate_destination,
      baggage_claim: flight.baggage_claim,
      delay_minutes: flight.delay_minutes || 0,
      status,
      dtw_pickup_instructions,
    }
  } catch (error) {
    console.error('FlightAware fetch error:', error)
    return null
  }
}

/**
 * Get weather conditions for Detroit airport area.
 */
export async function getDTWWeather(apiKey: string): Promise<string | null> {
  try {
    // DTW coordinates: 42.2124, -83.3534
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=42.2124&lon=-83.3534&units=imperial&appid=${apiKey}`
    )

    if (!response.ok) return null

    const data = await response.json()
    const temp = Math.round(data.main.temp)
    const desc = data.weather[0]?.description || 'clear'
    const visibility = data.visibility ? `${Math.round(data.visibility / 1609)} mi visibility` : ''

    return `${temp}°F, ${desc}${visibility ? `, ${visibility}` : ''}`
  } catch {
    return null
  }
}

/**
 * Determine if polling should start for a flight.
 * Polling starts 3 hours before scheduled arrival.
 */
export function shouldStartPolling(scheduledArrival: string): boolean {
  const arrival = new Date(scheduledArrival)
  const now = new Date()
  const threeHoursBefore = new Date(arrival.getTime() - 3 * 60 * 60 * 1000)
  return now >= threeHoursBefore && now <= arrival
}

/**
 * Generate flight status notification SMS.
 */
export function generateFlightNotificationSMS(
  flight: ParsedFlightStatus,
  weather: string | null
): string {
  const lines: string[] = [`Timeless Rides - Flight Update`]

  if (flight.status === 'landed') {
    lines.push(
      ``,
      `Your flight ${flight.flight_number} has landed!`,
      flight.dtw_pickup_instructions || `Your driver is ready at the terminal.`,
      flight.baggage_claim ? `Baggage claim: ${flight.baggage_claim}` : '',
      weather ? `Weather: ${weather}` : '',
      ``,
      `Your driver is standing by. See you shortly!`
    )
  } else if (flight.delay_minutes > 15) {
    lines.push(
      ``,
      `Flight ${flight.flight_number} is delayed ~${flight.delay_minutes} min.`,
      `We've adjusted your pickup time accordingly.`,
      `No action needed on your end.`
    )
  } else if (flight.status === 'cancelled') {
    lines.push(
      ``,
      `Flight ${flight.flight_number} has been cancelled.`,
      `Please call us at (248) 440-7357 to reschedule your ride.`
    )
  } else if (flight.gate) {
    lines.push(
      ``,
      `Flight ${flight.flight_number} update:`,
      `Gate: ${flight.gate}`,
      flight.terminal ? `Terminal: ${flight.terminal}` : '',
      `On time for arrival.`
    )
  }

  return lines.filter(Boolean).join('\n')
}
