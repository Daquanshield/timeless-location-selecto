import { CarFront, CalendarClock, CircleCheckBig, DollarSign, TrendingUp, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { DashboardStats } from '@/lib/dashboard-types'

interface StatsOverviewProps {
  stats: DashboardStats
}

export default function StatsOverview({ stats }: StatsOverviewProps) {
  const totalPayments = (stats.payment_breakdown?.paid || 0) + (stats.payment_breakdown?.deposit || 0) + (stats.payment_breakdown?.unpaid || 0)

  return (
    <div className="space-y-3 mb-4">
      {/* Main stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center py-4 px-2">
            <CarFront size={28} className="text-primary mb-1.5" strokeWidth={1.5} />
            <span className="font-display text-xl text-primary">{stats.rides_today || 0}</span>
            <span className="text-muted-foreground text-xs">Today&apos;s Rides</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-4 px-2">
            <CalendarClock size={28} className="text-primary mb-1.5" strokeWidth={1.5} />
            <span className="font-display text-xl text-primary">{stats.rides_upcoming || 0}</span>
            <span className="text-muted-foreground text-xs">Upcoming</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-4 px-2">
            <CircleCheckBig size={28} className="text-green-500 mb-1.5" strokeWidth={1.5} />
            <span className="font-display text-xl text-primary">{stats.rides_completed_today || 0}</span>
            <span className="text-muted-foreground text-xs">Completed</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center py-4 px-2">
            <DollarSign size={28} className="text-primary mb-1.5" strokeWidth={1.5} />
            <span className="font-display text-xl text-primary">${(stats.total_earnings_today || 0).toFixed(0)}</span>
            <span className="text-muted-foreground text-xs">Today&apos;s Earnings</span>
          </CardContent>
        </Card>
      </div>

      {/* Earnings breakdown */}
      {(stats.projected_earnings > 0 || stats.total_earnings_today > 0) && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={14} className="text-muted-foreground" strokeWidth={1.5} />
              <span className="text-muted-foreground text-xs uppercase tracking-wider">Revenue Overview</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-muted-foreground text-xs">Completed</div>
                <div className="font-display text-lg text-primary">${(stats.total_earnings_today || 0).toFixed(0)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Projected (pending)</div>
                <div className="font-display text-lg text-foreground/70">${(stats.projected_earnings || 0).toFixed(0)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment status breakdown */}
      {totalPayments > 0 && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="text-muted-foreground text-xs uppercase tracking-wider mb-2">Payment Status</div>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-foreground/70">{stats.payment_breakdown.paid} paid</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-foreground/70">{stats.payment_breakdown.deposit} deposit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-foreground/70">{stats.payment_breakdown.unpaid} unpaid</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unconfirmed alert */}
      {stats.unconfirmed_count > 0 && (
        <Alert className="border-l-4 border-l-primary">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-primary font-medium text-sm">
            {stats.unconfirmed_count} ride{stats.unconfirmed_count > 1 ? 's' : ''} awaiting driver confirmation
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
