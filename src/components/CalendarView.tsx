'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarPlus, ChevronLeft, ChevronRight, Droplet, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from './SessionProvider'
import { actualPeriodDays, computeCycle, fertileDays, predictedPeriodDays } from '@/lib/cycle'
import { cx, daysBetween, parseYmd, ymd } from '@/lib/utils'
import type { CoupleEvent, Period } from '@/lib/types'

const DOW = ['S', 'S', 'R', 'K', 'J', 'S', 'M'] // Senin..Minggu
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export function CalendarView() {
  const { me } = useSession()
  const isGirl = me === 'girl'

  const [cursor, setCursor] = useState(() => new Date())
  const [periods, setPeriods] = useState<Period[]>([])
  const [events, setEvents] = useState<CoupleEvent[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [newEvent, setNewEvent] = useState('')

  const load = async () => {
    const [p, e] = await Promise.all([
      supabase.from('periods').select('*').order('start_date'),
      supabase.from('events').select('*').order('date'),
    ])
    setPeriods((p.data as Period[]) ?? [])
    setEvents((e.data as CoupleEvent[]) ?? [])
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel('calendar-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'periods' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const stats = useMemo(() => computeCycle(periods), [periods])
  const actual = useMemo(() => actualPeriodDays(periods), [periods])
  const predicted = useMemo(() => predictedPeriodDays(stats), [stats])
  const fertile = useMemo(() => fertileDays(stats), [stats])
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CoupleEvent[]>()
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e])
    return m
  }, [events])

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const offset = (first.getDay() + 6) % 7 // mulai Senin
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const cells: (Date | null)[] = Array(offset).fill(null)
    for (let d = 1; d <= total; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    while (cells.length % 7) cells.push(null)
    return cells
  }, [cursor])

  const today = ymd(new Date())
  const daysToPeriod = stats.nextStart ? daysBetween(new Date(), stats.nextStart) : null

  /* ---------- aksi ---------- */
  async function togglePeriodStart(day: string) {
    const existing = periods.find((p) => p.start_date === day)
    if (existing) {
      await supabase.from('periods').delete().eq('id', existing.id)
    } else {
      await supabase.from('periods').insert({ start_date: day })
    }
    setSelected(null)
  }

  async function markPeriodEnd(day: string) {
    const open = [...periods]
      .filter((p) => p.start_date <= day)
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0]
    if (!open) return
    await supabase.from('periods').update({ end_date: day }).eq('id', open.id)
    setSelected(null)
  }

  async function addEvent(day: string) {
    const title = newEvent.trim()
    if (!title) return
    setNewEvent('')
    await supabase.from('events').insert({ title, date: day, kind: 'agenda', created_by: me })
  }

  return (
    <div className="mx-auto max-w-md px-5 py-5">
      <h1 className="font-display text-[30px] leading-tight text-ink">Kalender kita</h1>

      {/* Ringkasan siklus */}
      <div className="mt-4 rounded-[26px] border border-line bg-gradient-to-br from-primary-100 via-surface to-surface p-5 dark:from-primary-900/40">
        <div className="flex items-center gap-2 text-primary-700 dark:text-primary-200">
          <Droplet size={17} />
          <span className="text-[14px] font-semibold">Siklus haid</span>
        </div>

        {stats.lastStart ? (
          <>
            <p className="mt-3 font-display text-[38px] leading-none text-ink">
              {daysToPeriod !== null && daysToPeriod >= 0 ? daysToPeriod : 0}
              <span className="ml-2 font-sans text-[14px] font-medium text-muted">hari lagi</span>
            </p>
            <p className="mt-2 text-[13.5px] text-muted">
              Perkiraan mulai {stats.nextStart!.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} · fase{' '}
              {stats.phase?.toLowerCase()} hari ke-{stats.dayOfCycle}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="chip">Siklus {stats.avgCycle} hari</span>
              <span className="chip">Durasi {stats.avgPeriod} hari</span>
              <span className="chip">{stats.samples} siklus tercatat</span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            {isGirl
              ? 'Ketuk tanggal saat haid mulai untuk menandainya. Setelah dua kali, prediksi otomatis muncul.'
              : 'Belum ada catatan siklus.'}
          </p>
        )}
      </div>

      {/* Navigasi bulan */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          aria-label="Bulan sebelumnya"
          className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink active:scale-95"
        >
          <ChevronLeft size={18} />
        </button>
        <p className="font-display text-[20px] text-ink">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </p>
        <button
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          aria-label="Bulan berikutnya"
          className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink active:scale-95"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Grid */}
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {DOW.map((d, i) => (
          <span key={i} className="pb-1 text-[12px] text-muted">{d}</span>
        ))}

        {grid.map((d, i) => {
          if (!d) return <span key={i} />
          const key = ymd(d)
          const isToday = key === today
          const isActual = actual.has(key)
          const isPredicted = !isActual && predicted.has(key)
          const isFertile = !isActual && !isPredicted && fertile.has(key)
          const evs = eventsByDay.get(key)

          return (
            <button
              key={i}
              onClick={() => setSelected(key)}
              className={cx(
                'relative aspect-square rounded-2xl text-[14px] transition active:scale-95',
                isActual && 'bg-primary text-white font-semibold',
                isPredicted && 'border border-dashed border-primary-400 text-primary-700 dark:text-primary-200',
                isFertile && 'bg-mint/20 text-ink',
                !isActual && !isPredicted && !isFertile && 'text-ink',
                isToday && !isActual && 'ring-2 ring-primary ring-offset-2 ring-offset-[color:var(--bg)]',
              )}
            >
              {d.getDate()}
              {evs && (
                <span className="absolute bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-gold" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Legend className="bg-primary" label="Haid tercatat" />
        <Legend className="border border-dashed border-primary-400" label="Prediksi haid" />
        <Legend className="bg-mint/50" label="Masa subur" />
        <Legend className="bg-gold" label="Agenda" />
      </div>

      {/* Agenda mendatang */}
      <section className="mt-7">
        <h2 className="font-display text-[22px] text-ink">Agenda mendatang</h2>
        <ul className="mt-3 space-y-2">
          {events.filter((e) => e.date >= today).slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface2 text-center leading-none">
                <span className="block text-[15px] font-semibold text-ink">{parseYmd(e.date).getDate()}</span>
                <span className="block text-[10px] text-muted">{MONTHS[parseYmd(e.date).getMonth()].slice(0, 3)}</span>
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{e.title}</span>
              <button
                onClick={() => supabase.from('events').delete().eq('id', e.id)}
                aria-label="Hapus agenda"
                className="text-muted active:scale-90"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
          {events.filter((e) => e.date >= today).length === 0 && (
            <li className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[14px] text-muted">
              Belum ada rencana. Ketuk tanggal untuk menambah.
            </li>
          )}
        </ul>
      </section>

      {/* Sheet tanggal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setSelected(null)}>
          <div className="sheet w-full animate-pop" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-display text-[21px] text-ink">
                {parseYmd(selected).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              <button onClick={() => setSelected(null)} aria-label="Tutup" className="text-muted"><X size={20} /></button>
            </div>

            {isGirl && (
              <div className="mb-4 space-y-2">
                <button onClick={() => togglePeriodStart(selected)} className="btn-primary w-full">
                  <Droplet size={17} />
                  {periods.some((p) => p.start_date === selected) ? 'Batalkan tanda mulai haid' : 'Tandai mulai haid'}
                </button>
                <button onClick={() => markPeriodEnd(selected)} className="btn-ghost w-full">
                  Tandai haid selesai di tanggal ini
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addEvent(selected)}
                placeholder="Tambah agenda, misal: nonton bareng"
                className="field flex-1"
              />
              <button onClick={() => addEvent(selected)} aria-label="Simpan agenda" className="btn-primary px-4">
                <CalendarPlus size={18} />
              </button>
            </div>

            <ul className="mt-4 space-y-2">
              {(eventsByDay.get(selected) ?? []).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-surface2 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[14.5px] text-ink">{e.title}</span>
                  <button onClick={() => supabase.from('events').delete().eq('id', e.id)} aria-label="Hapus" className="text-muted">
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>

            {!isGirl && (
              <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
                Catatan haid hanya bisa diubah dari akun cewek. Kamu tetap bisa melihatnya supaya tahu kapan harus lebih perhatian.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[12px] text-muted">
      <span className={cx('h-3 w-3 rounded-full', className)} />
      {label}
    </span>
  )
}
