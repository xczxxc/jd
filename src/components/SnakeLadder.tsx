'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from './SessionProvider'
import { Avatar } from './Avatar'
import { cx } from '@/lib/utils'
import type { Role } from '@/lib/types'

const SNAKES: Record<number, number> = { 17: 4, 24: 9, 38: 20, 47: 26, 53: 33, 62: 43, 76: 58, 87: 69, 93: 74, 98: 79 }
const LADDERS: Record<number, number> = { 3: 22, 8: 27, 15: 34, 21: 42, 28: 50, 36: 55, 51: 72, 66: 85, 78: 96 }
const HEART_TILES = [5, 13, 31, 45, 59, 67, 82, 91]

const CARDS = [
  'Kirim voice note bilang “aku sayang kamu” sekarang juga.',
  'Sebutkan tiga hal yang bikin kamu jatuh hati pertama kali.',
  'Kirim selfie apa adanya, tanpa filter.',
  'Ceritakan momen paling lucu yang pernah kalian lewati.',
  'Tulis satu hal yang belum pernah kamu bilang ke dia.',
  'Janjikan satu kencan minggu ini, lengkap dengan tempatnya.',
  'Puji dia pakai kalimat yang tidak boleh diulang dua kali.',
  'Kirim lagu yang mengingatkan kamu ke dia.',
  'Ceritakan hal kecil dari dia yang diam-diam kamu suka.',
  'Ketik permintaan maaf untuk satu hal sepele minggu ini.',
]

type State = {
  pos: Record<Role, number>
  turn: Role
  dice: number | null
  winner: Role | null
  log: string[]
  card: { text: string; forRole: Role } | null
  seed: number
}

const fresh = (): State => ({
  pos: { boy: 0, girl: 0 },
  turn: 'girl',
  dice: null,
  winner: null,
  log: ['Papan baru siap. Cewek jalan duluan.'],
  card: null,
  seed: Date.now(),
})

