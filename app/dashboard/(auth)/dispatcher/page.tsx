'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import NavBar from '@/components/dashboard/NavBar'
import StatsOverview from '@/components/dashboard/StatsOverview'
import RideFilters from '@/components/dashboard/RideFilters'
import RideCard from '@/components/dashboard/RideCard'
import EmptyState from '@/components/dashboard/EmptyState'
import type { RideSummary, DashboardUser, DashboardStats } from '@/lib/dashboard-types'

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
    // We'll fetch drivers from the rides data for now
    // In a full implementation, this would be a dedicated API
    const res = await fetch('/api/dashboard/rides?limit=50')
    if (res.ok) {
      const data = await res.json()
      const driverMap = new Map<string, string>()
      for (const ride of data.rides) {
        if (ride.driver_phone && ride.driver_name) {
          driverMap.set(ride.driver_phone, ride.driver_name)
        }
      }
      setDrivers(Array.from(driverMap.entries()).map(([phone, name]) => ({ phone, name })))
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

  const handleFilterChange = (newFilters: Record<string, string | undefined>) => {
    setFilters(newFilters)
    setPage(1)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" style={{ width: 40, height: 40 }} />
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
            <div className="spinner" style={{ width: 16, height: 16 }} />
          </div>
        )}

        {/* Stats */}
        {stats && <StatsOverview stats={stats} />}

        {/* Filters */}
        <RideFilters drivers={drivers} onFilterChange={handleFilterChange} />

        {/* Rides list */}
        {rides.length > 0 ? (
          <div className="space-y-3">
            {rides.map(ride => (
              <RideCard
                key={ride.id}
                ride={ride}
                basePath="/dashboard/dispatcher"
                showDriver
                onAccept={(id) => handleConfirm(id, 'accept')}
                onDecline={(id) => handleConfirm(id, 'decline')}
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
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-secondary py-2 px-4 text-sm disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-cream/50 text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn-secondary py-2 px-4 text-sm disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </>
  )
}
