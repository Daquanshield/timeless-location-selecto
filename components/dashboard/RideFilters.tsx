'use client'

import { useState } from 'react'

interface Driver {
  phone: string
  name: string
}

interface RideFiltersProps {
  drivers: Driver[]
  onFilterChange: (filters: {
    status?: string
    driver_phone?: string
    date_from?: string
    date_to?: string
  }) => void
}

export default function RideFilters({ drivers, onFilterChange }: RideFiltersProps) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const apply = () => {
    onFilterChange({
      status: status || undefined,
      driver_phone: driverPhone || undefined,
      date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      date_to: dateTo ? new Date(dateTo + 'T23:59:59').toISOString() : undefined,
    })
  }

  const clear = () => {
    setStatus('')
    setDriverPhone('')
    setDateFrom('')
    setDateTo('')
    onFilterChange({})
  }

  const hasFilters = status || driverPhone || dateFrom || dateTo

  return (
    <div className="mb-4">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-cream/50 hover:text-cream text-sm mb-2"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4h12M4 8h8M6 12h4" strokeLinecap="round" />
        </svg>
        Filters
        {hasFilters && (
          <span className="w-2 h-2 rounded-full bg-gold" />
        )}
      </button>

      {open && (
        <div className="location-card space-y-3 mb-3">
          {/* Status */}
          <div>
            <label className="text-cream/40 text-xs block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="en_route">En Route</option>
              <option value="arrived">Arrived</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Driver */}
          <div>
            <label className="text-cream/40 text-xs block mb-1">Driver</label>
            <select
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              className="input-field text-sm py-2"
            >
              <option value="">All Drivers</option>
              {drivers.map(d => (
                <option key={d.phone} value={d.phone}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-cream/40 text-xs block mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field text-sm py-2"
              />
            </div>
            <div>
              <label className="text-cream/40 text-xs block mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field text-sm py-2"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={apply} className="btn-primary flex-1 py-2 text-sm" style={{ minHeight: 'auto' }}>
              Apply
            </button>
            {hasFilters && (
              <button onClick={clear} className="btn-secondary py-2 px-4 text-sm">
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
