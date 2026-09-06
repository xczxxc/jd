'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Droplet, MessageCircleHeart, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from './SessionProvider'
import { Avatar } from './Avatar'
import { computeCycle } from '@/lib/cycle'
import { daysBetween } from '@/lib/utils'
import { CONFIG } from '@/lib/config'
import type { Moment, Period } from '@/lib/types'

const FALLBACK_START = CONFIG.loveStartDate

export function Dashboard() {
  const { me, partner, profiles } = useSession()
  const [start, setStart] = useState(FALLBACK_START)
  const [now, setNow] = useState(() => Date.now())
  const [periods, setPeriods] = useState<Period[]>([])
  const [moments, setMoments] = useState<Moment[]>([])
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    ;(async () => {
      const [s, p, m, c] = await Promise.all([
        supabase.from('settings').select('value').eq('key', 'relationship').maybeSingle(),
        supabase.from('periods').select('*').order('start_date'),
        supabase.from('moments').select('*').order('created_at', { ascending: false }).limit(6),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('sender', partner).is('read_at', null),
      ])
      if (s.data?.value?.start_date) setStart(s.data.value.start_date)
      setPeriods((p.data as Period[]) ?? [])
      setMoments((m.data as Moment[]) ?? [])
      setUnread(c.count ?? 0)
    })()
  }, [partner])

  const t = useMemo(() => {
    const from = new Date(start + 'T00:00:00')
    const diff = Math.max(0, now - from.getTime())
    const totalDays = Math.floor(diff / 86400000)

    let y = now >= from.getTime() ? new Date(now).getFullYear() - from.getFullYear() : 0
    const anniv = new Date(from)
    anniv.setFullYear(from.getFullYear() + y)
    if (anniv.getTime() > now) { y -= 1; anniv.setFullYear(anniv.getFullYear() - 1) }
    let months = 0
    const walk = new Date(anniv)
    while (true) {
      const next = new Date(walk)
      next.setMonth(next.getMonth() + 1)
      if (next.getTime() > now) break
      walk.setMonth(walk.getMonth() + 1)
      months++
    }
    const days = Math.floor((now - walk.getTime()) / 86400000)
    const rest = diff % 86400000
    return {
      totalDays,
      y: Math.max(0, y),
      months,
      days,
      h: Math.floor(rest / 3600000),
      m: Math.floor((rest % 3600000) / 60000),
      s: Math.floor((rest % 60000) / 1000),
    }
  }, [now, start])

  const nextMonthiversary = useMemo(() => {
    const from = new Date(start + 'T00:00:00')
    const d = new Date()
    const target = new Date(d.getFullYear(), d.getMonth(), from.getDate())
    if (target.getTime() < new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) target.setMonth(target.getMonth() + 1)
    return daysBetween(new Date(), target)
  }, [start])

  const cycle = useMemo(() => computeCycle(periods), [periods])
  const daysToPeriod = cycle.nextStart ? daysBetween(new Date(), cycle.nextStart) : null

  return (
    <div className="mx-auto max-w-md px-5 py-5">
      {/* Hero: penghitung */}
      <section className="relative overflow-hidden rounded-[30px] border border-line bg-gradient-to-br from-primary-100 via-surface to-surface p-6 dark:from-primary-900/40">
        <div className="flex items-center gap-2">
          <Avatar url={profiles.girl.avatar_url} name={profiles.girl.display_name} size={38} />
          <span className="text-primary-600">💞</span>
          <Avatar url={profiles.boy.avatar_url} name={profiles.boy.display_name} size={38} />
          <span className="ml-auto text-[12px] text-muted">sejak 19 Juni 2026</span>
        </div>

        <p className="mt-5 font-display text-[64px] leading-[0.88] tracking-tight text-ink">
          {t.totalDays.toLocaleString('id-ID')}
        </p>
        <p className="mt-1 text-[15px] text-muted">hari bersama</p>

        <p className="mt-4 text-[14.5px] text-ink/80">
          {t.y > 0 && `${t.y} tahun `}
          {t.months} bulan {t.days} hari
          <span className="tabular-nums text-muted">
            {' · '}
            {String(t.h).padStart(2, '0')}:{String(t.m).padStart(2, '0')}:{String(t.s).padStart(2, '0')}
          </span>
        </p>

        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1.5 text-[13px] text-muted backdrop-blur">
          <Sparkles size={14} className="text-primary-600" />
          {nextMonthiversary === 0 ? 'Monthsary-nya hari ini 🎉' : `${nextMonthiversary} hari lagi monthsary`}
        </p>
      </section>

      {/* Pintasan */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/chat" className="rounded-3xl border border-line bg-surface p-4 active:scale-[0.99]">
          <MessageCircleHeart size={22} className="text-primary-600" />
          <p className="mt-3 text-[15px] font-semibold text-ink">Chat</p>
          <p className="text-[13px] text-muted">
            {unread > 0 ? `${unread} pesan belum dibaca` : 'Semua sudah dibaca'}
          </p>
        </Link>

        <Link href="/calendar" className="rounded-3xl border border-line bg-surface p-4 active:scale-[0.99]">
          <Droplet size={22} className="text-primary-600" />
          <p className="mt-3 text-[15px] font-semibold text-ink">Siklus</p>
          <p className="text-[13px] text-muted">
            {daysToPeriod === null
              ? 'Belum ada catatan'
              : daysToPeriod <= 0
                ? 'Perkiraan sudah lewat'
                : `${daysToPeriod} hari lagi haid`}
          </p>
        </Link>
      </div>

      {cycle.phase && (
        <div className="mt-3 flex items-center gap-3 rounded-3xl border border-line bg-surface p-4">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-100 text-lg dark:bg-primary-900/50">
            {cycle.phase === 'Menstruasi' ? '🩸' : cycle.phase === 'Ovulasi' ? '🌱' : cycle.phase === 'Folikuler' ? '🌤️' : '🌙'}
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">Fase {cycle.phase.toLowerCase()}</p>
            <p className="text-[13px] text-muted">
              Hari ke-{cycle.dayOfCycle} dari siklus rata-rata {cycle.avgCycle} hari
            </p>
          </div>
        </div>
      )}

      {/* Moment terbaru */}
      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-[22px] text-ink">Moment terbaru</h2>
          <Link href="/moments" className="text-[13px] font-medium text-primary-600">Lihat semua</Link>
        </div>

        {moments.length === 0 ? (
          <Link
            href="/moments"
            className="block rounded-3xl border border-dashed border-line bg-surface p-6 text-center text-[14px] text-muted"
          >
            Belum ada foto. Unggah satu untuk memulai galeri kalian.
          </Link>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {moments.map((m) => (
              <Link key={m.id} href="/moments" className="aspect-square overflow-hidden rounded-2xl bg-surface2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.caption ?? 'Moment'} loading="lazy" className="h-full w-full object-cover" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
