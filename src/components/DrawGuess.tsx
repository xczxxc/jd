'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Eraser, RotateCcw, SendHorizontal, SkipForward, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from './SessionProvider'
import { cx, mmss } from '@/lib/utils'
import type { Role } from '@/lib/types'

const WORDS = [
  'bunga mawar', 'cincin', 'pelangi', 'kucing', 'pizza', 'pantai', 'gitar', 'boneka beruang',
  'kado', 'bulan sabit', 'payung', 'es krim', 'kupu-kupu', 'sepeda', 'balon', 'jam tangan',
  'kacamata', 'pesawat', 'kue ulang tahun', 'jantung hati', 'kopi', 'kunci', 'rumah', 'matahari',
  'surat cinta', 'bintang', 'kamera', 'sepatu', 'topi', 'ikan',
]

const COLORS = ['#2B1A20', '#FF8DA1', '#EE5C7D', '#F0B36B', '#7FC8B0', '#7FA9E0']
const ROUND_SECONDS = 100

type Guess = { by: Role; text: string; correct: boolean }
type State = {
  drawer: Role
  word: string
  round: number
  scores: Record<Role, number>
  guesses: Guess[]
  startedAt: number
  revealed: boolean
}

const pickWord = (avoid?: string) => {
  let w = WORDS[Math.floor(Math.random() * WORDS.length)]
  while (w === avoid) w = WORDS[Math.floor(Math.random() * WORDS.length)]
  return w
}

const fresh = (drawer: Role = 'girl'): State => ({
  drawer,
  word: pickWord(),
  round: 1,
  scores: { boy: 0, girl: 0 },
  guesses: [],
  startedAt: Date.now(),
  revealed: false,
})

