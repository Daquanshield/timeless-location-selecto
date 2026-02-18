import type { DashboardStats } from '@/lib/dashboard-types'

interface StatsOverviewProps {
  stats: DashboardStats
}

const cards = [
  { key: 'rides_today', label: "Today's Rides", icon: '&#128663;', format: (v: number) => String(v) },
  { key: 'rides_upcoming', label: 'Upcoming', icon: '&#128197;', format: (v: number) => String(v) },
  { key: 'rides_completed_today', label: 'Completed', icon: '&#9989;', format: (v: number) => String(v) },
  { key: 'total_earnings_today', label: 'Earnings', icon: '&#128176;', format: (v: number) => `$${v.toFixed(0)}` },
] as const

export default function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {cards.map(card => (
        <div
          key={card.key}
          className="location-card flex flex-col items-center py-4"
        >
          <span className="text-2xl mb-1" dangerouslySetInnerHTML={{ __html: card.icon }} />
          <span className="font-display text-xl text-gold">
            {card.format((stats as any)[card.key] || 0)}
          </span>
          <span className="text-cream/50 text-xs">{card.label}</span>
        </div>
      ))}
      {stats.unconfirmed_count > 0 && (
        <div className="col-span-2 location-card text-center py-2 border-l-4" style={{ borderLeftColor: 'var(--gold)' }}>
          <span className="text-gold font-medium text-sm">
            {stats.unconfirmed_count} ride{stats.unconfirmed_count > 1 ? 's' : ''} awaiting driver confirmation
          </span>
        </div>
      )}
    </div>
  )
}
