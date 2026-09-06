'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Check, Loader2, LogOut, Moon, Sun } from 'lucide-react'
import { supabase, BUCKETS } from '@/lib/supabase'
import { compressImage } from '@/lib/compress'
import { uid } from '@/lib/utils'
import { useSession } from './SessionProvider'
import { useTheme } from './ThemeProvider'
import { Avatar } from './Avatar'
import { CONFIG } from '@/lib/config'

const FALLBACK_START = CONFIG.loveStartDate

export function ProfileEditor() {
  const router = useRouter()
  const { me, profiles, refresh } = useSession()
  const { mode, toggle } = useTheme()

  const [name, setName] = useState(profiles[me].display_name)
  const [bio, setBio] = useState(profiles[me].bio ?? '')
  const [start, setStart] = useState(FALLBACK_START)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(profiles[me].display_name)
    setBio(profiles[me].bio ?? '')
  }, [me, profiles])

  useEffect(() => {
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'relationship')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value?.start_date) setStart(data.value.start_date)
      })
  }, [])

  async function saveProfile() {
    setSaving(true)
    await supabase
      .from('profiles')
      .update({ display_name: name.trim() || 'Sayang', bio: bio.trim() || null, updated_at: new Date().toISOString() })
      .eq('id', me)
    await supabase.from('settings').upsert({ key: 'relationship', value: { start_date: start } })
    await refresh()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  async function changeAvatar(file: File) {
    setUploading(true)
    try {
      const out = await compressImage(file, { maxSide: 640, targetKB: 90, startQuality: 0.9 })
      const path = `${me}/${uid()}.${out.ext}`
      const { error } = await supabase.storage.from(BUCKETS.avatars).upload(path, out.blob, {
        contentType: out.mime,
        cacheControl: '31536000',
      })
      if (error) throw error
      const { data } = supabase.storage.from(BUCKETS.avatars).getPublicUrl(path)
      const old = profiles[me].avatar_url
      await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', me)
      if (old?.includes(`/${BUCKETS.avatars}/`)) {
        const oldPath = old.split(`/${BUCKETS.avatars}/`)[1]
        if (oldPath) supabase.storage.from(BUCKETS.avatars).remove([decodeURIComponent(oldPath)])
      }
      await refresh()
      router.refresh()
    } catch {
      /* diam saja, foto lama tetap dipakai */
    }
    setUploading(false)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.replace('/')
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-md px-5 py-5">
      <h1 className="font-display text-[30px] leading-tight text-ink">Profil</h1>

      <div className="mt-6 flex flex-col items-center">
        <button onClick={() => fileRef.current?.click()} className="relative active:scale-95" aria-label="Ganti foto profil">
          <Avatar url={profiles[me].avatar_url} name={profiles[me].display_name} size={112} />
          <span className="absolute -bottom-1 -right-1 grid h-9 w-9 place-items-center rounded-full border-2 border-[color:var(--bg)] bg-gradient-to-br from-primary-400 to-primary-600 text-white">
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
          </span>
        </button>
        <p className="mt-3 text-[13px] text-muted">Masuk sebagai {me === 'girl' ? 'cewek' : 'cowok'}</p>
      </div>

      <div className="mt-7 space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[13.5px] text-muted">Nama panggilan</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} className="field" />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13.5px] text-muted">Status singkat</span>
          <input
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={60}
            placeholder="Misal: kangen terus"
            className="field"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13.5px] text-muted">Tanggal jadian</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="field" />
        </label>

        <button onClick={saveProfile} disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 size={17} className="animate-spin" /> : saved ? <Check size={17} /> : null}
          {saved ? 'Tersimpan' : 'Simpan perubahan'}
        </button>
      </div>

      <div className="mt-8 space-y-2">
        <button onClick={toggle} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left active:scale-[0.99]">
          {mode === 'dark' ? <Sun size={18} className="text-primary-600" /> : <Moon size={18} className="text-primary-600" />}
          <span className="flex-1 text-[15px] text-ink">Mode {mode === 'dark' ? 'terang' : 'gelap'}</span>
        </button>

        <button onClick={logout} className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-left active:scale-[0.99]">
          <LogOut size={18} className="text-primary-600" />
          <span className="flex-1 text-[15px] text-ink">Keluar</span>
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) changeAvatar(f)
        }}
      />
    </div>
  )
}
