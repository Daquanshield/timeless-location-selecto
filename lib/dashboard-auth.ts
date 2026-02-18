import { NextRequest } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { DashboardUser } from '@/lib/dashboard-types'

export interface AuthResult {
  user: DashboardUser
  sessionId: string
}

/**
 * Validate dashboard session from cookie.
 * Returns user + session or null if unauthorized.
 */
export async function getSessionUser(request: NextRequest): Promise<AuthResult | null> {
  const cookieValue = request.cookies.get('dashboard_session')?.value
  if (!cookieValue) return null

  const supabase = createServerClient()

  // Look up valid session
  const { data: session, error: sessionError } = await supabase
    .from('dashboard_sessions')
    .select('id, user_id, expires_at')
    .eq('token', cookieValue)
    .eq('is_authenticated', true)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (sessionError || !session) return null

  // Look up active user
  const { data: user, error: userError } = await supabase
    .from('dashboard_users')
    .select('id, phone, name, email, role, ghl_contact_id, is_active')
    .eq('id', session.user_id)
    .eq('is_active', true)
    .single()

  if (userError || !user) return null

  return {
    user: user as DashboardUser,
    sessionId: session.id,
  }
}

/**
 * Generate a cryptographically random hex token.
 */
export function generateToken(length: number = 32): string {
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a random 6-digit numeric code.
 */
export function generateMagicCode(): string {
  const array = new Uint8Array(4)
  crypto.getRandomValues(array)
  const num = ((array[0] << 16) | (array[1] << 8) | array[2]) % 900000 + 100000
  return String(num)
}
