import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateToken, generateMagicCode } from '@/lib/dashboard-auth'
import { sendSMS } from '@/lib/sms'
import { checkRateLimit, getClientIp, sanitizeString } from '@/lib/security'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://book.timelessrides.us'

export async function POST(request: NextRequest) {
  // Rate limit: 3 per 5 min per IP
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-send-code:${ip}`, { maxRequests: 3, windowMs: 300000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a few minutes.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    let phone = sanitizeString(body.phone || '')

    // Normalize phone to E.164
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 10) {
      phone = `+1${digits}`
    } else if (digits.length === 11 && digits[0] === '1') {
      phone = `+${digits}`
    } else if (digits.length > 0 && !phone.startsWith('+')) {
      phone = `+${digits}`
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 })
    }

    const supabase = createServerClient()

    // Look up user
    const { data: user, error: userError } = await supabase
      .from('dashboard_users')
      .select('id, name, ghl_contact_id, is_active')
      .eq('phone', phone)
      .single()

    if (userError || !user || !user.is_active) {
      return NextResponse.json({ error: 'Phone number not registered' }, { status: 404 })
    }

    // Generate magic code + session token
    const magicCode = generateMagicCode()
    const sessionToken = generateToken(32)
    const now = new Date()
    const codeExpiry = new Date(now.getTime() + 10 * 60 * 1000) // 10 min
    const sessionExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h

    // Create session
    const { error: insertError } = await supabase.from('dashboard_sessions').insert({
      user_id: user.id,
      token: sessionToken,
      magic_code: magicCode,
      magic_code_expires_at: codeExpiry.toISOString(),
      is_authenticated: false,
      expires_at: sessionExpiry.toISOString(),
    })

    if (insertError) {
      console.error('Failed to create session:', insertError)
      return NextResponse.json({ error: 'Failed to send code' }, { status: 500 })
    }

    // Send SMS with login link
    const link = `${DASHBOARD_URL}/dashboard/verify?code=${magicCode}`
    const message = `Your Timeless Rides dashboard login:\n${link}\n\nThis link expires in 10 minutes.`

    const sent = await sendSMS({
      contactId: user.ghl_contact_id || undefined,
      phone: !user.ghl_contact_id ? phone : undefined,
      message,
    })

    if (!sent) {
      console.error('SMS send failed for', phone)
      // Don't reveal SMS failure to client for security
    }

    return NextResponse.json({ success: true, message: 'Login link sent to your phone' })
  } catch (error) {
    console.error('send-code error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
