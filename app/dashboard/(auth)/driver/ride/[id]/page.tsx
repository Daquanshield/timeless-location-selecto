'use client'

import { useEffect, useState } from 'react'
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
import type { RideDetail, RideStatus, DashboardUser } from '@/lib/dashboard-types'

export default function DriverRideDetail() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [ride, setRide] = useState<RideDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [notifying, setNotifying] = useState(false)
  const [notifySuccess, setNotifySuccess] = useState('')
  const [showNotifyMenu, setShowNotifyMenu] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [userRes, rideRes] = await Promise.all([
        fetch('/api/dashboard/auth/me'),
        fetch(`/api/dashboard/rides/${id}`),
      ])

      if (!userRes.ok) { router.push('/dashboard/login'); return }
      if (!rideRes.ok) { router.push('/dashboard/driver'); return }

      const userData = await userRes.json()
      const rideData = await rideRes.json()
      setUser(userData.user)
      setRide(rideData.ride)
      setLoading(false)
    }
    load()
  }, [id, router])

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

  return (
    <>
      <NavBar userName={user.name} userRole="driver" />
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/dashboard/driver')}
          className="text-muted-foreground hover:text-foreground mb-4 gap-1 px-0"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to rides
        </Button>

        {/* Accept/Decline if needed */}
        {ride.confirmation_status === 'unconfirmed' && (
          <Card className="mb-4 border-l-4 border-l-primary">
            <CardContent className="p-4">
              <p className="text-primary font-medium mb-3">New ride request - please respond</p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleConfirm('accept')}
                  disabled={updating}
                  className="flex-1"
                >
                  Accept Ride
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
        {ride.status && ['en_route', 'arrived', 'in_progress'].includes(ride.status) && (
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

        {/* Main details card */}
        <Card className="mb-4">
          <CardContent className="p-4">
            {/* Date/Time */}
            <div className="text-center mb-4 pb-4 border-b border-border">
              <div className="font-display text-2xl text-primary">{time}</div>
              <div className="text-muted-foreground text-sm">{date}</div>
            </div>

            {/* Status badges */}
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
            </div>

            {/* Addresses */}
            <div className="mb-4 pb-4 border-b border-border">
              {/* Pickup */}
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

              {/* Dropoff */}
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
            </div>

            {/* Notes */}
            {ride.notes && (
              <>
                <Separator className="mt-4 mb-4" />
                <div>
                  <div className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Notes</div>
                  <div className="text-foreground/70 text-sm">{ride.notes}</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
