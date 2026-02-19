import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateToken, generateMagicCode } from '@/lib/dashboard-auth'
import { sendSMS, sendEmail } from '@/lib/sms'
import { checkRateLimit, getClientIp, sanitizeString } from '@/lib/security'

const DASHBOARD_URL = (process.env.NEXT_PUBLIC_DASHBOARD_URL || 'https://book.timelessrides.us').trim()

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
    const inputEmail = sanitizeString(body.email || '').toLowerCase().trim()
    let phone = sanitizeString(body.phone || '')

    // Determine login method
    const loginViaEmail = !!inputEmail && !phone

    if (loginViaEmail) {
      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputEmail)) {
        return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
      }
    } else {
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
    }

    const supabase = createServerClient()

    // Look up user by phone or email
    const query = supabase
      .from('dashboard_users')
      .select('id, name, phone, email, ghl_contact_id, is_active')

    if (loginViaEmail) {
      query.eq('email', inputEmail)
    } else {
      query.eq('phone', phone)
    }

    const { data: user, error: userError } = await query.single()

    if (userError || !user || !user.is_active) {
      const msg = loginViaEmail ? 'Email not registered' : 'Phone number not registered'
      return NextResponse.json({ error: msg }, { status: 404 })
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

    const link = `${DASHBOARD_URL}?v=${magicCode}`

    if (loginViaEmail) {
      // Email-only login: send email
      if (!user.ghl_contact_id) {
        console.error('No GHL contact ID for email user', user.email)
        return NextResponse.json({ error: 'Unable to send email. Contact admin.' }, { status: 500 })
      }

      const emailSent = await sendEmail({
        contactId: user.ghl_contact_id,
        subject: 'Your Timeless Rides Dashboard Login',
        html: buildEmailHtml(user.name, link),
      })

      if (!emailSent) {
        console.error('Email send failed for', user.email)
      }

      return NextResponse.json({
        success: true,
        message: 'Login link sent to your email',
        sentVia: 'email',
      })
    } else {
      // Phone login: send SMS, also send email if available
      const smsMessage = `${link}\n\nTimeless Rides login (10 min)`

      const smsSent = await sendSMS({
        contactId: user.ghl_contact_id || undefined,
        phone: !user.ghl_contact_id ? user.phone : undefined,
        message: smsMessage,
        from: 'elena',
      })

      if (!smsSent) {
        console.error('SMS send failed for', user.phone)
      }

      // Also send email if user has email + GHL contact
      let emailSent = false
      if (user.email && user.ghl_contact_id) {
        emailSent = await sendEmail({
          contactId: user.ghl_contact_id,
          subject: 'Your Timeless Rides Dashboard Login',
          html: buildEmailHtml(user.name, link),
        })

        if (!emailSent) {
          console.error('Email send failed for', user.email)
        }
      }

      const channels = [smsSent && 'phone', emailSent && 'email'].filter(Boolean).join(' and ')
      return NextResponse.json({
        success: true,
        message: channels ? `Login link sent to your ${channels}` : 'Login link sent',
        sentVia: 'phone',
      })
    }
  } catch (error) {
    console.error('send-code error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

function buildEmailHtml(name: string, link: string): string {
  return `
    <div style="font-family: 'Georgia', serif; max-width: 480px; margin: 0 auto; background: #1A1A1A; padding: 40px 30px; border-radius: 12px;">
      <h1 style="color: #D4AF37; font-size: 24px; text-align: center; margin-bottom: 8px;">Timeless Rides</h1>
      <p style="color: #F5F2EB99; text-align: center; font-size: 14px; margin-bottom: 32px;">Dashboard Login</p>
      <p style="color: #F5F2EB; font-size: 16px; margin-bottom: 24px;">Hi ${name},</p>
      <p style="color: #F5F2EBB3; font-size: 14px; margin-bottom: 32px;">Tap the button below to access your dashboard:</p>
      <div style="text-align: center; margin-bottom: 32px;">
        <a href="${link}" style="display: inline-block; background: #D4AF37; color: #1A1A1A; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">Open Dashboard</a>
      </div>
      <p style="color: #F5F2EB66; font-size: 12px; text-align: center;">This link expires in 10 minutes.</p>
    </div>
  `
}
