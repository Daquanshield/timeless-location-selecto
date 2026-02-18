'use client'

import { useRouter } from 'next/navigation'
import type { RideSummary } from '@/lib/dashboard-types'
import RideStatusBadge from './RideStatusBadge'
import ConfirmationBadge from './ConfirmationBadge'

interface RideCardProps {
  ride: RideSummary
  basePath: string
  showDriver?: boolean
  onAccept?: (id: string) => void
  onDecline?: (id: string) => void
}

export default function RideCard({ ride, basePath, showDriver, onAccept, onDecline }: RideCardProps) {
  const router = useRouter()

  const formatDate = (iso: string) => {
    const dt = new Date(iso)
    return dt.toLocaleDateString('en-US', {
      timeZone: 'America/Detroit',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (iso: string) => {
    const dt = new Date(iso)
    return dt.toLocaleTimeString('en-US', {
      timeZone: 'America/Detroit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatPrice = (amount: number | null) => {
    if (!amount) return ''
    return `$${amount.toFixed(0)}`
  }

  const truncate = (str: string | null, len: number) => {
    if (!str) return ''
    return str.length > len ? str.substring(0, len) + '...' : str
  }

  const needsAction = ride.confirmation_status === 'unconfirmed'

  return (
    <div
      className={`location-card cursor-pointer transition-all hover:border-gold/40 ${
        needsAction ? 'border-l-4' : ''
      } ${ride.is_vip ? 'border-l-4' : ''}`}
      style={
        needsAction
          ? { borderLeftColor: 'var(--gold)' }
          : ride.is_vip
          ? { borderLeftColor: 'var(--gold)' }
          : {}
      }
      onClick={() => router.push(`${basePath}/ride/${ride.id}`)}
    >
      {/* Row 1: Date/Time + Price */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <span className="font-display text-lg text-gold">{formatTime(ride.pickup_datetime)}</span>
          <span className="text-cream/40 text-sm ml-2">{formatDate(ride.pickup_datetime)}</span>
        </div>
        <span className="font-display text-lg text-gold">{formatPrice(ride.total_amount)}</span>
      </div>

      {/* Row 2: Client + Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-cream text-sm font-medium">
          {ride.client_name || 'Unknown Client'}
          {ride.is_vip && <span className="text-gold ml-1 text-xs">VIP</span>}
        </span>
        <div className="flex items-center gap-1.5">
          {needsAction && <ConfirmationBadge status={ride.confirmation_status} />}
          <RideStatusBadge status={ride.status} />
        </div>
      </div>

      {/* Row 3: Pickup */}
      <div className="flex items-start gap-2 mb-1">
        <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: 'var(--gold)' }} />
        <span className="text-cream/60 text-sm">{truncate(ride.pickup_address, 50)}</span>
      </div>

      {/* Row 4: Dropoff */}
      <div className="flex items-start gap-2 mb-2">
        <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-charcoal border" style={{ borderColor: 'var(--gold)' }} />
        <span className="text-cream/60 text-sm">{truncate(ride.dropoff_address, 50)}</span>
      </div>

      {/* Row 5: Vehicle + Driver (if dispatcher) */}
      <div className="flex items-center gap-2 text-xs text-cream/40">
        {ride.vehicle_type && (
          <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(212, 175, 55, 0.1)', color: 'var(--gold)' }}>
            {ride.vehicle_type}
          </span>
        )}
        {ride.service_option && (
          <span className="px-2 py-0.5 rounded" style={{ background: 'rgba(245, 242, 235, 0.05)' }}>
            {ride.service_option}
          </span>
        )}
        {ride.number_of_passengers && ride.number_of_passengers > 1 && (
          <span>{ride.number_of_passengers} pax</span>
        )}
        {showDriver && ride.driver_name && (
          <span className="ml-auto">{ride.driver_name}</span>
        )}
      </div>

      {/* Accept/Decline buttons */}
      {needsAction && onAccept && onDecline && (
        <div className="flex gap-3 mt-3 pt-3 border-t" style={{ borderColor: '#3a3a3a' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onAccept(ride.id) }}
            className="btn-primary flex-1 py-2 text-sm"
            style={{ minHeight: 'auto' }}
          >
            Accept
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDecline(ride.id) }}
            className="btn-secondary flex-1 py-2 text-sm"
          >
            Decline
          </button>
        </div>
      )}
    </div>
  )
}
