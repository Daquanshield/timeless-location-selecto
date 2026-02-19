'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import NavBar from '@/components/dashboard/NavBar'
import StatsOverview from '@/components/dashboard/StatsOverview'
import RideFilters from '@/components/dashboard/RideFilters'
import RideCard from '@/components/dashboard/RideCard'
import EmptyState from '@/components/dashboard/EmptyState'
import CreateRideForm from '@/components/dashboard/CreateRideForm'
import type { RideSummary, DashboardUser, DashboardStats, RideStatus } from '@/lib/dashboard-types'

interface Driver {
  phone: string
  name: string
}

export default function DispatcherDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [rides, setRides] = useState<RideSummary[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState<Record<string, string | undefined>>({})
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showCreateForm, setShowCreateForm] = useState(false)

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

  const fetchStats = useCallback(async () => {
    const res = await fetch('/api/dashboard/stats')
    if (res.ok) {
      const data = await res.json()
      setStats(data)
    }
  }, [])

  const fetchRides = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', '20')
    if (filters.status) params.set('status', filters.status)
    if (filters.driver_phone) params.set('driver_phone', filters.driver_phone)
    if (filters.date_from) params.set('date_from', filters.date_from)
    if (filters.date_to) params.set('date_to', filters.date_to)

    const res = await fetch(`/api/dashboard/rides?${params}`)
    if (res.ok) {
      const data = await res.json()
      setRides(data.rides)
      setTotalPages(data.totalPages)
    }
  }, [page, filters])

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
    const init = async () => {
      setLoading(true)
      const u = await fetchUser()
      if (u) {
        await Promise.all([fetchStats(), fetchRides(), fetchDrivers()])
      }
      setLoading(false)
    }
    init()
  }, [fetchUser, fetchStats, fetchRides, fetchDrivers])

  // Re-fetch rides when filters or page change
  useEffect(() => {
    if (!loading) fetchRides()
  }, [filters, page, fetchRides, loading])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      setRefreshing(true)
      await Promise.all([fetchStats(), fetchRides()])
      setRefreshing(false)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchStats, fetchRides])

  const handleConfirm = async (id: string, action: 'accept' | 'decline') => {
    const res = await fetch(`/api/dashboard/rides/${id}/confirm`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      await Promise.all([fetchStats(), fetchRides()])
    }
  }

  const handleStatusAdvance = async (id: string, nextStatus: RideStatus) => {
    const res = await fetch(`/api/dashboard/rides/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    if (res.ok) {
      await Promise.all([fetchStats(), fetchRides()])
    }
  }

  const handleFilterChange = (newFilters: Record<string, string | undefined>) => {
    setFilters(newFilters)
    setPage(1)
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

        {/* Stats */}
        {stats && <StatsOverview stats={stats} />}

        {/* Filters + New Ride button */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex-1">
            <RideFilters drivers={drivers} onFilterChange={handleFilterChange} />
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            size="sm"
          >
            + New Ride
          </Button>
        </div>

        {/* Create Ride Form */}
        {showCreateForm && (
          <CreateRideForm
            onCancel={() => setShowCreateForm(false)}
            onCreated={() => {
              setShowCreateForm(false)
              fetchStats()
              fetchRides()
            }}
          />
        )}

        {/* Rides list */}
        {rides.length > 0 ? (
          <div className="space-y-3">
            {rides.map(ride => (
              <RideCard
                key={ride.id}
                ride={ride}
                basePath="/dashboard/dispatcher"
                showDriver
                userRole="dispatcher"
                onAccept={(id) => handleConfirm(id, 'accept')}
                onDecline={(id) => handleConfirm(id, 'decline')}
                onStatusAdvance={handleStatusAdvance}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No rides found"
            message={Object.keys(filters).length > 0 ? 'Try adjusting your filters.' : 'Rides will appear here as they are booked.'}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
