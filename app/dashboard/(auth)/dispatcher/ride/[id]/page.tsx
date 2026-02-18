'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
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

  const fetchDrivers = useCallback(async () => {
    const res = await fetch('/api/dashboard/rides?limit=50')
    if (res.ok) {
      const data = await res.json()
      const driverMap = new Map<string, string>()
      for (const r of data.rides) {
        if (r.driver_phone && r.driver_name) {
          driverMap.set(r.driver_phone, r.driver_name)
        }
      }
      setDrivers(Array.from(driverMap.entries()).map(([phone, name]) => ({ phone, name })))
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

  const handleStatusAdvance = async (nextStatus: RideStatus) => {
    setUpdating(true)
    const res = await fetch(`/api/dashboard/rides/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (res.ok) {
      setRide(prev => prev ? { ...prev, status: nextStatus } : prev)
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
      // Refresh ride data
      const rideRes = await fetch(`/api/dashboard/rides/${id}`)
      if (rideRes.ok) {
        const data = await rideRes.json()
        setRide(data.ride)
      }
    }
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
        <div className="spinner" style={{ width: 40, height: 40 }} />
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
        <button
          onClick={() => router.push('/dashboard/dispatcher')}
          className="text-cream/50 hover:text-cream text-sm mb-4 flex items-center gap-1"
        >
          &larr; Back to all rides
        </button>

        {/* Driver assignment */}
        <div className="location-card mb-4">
          <div className="text-cream/40 text-xs uppercase tracking-wider mb-2">Driver Assignment</div>
          <div className="text-cream font-medium mb-2">
            {ride.driver_name || 'Unassigned'}
            {ride.driver_phone && <span className="text-cream/40 text-sm ml-2">{ride.driver_phone}</span>}
          </div>
          <DriverSelector
            drivers={drivers}
            currentDriverPhone={ride.driver_phone}
            onAssign={handleAssign}
          />
        </div>

        {/* Accept/Decline for dispatcher */}
        {ride.confirmation_status === 'unconfirmed' && (
          <div className="location-card mb-4 border-l-4" style={{ borderLeftColor: 'var(--gold)' }}>
            <p className="text-gold font-medium mb-3">Awaiting driver confirmation</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleConfirm('accept')}
                disabled={updating}
                className="btn-primary flex-1 py-3"
                style={{ minHeight: 'auto' }}
              >
                Accept (on behalf)
              </button>
              <button
                onClick={() => handleConfirm('decline')}
                disabled={updating}
                className="btn-secondary flex-1 py-3"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {/* Status progress */}
        {ride.status !== 'pending' && ride.status !== 'cancelled' && (
          <div className="location-card mb-4">
            <StatusProgressBar
              currentStatus={ride.status as RideStatus}
              onAdvance={updating ? undefined : handleStatusAdvance}
            />
          </div>
        )}

        {/* Main details */}
        <div className="location-card mb-4">
          {/* Date/Time */}
          <div className="text-center mb-4 pb-4 border-b" style={{ borderColor: '#3a3a3a' }}>
            <div className="font-display text-2xl text-gold">{time}</div>
            <div className="text-cream/60 text-sm">{date}</div>
          </div>

          {/* Badges */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <RideStatusBadge status={ride.status as RideStatus} />
            <ConfirmationBadge status={ride.confirmation_status as any} />
            {ride.is_vip && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500 text-yellow-900">VIP</span>
            )}
          </div>

          {/* Customer */}
          <div className="mb-4 pb-4 border-b" style={{ borderColor: '#3a3a3a' }}>
            <div className="text-cream/40 text-xs uppercase tracking-wider mb-1">Customer</div>
            <div className="text-cream font-medium">{ride.client_name || 'Unknown'}</div>
            {ride.client_phone && (
              <a href={`tel:${ride.client_phone}`} className="text-gold text-sm hover:underline">
                {ride.client_phone}
              </a>
            )}
            {ride.client_email && (
              <div className="text-cream/50 text-sm">{ride.client_email}</div>
            )}
          </div>

          {/* Addresses */}
          <div className="mb-4 pb-4 border-b" style={{ borderColor: '#3a3a3a' }}>
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'var(--gold)' }} />
                <span className="text-cream/40 text-xs uppercase tracking-wider">Pickup</span>
              </div>
              <button
                onClick={() => openMaps(ride.pickup_address)}
                className="text-cream text-sm text-left hover:text-gold transition-colors"
              >
                {ride.pickup_address}
              </button>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border" style={{ borderColor: 'var(--gold)', background: 'var(--charcoal)' }} />
                <span className="text-cream/40 text-xs uppercase tracking-wider">Dropoff</span>
              </div>
              <button
                onClick={() => openMaps(ride.dropoff_address)}
                className="text-cream text-sm text-left hover:text-gold transition-colors"
              >
                {ride.dropoff_address}
              </button>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {ride.vehicle_type && (
              <div>
                <div className="text-cream/40 text-xs">Vehicle</div>
                <div className="text-cream">{ride.vehicle_type}</div>
              </div>
            )}
            {ride.service_option && (
              <div>
                <div className="text-cream/40 text-xs">Service</div>
                <div className="text-cream">{ride.service_option}</div>
              </div>
            )}
            {ride.number_of_passengers && (
              <div>
                <div className="text-cream/40 text-xs">Passengers</div>
                <div className="text-cream">{ride.number_of_passengers}</div>
              </div>
            )}
            {ride.total_amount && (
              <div>
                <div className="text-cream/40 text-xs">Price</div>
                <div className="font-display text-gold text-lg">${ride.total_amount}</div>
              </div>
            )}
            {ride.distance && (
              <div>
                <div className="text-cream/40 text-xs">Distance</div>
                <div className="text-cream">{ride.distance}</div>
              </div>
            )}
            {ride.duration && (
              <div>
                <div className="text-cream/40 text-xs">Duration</div>
                <div className="text-cream">{ride.duration}</div>
              </div>
            )}
            {ride.payment_status && (
              <div>
                <div className="text-cream/40 text-xs">Payment</div>
                <div className="text-cream capitalize">{ride.payment_status}</div>
              </div>
            )}
            {ride.invoice_id && (
              <div>
                <div className="text-cream/40 text-xs">Invoice</div>
                <div className="text-cream text-xs truncate">{ride.invoice_id}</div>
              </div>
            )}
          </div>

          {/* Notes */}
          {ride.notes && (
            <div className="mt-4 pt-4 border-t" style={{ borderColor: '#3a3a3a' }}>
              <div className="text-cream/40 text-xs uppercase tracking-wider mb-1">Notes</div>
              <div className="text-cream/70 text-sm">{ride.notes}</div>
            </div>
          )}

          {/* Tags */}
          {ride.tags && ride.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {ride.tags.map((tag, i) => (
                <span key={i} className="px-2 py-0.5 rounded text-xs" style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--gold)' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Assignment History */}
        {history.length > 0 && (
          <div className="location-card mb-4">
            <div className="text-cream/40 text-xs uppercase tracking-wider mb-3">Assignment History</div>
            <div className="space-y-2">
              {history.map((entry: AssignmentHistoryEntry, i: number) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--gold)' }} />
                  <div>
                    <div className="text-cream/70">
                      {(entry as any).action
                        ? `${(entry as any).by} ${(entry as any).action} the ride`
                        : `${entry.assigned_by} assigned to ${entry.to_driver}`
                      }
                      {entry.from_driver && (
                        <span className="text-cream/40"> (was: {entry.from_driver})</span>
                      )}
                    </div>
                    <div className="text-cream/30 text-xs">
                      {new Date(entry.timestamp).toLocaleString('en-US', { timeZone: 'America/Detroit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
