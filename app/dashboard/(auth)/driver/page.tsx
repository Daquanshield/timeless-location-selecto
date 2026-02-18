'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/dashboard/NavBar'
import RideCard from '@/components/dashboard/RideCard'
import EmptyState from '@/components/dashboard/EmptyState'
import type { RideSummary, DashboardUser } from '@/lib/dashboard-types'

type TabKey = 'upcoming' | 'past'

export default function DriverDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [rides, setRides] = useState<RideSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('upcoming')
  const [refreshing, setRefreshing] = useState(false)

  const fetchUser = useCallback(async () => {
    const res = await fetch('/api/dashboard/auth/me')
    if (!res.ok) { router.push('/dashboard/login'); return null }
    const data = await res.json()
    setUser(data.user)
    return data.user
  }, [router])

  const fetchRides = useCallback(async () => {
    const statusFilter = tab === 'upcoming'
      ? 'pending,confirmed,en_route,arrived,in_progress'
      : 'completed,cancelled'

    const dateParam = tab === 'past'
      ? `&date_from=${new Date(Date.now() - 30 * 86400000).toISOString()}`
      : ''

    const res = await fetch(`/api/dashboard/rides?status=${statusFilter}${dateParam}&limit=50`)
    if (res.ok) {
      const data = await res.json()
      setRides(data.rides)
    }
  }, [tab])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const u = await fetchUser()
      if (u) await fetchRides()
      setLoading(false)
    }
    init()
  }, [fetchUser, fetchRides])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      setRefreshing(true)
      await fetchRides()
      setRefreshing(false)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchRides])

  const handleConfirm = async (id: string, action: 'accept' | 'decline') => {
    const res = await fetch(`/api/dashboard/rides/${id}/confirm`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) await fetchRides()
  }

  // Split rides into sections
  const needsAction = rides.filter(r => r.confirmation_status === 'unconfirmed')
  const activeRides = rides.filter(r =>
    r.confirmation_status !== 'unconfirmed' &&
    ['confirmed', 'en_route', 'arrived', 'in_progress'].includes(r.status)
  )
  const otherRides = rides.filter(r =>
    r.confirmation_status !== 'unconfirmed' &&
    !['confirmed', 'en_route', 'arrived', 'in_progress'].includes(r.status)
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    )
  }

  return (
    <>
      <NavBar userName={user?.name || ''} userRole="driver" />
      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Refresh indicator */}
        {refreshing && (
          <div className="flex justify-center mb-2">
            <div className="spinner" style={{ width: 16, height: 16 }} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: 'var(--charcoal-light)' }}>
          {(['upcoming', 'past'] as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t
                  ? 'text-charcoal'
                  : 'text-cream/50 hover:text-cream/70'
              }`}
              style={tab === t ? { background: 'var(--gold)' } : {}}
            >
              {t === 'upcoming' ? 'Upcoming' : 'Past Rides'}
            </button>
          ))}
        </div>

        {tab === 'upcoming' ? (
          <>
            {/* Action Needed */}
            {needsAction.length > 0 && (
              <div className="mb-6">
                <h2 className="text-gold font-display text-lg mb-3">Action Needed</h2>
                <div className="space-y-3">
                  {needsAction.map(ride => (
                    <RideCard
                      key={ride.id}
                      ride={ride}
                      basePath="/dashboard/driver"
                      onAccept={(id) => handleConfirm(id, 'accept')}
                      onDecline={(id) => handleConfirm(id, 'decline')}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Active Rides */}
            {activeRides.length > 0 && (
              <div className="mb-6">
                <h2 className="text-cream/60 font-medium text-sm uppercase tracking-wider mb-3">Active Rides</h2>
                <div className="space-y-3">
                  {activeRides.map(ride => (
                    <RideCard key={ride.id} ride={ride} basePath="/dashboard/driver" />
                  ))}
                </div>
              </div>
            )}

            {/* Other upcoming */}
            {otherRides.length > 0 && (
              <div className="mb-6">
                <h2 className="text-cream/60 font-medium text-sm uppercase tracking-wider mb-3">Upcoming</h2>
                <div className="space-y-3">
                  {otherRides.map(ride => (
                    <RideCard key={ride.id} ride={ride} basePath="/dashboard/driver" />
                  ))}
                </div>
              </div>
            )}

            {rides.length === 0 && (
              <EmptyState title="No upcoming rides" message="You'll see new ride assignments here." />
            )}
          </>
        ) : (
          <>
            {rides.length > 0 ? (
              <div className="space-y-3">
                {rides.map(ride => (
                  <RideCard key={ride.id} ride={ride} basePath="/dashboard/driver" />
                ))}
              </div>
            ) : (
              <EmptyState title="No past rides" message="Completed rides from the last 30 days will appear here." />
            )}
          </>
        )}
      </div>
    </>
  )
}
