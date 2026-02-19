'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Menu, X, LogOut } from 'lucide-react'
import type { UserRole } from '@/lib/dashboard-types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import NotificationBell from '@/components/dashboard/NotificationBell'

interface NavBarProps {
  userName: string
  userRole: UserRole
}

export default function NavBar({ userName, userRole }: NavBarProps) {
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const basePath = userRole === 'dispatcher' ? '/dashboard/dispatcher' : '/dashboard/driver'

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch('/api/dashboard/auth/logout', { method: 'POST' })
    router.push('/dashboard/login')
  }

  const navLinks = userRole === 'dispatcher'
    ? [
        { label: 'All Rides', href: '/dashboard/dispatcher' },
        { label: 'Drivers', href: '/dashboard/dispatcher/drivers' },
        { label: 'Appointments', href: '/dashboard/dispatcher/appointments' },
        { label: 'Docs', href: '/dashboard/docs' },
      ]
    : [
        { label: 'My Rides', href: '/dashboard/driver' },
      ]

  return (
    <nav className="sticky top-0 z-50 bg-background border-b border-border/30">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <button onClick={() => router.push(basePath)} className="flex items-center gap-2">
          <span className="font-display text-lg text-primary">Timeless Rides</span>
          <span className="text-muted-foreground text-xs hidden sm:inline">
            {userRole === 'dispatcher' ? 'Dispatch' : 'Driver'}
          </span>
        </button>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-1">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              onClick={() => router.push(link.href)}
              className="text-muted-foreground hover:text-primary"
            >
              {link.label}
            </Button>
          ))}
          {userRole === 'dispatcher' && <NotificationBell basePath={basePath} />}
          <Separator orientation="vertical" className="h-6 mx-2" />
          <span className="text-muted-foreground text-sm">{userName}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-muted-foreground hover:text-destructive-foreground"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>

        {/* Mobile actions */}
        <div className="sm:hidden flex items-center gap-1">
          {userRole === 'dispatcher' && <NotificationBell basePath={basePath} />}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                {sheetOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64 bg-background border-border">
              <div className="flex flex-col gap-2 mt-8">
                {navLinks.map((link) => (
                  <Button
                    key={link.href}
                    variant="ghost"
                    className="justify-start text-foreground hover:text-primary"
                    onClick={() => { router.push(link.href); setSheetOpen(false) }}
                  >
                    {link.label}
                  </Button>
                ))}
                <Separator className="my-2" />
                <div className="px-4 py-2">
                  <span className="text-muted-foreground text-sm">{userName}</span>
                </div>
                <Button
                  variant="ghost"
                  className="justify-start text-destructive-foreground hover:text-destructive-foreground"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
