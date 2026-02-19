'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface CreateRideFormProps {
  onCreated: () => void
  onCancel: () => void
}

export default function CreateRideForm({ onCreated, onCancel }: CreateRideFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    pickup_address: '',
    dropoff_address: '',
    pickup_date: '',
    pickup_time: '',
    service_type: 'Airport Transfer',
    vehicle_class: 'Executive SUV',
    number_of_passengers: '1',
    special_instructions: '',
    quoted_price: '',
    payment_status: 'unpaid',
  })

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    if (!form.pickup_date || !form.pickup_time) {
      setError('Date and time are required')
      setSaving(false)
      return
    }

    const pickupDatetime = new Date(`${form.pickup_date}T${form.pickup_time}`).toISOString()

    const res = await fetch('/api/rides/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_name: form.client_name,
        client_phone: form.client_phone,
        client_email: form.client_email || undefined,
        pickup_address: form.pickup_address,
        dropoff_address: form.dropoff_address,
        pickup_datetime: pickupDatetime,
        service_type: form.service_type,
        vehicle_class: form.vehicle_class,
        number_of_passengers: parseInt(form.number_of_passengers) || 1,
        special_instructions: form.special_instructions || undefined,
        quoted_price: form.quoted_price ? parseFloat(form.quoted_price) : undefined,
        payment_status: form.payment_status,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to create ride')
      setSaving(false)
      return
    }

    onCreated()
  }

  return (
    <Card className="mb-4">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-primary font-display text-lg">New Ride</CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            Cancel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Client Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs">Client Name *</Label>
              <Input
                type="text"
                value={form.client_name}
                onChange={(e) => setForm(f => ({ ...f, client_name: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Phone</Label>
              <Input
                type="tel"
                value={formatPhone(form.client_phone)}
                onChange={(e) => setForm(f => ({ ...f, client_phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                placeholder="(248) 555-0123"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={form.client_email}
                onChange={(e) => setForm(f => ({ ...f, client_email: e.target.value }))}
                className="mt-1"
              />
            </div>
          </div>

          {/* Addresses */}
          <div>
            <Label className="text-xs">Pickup Address *</Label>
            <Input
              type="text"
              value={form.pickup_address}
              onChange={(e) => setForm(f => ({ ...f, pickup_address: e.target.value }))}
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label className="text-xs">Dropoff Address *</Label>
            <Input
              type="text"
              value={form.dropoff_address}
              onChange={(e) => setForm(f => ({ ...f, dropoff_address: e.target.value }))}
              className="mt-1"
              required
            />
          </div>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input
                type="date"
                value={form.pickup_date}
                onChange={(e) => setForm(f => ({ ...f, pickup_date: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label className="text-xs">Time *</Label>
              <Input
                type="time"
                value={form.pickup_time}
                onChange={(e) => setForm(f => ({ ...f, pickup_time: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
          </div>

          {/* Service Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Service Type</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm(f => ({ ...f, service_type: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Airport Transfer">Airport Transfer</SelectItem>
                  <SelectItem value="Hourly Service">Hourly Service</SelectItem>
                  <SelectItem value="Day Rate">Day Rate</SelectItem>
                  <SelectItem value="Long-Distance">Long-Distance</SelectItem>
                  <SelectItem value="Multi-Stop">Multi-Stop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vehicle Class</Label>
              <Select value={form.vehicle_class} onValueChange={(v) => setForm(f => ({ ...f, vehicle_class: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Executive SUV">Executive SUV</SelectItem>
                  <SelectItem value="Premier SUV">Premier SUV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Passengers</Label>
              <Input
                type="number"
                min="1"
                max="7"
                value={form.number_of_passengers}
                onChange={(e) => setForm(f => ({ ...f, number_of_passengers: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.quoted_price}
                onChange={(e) => setForm(f => ({ ...f, quoted_price: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Payment</Label>
              <Select value={form.payment_status} onValueChange={(v) => setForm(f => ({ ...f, payment_status: v }))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Special Instructions</Label>
            <textarea
              value={form.special_instructions}
              onChange={(e) => setForm(f => ({ ...f, special_instructions: e.target.value }))}
              className="mt-1 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              rows={2}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? 'Creating Ride...' : 'Create Ride'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
