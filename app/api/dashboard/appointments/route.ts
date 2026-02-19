import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

const GHL_API_KEY = 'pit-43964b83-eaaf-4d1c-9296-79ca285270d8'
const GHL_LOCATION_ID = '9f8lj2gn9ldOJVzae8bT'
const GHL_CALENDAR_ID = 'SuCiIaa9kJOjTlwirO74'

interface GHLEvent {
  id: string
  title: string
  appointmentStatus: string
  startTime: string
  endTime: string
  address: string
  contactId: string
  dateAdded: string
  dateUpdated: string
  assignedUserId: string
  isRecurring: boolean
  deleted: boolean
}

function parseTitle(title: string) {
  // Try to parse structured titles like "Airport Transfer — Executive SUV — $95 (UNCONFIRMED)"
  const structured = title.match(/^(.+?)\s*—\s*(.+?)\s*—\s*\$(\d+(?:\.\d+)?)\s*\((.+?)\)$/)
  if (structured) {
    return {
      serviceType: structured[1].trim(),
      vehicle: structured[2].trim(),
      price: parseFloat(structured[3]),
      paymentNote: structured[4].trim(),
      displayTitle: `${structured[1].trim()} — ${structured[2].trim()}`,
    }
  }

  // Try "Timeless Rides - Address to Address (STATUS)"
  const legacy = title.match(/^Timeless Rides\s*-\s*(.+?)\s+to\s+(.+?)(?:\s*\((.+?)\))?$/)
  if (legacy) {
    return {
      serviceType: null,
      vehicle: null,
      price: null,
      paymentNote: legacy[3]?.trim() || null,
      displayTitle: `${legacy[1].trim()} → ${legacy[2].trim()}`,
    }
  }

  // Try "pickup -> dropoff for name"
  const simple = title.match(/^(.+?)\s*->\s*(.+?)\s+for\s+(.+)$/)
  if (simple) {
    return {
      serviceType: null,
      vehicle: null,
      price: null,
      paymentNote: null,
      displayTitle: `${simple[1].trim()} → ${simple[2].trim()} (${simple[3].trim()})`,
    }
  }

  return {
    serviceType: null,
    vehicle: null,
    price: null,
    paymentNote: null,
    displayTitle: title,
  }
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-appointments:${ip}`, { maxRequests: 30, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (auth.user.role !== 'dispatcher') {
    return NextResponse.json({ error: 'Dispatcher only' }, { status: 403 })
  }

  const view = request.nextUrl.searchParams.get('view') || 'upcoming'

  const now = Date.now()
  let startTime: number
  let endTime: number

  if (view === 'calendar') {
    // Calendar view: fetch full month range
    const monthParam = parseInt(request.nextUrl.searchParams.get('month') || '')
    const yearParam = parseInt(request.nextUrl.searchParams.get('year') || '')
    const calMonth = isNaN(monthParam) ? new Date().getMonth() : monthParam
    const calYear = isNaN(yearParam) ? new Date().getFullYear() : yearParam
    startTime = new Date(calYear, calMonth, 1).getTime()
    endTime = new Date(calYear, calMonth + 1, 0, 23, 59, 59, 999).getTime()
  } else if (view === 'archive') {
    startTime = now - 90 * 24 * 60 * 60 * 1000 // 90 days ago
    endTime = now
  } else {
    startTime = now
    endTime = now + 60 * 24 * 60 * 60 * 1000 // 60 days ahead
  }

  try {
    const url = `https://services.leadconnectorhq.com/calendars/events?locationId=${GHL_LOCATION_ID}&calendarId=${GHL_CALENDAR_ID}&startTime=${startTime}&endTime=${endTime}`

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-04-15',
      },
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('GHL appointments fetch failed:', res.status, text.substring(0, 200))
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 502 })
    }

    const data = await res.json()
    const events: GHLEvent[] = data.events || []

    // Filter based on view
    let filtered: GHLEvent[]
    if (view === 'calendar') {
      // Calendar: all non-deleted events for the month
      filtered = events.filter(e => !e.deleted)
      filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    } else if (view === 'archive') {
      // Archive: cancelled OR past (endTime before now)
      filtered = events.filter(e =>
        e.appointmentStatus === 'cancelled' || new Date(e.endTime).getTime() < now
      )
      // Sort newest first
      filtered.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    } else {
      // Upcoming: non-cancelled, not deleted
      filtered = events.filter(e =>
        e.appointmentStatus !== 'cancelled' && !e.deleted
      )
      // Sort by start time ascending (soonest first)
      filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    }

    const appointments = filtered.map(e => {
      const parsed = parseTitle(e.title)
      return {
        id: e.id,
        title: parsed.displayTitle,
        rawTitle: e.title,
        status: e.appointmentStatus,
        startTime: e.startTime,
        endTime: e.endTime,
        address: e.address || null,
        contactId: e.contactId,
        serviceType: parsed.serviceType,
        vehicle: parsed.vehicle,
        price: parsed.price,
        paymentNote: parsed.paymentNote,
        assignedUserId: e.assignedUserId,
        createdAt: e.dateAdded,
      }
    })

    return NextResponse.json({
      appointments,
      total: appointments.length,
      view,
    })
  } catch (err) {
    console.error('GHL appointments error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
