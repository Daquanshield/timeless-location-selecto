import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Security middleware for all routes
 * Adds security headers and basic protections
 */
export function middleware(request: NextRequest) {
  // Short login link: /?v=CODE → /dashboard/verify?code=CODE
  const loginCode = request.nextUrl.searchParams.get('v')
  if (loginCode && request.nextUrl.pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard/verify'
    url.searchParams.delete('v')
    url.searchParams.set('code', loginCode)
    return NextResponse.redirect(url)
  }

  const response = NextResponse.next()

  // Security headers
  const headers = response.headers

  // Prevent clickjacking
  headers.set('X-Frame-Options', 'DENY')

  // Prevent MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff')

  // XSS Protection (legacy browsers)
  headers.set('X-XSS-Protection', '1; mode=block')

  // Referrer policy - don't leak URLs
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions policy - disable unnecessary features
  headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=()'
  )

  // Content Security Policy
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.mapbox.com https://*.tiles.mapbox.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://api.mapbox.com https://*.mapbox.com https://*.supabase.co wss://*.supabase.co",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  )

  // HSTS - only in production (when using HTTPS)
  if (process.env.NODE_ENV === 'production') {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    )
  }

  return response
}

// Apply to all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
