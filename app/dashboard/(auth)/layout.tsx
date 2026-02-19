import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase'
import InactivityGuard from '@/components/dashboard/InactivityGuard'

export default async function AuthenticatedDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get('dashboard_session')?.value

  if (!sessionToken) {
    redirect('/dashboard/login')
  }

  // Validate session
  const supabase = createServerClient()
  const { data: session } = await supabase
    .from('dashboard_sessions')
    .select('id, user_id, expires_at')
    .eq('token', sessionToken)
    .eq('is_authenticated', true)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (!session) {
    redirect('/dashboard/login')
  }

  const { data: user } = await supabase
    .from('dashboard_users')
    .select('id, name, phone, role, is_active')
    .eq('id', session.user_id)
    .single()

  if (!user || !user.is_active) {
    redirect('/dashboard/login')
  }

  return <InactivityGuard>{children}</InactivityGuard>
}
