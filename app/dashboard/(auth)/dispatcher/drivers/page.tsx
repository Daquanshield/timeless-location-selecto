'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import NavBar from '@/components/dashboard/NavBar'
import type { DashboardUser } from '@/lib/dashboard-types'

interface Driver {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  employment_type: string
  pay_rate: number | null
  status: string
  vehicle_assigned: string | null
  created_at: string
}

export default function DriverManagement() {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    employment_type: '1099',
    pay_rate: '',
    vehicle_assigned: '',
  })

  const fetchDrivers = useCallback(async () => {
    const res = await fetch('/api/dashboard/drivers')
    if (res.ok) {
      const data = await res.json()
      setDrivers(data.drivers)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const userRes = await fetch('/api/dashboard/auth/me')
      if (!userRes.ok) { router.push('/dashboard/login'); return }
      const userData = await userRes.json()
      if (userData.user.role !== 'dispatcher') { router.push('/dashboard/driver'); return }
      setUser(userData.user)
      await fetchDrivers()
      setLoading(false)
    }
    init()
  }, [router, fetchDrivers])

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

    const res = await fetch('/api/dashboard/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        pay_rate: form.pay_rate ? parseFloat(form.pay_rate) : null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Failed to create driver')
      setSaving(false)
      return
    }

    setForm({ first_name: '', last_name: '', phone: '', email: '', employment_type: '1099', pay_rate: '', vehicle_assigned: '' })
    setShowForm(false)
    await fetchDrivers()
    setSaving(false)
  }

  const toggleDriverStatus = async (driver: Driver) => {
    const newStatus = driver.status === 'active' ? 'inactive' : 'active'
    const res = await fetch(`/api/dashboard/drivers/${driver.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      await fetchDrivers()
    }
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl text-primary">Drivers</h1>
            <p className="text-muted-foreground text-sm">{drivers.length} driver{drivers.length !== 1 ? 's' : ''}</p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            size="sm"
          >
            {showForm ? 'Cancel' : '+ Add Driver'}
          </Button>
        </div>

        {/* Add Driver Form */}
        {showForm && (
          <Card className="mb-6">
            <CardContent className="p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <h2 className="text-primary font-display text-lg mb-2">New Driver</h2>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-foreground/70 text-xs">First Name</Label>
                    <Input
                      type="text"
                      value={form.first_name}
                      onChange={(e) => setForm(f => ({ ...f, first_name: e.target.value }))}
                      className="mt-1 text-sm"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-foreground/70 text-xs">Last Name</Label>
                    <Input
                      type="text"
                      value={form.last_name}
                      onChange={(e) => setForm(f => ({ ...f, last_name: e.target.value }))}
                      className="mt-1 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-foreground/70 text-xs">Phone Number</Label>
                  <Input
                    type="tel"
                    value={formatPhone(form.phone)}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                    placeholder="(248) 555-0123"
                    className="mt-1 text-sm"
                    required
                  />
                </div>

                <div>
                  <Label className="text-foreground/70 text-xs">
                    Business Email <span className="text-muted-foreground">(used for login)</span>
                  </Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="driver@timelesstrust.tech"
                    className="mt-1 text-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-foreground/70 text-xs">Employment Type</Label>
                    <Select
                      value={form.employment_type}
                      onValueChange={(v) => setForm(f => ({ ...f, employment_type: v }))}
                    >
                      <SelectTrigger className="mt-1 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1099">1099 Contractor</SelectItem>
                        <SelectItem value="W2">W2 Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-foreground/70 text-xs">Pay Rate ($/hr)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.pay_rate}
                      onChange={(e) => setForm(f => ({ ...f, pay_rate: e.target.value }))}
                      placeholder="25.00"
                      className="mt-1 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-foreground/70 text-xs">Vehicle Assigned</Label>
                  <Input
                    type="text"
                    value={form.vehicle_assigned}
                    onChange={(e) => setForm(f => ({ ...f, vehicle_assigned: e.target.value }))}
                    placeholder="2024 Cadillac Escalade - Black"
                    className="mt-1 text-sm"
                  />
                </div>

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </span>
                  ) : 'Create Driver'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Driver list */}
        <div className="space-y-3">
          {drivers.map(driver => (
            <Card
              key={driver.id}
              className={driver.status !== 'active' ? 'opacity-50' : ''}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-foreground font-medium">
                      {driver.first_name} {driver.last_name}
                    </div>
                    <div className="text-muted-foreground text-sm">{driver.phone}</div>
                    {driver.email && <div className="text-muted-foreground/70 text-xs">{driver.email}</div>}
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      driver.status === 'active'
                        ? 'bg-green-600 text-green-200'
                        : 'bg-gray-600 text-gray-300'
                    }
                  >
                    {driver.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span>{driver.employment_type}</span>
                  {driver.pay_rate && <span>${driver.pay_rate}/hr</span>}
                  {driver.vehicle_assigned && <span>{driver.vehicle_assigned}</span>}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleDriverStatus(driver)}
                >
                  {driver.status === 'active' ? 'Deactivate' : 'Activate'}
                </Button>
              </CardContent>
            </Card>
          ))}

          {drivers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-muted-foreground/60 text-lg mb-2">No drivers yet</div>
              <p className="text-muted-foreground/40 text-sm">Add your first driver to get started.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
