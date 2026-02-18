import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Dashboard | Timeless Rides',
  description: 'Driver and dispatcher dashboard for Timeless Rides',
}

export default function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-charcoal">
      {children}
    </div>
  )
}
