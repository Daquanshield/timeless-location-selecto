'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import NavBar from '@/components/dashboard/NavBar'
import type { DashboardUser } from '@/lib/dashboard-types'

interface Section {
  id: string
  title: string
  content: React.ReactNode
}

export default function DocsPage() {
  const router = useRouter()
  const [user, setUser] = useState<DashboardUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState('overview')

  const fetchUser = useCallback(async () => {
    const res = await fetch('/api/dashboard/auth/me')
    if (!res.ok) { router.push('/dashboard/login'); return }
    const data = await res.json()
    setUser(data.user)
    setLoading(false)
  }, [router])

  useEffect(() => { fetchUser() }, [fetchUser])

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const sections: Section[] = [
    {
      id: 'overview',
      title: 'System Overview',
      content: (
        <div className="space-y-6">
          <p className="text-foreground/70">
            Timeless Rides is a premium black car/SUV service operating in Metro Detroit. The system consists of three integrated platforms working together to deliver seamless booking and ride management.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <InfoCard
              title="Website"
              subtitle="book.timelessrides.us"
              items={['Customer booking', 'Driver dashboard', 'Dispatcher dashboard']}
            />
            <InfoCard
              title="GoHighLevel"
              subtitle="CRM & Calendar"
              items={['Calendar scheduling', 'SMS notifications', 'Contact management']}
            />
            <InfoCard
              title="n8n Automation"
              subtitle="Elena AI Agent"
              items={['Voice AI assistant', 'Workflow automation', 'Ride creation']}
            />
          </div>
          <Card className="border-primary/15 bg-primary/5">
            <CardContent className="p-4">
              <h4 className="text-primary font-display text-sm mb-3">How It Works</h4>
              <ol className="space-y-2 text-muted-foreground text-sm">
                <li className="flex gap-2"><span className="text-primary/60 font-mono">1.</span> Customer calls or texts &rarr; Elena AI collects details</li>
                <li className="flex gap-2"><span className="text-primary/60 font-mono">2.</span> Elena sends booking link via SMS</li>
                <li className="flex gap-2"><span className="text-primary/60 font-mono">3.</span> Customer confirms on website &rarr; GHL appointment created</li>
                <li className="flex gap-2"><span className="text-primary/60 font-mono">4.</span> Ride appears in dispatcher dashboard</li>
                <li className="flex gap-2"><span className="text-primary/60 font-mono">5.</span> Dispatcher assigns driver</li>
                <li className="flex gap-2"><span className="text-primary/60 font-mono">6.</span> Driver manages ride status through completion</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'pricing',
      title: 'SOFIA Pricing',
      content: (
        <div className="space-y-6">
          <p className="text-foreground/70 text-sm">
            SOFIA v4.0 handles all pricing with zone-based flat rates for airport transfers and hourly rates for local rides.
          </p>

          <DocTable
            title="Service Types"
            headers={['Service', 'When Used', 'Pricing']}
            rows={[
              ['Airport Transfer', 'One end is DTW', 'Flat rate by zone'],
              ['Hourly', 'Local Metro Detroit', 'Per-hour (3hr min)'],
              ['Day Rate', 'Extended bookings', '8hr or 12hr packages'],
              ['Long Distance', 'Outside Metro Detroit', 'Per-destination'],
              ['Multi-Stop', 'Airport + stops', 'Base + $15/stop'],
            ]}
          />

          <DocTable
            title="Vehicle Classes"
            headers={['Class', 'Capacity', 'Hourly Rate']}
            rows={[
              ['Executive SUV', 'Up to 4 pax', '$85/hr'],
              ['Premier SUV', 'Up to 6 pax', '$110/hr'],
            ]}
          />

          <DocTable
            title="Airport Transfer Rates"
            headers={['Zone', 'Executive SUV', 'Premier SUV']}
            rows={[
              ['Downtown', '$95', '$125'],
              ['West', '$95', '$125'],
              ['North', '$125', '$160'],
              ['East', '$125', '$160'],
              ['Northeast', '$150', '$175'],
            ]}
          />

          <DocTable
            title="Day Rates"
            headers={['Package', 'Executive SUV', 'Premier SUV']}
            rows={[
              ['8-hour', '$600', '$800'],
              ['12-hour', '$850', '$1,100'],
            ]}
          />

          <DocTable
            title="Long-Distance Destinations"
            headers={['Destination', 'Exec (1-way)', 'Exec (Round)', 'Premier (1-way)', 'Premier (Round)']}
            rows={[
              ['Ann Arbor', '$125', '$225', '$175', '$300'],
              ['Lansing', '$250', '$400', '$325', '$525'],
              ['Grand Rapids', '$375', '$625', '$475', '$800'],
              ['Flint', '$150', '$250', '$200', '$350'],
              ['Toledo', '$175', '$300', '$250', '$400'],
              ['Kalamazoo', '$325', '$550', '$425', '$700'],
              ['Port Huron', '$175', '$300', '$250', '$400'],
              ['Bay City', '$250', '$400', '$325', '$525'],
              ['Traverse City', '$500', '$850', '$625', '$1,050'],
              ['Chicago', '$550', '$950', '$700', '$1,200'],
            ]}
          />

          <DocTable
            title="Wait Time Tiers (Long-Distance)"
            headers={['Tier', 'Duration', 'Executive', 'Premier']}
            rows={[
              ['Short', '1-2 hours', '$50', '$75'],
              ['Dinner', '2-4 hours', '$100', '$150'],
              ['Extended', '4-6 hours', '$175', '$250'],
              ['All Day', '6-8 hours', '$250', '$350'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'zones',
      title: 'Metro Detroit Zones',
      content: (
        <div className="space-y-6">
          <p className="text-foreground/70 text-sm">
            Zones are auto-detected from addresses using keyword matching and GPS coordinates.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ZoneCard zone="Downtown" color="#D4AF37" areas="Detroit core, Midtown, Corktown, Renaissance Center, Greektown, Eastern Market" />
            <ZoneCard zone="West" color="#6366F1" areas="Novi, Plymouth, Farmington, Livonia, Dearborn, Canton" />
            <ZoneCard zone="North" color="#22C55E" areas="Troy, Birmingham, Royal Oak, Southfield, Bloomfield Hills" />
            <ZoneCard zone="East" color="#EF4444" areas="Grosse Pointe, St. Clair Shores, Eastpointe, Macomb" />
            <ZoneCard zone="Northeast" color="#F59E0B" areas="Rochester, Auburn Hills, Lake Orion, Clarkston, Oxford" />
            <ZoneCard zone="Airport" color="#06B6D4" areas="DTW, Romulus, Wayne, Metro Airport area" />
            <ZoneCard zone="Out of Area" color="#9CA3AF" areas="Beyond Metro Detroit boundaries" />
          </div>
        </div>
      ),
    },
    {
      id: 'ride-status',
      title: 'Ride Status Flow',
      content: (
        <div className="space-y-6">
          <p className="text-foreground/70 text-sm">
            Each ride follows a defined status progression. Only valid transitions are allowed.
          </p>

          <div className="flex flex-wrap gap-2 items-center justify-center py-4">
            <StatusStep label="Pending" color="#F59E0B" />
            <Arrow />
            <StatusStep label="Confirmed" color="#22C55E" />
            <Arrow />
            <StatusStep label="En Route" color="#3B82F6" />
            <Arrow />
            <StatusStep label="Arrived" color="#8B5CF6" />
            <Arrow />
            <StatusStep label="In Progress" color="#06B6D4" />
            <Arrow />
            <StatusStep label="Completed" color="#22C55E" />
          </div>

          <div className="flex flex-wrap gap-2 items-center justify-center">
            <StatusStep label="Cancelled" color="#EF4444" />
            <StatusStep label="No Show" color="#F97316" />
          </div>

          <DocTable
            title="Status Definitions"
            headers={['Status', 'Meaning', 'Set By']}
            rows={[
              ['Pending', 'New ride, awaiting confirmation', 'System'],
              ['Confirmed', 'Driver accepted the ride', 'Driver / Dispatcher'],
              ['En Route', 'Driver heading to pickup', 'Driver'],
              ['Arrived', 'Driver at pickup location', 'Driver'],
              ['In Progress', 'Customer picked up, trip active', 'Driver'],
              ['Completed', 'Trip finished', 'Driver'],
              ['Cancelled', 'Ride cancelled', 'Dispatcher'],
              ['No Show', 'Customer did not show up', 'Driver / Dispatcher'],
            ]}
          />

          <DocTable
            title="Confirmation Status"
            headers={['Status', 'Meaning']}
            rows={[
              ['Unconfirmed', 'Awaiting driver response'],
              ['Confirmed', 'Driver accepted'],
              ['Declined', 'Driver declined'],
              ['Unavailable', 'No driver available'],
            ]}
          />

          <DocTable
            title="Payment Status"
            headers={['Status', 'Meaning']}
            rows={[
              ['Unpaid', 'No payment received'],
              ['Deposit', 'Partial payment received'],
              ['Paid', 'Full payment received'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'notifications',
      title: 'SMS Notifications',
      content: (
        <div className="space-y-6">
          <p className="text-foreground/70 text-sm">
            The system sends automatic SMS notifications to clients via GoHighLevel on ride status changes.
          </p>

          <DocTable
            title="Automatic Status Notifications"
            headers={['Trigger', 'Message']}
            rows={[
              ['Ride Confirmed', 'Your booking for [date] at [time] has been confirmed! Pickup: [address]'],
              ['Driver En Route', 'Your chauffeur is on the way! ETA to pickup: [address]'],
              ['Driver Arrived', 'Your chauffeur has arrived at [address]'],
              ['Ride Completed', 'Thank you for riding with Timeless Rides! Your trip is complete.'],
              ['Ride Cancelled', 'Your booking for [date] has been cancelled.'],
            ]}
          />

          <DocTable
            title="Driver Quick Notifications"
            headers={['Template', 'Message']}
            rows={[
              ['5 Minutes Away', 'Your chauffeur will arrive in approximately 5 minutes.'],
              ['Arrived', 'Your chauffeur has arrived and is waiting.'],
              ['Delayed', 'Your chauffeur is running a few minutes behind. We apologize.'],
            ]}
          />
        </div>
      ),
    },
    {
      id: 'dashboard-guide',
      title: 'Dashboard Guide',
      content: (
        <div className="space-y-6">
          {user.role === 'dispatcher' ? (
            <>
              <h4 className="text-primary font-display">Dispatcher Features</h4>
              <div className="space-y-4">
                <GuideItem
                  title="Stats Overview"
                  desc="View rides today, upcoming count, completed today, total earnings, projected earnings, and payment breakdown (paid/deposit/unpaid)."
                />
                <GuideItem
                  title="Ride Management"
                  desc="View all rides with filters by status, date range, and driver. Click any ride to see full details."
                />
                <GuideItem
                  title="Assign Drivers"
                  desc="Open a ride detail and use the driver dropdown to assign or reassign a driver."
                />
                <GuideItem
                  title="Create Rides"
                  desc="Click 'New Ride' on the main page to manually create a ride with all details."
                />
                <GuideItem
                  title="Appointments"
                  desc="View upcoming and archived GHL calendar appointments. Auto-refreshes every 60 seconds."
                />
                <GuideItem
                  title="Notifications"
                  desc="Bell icon shows recent status changes and new bookings. Polls every 30 seconds."
                />
                <GuideItem
                  title="Send Client SMS"
                  desc="On any active ride, use 'Notify Client' to send a templated SMS to the customer."
                />
                <GuideItem
                  title="Ride Notes"
                  desc="Add or edit internal notes on any ride for driver instructions or special requests."
                />
              </div>
            </>
          ) : (
            <>
              <h4 className="text-primary font-display">Driver Features</h4>
              <div className="space-y-4">
                <GuideItem
                  title="My Rides"
                  desc="View your assigned upcoming rides (pending, confirmed, en route, arrived, in progress) and past rides."
                />
                <GuideItem
                  title="Accept / Decline"
                  desc="When a ride is assigned to you, open it and click Accept or Decline."
                />
                <GuideItem
                  title="Status Updates"
                  desc="Progress through the ride: Confirmed → En Route → Arrived → In Progress → Completed. Each update notifies the client."
                />
                <GuideItem
                  title="Quick Notifications"
                  desc="During active rides, send quick SMS to client: '5 min away', 'Arrived', or 'Delayed'."
                />
              </div>
            </>
          )}

          <Card className="border-primary/15 bg-primary/5">
            <CardContent className="p-4">
              <h4 className="text-primary font-display text-sm mb-3">Login & Security</h4>
              <ul className="space-y-1 text-muted-foreground text-sm">
                <li>&bull; Login with your phone number — a 6-digit code is sent via SMS</li>
                <li>&bull; Sessions last 24 hours</li>
                <li>&bull; Auto-logout after 30 minutes of inactivity</li>
                <li>&bull; 5 login attempts per hour per phone number</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },
    {
      id: 'key-urls',
      title: 'Quick Reference',
      content: (
        <div className="space-y-6">
          <DocTable
            title="Key URLs"
            headers={['System', 'URL']}
            rows={[
              ['Booking Website', 'book.timelessrides.us'],
              ['Dashboard', 'book.timelessrides.us/dashboard'],
              ['n8n Workflows', 'timelesstrust.app.n8n.cloud'],
            ]}
          />

          <DocTable
            title="Timezone"
            headers={['Setting', 'Value']}
            rows={[
              ['All times displayed in', 'America/Detroit (Eastern Time)'],
              ['Calendar slots from', 'GoHighLevel (GHL)'],
              ['Appointment format', 'ISO 8601 with timezone offset'],
            ]}
          />

          <Card className="border-destructive/20 bg-destructive/5">
            <CardContent className="p-4">
              <h4 className="text-destructive font-display text-sm mb-2">Troubleshooting</h4>
              <ul className="space-y-2 text-muted-foreground text-sm">
                <li><span className="text-foreground/80 font-medium">Can&apos;t log in?</span> — Make sure your phone number is registered in the system. Contact dispatch.</li>
                <li><span className="text-foreground/80 font-medium">Not receiving SMS?</span> — Check your phone number format. Must include country code (+1).</li>
                <li><span className="text-foreground/80 font-medium">Ride not showing?</span> — Try refreshing. Rides update in real-time but may take a few seconds.</li>
                <li><span className="text-foreground/80 font-medium">Status won&apos;t update?</span> — Rides must follow the correct order. You can&apos;t skip steps.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <NavBar userName={user.name} userRole={user.role} />

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-display text-2xl text-primary">System Documentation</h1>
          <p className="text-muted-foreground text-sm mt-1">Timeless Rides operations reference</p>
        </div>

        {/* Tab navigation */}
        <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-primary/15">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeSection === s.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground/70 hover:bg-accent'
              }`}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Active section content */}
        {sections.map((s) =>
          s.id === activeSection ? (
            <div key={s.id}>
              <h2 className="font-display text-xl text-foreground mb-4">{s.title}</h2>
              {s.content}
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}

/* ============ Helper Components ============ */

function InfoCard({ title, subtitle, items }: { title: string; subtitle: string; items: string[] }) {
  return (
    <Card className="border-primary/10 bg-accent/30">
      <CardContent className="p-4">
        <h4 className="text-primary font-display text-sm">{title}</h4>
        <p className="text-muted-foreground text-xs mb-2">{subtitle}</p>
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-foreground/60 text-xs">&bull; {item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function DocTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div>
      <h4 className="text-foreground/80 font-medium text-sm mb-2">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-primary/10">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary/8">
              {headers.map((h, i) => (
                <th key={i} className="text-left px-3 py-2 text-primary/80 font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-t border-primary/6">
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 text-xs ${ci === 0 ? 'text-foreground/80 font-medium' : 'text-foreground/60'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ZoneCard({ zone, color, areas }: { zone: string; color: string; areas: string }) {
  return (
    <Card className="border-primary/10 bg-accent/30">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-foreground/90 font-medium text-sm">{zone}</span>
        </div>
        <p className="text-muted-foreground text-xs">{areas}</p>
      </CardContent>
    </Card>
  )
}

function StatusStep({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${color}20`, color }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  )
}

function Arrow() {
  return <span className="text-muted-foreground/50 text-xs">&rarr;</span>
}

function GuideItem({ title, desc }: { title: string; desc: string }) {
  return (
    <Card className="border-primary/8 bg-accent/30">
      <CardContent className="p-3">
        <h5 className="text-foreground/90 font-medium text-sm">{title}</h5>
        <p className="text-muted-foreground text-xs mt-1">{desc}</p>
      </CardContent>
    </Card>
  )
}
