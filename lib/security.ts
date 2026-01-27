import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

/**
 * Security utilities for the location selector API
 */

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory rate limit store (use Redis in production for multiple instances)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  rateLimitStore.forEach((entry, key) => {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  })
}, 60000) // Clean every minute

interface RateLimitConfig {
  maxRequests: number  // Max requests per window
  windowMs: number     // Time window in milliseconds
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60000  // 1 minute
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: NextRequest): string {
  // Check various headers (in order of reliability)
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp

  const xRealIp = request.headers.get('x-real-ip')
  if (xRealIp) return xRealIp

  const xForwardedFor = request.headers.get('x-forwarded-for')
  if (xForwardedFor) {
    // Take the first IP (client IP)
    return xForwardedFor.split(',')[0].trim()
  }

  return 'unknown'
}

/**
 * Check rate limit for a given key
 * Returns { allowed: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || entry.resetAt < now) {
    // First request or window expired - reset
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs
    })
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetIn: config.windowMs
    }
  }

  if (entry.count >= config.maxRequests) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetIn: entry.resetAt - now
    }
  }

  // Increment count
  entry.count++
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetIn: entry.resetAt - now
  }
}

/**
 * Rate limit middleware for API routes
 */
export function rateLimit(
  request: NextRequest,
  endpoint: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): NextResponse | null {
  const ip = getClientIp(request)
  const key = `${endpoint}:${ip}`
  const result = checkRateLimit(key, config)

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(result.resetIn / 1000)),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetIn / 1000))
        }
      }
    )
  }

  return null // Allowed
}

// ============================================
// INPUT SANITIZATION
// ============================================

/**
 * Sanitize string input - removes HTML tags and dangerous characters
 */
export function sanitizeString(input: string | undefined | null, maxLength: number = 500): string {
  if (!input) return ''

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove dangerous characters that could be used in injection
    .replace(/[<>'"`;(){}[\]\\]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Limit length
    .slice(0, maxLength)
}

/**
 * Sanitize address input - less strict, allows common address characters
 */
export function sanitizeAddress(input: string | undefined | null, maxLength: number = 300): string {
  if (!input) return ''

  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove script content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Only allow address-safe characters (letters, numbers, spaces, common punctuation)
    .replace(/[^a-zA-Z0-9\s.,#\-']/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim()
    // Limit length
    .slice(0, maxLength)
}

/**
 * Validate and sanitize coordinates
 */
export function sanitizeCoordinate(value: number | undefined | null, type: 'lat' | 'lng'): number | null {
  if (value === undefined || value === null || isNaN(value)) return null

  const num = Number(value)

  // Validate ranges
  if (type === 'lat' && (num < -90 || num > 90)) return null
  if (type === 'lng' && (num < -180 || num > 180)) return null

  // Round to reasonable precision (6 decimal places ~= 0.1m accuracy)
  return Math.round(num * 1000000) / 1000000
}

/**
 * Validate token format (UUID v4)
 */
export function isValidToken(token: string | undefined | null): boolean {
  if (!token) return false
  // UUID v4 format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(token)
}

// ============================================
// WEBHOOK SECURITY
// ============================================

/**
 * Generate HMAC signature for webhook payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
}

/**
 * Create signed webhook headers
 */
export function createWebhookHeaders(payload: string, secret: string): Record<string, string> {
  const timestamp = Date.now().toString()
  const signaturePayload = `${timestamp}.${payload}`
  const signature = generateWebhookSignature(signaturePayload, secret)

  return {
    'Content-Type': 'application/json',
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': `sha256=${signature}`
  }
}

/**
 * Verify webhook signature (for receiving webhooks)
 */
export function verifyWebhookSignature(
  payload: string,
  timestamp: string,
  signature: string,
  secret: string,
  maxAge: number = 300000 // 5 minutes
): boolean {
  // Check timestamp freshness
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Date.now() - ts > maxAge) {
    return false
  }

  // Verify signature
  const signaturePayload = `${timestamp}.${payload}`
  const expectedSignature = `sha256=${generateWebhookSignature(signaturePayload, secret)}`

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

// ============================================
// REQUEST VALIDATION
// ============================================

/**
 * Validate request content type
 */
export function validateContentType(request: NextRequest): boolean {
  const contentType = request.headers.get('content-type')
  return contentType?.includes('application/json') ?? false
}

/**
 * Check request body size (basic DoS protection)
 */
export function isRequestTooLarge(contentLength: string | null, maxSize: number = 100000): boolean {
  if (!contentLength) return false
  const size = parseInt(contentLength, 10)
  return !isNaN(size) && size > maxSize
}
