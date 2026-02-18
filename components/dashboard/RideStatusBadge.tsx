import { STATUS_CONFIG, type RideStatus } from '@/lib/dashboard-types'

interface RideStatusBadgeProps {
  status: RideStatus
}

export default function RideStatusBadge({ status }: RideStatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      {config.label}
    </span>
  )
}
