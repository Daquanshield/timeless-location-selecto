'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function DashboardLogin() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')

  // Auto-detect if input is phone or email
  const digitsOnly = input.replace(/\D/g, '')
  const isEmail = input.includes('@')
  const isPhone = !isEmail && digitsOnly.length >= 3

  const stripCountryCode = (digits: string) => {
    if (digits.length > 1 && digits[0] === '1') {
      return digits.slice(1)
    }
    return digits
  }

  const formatPhone = (value: string) => {
    const digits = stripCountryCode(value.replace(/\D/g, ''))
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handleChange = (value: string) => {
    setError('')
    // If it looks like a phone number (starts with digit, +, or parens), format it
    const raw = value.replace(/\D/g, '')
    if (!value.includes('@') && raw.length > 0 && !value.match(/^[a-zA-Z]/)) {
      const digits = stripCountryCode(raw.slice(0, 11))
      setInput(formatPhone(digits))
    } else {
      setInput(value)
    }
  }

  const isValid = isEmail
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)
    : stripCountryCode(digitsOnly).length >= 10

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const payload = isEmail
        ? { email: input.trim().toLowerCase() }
        : { phone: stripCountryCode(digitsOnly) }

      const res = await fetch('/api/dashboard/auth/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to send login link')
        return
      }

      setSentTo(data.sentVia || (isEmail ? 'email' : 'phone'))
      setSent(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    const viaEmail = sentTo === 'email'
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-6xl mb-6">{viaEmail ? '\u2709\uFE0F' : '\uD83D\uDCAC'}</div>
          <h1 className="font-display text-2xl text-primary mb-3">
            {viaEmail ? 'Check Your Email' : 'Check Your Texts'}
          </h1>
          <p className="text-foreground/70 mb-8">
            We sent a login link to your {viaEmail ? 'email' : 'phone'}. Tap the link to access your dashboard.
          </p>
          <p className="text-muted-foreground text-sm mb-6">Link expires in 10 minutes</p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { setSent(false); setInput(''); }}
          >
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-10">
          <h1 className="font-display text-3xl text-primary mb-2">Timeless Rides</h1>
          <p className="text-muted-foreground text-sm">Team Dashboard</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label className="text-foreground/70 text-sm mb-2">Phone Number or Email</Label>
            <Input
              type="text"
              value={input}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="(248) 440-7357 or name@email.com"
              className="text-center text-lg mt-2"
              autoFocus
              required
            />
            <p className="text-muted-foreground/60 text-xs text-center mt-2">
              {isEmail ? 'Login link will be sent to your email' : isPhone ? 'Login link will be sent via SMS' : 'Enter your registered phone or email'}
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription className="text-center text-sm">{error}</AlertDescription>
            </Alert>
          )}

          <Button
            type="submit"
            disabled={loading || !isValid}
            className="w-full"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </span>
            ) : (
              'Send Login Link'
            )}
          </Button>
        </form>

        <p className="text-center text-muted-foreground/60 text-xs mt-8">
          Only registered team members can access this dashboard
        </p>
      </div>
    </div>
  )
}
