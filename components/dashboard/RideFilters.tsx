'use client'

import { useState } from 'react'
import { Filter } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
      status: (status && status !== 'all') ? status : undefined,
      driver_phone: (driverPhone && driverPhone !== 'all') ? driverPhone : undefined,
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

  const hasFilters = (status && status !== 'all') || (driverPhone && driverPhone !== 'all') || dateFrom || dateTo

  return (
    <div className="mb-4">
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="text-muted-foreground hover:text-foreground mb-2 gap-2"
      >
        <Filter className="h-4 w-4" />
        Filters
        {hasFilters && (
          <span className="w-2 h-2 rounded-full bg-primary" />
        )}
      </Button>

      {open && (
        <Card className="mb-3">
          <CardContent className="p-4 space-y-3">
            {/* Status */}
            <div>
              <Label className="text-muted-foreground text-xs">Status</Label>
              <Select value={status || 'all'} onValueChange={setStatus}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="en_route">En Route</SelectItem>
                  <SelectItem value="arrived">Arrived</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Driver */}
            <div>
              <Label className="text-muted-foreground text-xs">Driver</Label>
              <Select value={driverPhone || 'all'} onValueChange={setDriverPhone}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {drivers.map(d => (
                    <SelectItem key={d.phone} value={d.phone}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-muted-foreground text-xs">From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button onClick={apply} className="flex-1" size="sm">
                Apply
              </Button>
              {hasFilters && (
                <Button onClick={clear} variant="outline" size="sm">
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
