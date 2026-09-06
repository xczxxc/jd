import type { Role } from './types'

export const other = (r: Role): Role => (r === 'boy' ? 'girl' : 'boy')

export function cx(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(' ')
}

export function bytes(n?: number | null) {
  if (!n) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(); yest.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Hari ini'
  if (same(d, yest)) return 'Kemarin'
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function mmss(sec: number) {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function ymd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function parseYmd(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysBetween(a: Date, b: Date) {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((B - A) / 86400000)
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
