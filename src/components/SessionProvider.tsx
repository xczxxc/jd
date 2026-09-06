'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { other } from '@/lib/utils'
import { CONFIG } from '@/lib/config'
import type { Profile, Role } from '@/lib/types'

type Ctx = {
  me: Role
  partner: Role
  profiles: Record<Role, Profile>
  refresh: () => Promise<void>
}

const SessionCtx = createContext<Ctx | null>(null)

export function useSession() {
  const v = useContext(SessionCtx)
  if (!v) throw new Error('useSession dipakai di luar SessionProvider')
  return v
}

const fallback = (id: Role): Profile => ({
  id,
  display_name: id === 'boy' ? CONFIG.boyName : CONFIG.girlName,
  avatar_url: null,
  bio: null,
})

export function SessionProvider({ me, initial, children }: { me: Role; initial: Profile[]; children: React.ReactNode }) {
  const [list, setList] = useState<Profile[]>(initial)

  const load = async () => {
    const { data } = await supabase.from('profiles').select('*')
    if (data) setList(data as Profile[])
  }

  useEffect(() => {
    const ch = supabase
      .channel('profiles-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const value = useMemo<Ctx>(() => {
    const map: Record<Role, Profile> = { boy: fallback('boy'), girl: fallback('girl') }
    for (const p of list) map[p.id] = p
    return { me, partner: other(me), profiles: map, refresh: load }
  }, [list, me])

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}
