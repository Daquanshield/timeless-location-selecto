import { Badge } from '@/components/ui/badge'
import { CONFIRMATION_CONFIG, type ConfirmationStatus } from '@/lib/dashboard-types'
import { cn } from '@/lib/utils'

interface ConfirmationBadgeProps {
  status: ConfirmationStatus
}

export default function ConfirmationBadge({ status }: ConfirmationBadgeProps) {
  const config = CONFIRMATION_CONFIG[status] || CONFIRMATION_CONFIG.unconfirmed

  return (
    <Badge variant="secondary" className={cn('text-xs font-medium rounded-full', config.bg, config.color, status === 'unconfirmed' && 'animate-pulse')}>
      {config.label}
    </Badge>
  )
}
