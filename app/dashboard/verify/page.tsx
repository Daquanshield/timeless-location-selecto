'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying')
  const [error, setError] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      setStatus('error')
      setError('No login code found')
      return
    }

    const verify = async () => {
      try {
        const res = await fetch('/api/dashboard/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })

        const data = await res.json()

        if (!res.ok) {
          setStatus('error')
          setError(data.error || 'Verification failed')
          return
        }

        setStatus('success')

        // Redirect based on role
        const redirectPath = data.user?.role === 'dispatcher'
          ? '/dashboard/dispatcher'
          : '/dashboard/driver'

        setTimeout(() => router.push(redirectPath), 1000)
      } catch {
        setStatus('error')
        setError('Network error')
      }
    }

    verify()
  }, [searchParams, router])

  return (
    <div className="w-full max-w-sm text-center">
      {status === 'verifying' && (
        <>
          <div className="flex justify-center mb-6">
            <div className="spinner" style={{ width: 40, height: 40 }} />
          </div>
          <h1 className="font-display text-2xl text-gold mb-2">Verifying...</h1>
          <p className="text-cream/60">Please wait</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-6xl mb-6">&#9989;</div>
          <h1 className="font-display text-2xl text-gold mb-2">Verified!</h1>
          <p className="text-cream/60">Redirecting to your dashboard...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-6xl mb-6">&#10060;</div>
          <h1 className="font-display text-2xl text-red-400 mb-2">Login Failed</h1>
          <p className="text-cream/60 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard/login')}
            className="btn-primary w-full"
          >
            Try Again
          </button>
        </>
      )}
    </div>
  )
}

export default function DashboardVerify() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense
        fallback={
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="spinner" style={{ width: 40, height: 40 }} />
            </div>
            <h1 className="font-display text-2xl text-gold mb-2">Loading...</h1>
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  )
}
