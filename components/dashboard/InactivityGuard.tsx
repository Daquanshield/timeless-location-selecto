'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export default function InactivityGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const logout = useCallback(async () => {
    await fetch('/api/dashboard/auth/logout', { method: 'POST' }).catch(() => {})
    router.push('/dashboard/login?expired=1')
  }, [router])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(logout, INACTIVITY_TIMEOUT)
  }, [logout])

  useEffect(() => {
    const events = ['mousedown', 'touchstart', 'keydown', 'scroll']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [resetTimer])

  return <>{children}</>
}
