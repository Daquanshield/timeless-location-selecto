import { Badge } from '@/components/ui/badge'
import { STATUS_CONFIG, type RideStatus } from '@/lib/dashboard-types'
import { cn } from '@/lib/utils'

interface RideStatusBadgeProps {
  status: RideStatus
}

export default function RideStatusBadge({ status }: RideStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending

  return (
    <Badge variant="secondary" className={cn('text-xs font-medium rounded-full', config.bg, config.color)}>
      {config.label}
    </Badge>
  )
}