export function SnakeLadder() {
  const { me, profiles } = useSession()
  const [state, setState] = useState<State | null>(null)
  const [rolling, setRolling] = useState(false)
  const [face, setFace] = useState(1)

  const save = useCallback(async (next: State) => {
    setState(next)
    await supabase.from('game_rooms').update({ state: next, updated_at: new Date().toISOString() }).eq('id', 'snake')
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('game_rooms').select('state').eq('id', 'snake').maybeSingle()
      const s = data?.state as State | undefined
      if (s && s.pos) setState(s)
      else await save(fresh())
    })()

    const ch = supabase
      .channel('snake-room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms', filter: 'id=eq.snake' }, ({ new: row }) => {
        const s = (row as { state: State }).state
        if (s?.pos) setState(s)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [save])

  const myTurn = state?.turn === me && !state?.winner && !rolling

  async function roll() {
    if (!state || !myTurn) return
    setRolling(true)
    const spin = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 70)
    await new Promise((r) => setTimeout(r, 700))
    clearInterval(spin)

    const d = 1 + Math.floor(Math.random() * 6)
    setFace(d)

    const from = state.pos[me]
    let to = from + d
    const log: string[] = []
    const name = profiles[me].display_name

    if (to > 100) {
      to = from
      log.push(`${name} dapat ${d}, angkanya kelewat. Tetap di ${from || 'start'}.`)
    } else {
      log.push(`${name} dapat ${d} dan melangkah ke ${to}.`)
      if (LADDERS[to]) { log.push(`Tangga! Naik ke ${LADDERS[to]}.`); to = LADDERS[to] }
      else if (SNAKES[to]) { log.push(`Ular! Melorot ke ${SNAKES[to]}.`); to = SNAKES[to] }
    }

    const card = HEART_TILES.includes(to)
      ? { text: CARDS[Math.floor(Math.random() * CARDS.length)], forRole: me }
      : null
    if (card) log.push(`Kotak hati! ${name} kena tantangan.`)

    const winner = to === 100 ? me : null
    if (winner) log.push(`${name} menang! 🏆`)

    const extraTurn = d === 6 && !winner
    const next: State = {
      ...state,
      pos: { ...state.pos, [me]: to },
      dice: d,
      turn: extraTurn ? me : me === 'boy' ? 'girl' : 'boy',
      winner,
      card,
      log: [...log.reverse(), ...state.log].slice(0, 30),
    }
    if (extraTurn) next.log = ['Dadu 6, dapat giliran lagi.', ...next.log].slice(0, 30)

    await save(next)
    setRolling(false)
  }

  const cells = useMemo(() => {
    const rows: number[][] = []
    for (let r = 9; r >= 0; r--) {
      const row = Array.from({ length: 10 }, (_, c) => r * 10 + c + 1)
      rows.push(r % 2 === 0 ? row : row.reverse())
    }
    return rows.flat()
  }, [])

  if (!state) {
    return <p className="px-5 py-10 text-center text-[14px] text-muted">Menyiapkan papan…</p>
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4">
      <div className="flex items-center gap-2">
        <Link href="/games" aria-label="Kembali" className="grid h-9 w-9 place-items-center rounded-full text-primary-600">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="font-display text-[24px] text-ink">Ular Tangga Bucin</h1>
        <button onClick={() => save(fresh())} aria-label="Mulai ulang" className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-line text-muted">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Pemain */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {(['girl', 'boy'] as Role[]).map((r) => (
          <div
            key={r}
            className={cx(
              'flex items-center gap-3 rounded-3xl border p-3 transition',
              state.turn === r && !state.winner ? 'border-primary bg-primary-100/60 dark:bg-primary-900/40' : 'border-line bg-surface',
            )}
          >
            <Avatar url={profiles[r].avatar_url} name={profiles[r].display_name} size={38} />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-ink">{profiles[r].display_name}</p>
              <p className="text-[12.5px] text-muted">kotak {state.pos[r] || '-'}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Papan */}
      <div className="mt-4 grid grid-cols-10 gap-[3px] rounded-3xl border border-line bg-surface p-2">
        {cells.map((n) => {
          const isSnake = n in SNAKES
          const isLadder = n in LADDERS
          const isHeart = HEART_TILES.includes(n)
          const here: Role[] = (['girl', 'boy'] as Role[]).filter((r) => state.pos[r] === n)

          return (
            <div
              key={n}
              className={cx(
                'relative aspect-square rounded-[7px] text-[8px] leading-none',
                isLadder && 'bg-mint/25',
                isSnake && 'bg-primary-200/60 dark:bg-primary-900/50',
                isHeart && 'bg-gold/25',
                !isSnake && !isLadder && !isHeart && 'bg-surface2',
                n === 100 && 'bg-gradient-to-br from-primary-400 to-primary-600',
              )}
            >
              <span className={cx('absolute left-[3px] top-[2px]', n === 100 ? 'text-white' : 'text-muted')}>{n}</span>
              <span className="absolute inset-0 grid place-items-center text-[10px]">
                {isLadder && '🪜'}
                {isSnake && '🐍'}
                {isHeart && '💝'}
              </span>
              {here.length > 0 && (
                <span className="absolute inset-0 flex items-end justify-center gap-[1px] pb-[2px]">
                  {here.map((r) => (
                    <span
                      key={r}
                      className={cx('h-2 w-2 rounded-full ring-1 ring-white', r === 'girl' ? 'bg-primary-600' : 'bg-sky')}
                    />
                  ))}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Dadu */}
      <div className="mt-5 flex items-center gap-4">
        <button
          onClick={roll}
          disabled={!myTurn}
          className={cx(
            'grid h-20 w-20 shrink-0 place-items-center rounded-3xl border-2 font-display text-[34px] transition active:scale-95',
            myTurn ? 'border-primary bg-surface text-ink shadow-soft' : 'border-line bg-surface2 text-muted',
            rolling && 'animate-pulse',
          )}
          aria-label="Lempar dadu"
        >
          {rolling ? face : (state.dice ?? '🎲')}
        </button>
        <p className="text-[14.5px] leading-relaxed text-muted">
          {state.winner
            ? `${profiles[state.winner].display_name} menang. Ketuk tombol ulang untuk main lagi.`
            : myTurn
              ? 'Giliran kamu. Lempar dadunya.'
              : `Menunggu ${profiles[state.turn].display_name} melempar dadu.`}
        </p>
      </div>

      {/* Kartu tantangan */}
      {state.card && (
        <div className="mt-5 rounded-[26px] border border-line bg-gradient-to-br from-gold/25 to-primary-100 p-5 dark:to-primary-900/40">
          <p className="text-[12.5px] font-semibold text-primary-700 dark:text-primary-200">
            Tantangan untuk {profiles[state.card.forRole].display_name}
          </p>
          <p className="mt-2 font-display text-[19px] leading-snug text-ink">{state.card.text}</p>
          <button onClick={() => save({ ...state, card: null })} className="btn-ghost mt-4 w-full">Sudah dikerjakan</button>
        </div>
      )}

      {/* Riwayat */}
      <div className="mt-6">
        <h2 className="text-[13px] font-semibold text-muted">Jalannya permainan</h2>
        <ul className="mt-2 space-y-1.5">
          {state.log.slice(0, 8).map((l, i) => (
            <li key={i} className={cx('text-[13.5px]', i === 0 ? 'text-ink' : 'text-muted')}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
