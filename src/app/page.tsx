import { createClient } from '@supabase/supabase-js'
import { LoginView } from '@/components/LoginView'
import { CONFIG, isSupabaseConfigured } from '@/lib/config'
import type { Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

async function getProfiles(): Promise<Profile[]> {
  if (!isSupabaseConfigured) return []
  try {
    const sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: false } })
    const { data } = await sb.from('profiles').select('*')
    return (data as Profile[]) ?? []
  } catch {
    return []
  }
}

export default async function LoginPage() {
  const profiles = await getProfiles()
  return <LoginView profiles={profiles} />
}
