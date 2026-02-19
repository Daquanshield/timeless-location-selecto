'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import type { RideSummary, RideStatus, UserRole } from '@/lib/dashboard-types'
import { STATUS_ACTION_LABELS } from '@/lib/dashboard-types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import RideStatusBadge from './RideStatusBadge'
import ConfirmationBadge from './ConfirmationBadge'

interface RideCardProps {
  ride: RideSummary
  basePath: string
  showDriver?: boolean
  hidePrice?: boolean
  userRole?: UserRole
  onAccept?: (id: string) => void
  onDecline?: (id: string) => void
  onStatusAdvance?: (id: string, nextStatus: RideStatus) => void
}

export default function RideCard({
  ride, basePath, showDriver, hidePrice, userRole,
  onAccept, onDecline, onStatusAdvance,
}: RideCardProps) {
  const router = useRouter()
  const [advancing, setAdvancing] = useState(false)

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
  const actionLabel = STATUS_ACTION_LABELS[ride.status as keyof typeof STATUS_ACTION_LABELS]
  const showStatusButton = !needsAction && actionLabel && onStatusAdvance && ride.confirmation_status === 'confirmed'

  const handleAdvance = async (e: React.MouseEvent, nextStatus: RideStatus) => {
    e.stopPropagation()
    if (advancing) return
    setAdvancing(true)
    try {
      await onStatusAdvance?.(ride.id, nextStatus)
    } finally {
      setAdvancing(false)
    }
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:border-primary/40',
        needsAction && 'border-l-4 border-l-primary',
        ride.is_vip && !needsAction && 'border-l-4 border-l-primary',
      )}
      onClick={() => router.push(`${basePath}/ride/${ride.id}`)}
    >
      <CardContent className="p-4">
        {/* Row 1: Date/Time + Price */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <span className="font-display text-lg text-primary">{formatTime(ride.pickup_datetime)}</span>
            <span className="text-muted-foreground text-sm ml-2">{formatDate(ride.pickup_datetime)}</span>
          </div>
          {!hidePrice && (
            <span className="font-display text-lg text-primary">{formatPrice(ride.total_amount)}</span>
          )}
        </div>

        {/* Row 2: Client + Status */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-foreground text-sm font-medium">
            {ride.client_name || 'Unknown Client'}
            {ride.is_vip && <span className="text-primary ml-1 text-xs">VIP</span>}
          </span>
          <div className="flex items-center gap-1.5">
            {needsAction && <ConfirmationBadge status={ride.confirmation_status} />}
            <RideStatusBadge status={ride.status} />
          </div>
        </div>

        {/* Row 3: Pickup */}
        <div className="flex items-start gap-2 mb-1">
          <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 bg-primary" />
          <span className="text-foreground/60 text-sm">{truncate(ride.pickup_address, 50)}</span>
        </div>

        {/* Row 4: Dropoff */}
        <div className="flex items-start gap-2 mb-2">
          <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0 border-2 border-primary bg-background" />
          <span className="text-foreground/60 text-sm">{truncate(ride.dropoff_address, 50)}</span>
        </div>

        {/* Row 5: Vehicle + Driver (if dispatcher) */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {ride.vehicle_type && (
            <Badge variant="outline" className="text-primary border-primary/20 bg-primary/10 text-xs py-0">
              {ride.vehicle_type}
            </Badge>
          )}
          {ride.service_option && (
            <Badge variant="outline" className="text-foreground/60 border-border bg-secondary/50 text-xs py-0">
              {ride.service_option}
            </Badge>
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
          <>
            <Separator className="mt-3 mb-3" />
            <div className="flex gap-3">
              <Button
                onClick={(e) => { e.stopPropagation(); onAccept(ride.id) }}
                className="flex-1"
                size="sm"
              >
                Accept
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); onDecline(ride.id) }}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                Decline
              </Button>
            </div>
          </>
        )}

        {/* Status action buttons */}
        {showStatusButton && (
          <>
            <Separator className="mt-3 mb-3" />
            <div className="flex gap-3">
              <Button
                onClick={(e) => handleAdvance(e, actionLabel.nextStatus)}
                disabled={advancing}
                className="flex-1"
                size="sm"
              >
                {advancing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Updating...
                  </span>
                ) : actionLabel.label}
              </Button>
              {ride.status === 'arrived' && (
                <Button
                  onClick={(e) => handleAdvance(e, 'no_show')}
                  disabled={advancing}
                  variant="outline"
                  size="sm"
                  className="text-orange-400 hover:text-orange-300"
                >
                  No Show
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
