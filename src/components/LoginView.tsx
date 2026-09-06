'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, Loader2, Lock } from 'lucide-react'
import { Avatar } from './Avatar'
import { ThemeToggle } from './ThemeProvider'
import { CONFIG, isSupabaseConfigured } from '@/lib/config'
import type { Profile, Role } from '@/lib/types'

const LOVE_START = CONFIG.loveStartDate

export function LoginView({ profiles }: { profiles: Profile[] }) {
  const router = useRouter()
  const [picked, setPicked] = useState<Role | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const byId = (id: Role) => profiles.find((p) => p.id === id)
  const accounts: { id: Role; label: string; name: string; avatar: string | null }[] = [
    {
      id: 'girl',
      label: 'Cewek',
      name: byId('girl')?.display_name || CONFIG.girlName,
      avatar: byId('girl')?.avatar_url ?? null,
    },
    {
      id: 'boy',
      label: 'Cowok',
      name: byId('boy')?.display_name || CONFIG.boyName,
      avatar: byId('boy')?.avatar_url ?? null,
    },
  ]

  useEffect(() => {
    if (picked) setTimeout(() => inputRef.current?.focus(), 120)
  }, [picked])

  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(LOVE_START + 'T00:00:00').getTime()) / 86400000),
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!picked || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: picked, code }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Kodenya belum cocok.')
        setCode('')
        inputRef.current?.focus()
        return
      }
      router.replace('/home')
      router.refresh()
    } catch {
      setError('Koneksi bermasalah. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative isolate flex min-h-[100dvh] flex-col overflow-hidden px-6 pb-10 pt-8">
      <Backdrop />

      <div className="flex justify-end">
        <ThemeToggle />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <p className="text-[13px] font-medium text-muted">Ruang privat berdua</p>
        <h1 className="mt-2 font-display text-[44px] leading-[0.95] tracking-tight text-ink">
          LoveNest
        </h1>
        <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed text-muted">
          Sudah {days.toLocaleString('id-ID')} hari sejak 19 Juni 2026. Masuk sebagai siapa hari ini?
        </p>

        {!isSupabaseConfigured && (
          <div className="mt-6 rounded-2xl border border-primary-300 bg-primary-100 px-4 py-3 dark:border-primary-700 dark:bg-primary-900/40">
            <p className="text-[13.5px] font-semibold text-primary-800 dark:text-primary-100">Supabase belum disetel</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-primary-800/80 dark:text-primary-100/80">
              Buka <code className="rounded bg-surface/60 px-1">src/lib/config.ts</code> lalu isi SUPABASE_URL dan
              SUPABASE_ANON_KEY. Login tetap jalan, tapi chat, kalender, dan galeri masih kosong.
            </p>
          </div>
        )}

        <ul className="mt-8 space-y-3">
          {accounts.map((acc) => {
            const open = picked === acc.id
            return (
              <li key={acc.id}>
                <div
                  className={`overflow-hidden rounded-[26px] border transition-all ${
                    open
                      ? 'border-primary bg-surface shadow-soft'
                      : 'border-line bg-surface/80 backdrop-blur'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(open ? null : acc.id)
                      setError(null)
                      setCode('')
                    }}
                    className="flex w-full items-center gap-4 px-4 py-4 text-left"
                  >
                    <Avatar url={acc.avatar} name={acc.name} size={52} ring={open} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-semibold text-ink">{acc.name}</span>
                      <span className="block text-[13px] text-muted">Masuk sebagai {acc.label.toLowerCase()}</span>
                    </span>
                    <ChevronRight
                      size={20}
                      className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {open && (
                    <form onSubmit={submit} className="animate-pop border-t border-line px-4 pb-4 pt-4">
                      <label htmlFor="code" className="mb-2 flex items-center gap-1.5 text-[13px] text-muted">
                        <Lock size={13} /> Kode rahasia kamu
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="code"
                          ref={inputRef}
                          type="password"
                          inputMode="text"
                          autoComplete="off"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          placeholder="••••••"
                          className="field flex-1 tracking-[0.3em]"
                        />
                        <button type="submit" disabled={busy || !code} className="btn-primary px-5">
                          {busy ? <Loader2 size={18} className="animate-spin" /> : 'Masuk'}
                        </button>
                      </div>
                      {error && (
                        <p role="alert" className="mt-3 text-[13px] font-medium text-primary-700 dark:text-primary-300">
                          {error}
                        </p>
                      )}
                    </form>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        <p className="mt-8 text-center text-[12px] leading-relaxed text-muted">
          Hanya dua akun ini yang ada. Kode diatur lewat environment variable.
        </p>
      </div>
    </main>
  )
}

function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/35 blur-3xl" />
      <div className="absolute -right-20 top-1/3 h-64 w-64 rounded-full bg-primary-200/60 blur-3xl dark:bg-primary-900/40" />
      <div className="absolute bottom-0 left-1/4 h-56 w-56 rounded-full bg-gold/25 blur-3xl" />
      <span className="absolute left-8 top-1/3 animate-float text-2xl opacity-60">💗</span>
      <span className="absolute right-10 top-1/4 animate-float text-xl opacity-50 [animation-delay:1.5s]">💌</span>
      <span className="absolute bottom-24 right-14 animate-float text-2xl opacity-50 [animation-delay:3s]">🌸</span>
    </div>
  )
}
