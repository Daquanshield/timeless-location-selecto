import { CONFIRMATION_CONFIG, type ConfirmationStatus } from '@/lib/dashboard-types'

interface ConfirmationBadgeProps {
  status: ConfirmationStatus
}

export default function ConfirmationBadge({ status }: ConfirmationBadgeProps) {
  const config = CONFIRMATION_CONFIG[status] || CONFIRMATION_CONFIG.unconfirmed

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color} ${status === 'unconfirmed' ? 'animate-pulse' : ''}`}>
      {config.label}
    </span>
  )
}
