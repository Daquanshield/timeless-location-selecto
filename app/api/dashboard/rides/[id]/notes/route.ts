import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSessionUser } from '@/lib/dashboard-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request)
  const rl = checkRateLimit(`dashboard-notes:${ip}`, { maxRequests: 20, windowMs: 60000 })
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const auth = await getSessionUser(request)
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only dispatchers can edit notes
  if (auth.user.role !== 'dispatcher') {
    return NextResponse.json({ error: 'Dispatcher access only' }, { status: 403 })
  }

  const body = await request.json()
  const notes = typeof body.notes === 'string' ? body.notes : ''

  const supabase = createServerClient()

  const { error } = await supabase
    .from('rides')
    .update({ notes })
    .eq('id', params.id)

  if (error) {
    console.error('Failed to update notes:', error)
    return NextResponse.json({ error: 'Failed to update notes' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
