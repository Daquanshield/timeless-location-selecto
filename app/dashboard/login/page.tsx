'use client'

import { useState } from 'react'

export default function DashboardLogin() {
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/dashboard/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send code')
        return
      }

      setSent(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Format phone for display
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-6">&#128172;</div>
          <h1 className="font-display text-2xl text-gold mb-3">Check Your Texts</h1>
          <p className="text-cream/70 mb-8">
            We sent a login link to your phone. Tap the link to access your dashboard.
          </p>
          <p className="text-cream/40 text-sm mb-6">Link expires in 10 minutes</p>
          <button
            onClick={() => { setSent(false); setPhone(''); }}
            className="btn-secondary w-full"
          >
            Use a different number
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl text-gold mb-2">Timeless Rides</h1>
          <p className="text-cream/60 text-sm">Driver Dashboard</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-cream/70 text-sm mb-2">Phone Number</label>
            <input
              type="tel"
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="(248) 440-7357"
              className="input-field text-center text-lg tracking-wider"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="error-box text-center text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || phone.replace(/\D/g, '').length < 10}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="spinner spinner-light" style={{ width: 20, height: 20 }} />
                Sending...
              </>
            ) : (
              'Send Login Link'
            )}
          </button>
        </form>

        <p className="text-center text-cream/30 text-xs mt-8">
          Only registered drivers can access this dashboard
        </p>
      </div>
    </div>
  )
}
