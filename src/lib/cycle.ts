import { daysBetween, parseYmd, ymd } from './utils'
import type { Period } from './types'

export type CycleStats = {
  avgCycle: number
  avgPeriod: number
  lastStart: Date | null
  nextStart: Date | null
  ovulation: Date | null
  fertileFrom: Date | null
  fertileTo: Date | null
  dayOfCycle: number | null
  phase: 'Menstruasi' | 'Folikuler' | 'Ovulasi' | 'Luteal' | null
  samples: number
}

const DEFAULT_CYCLE = 28
const DEFAULT_PERIOD = 5

export function computeCycle(periods: Period[], today = new Date()): CycleStats {
  const sorted = [...periods].sort((a, b) => a.start_date.localeCompare(b.start_date))
  if (!sorted.length) {
    return {
      avgCycle: DEFAULT_CYCLE, avgPeriod: DEFAULT_PERIOD, lastStart: null, nextStart: null,
      ovulation: null, fertileFrom: null, fertileTo: null, dayOfCycle: null, phase: null, samples: 0,
    }
  }

  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const g = daysBetween(parseYmd(sorted[i - 1].start_date), parseYmd(sorted[i].start_date))
    if (g >= 18 && g <= 60) gaps.push(g)
  }
  const recent = gaps.slice(-6)
  const avgCycle = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : DEFAULT_CYCLE

  const lens = sorted
    .filter((p) => p.end_date)
    .map((p) => daysBetween(parseYmd(p.start_date), parseYmd(p.end_date!)) + 1)
    .filter((n) => n >= 1 && n <= 14)
    .slice(-6)
  const avgPeriod = lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : DEFAULT_PERIOD

  const lastStart = parseYmd(sorted[sorted.length - 1].start_date)
  const nextStart = addDays(lastStart, avgCycle)
  const ovulation = addDays(nextStart, -14)
  const fertileFrom = addDays(ovulation, -5)
  const fertileTo = addDays(ovulation, 1)

  const dayOfCycle = daysBetween(lastStart, today) + 1
  let phase: CycleStats['phase'] = 'Luteal'
  if (dayOfCycle <= avgPeriod) phase = 'Menstruasi'
  else if (today >= fertileFrom && today <= fertileTo) phase = 'Ovulasi'
  else if (today < fertileFrom) phase = 'Folikuler'

  return {
    avgCycle, avgPeriod, lastStart, nextStart, ovulation, fertileFrom, fertileTo,
    dayOfCycle: dayOfCycle > 0 ? dayOfCycle : null, phase, samples: gaps.length,
  }
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Set tanggal yang diprediksi haid untuk beberapa siklus ke depan. */
export function predictedPeriodDays(stats: CycleStats, cycles = 6): Set<string> {
  const out = new Set<string>()
  if (!stats.nextStart) return out
  for (let c = 0; c < cycles; c++) {
    const start = addDays(stats.nextStart, c * stats.avgCycle)
    for (let i = 0; i < stats.avgPeriod; i++) out.add(ymd(addDays(start, i)))
  }
  return out
}

export function fertileDays(stats: CycleStats, cycles = 6): Set<string> {
  const out = new Set<string>()
  if (!stats.nextStart) return out
  for (let c = 0; c < cycles; c++) {
    const next = addDays(stats.nextStart, c * stats.avgCycle)
    const ov = addDays(next, -14)
    for (let i = -5; i <= 1; i++) out.add(ymd(addDays(ov, i)))
  }
  return out
}

export function actualPeriodDays(periods: Period[]): Set<string> {
  const out = new Set<string>()
  for (const p of periods) {
    const s = parseYmd(p.start_date)
    const e = p.end_date ? parseYmd(p.end_date) : addDays(s, DEFAULT_PERIOD - 1)
    for (let d = new Date(s); d <= e; d = addDays(d, 1)) out.add(ymd(d))
  }
  return out
}
