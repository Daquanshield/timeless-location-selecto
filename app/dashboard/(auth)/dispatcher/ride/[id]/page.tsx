'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import NavBar from '@/components/dashboard/NavBar'
import RideStatusBadge from '@/components/dashboard/RideStatusBadge'
import ConfirmationBadge from '@/components/dashboard/ConfirmationBadge'
import StatusProgressBar from '@/components/dashboard/StatusProgressBar'
import DriverSelector from '@/components/dashboard/DriverSelector'
import type { RideDetail, RideStatus, DashboardUser, AssignmentHistoryEntry } from '@/lib/dashboard-types'

interface Driver {
  phone: string
  name: string
}

export default function DispatcherRideDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [ride, setRide] = useState<RideDetail | null>(null)
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [notifySuccess, setNotifySuccess] = useState('')
  const [showNotifyMenu, setShowNotifyMenu] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesText, setNotesText] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  const fetchDrivers = useCallback(async () => {
    const res = await fetch('/api/dashboard/drivers')
    if (res.ok) {
      const data = await res.json()
      setDrivers(
        (data.drivers || [])
          .filter((d: { status: string }) => d.status === 'active')
          .map((d: { phone: string; first_name: string; last_name: string }) => ({
            phone: d.phone,
            name: `${d.first_name} ${d.last_name}`,
          }))
      )
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      const [userRes, rideRes] = await Promise.all([
        fetch('/api/dashboard/auth/me'),
        fetch(`/api/dashboard/rides/${id}`),
      ])

      if (!userRes.ok) { router.push('/dashboard/login'); return }
      if (!rideRes.ok) { router.push('/dashboard/dispatcher'); return }

      const userData = await userRes.json()
      const rideData = await rideRes.json()

      if (userData.user.role !== 'dispatcher') {
        router.push('/dashboard/driver')
        return
      }

      setUser(userData.user)
      setRide(rideData.ride)
      await fetchDrivers()
      setLoading(false)
    }
    load()
  }, [id, router, fetchDrivers])

  const handleStatusChange = async (newStatus: RideStatus) => {
    setUpdating(true)
    const res = await fetch(`/api/dashboard/rides/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setRide(prev => prev ? { ...prev, status: newStatus } : prev)
    }
    setUpdating(false)
  }

  const handleConfirm = async (action: 'accept' | 'decline') => {
    setUpdating(true)
    const res = await fetch(`/api/dashboard/rides/${id}/confirm`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      const data = await res.json()
      setRide(prev => prev ? {
        ...prev,
        confirmation_status: data.confirmation_status,
        status: action === 'accept' ? 'confirmed' : prev.status,
      } : prev)
    }
    setUpdating(false)
  }

  const handleAssign = async (driverPhone: string) => {
    const res = await fetch(`/api/dashboard/rides/${id}/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_phone: driverPhone }),
    })
    if (res.ok) {
      const rideRes = await fetch(`/api/dashboard/rides/${id}`)
      if (rideRes.ok) {
        const data = await rideRes.json()
        setRide(data.ride)
      }
    }
  }

  const handleNotify = async (template: string, delayMinutes?: string) => {
    setNotifying(true)
    setNotifySuccess('')
    setShowNotifyMenu(false)
    const res = await fetch(`/api/dashboard/rides/${id}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, delay_minutes: delayMinutes }),
    })
    if (res.ok) {
      setNotifySuccess('Client notified!')
      setTimeout(() => setNotifySuccess(''), 3000)
    }
    setNotifying(false)
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    const res = await fetch(`/api/dashboard/rides/${id}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: notesText }),
    })
    if (res.ok) {
      setRide(prev => prev ? { ...prev, notes: notesText || null } : prev)
      setEditingNotes(false)
    }
    setSavingNotes(false)
  }

  const formatDateTime = (iso: string) => {
    const dt = new Date(iso)
    return {
      date: dt.toLocaleDateString('en-US', { timeZone: 'America/Detroit', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      time: dt.toLocaleTimeString('en-US', { timeZone: 'America/Detroit', hour: 'numeric', minute: '2-digit', hour12: true }),
    }
  }

  const openMaps = (address: string) => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')
  }

  if (loading || !ride || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  const { date, time } = formatDateTime(ride.pickup_datetime)
  const history = Array.isArray(ride.assignment_history) ? ride.assignment_history : []

  return (
    <>
      <NavBar userName={user.name} userRole="dispatcher" />
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Back */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/dispatcher')}
          className="text-muted-foreground hover:text-foreground mb-4 gap-1 px-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to all rides
        </Button>

        {/* Driver assignment */}
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Driver Assignment</div>
            <div className="text-foreground font-medium mb-2">
              {ride.driver_name || 'Unassigned'}
              {ride.driver_phone && <span className="text-muted-foreground text-sm ml-2">{ride.driver_phone}</span>}
            </div>
            <DriverSelector
              drivers={drivers}
              currentDriverPhone={ride.driver_phone}
              onAssign={handleAssign}
            />
          </CardContent>
        </Card>

        {/* Accept/Decline for dispatcher */}
        {ride.confirmation_status === 'unconfirmed' && (
          <Card className="mb-4 border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-primary font-medium mb-3">Awaiting driver confirmation</p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleConfirm('accept')}
                  disabled={updating}
                  className="flex-1"
                >
                  Accept (on behalf)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleConfirm('decline')}
                  disabled={updating}
                  className="flex-1"
                >
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status progress */}
        {ride.status !== 'pending' && ride.status !== 'cancelled' && ride.status !== 'no_show' && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <StatusProgressBar
                currentStatus={ride.status as RideStatus}
                onAdvance={updating ? undefined : handleStatusChange}
                onUndo={updating ? undefined : handleStatusChange}
              />
            </CardContent>
          </Card>
        )}

        {/* Notify Client */}
        {ride.status && ['confirmed', 'en_route', 'arrived', 'in_progress'].includes(ride.status) && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-foreground/70 text-sm font-medium">Notify Client</span>
                {notifySuccess && <span className="text-green-400 text-xs">{notifySuccess}</span>}
              </div>
              <div className="mt-2">
                <Popover open={showNotifyMenu} onOpenChange={setShowNotifyMenu}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={notifying}
                      className="w-full"
                    >
                      {notifying ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </span>
                      ) : 'Send Notification'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <button onClick={() => handleNotify('five_min')} className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors border-b border-border">
                      &ldquo;5 minutes away&rdquo;
                    </button>
                    <button onClick={() => handleNotify('arrived')} className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors border-b border-border">
                      &ldquo;Driver has arrived&rdquo;
                    </button>
                    <button onClick={() => handleNotify('delayed', '10')} className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors">
                      &ldquo;Running ~10 min late&rdquo;
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main details */}
        <Card className="mb-4">
          <CardContent className="p-4">
            {/* Date/Time */}
            <div className="text-center mb-4 pb-4 border-b border-border">
              <div className="font-display text-2xl text-primary">{time}</div>
              <div className="text-muted-foreground text-sm">{date}</div>
            </div>

            {/* Badges */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <RideStatusBadge status={ride.status as RideStatus} />
              <ConfirmationBadge status={ride.confirmation_status as any} />
              {ride.is_vip && (
                <Badge className="bg-yellow-500 text-yellow-900">VIP</Badge>
              )}
            </div>

            {/* Customer */}
            <div className="mb-4 pb-4 border-b border-border">
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Customer</div>
              <div className="text-foreground font-medium">{ride.client_name || 'Unknown'}</div>
              {ride.client_phone && (
                <a href={`tel:${ride.client_phone}`} className="text-primary text-sm hover:underline">
                  {ride.client_phone}
                </a>
              )}
              {ride.client_email && (
                <div className="text-muted-foreground text-sm">{ride.client_email}</div>
              )}
            </div>

            {/* Addresses */}
            <div className="mb-4 pb-4 border-b border-border">
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-primary" />
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Pickup</span>
                </div>
                <button
                  onClick={() => openMaps(ride.pickup_address)}
                  className="text-foreground text-sm text-left hover:text-primary transition-colors"
                >
                  {ride.pickup_address}
                </button>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-2 border-primary bg-background" />
                  <span className="text-muted-foreground text-xs uppercase tracking-wider">Dropoff</span>
                </div>
                <button
                  onClick={() => openMaps(ride.dropoff_address)}
                  className="text-foreground text-sm text-left hover:text-primary transition-colors"
                >
                  {ride.dropoff_address}
                </button>
              </div>
            </div>

            {/* Details grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {ride.vehicle_type && (
                <div>
                  <div className="text-muted-foreground text-xs">Vehicle</div>
                  <div className="text-foreground">{ride.vehicle_type}</div>
                </div>
              )}
              {ride.service_option && (
                <div>
                  <div className="text-muted-foreground text-xs">Service</div>
                  <div className="text-foreground">{ride.service_option}</div>
                </div>
              )}
              {ride.number_of_passengers && (
                <div>
                  <div className="text-muted-foreground text-xs">Passengers</div>
                  <div className="text-foreground">{ride.number_of_passengers}</div>
                </div>
              )}
              {ride.total_amount && (
                <div>
                  <div className="text-muted-foreground text-xs">Price</div>
                  <div className="font-display text-primary text-lg">${ride.total_amount}</div>
                </div>
              )}
              {ride.distance && (
                <div>
                  <div className="text-muted-foreground text-xs">Distance</div>
                  <div className="text-foreground">{ride.distance}</div>
                </div>
              )}
              {ride.duration && (
                <div>
                  <div className="text-muted-foreground text-xs">Duration</div>
                  <div className="text-foreground">{ride.duration}</div>
                </div>
              )}
              {ride.payment_status && (
                <div>
                  <div className="text-muted-foreground text-xs">Payment</div>
                  <div className="text-foreground capitalize">{ride.payment_status}</div>
                </div>
              )}
              {ride.invoice_id && (
                <div>
                  <div className="text-muted-foreground text-xs">Invoice</div>
                  <div className="text-foreground text-xs truncate">{ride.invoice_id}</div>
                </div>
              )}
            </div>

            {/* Notes (editable) */}
            <Separator className="mt-4 mb-4" />
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-muted-foreground text-xs uppercase tracking-wider">Notes</div>
                {!editingNotes && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => { setNotesText(ride.notes || ''); setEditingNotes(true) }}
                    className="text-primary text-xs h-auto p-0"
                  >
                    {ride.notes ? 'Edit' : 'Add notes'}
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    rows={3}
                    placeholder="Add notes about this ride..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingNotes(false)}
                      className="text-muted-foreground text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="text-primary text-xs"
                    >
                      {savingNotes ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                ride.notes ? (
                  <div className="text-foreground/70 text-sm whitespace-pre-wrap">{ride.notes}</div>
                ) : (
                  <div className="text-muted-foreground/60 text-sm italic">No notes</div>
                )
              )}
            </div>

            {/* Tags */}
            {ride.tags && ride.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {ride.tags.map((tag, i) => (
                  <Badge key={i} variant="outline" className="text-primary border-primary/20 bg-primary/10 text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignment History */}
        {history.length > 0 && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-wider mb-3">Assignment History</div>
              <div className="space-y-2">
                {history.map((entry: AssignmentHistoryEntry, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 bg-primary" />
                    <div>
                      <div className="text-foreground/70">
                        {(entry as any).action
                          ? `${(entry as any).by} ${(entry as any).action} the ride`
                          : `${entry.assigned_by} assigned to ${entry.to_driver}`
                        }
                        {entry.from_driver && (
                          <span className="text-muted-foreground"> (was: {entry.from_driver})</span>
                        )}
                      </div>
                      <div className="text-muted-foreground/60 text-xs">
                        {new Date(entry.timestamp).toLocaleString('en-US', { timeZone: 'America/Detroit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
