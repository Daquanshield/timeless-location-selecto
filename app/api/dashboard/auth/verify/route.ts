import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function POST(request: NextRequest) {
  // Rate limit: 5 per 5 min per IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-verify:${ip}`, { maxRequests: 5, windowMs: 300000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const code = String(body.code || '').trim()

    if (!code || code.length !== 6) {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Find matching session
    const { data: session, error: sessionError } = await supabase
      .from('dashboard_sessions')
      .select('id, user_id, token, magic_code_expires_at')
      .eq('magic_code', code)
      .eq('is_authenticated', false)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 })
    }

    // Check expiry
    if (new Date(session.magic_code_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Code expired. Request a new one.' }, { status: 401 })
    }

    // Authenticate session
    const sessionExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h from now
    const { error: updateError } = await supabase
      .from('dashboard_sessions')
      .update({
        is_authenticated: true,
        magic_code: null, // Clear used code
        expires_at: sessionExpiry.toISOString(),
      })
      .eq('id', session.id)

    if (updateError) {
      console.error('Failed to authenticate session:', updateError)
      return NextResponse.json({ error: 'Server error' }, { status: 500 })
    }

    // Get user info
    const { data: user } = await supabase
      .from('dashboard_users')
      .select('id, name, phone, role, email')
      .eq('id', session.user_id)
      .eq('is_active', true)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'Account not found' }, { status: 401 })
    }

    // Set session cookie
    const isProduction = process.env.NODE_ENV === 'production'
    const response = NextResponse.json({
      success: true,
      user: { name: user.name, role: user.role },
    })

    response.cookies.set('dashboard_session', session.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400, // 24 hours
    })

    return response
  } catch (error) {
    console.error('verify error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
