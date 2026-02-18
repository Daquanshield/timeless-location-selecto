'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/dashboard-types'

interface NavBarProps {
  userName: string
  userRole: UserRole
}

export default function NavBar({ userName, userRole }: NavBarProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const basePath = userRole === 'dispatcher' ? '/dashboard/dispatcher' : '/dashboard/driver'

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch('/api/dashboard/auth/logout', { method: 'POST' })
    router.push('/dashboard/login')
  }

  const navLinks = userRole === 'dispatcher'
    ? [
        { label: 'All Rides', href: '/dashboard/dispatcher' },
      ]
    : [
        { label: 'My Rides', href: '/dashboard/driver' },
      ]

  return (
    <nav className="sticky top-0 z-50 bg-charcoal border-b" style={{ borderColor: 'rgba(212, 175, 55, 0.2)' }}>
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <button onClick={() => router.push(basePath)} className="flex items-center gap-2">
          <span className="font-display text-lg text-gold">Timeless Rides</span>
          <span className="text-cream/40 text-xs hidden sm:inline">
            {userRole === 'dispatcher' ? 'Dispatch' : 'Driver'}
          </span>
        </button>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6">
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className="text-cream/70 hover:text-gold text-sm transition-colors"
            >
              {link.label}
            </button>
          ))}
          <div className="flex items-center gap-3">
            <span className="text-cream/50 text-sm">{userName}</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-cream/40 hover:text-red-400 text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden text-cream/60 p-1"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden border-t px-4 py-3 space-y-2" style={{ borderColor: 'rgba(212, 175, 55, 0.1)' }}>
          {navLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => { router.push(link.href); setMenuOpen(false) }}
              className="block w-full text-left text-cream/70 hover:text-gold py-2 text-sm"
            >
              {link.label}
            </button>
          ))}
          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'rgba(212, 175, 55, 0.1)' }}>
            <span className="text-cream/50 text-sm">{userName}</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-red-400 text-sm"
            >
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
