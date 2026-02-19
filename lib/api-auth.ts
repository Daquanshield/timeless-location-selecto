import { NextRequest } from 'next/server'

const RIDES_API_KEY = process.env.RIDES_API_KEY

/**
 * Validate API key from X-API-Key header.
 * Used for external integrations (SOFIA, n8n).
 */
export function validateApiKey(request: NextRequest): boolean {
  if (!RIDES_API_KEY) return false
  const key = request.headers.get('X-API-Key')
  return key === RIDES_API_KEY
}
