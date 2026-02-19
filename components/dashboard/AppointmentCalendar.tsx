'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  title: string
  status: string
  startTime: string
  endTime: string
  address: string | null
  serviceType: string | null
  vehicle: string | null
  price: number | null
  paymentNote: string | null
}

interface AppointmentCalendarProps {
  appointments: Appointment[]
  onSelectDate: (date: string | null) => void
  selectedDate: string | null
  currentMonth: number // 0-indexed
  currentYear: number
  onMonthChange: (month: number, year: number) => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const STATUS_DOT_COLORS: Record<string, string> = {
  new: 'bg-primary',
  confirmed: 'bg-green-500',
  cancelled: 'bg-destructive',
  showed: 'bg-blue-500',
  noshow: 'bg-orange-500',
}

function toDetroitDateStr(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Detroit' })
}

function getDetroitToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Detroit' })
}

export default function AppointmentCalendar({
  appointments,
  onSelectDate,
  selectedDate,
  currentMonth,
  currentYear,
  onMonthChange,
}: AppointmentCalendarProps) {
  // Group appointments by date (Detroit timezone)
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {}
    for (const apt of appointments) {
      const dateKey = toDetroitDateStr(apt.startTime)
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(apt)
    }
    return map
  }, [appointments])

  const todayStr = getDetroitToday()

  // Build calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate()

  const cells: { day: number; month: number; year: number; dateStr: string; isCurrentMonth: boolean }[] = []

  for (let i = startOffset - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const m = currentMonth === 0 ? 11 : currentMonth - 1
    const y = currentMonth === 0 ? currentYear - 1 : currentYear
    cells.push({
      day: d, month: m, year: y,
      dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
    })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d, month: currentMonth, year: currentYear,
      dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: true,
    })
  }

  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const m = currentMonth === 11 ? 0 : currentMonth + 1
    const y = currentMonth === 11 ? currentYear + 1 : currentYear
    cells.push({
      day: d, month: m, year: y,
      dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
    })
  }

  const goToPrevMonth = () => {
    if (currentMonth === 0) onMonthChange(11, currentYear - 1)
    else onMonthChange(currentMonth - 1, currentYear)
    onSelectDate(null)
  }

  const goToNextMonth = () => {
    if (currentMonth === 11) onMonthChange(0, currentYear + 1)
    else onMonthChange(currentMonth + 1, currentYear)
    onSelectDate(null)
  }

  const goToToday = () => {
    const now = new Date()
    const detroitNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Detroit' }))
    onMonthChange(detroitNow.getMonth(), detroitNow.getFullYear())
    onSelectDate(todayStr)
  }

  const monthName = new Date(currentYear, currentMonth).toLocaleString('en-US', { month: 'long' })

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={goToPrevMonth} className="text-muted-foreground hover:text-primary">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <span className="font-display text-lg text-primary">{monthName} {currentYear}</span>
          <Button
            variant="link"
            size="sm"
            onClick={goToToday}
            className="block mx-auto text-muted-foreground text-xs h-auto py-0"
          >
            Today
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={goToNextMonth} className="text-muted-foreground hover:text-primary">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map((d) => (
          <div key={d} className="text-center text-muted-foreground/50 text-xs font-medium py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden bg-card">
        {cells.map((cell, i) => {
          const dayApts = appointmentsByDate[cell.dateStr] || []
          const isToday = cell.dateStr === todayStr
          const isSelected = cell.dateStr === selectedDate
          const hasApts = dayApts.length > 0

          return (
            <button
              key={i}
              onClick={() => onSelectDate(isSelected ? null : cell.dateStr)}
              className={cn(
                'relative flex flex-col items-center py-2 min-h-[52px] transition-colors',
                isSelected ? 'bg-primary/15' : cell.isCurrentMonth ? 'bg-background' : 'bg-background/60',
              )}
            >
              <span
                className={cn(
                  'text-sm leading-none',
                  isSelected && 'text-primary font-medium',
                  isToday && !isSelected && 'text-primary inline-flex items-center justify-center w-6 h-6 rounded-full border-[1.5px] border-primary',
                  !isSelected && !isToday && cell.isCurrentMonth && 'text-foreground/70',
                  !isSelected && !isToday && !cell.isCurrentMonth && 'text-foreground/20',
                )}
              >
                {cell.day}
              </span>

              {/* Appointment indicators */}
              {hasApts && (
                <div className="flex items-center gap-0.5 mt-1">
                  {dayApts.length <= 3 ? (
                    dayApts.map((apt, j) => (
                      <span
                        key={j}
                        className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT_COLORS[apt.status] || 'bg-muted-foreground')}
                      />
                    ))
                  ) : (
                    <>
                      <span className={cn('w-1.5 h-1.5 rounded-full', STATUS_DOT_COLORS[dayApts[0].status] || 'bg-muted-foreground')} />
                      <span className="text-[9px] text-muted-foreground leading-none ml-0.5">
                        +{dayApts.length - 1}
                      </span>
                    </>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
