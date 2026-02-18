import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/dashboard-auth'

export async function GET(request: NextRequest) {
  const auth = await getSessionUser(request)

  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      id: auth.user.id,
      name: auth.user.name,
      phone: auth.user.phone,
      role: auth.user.role,
      email: auth.user.email,
    },
  })
}
