import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('dashboard_session')?.value

  if (token) {
    const supabase = createServerClient()
    await supabase.from('dashboard_sessions').delete().eq('token', token)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('dashboard_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}