export function DrawGuess() {
  const { me, profiles } = useSession()
  const [state, setState] = useState<State | null>(null)
  const [guess, setGuess] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(4)
  const [erase, setErase] = useState(false)
  const [left, setLeft] = useState(ROUND_SECONDS)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPt = useRef<{ x: number; y: number } | null>(null)
  const strokeChan = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const isDrawer = state?.drawer === me

  const save = useCallback(async (next: State) => {
    setState(next)
    await supabase.from('game_rooms').update({ state: next, updated_at: new Date().toISOString() }).eq('id', 'draw')
  }, [])

  /* ---------- state permainan ---------- */
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('game_rooms').select('state').eq('id', 'draw').maybeSingle()
      const s = data?.state as State | undefined
      if (s?.word) setState(s)
      else await save(fresh())
    })()

    const ch = supabase
      .channel('draw-room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: 'id=eq.draw' }, ({ new: row }) => {
        const s = (row as { state: State }).state
        if (s?.word) setState(s)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [save])

  /* ---------- kanal coretan ---------- */
  useEffect(() => {
    const ch = supabase.channel('draw-canvas', { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'stroke' }, ({ payload }) => paint(payload))
    ch.on('broadcast', { event: 'clear' }, () => clearCanvas())
    ch.subscribe()
    strokeChan.current = ch
    return () => { supabase.removeChannel(ch); strokeChan.current = null }
  }, [])

  /* ---------- ukuran kanvas ---------- */
  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  /* ---------- timer ---------- */
  useEffect(() => {
    if (!state) return
    const id = setInterval(() => {
      const rem = ROUND_SECONDS - Math.floor((Date.now() - state.startedAt) / 1000)
      setLeft(Math.max(0, rem))
      if (rem <= 0 && isDrawer && !state.revealed) save({ ...state, revealed: true })
    }, 500)
    return () => clearInterval(id)
  }, [isDrawer, save, state])

  /* ---------- menggambar ---------- */
  function paint(s: { x0: number; y0: number; x1: number; y1: number; color: string; size: number }) {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    const w = c.getBoundingClientRect().width
    const h = c.getBoundingClientRect().height
    ctx.strokeStyle = s.color
    ctx.lineWidth = s.size
    ctx.globalCompositeOperation = s.color === 'erase' ? 'destination-out' : 'source-over'
    ctx.beginPath()
    ctx.moveTo(s.x0 * w, s.y0 * h)
    ctx.lineTo(s.x1 * w, s.y1 * h)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  function clearCanvas() {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
  }

  function pos(e: React.PointerEvent) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  function down(e: React.PointerEvent) {
    if (!isDrawer || state?.revealed) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    lastPt.current = pos(e)
  }

  function move(e: React.PointerEvent) {
    if (!drawing.current || !lastPt.current) return
    const p = pos(e)
    const stroke = {
      x0: lastPt.current.x, y0: lastPt.current.y, x1: p.x, y1: p.y,
      color: erase ? 'erase' : color,
      size: erase ? size * 4 : size,
    }
    paint(stroke)
    strokeChan.current?.send({ type: 'broadcast', event: 'stroke', payload: stroke })
    lastPt.current = p
  }

  function up() {
    drawing.current = false
    lastPt.current = null
  }

  function wipe() {
    clearCanvas()
    strokeChan.current?.send({ type: 'broadcast', event: 'clear', payload: {} })
  }

  /* ---------- ronde ---------- */
  async function nextRound(winner?: Role) {
    if (!state) return
    wipe()
    await save({
      drawer: state.drawer === 'boy' ? 'girl' : 'boy',
      word: pickWord(state.word),
      round: state.round + 1,
      scores: winner ? { ...state.scores, [winner]: state.scores[winner] + 1 } : state.scores,
      guesses: [],
      startedAt: Date.now(),
      revealed: false,
    })
  }

  async function submitGuess(e: React.FormEvent) {
    e.preventDefault()
    if (!state || isDrawer || state.revealed) return
    const text = guess.trim()
    if (!text) return
    setGuess('')
    const correct = normalize(text) === normalize(state.word)
    await save({ ...state, guesses: [...state.guesses, { by: me, text, correct }].slice(-25), revealed: correct })
    if (correct) setTimeout(() => nextRound(me), 1600)
  }

  if (!state) return <p className="px-5 py-10 text-center text-[14px] text-muted">Menyiapkan permainan…</p>

  const drawerName = profiles[state.drawer].display_name
  const masked = state.word.replace(/[^\s]/g, '_').split('').join(' ')

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <div className="flex items-center gap-2">
        <Link href="/games" aria-label="Kembali" className="grid h-9 w-9 place-items-center rounded-full text-primary-600">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="font-display text-[24px] text-ink">Tebak Gambar</h1>
        <button onClick={() => { wipe(); save(fresh()) }} aria-label="Mulai ulang" className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-line text-muted">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Skor */}
      <div className="mt-3 flex items-center gap-3 rounded-3xl border border-line bg-surface px-4 py-3">
        <span className="text-[14px] text-ink">
          {profiles.girl.display_name} <b className="font-display text-[18px]">{state.scores.girl}</b>
        </span>
        <span className="text-muted">–</span>
        <span className="text-[14px] text-ink">
          <b className="font-display text-[18px]">{state.scores.boy}</b> {profiles.boy.display_name}
        </span>
        <span className={cx('ml-auto text-[14px] tabular-nums', left <= 15 ? 'text-primary-600' : 'text-muted')}>
          {mmss(left)}
        </span>
      </div>

      {/* Kata */}
      <div className="mt-3 rounded-3xl border border-line bg-surface2 px-4 py-3 text-center">
        {state.revealed ? (
          <p className="font-display text-[20px] text-ink">Kata: {state.word}</p>
        ) : isDrawer ? (
          <>
            <p className="text-[12.5px] text-muted">Gambarkan kata ini</p>
            <p className="font-display text-[22px] text-ink">{state.word}</p>
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-muted">{drawerName} sedang menggambar</p>
            <p className="font-display text-[22px] tracking-[0.2em] text-ink">{masked}</p>
          </>
        )}
      </div>

      {/* Kanvas */}
      <div className="relative mt-3">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className={cx(
            'aspect-[4/3] w-full touch-none rounded-[26px] border border-line bg-white',
            isDrawer && !state.revealed ? 'cursor-crosshair' : 'cursor-not-allowed',
          )}
        />
        {!isDrawer && (
          <span className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-[11.5px] text-white">
            Kamu yang menebak
          </span>
        )}
      </div>

      {/* Alat gambar */}
      {isDrawer ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { setColor(c); setErase(false) }}
              aria-label={`Warna ${c}`}
              style={{ background: c }}
              className={cx('h-8 w-8 rounded-full transition', color === c && !erase ? 'ring-2 ring-primary ring-offset-2 ring-offset-[color:var(--bg)]' : '')}
            />
          ))}
          <button
            onClick={() => setErase((v) => !v)}
            aria-label="Penghapus"
            className={cx('grid h-8 w-8 place-items-center rounded-full border border-line', erase && 'bg-primary text-white')}
          >
            <Eraser size={15} />
          </button>
          <input
            type="range"
            min={2}
            max={16}
            value={size}
            onChange={(e) => setSize(+e.target.value)}
            aria-label="Ketebalan kuas"
            className="h-8 flex-1 accent-primary"
          />
          <button onClick={wipe} aria-label="Bersihkan kanvas" className="grid h-8 w-8 place-items-center rounded-full border border-line text-muted">
            <Trash2 size={15} />
          </button>
          <button onClick={() => nextRound()} className="btn-ghost h-9 px-3 text-[13px]">
            <SkipForward size={15} /> Ganti kata
          </button>
        </div>
      ) : (
        <form onSubmit={submitGuess} className="mt-3 flex gap-2">
          <input
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Tebakan kamu"
            disabled={state.revealed}
            className="field flex-1"
          />
          <button type="submit" disabled={state.revealed} aria-label="Kirim tebakan" className="btn-primary px-4">
            <SendHorizontal size={18} />
          </button>
        </form>
      )}

      {state.revealed && (
        <button onClick={() => nextRound()} className="btn-primary mt-3 w-full">Lanjut ronde berikutnya</button>
      )}

      {/* Tebakan */}
      <ul className="mt-4 space-y-1.5">
        {[...state.guesses].reverse().map((g, i) => (
          <li key={i} className="flex items-center gap-2 text-[14px]">
            <span className="text-muted">{profiles[g.by].display_name}:</span>
            <span className={cx(g.correct ? 'font-semibold text-primary-600' : 'text-ink')}>{g.text}</span>
            {g.correct && <span>🎉</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}
