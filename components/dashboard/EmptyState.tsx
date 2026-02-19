import { Card, CardContent } from '@/components/ui/card'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  message?: string
}

export default function EmptyState({
  title = 'No rides found',
  message = 'New rides will appear here when assigned.',
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-primary/10">
          <Inbox className="h-8 w-8 text-primary" strokeWidth={1.5} />
        </div>
        <h3 className="font-display text-lg text-foreground/60 mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm text-center max-w-xs">{message}</p>
      </CardContent>
    </Card>
  )
}
