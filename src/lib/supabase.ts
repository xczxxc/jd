import { createClient } from '@supabase/supabase-js'
import { CONFIG, isSupabaseConfigured } from './config'

if (typeof window !== 'undefined' && !isSupabaseConfigured) {
  console.warn('Supabase belum disetel. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di src/lib/config.ts')
}

export const supabase = createClient(
  isSupabaseConfigured ? CONFIG.supabaseUrl : 'https://belum-diisi.supabase.co',
  isSupabaseConfigured ? CONFIG.supabaseAnonKey : 'belum-diisi',
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 25 } },
  },
)

export const BUCKETS = { media: 'media', moments: 'moments', avatars: 'avatars' } as const
