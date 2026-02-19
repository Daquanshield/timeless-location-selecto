'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, List, CalendarDays } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import NavBar from '@/components/dashboard/NavBar'
import EmptyState from '@/components/dashboard/EmptyState'
import AppointmentCalendar from '@/components/dashboard/AppointmentCalendar'
import type { DashboardUser } from '@/lib/dashboard-types'

type TabKey = 'upcoming' | 'archive'
type ViewMode = 'list' | 'calendar'

interface Appointment {
  id: string
  title: string
  rawTitle: string
  status: string
  startTime: string
  endTime: string
  address: string | null
  contactId: string
  serviceType: string | null
  vehicle: string | null
  price: number | null
  paymentNote: string | null
  assignedUserId: string
  createdAt: string
}

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  new: { label: 'New', color: 'text-yellow-900', bg: 'bg-yellow-500' },
  confirmed: { label: 'Confirmed', color: 'text-green-200', bg: 'bg-green-600' },
  cancelled: { label: 'Cancelled', color: 'text-red-200', bg: 'bg-red-600' },
  showed: { label: 'Showed', color: 'text-blue-200', bg: 'bg-blue-600' },
  noshow: { label: 'No Show', color: 'text-orange-200', bg: 'bg-orange-600' },
  invalid: { label: 'Invalid', color: 'text-gray-300', bg: 'bg-gray-600' },
}

function getDetroitNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Detroit' }))
}

