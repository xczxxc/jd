import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getRole } from '@/lib/session'
import { SessionProvider } from '@/components/SessionProvider'
import { CallProvider } from '@/components/CallProvider'
import { AppShell } from '@/components/AppShell'
import { CONFIG, isSupabaseConfigured } from '@/lib/config'
import type { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getRole()
  if (!me) redirect('/')

  let profiles: Profile[] = []
  if (isSupabaseConfigured) {
    try {
      const sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: false } })
      const { data } = await sb.from('profiles').select('*')
      profiles = (data as Profile[]) ?? []
    } catch {}
  }

  return (
    <SessionProvider me={me} initial={profiles}>
      <CallProvider>
        <AppShell>{children}</AppShell>
      </CallProvider>
    </SessionProvider>
  )
}
