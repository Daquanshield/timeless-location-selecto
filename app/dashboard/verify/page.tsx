'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <h1 className="font-display text-2xl text-primary mb-2">Verifying...</h1>
          <p className="text-muted-foreground">Please wait</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="text-6xl mb-6">&#9989;</div>
          <h1 className="font-display text-2xl text-primary mb-2">Verified!</h1>
          <p className="text-muted-foreground">Redirecting to your dashboard...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-6xl mb-6">&#10060;</div>
          <h1 className="font-display text-2xl text-destructive mb-2">Login Failed</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button
            onClick={() => router.push('/dashboard/login')}
            className="w-full"
          >
            Try Again
          </Button>
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
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
            <h1 className="font-display text-2xl text-primary mb-2">Loading...</h1>
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  )
}