export default function AppointmentsPage() {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('upcoming')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [refreshing, setRefreshing] = useState(false)

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => getDetroitNow().getMonth())
  const [calYear, setCalYear] = useState(() => getDetroitNow().getFullYear())
  const [calAppointments, setCalAppointments] = useState<Appointment[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calLoading, setCalLoading] = useState(false)

  const fetchUser = useCallback(async () => {
    const res = await fetch('/api/dashboard/auth/me')
    if (!res.ok) { router.push('/dashboard/login'); return null }
    const data = await res.json()
    if (data.user.role !== 'dispatcher') {
      router.push('/dashboard/driver')
      return null
    }
    setUser(data.user)
    return data.user
  }, [router])

  const fetchAppointments = useCallback(async () => {
    const res = await fetch(`/api/dashboard/appointments?view=${tab}`)
    if (res.ok) {
      const data = await res.json()
      setAppointments(data.appointments || [])
    }
  }, [tab])

  const fetchCalendarAppointments = useCallback(async () => {
    setCalLoading(true)
    const res = await fetch(`/api/dashboard/appointments?view=calendar&month=${calMonth}&year=${calYear}`)
    if (res.ok) {
      const data = await res.json()
      setCalAppointments(data.appointments || [])
    }
    setCalLoading(false)
  }, [calMonth, calYear])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const u = await fetchUser()
      if (u) await fetchAppointments()
      setLoading(false)
    }
    init()
  }, [fetchUser, fetchAppointments])

  // Re-fetch list when tab changes
  useEffect(() => {
    if (!loading && viewMode === 'list') fetchAppointments()
  }, [tab, fetchAppointments, loading, viewMode])

  // Fetch calendar data when switching to calendar view or changing month
  useEffect(() => {
    if (!loading && viewMode === 'calendar') fetchCalendarAppointments()
  }, [viewMode, calMonth, calYear, fetchCalendarAppointments, loading])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(async () => {
      setRefreshing(true)
      if (viewMode === 'list') {
        await fetchAppointments()
      } else {
        await fetchCalendarAppointments()
      }
      setRefreshing(false)
    }, 60000)
    return () => clearInterval(interval)
  }, [fetchAppointments, fetchCalendarAppointments, viewMode])

  const formatDateTime = (iso: string) => {
    const dt = new Date(iso)
    return {
      date: dt.toLocaleDateString('en-US', {
        timeZone: 'America/Detroit',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: dt.toLocaleTimeString('en-US', {
        timeZone: 'America/Detroit',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    }
  }

  const getStatusStyle = (status: string) => {
    return STATUS_STYLES[status] || { label: status, color: 'text-gray-300', bg: 'bg-gray-600' }
  }

  // Get appointments for the selected calendar date
  const selectedDateAppointments = selectedDate
    ? calAppointments.filter((apt) => {
        const aptDate = new Date(apt.startTime).toLocaleDateString('en-CA', { timeZone: 'America/Detroit' })
        return aptDate === selectedDate
      })
    : []

  const renderAppointmentCard = (apt: Appointment) => {
    const { date, time } = formatDateTime(apt.startTime)
    const endFormatted = formatDateTime(apt.endTime)
    const style = getStatusStyle(apt.status)

    return (
      <Card key={apt.id}>
        <CardContent className="p-4">
          {/* Top row: date/time + status */}
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-display text-lg text-primary">{time}</div>
              <div className="text-muted-foreground text-xs">{date} — ends {endFormatted.time}</div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.color} ${style.bg}`}>
              {style.label}
            </span>
          </div>

          {/* Title */}
          <div className="text-foreground text-sm mb-2">{apt.title}</div>

          {/* Details row */}
          <div className="flex flex-wrap gap-3 text-xs">
            {apt.serviceType && (
              <span className="text-muted-foreground">
                <span className="text-muted-foreground/60">Service:</span> {apt.serviceType}
              </span>
            )}
            {apt.vehicle && (
              <span className="text-muted-foreground">
                <span className="text-muted-foreground/60">Vehicle:</span> {apt.vehicle}
              </span>
            )}
            {apt.price && (
              <span className="text-primary font-display text-sm">${apt.price}</span>
            )}
            {apt.paymentNote && (
              <Badge
                variant="secondary"
                className={
                  apt.paymentNote.includes('PAID') ? 'bg-green-600/20 text-green-300' :
                  apt.paymentNote.includes('CONFIRMED') ? 'bg-blue-600/20 text-blue-300' :
                  'bg-yellow-600/20 text-yellow-300'
                }
              >
                {apt.paymentNote}
              </Badge>
            )}
          </div>

          {/* Address */}
          {apt.address && (
            <>
              <Separator className="mt-2 mb-2" />
              <div>
                <div className="text-muted-foreground/60 text-xs">Address</div>
                <div className="text-foreground/60 text-xs">{apt.address}</div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <NavBar userName={user?.name || ''} userRole="dispatcher" />
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Refresh indicator */}
        {refreshing && (
          <div className="flex justify-center mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-2xl text-primary">GHL Appointments</h1>
          <span className="text-muted-foreground text-sm">
            {viewMode === 'list' ? `${appointments.length} total` : `${calAppointments.length} this month`}
          </span>
        </div>

        {/* View mode toggle */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="mb-3">
          <TabsList className="w-full">
            <TabsTrigger value="list" className="flex-1 gap-1.5">
              <List className="h-3.5 w-3.5" />
              List
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex-1 gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* List view */}
        {viewMode === 'list' && (
          <>
            {/* Upcoming/Archive tabs */}
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-4">
              <TabsList className="w-full">
                <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
                <TabsTrigger value="archive" className="flex-1">Archive</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Appointment list */}
            {appointments.length > 0 ? (
              <div className="space-y-3">
                {appointments.map(renderAppointmentCard)}
              </div>
            ) : (
              <EmptyState
                title={tab === 'upcoming' ? 'No upcoming appointments' : 'No archived appointments'}
                message={tab === 'upcoming'
                  ? 'Upcoming GHL appointments will appear here.'
                  : 'Past and cancelled appointments will appear here.'
                }
              />
            )}
          </>
        )}

        {/* Calendar view */}
        {viewMode === 'calendar' && (
          <>
            <Card className="mb-4">
              <CardContent className="p-4">
                {calLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <AppointmentCalendar
                    appointments={calAppointments}
                    onSelectDate={setSelectedDate}
                    selectedDate={selectedDate}
                    currentMonth={calMonth}
                    currentYear={calYear}
                    onMonthChange={(m, y) => { setCalMonth(m); setCalYear(y) }}
                  />
                )}
              </CardContent>
            </Card>

            {/* Selected day appointments */}
            {selectedDate && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-foreground/70 text-sm font-medium">
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h2>
                  <span className="text-muted-foreground text-xs">
                    {selectedDateAppointments.length} appointment{selectedDateAppointments.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {selectedDateAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDateAppointments.map(renderAppointmentCard)}
                  </div>
                ) : (
                  <Card>
                    <CardContent className="text-center py-6">
                      <p className="text-muted-foreground text-sm">No appointments on this day</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {!selectedDate && (
              <div className="text-center py-4">
                <p className="text-muted-foreground/60 text-sm">Tap a day to see its appointments</p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
