'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft, ImagePlus, Mic, Pause, Phone, Play, Reply, SendHorizontal,
  Trash2, Video, X,
} from 'lucide-react'
import { supabase, BUCKETS } from '@/lib/supabase'
import { compressImage } from '@/lib/compress'
import { clockTime, cx, dayLabel, mmss, uid } from '@/lib/utils'
import { useSession } from './SessionProvider'
import { useCall } from './CallProvider'
import { Avatar } from './Avatar'
import type { Message } from '@/lib/types'

export function ChatRoom() {
  const { me, partner, profiles } = useSession()
  const { start } = useCall()

  const [msgs, setMsgs] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const typingChan = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ---------- muat & realtime ---------- */
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('messages').select('*').order('created_at').limit(400)
      setMsgs((data as Message[]) ?? [])
    })()

    const ch = supabase
      .channel('chat-stream')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: row }) => {
        setMsgs((prev) => (prev.some((m) => m.id === (row as Message).id) ? prev : [...prev, row as Message]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: row }) => {
        setMsgs((prev) => prev.map((m) => (m.id === (row as Message).id ? (row as Message) : m)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, ({ old: row }) => {
        setMsgs((prev) => prev.filter((m) => m.id !== (row as Message).id))
      })
      .subscribe()

    const tc = supabase.channel('chat-typing', { config: { broadcast: { self: false } } })
    tc.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.from === me) return
      setPartnerTyping(payload.on)
    }).subscribe()
    typingChan.current = tc

    return () => {
      supabase.removeChannel(ch)
      supabase.removeChannel(tc)
    }
  }, [me])

  /* ---------- tandai sudah dibaca ---------- */
  useEffect(() => {
    const unread = msgs.filter((m) => m.sender === partner && !m.read_at)
    if (!unread.length) return
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread.map((m) => m.id))
      .then(() => {})
  }, [msgs, partner])

  /* ---------- auto scroll ---------- */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: msgs.length > 1 ? 'smooth' : 'auto' })
  }, [msgs.length, partnerTyping])

  /* ---------- kirim ---------- */
  const push = useCallback(
    async (payload: Partial<Message>) => {
      const row = {
        sender: me,
        kind: 'text' as const,
        reply_to: replyTo?.id ?? null,
        reply_snip: replyTo ? snip(replyTo) : null,
        ...payload,
      }
      setReplyTo(null)
      await supabase.from('messages').insert(row)
    },
    [me, replyTo],
  )

  async function sendText(e?: React.FormEvent) {
    e?.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    typingChan.current?.send({ type: 'broadcast', event: 'typing', payload: { from: me, on: false } })
    await push({ kind: 'text', body })
  }

  function onTyping(v: string) {
    setText(v)
    typingChan.current?.send({ type: 'broadcast', event: 'typing', payload: { from: me, on: v.length > 0 } })
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      typingChan.current?.send({ type: 'broadcast', event: 'typing', payload: { from: me, on: false } })
    }, 2500)
  }

  async function sendImage(file: File) {
    setUploading('Menyiapkan foto…')
    try {
      const out = await compressImage(file, { maxSide: 1600, targetKB: 300 })
      const path = `${me}/${uid()}.${out.ext}`
      setUploading('Mengunggah…')
      const { error } = await supabase.storage.from(BUCKETS.media).upload(path, out.blob, {
        contentType: out.mime,
        cacheControl: '31536000',
      })
      if (error) throw error
      const { data } = supabase.storage.from(BUCKETS.media).getPublicUrl(path)
      await push({ kind: 'image', media_url: data.publicUrl, media_path: path })
    } catch {
      setUploading('Foto gagal dikirim. Coba lagi.')
      setTimeout(() => setUploading(null), 2500)
      return
    }
    setUploading(null)
  }

  async function sendVoice(blob: Blob, seconds: number) {
    setUploading('Mengirim suara…')
    try {
      const path = `${me}/${uid()}.webm`
      const { error } = await supabase.storage.from(BUCKETS.media).upload(path, blob, { contentType: 'audio/webm' })
      if (error) throw error
      const { data } = supabase.storage.from(BUCKETS.media).getPublicUrl(path)
      await push({ kind: 'audio', media_url: data.publicUrl, media_path: path, duration: seconds })
    } catch {
      setUploading('Voice note gagal dikirim.')
      setTimeout(() => setUploading(null), 2500)
      return
    }
    setUploading(null)
  }

  async function react(m: Message) {
    await supabase.from('messages').update({ reaction: m.reaction ? null : '❤️' }).eq('id', m.id)
    setOpenId(null)
  }

  async function remove(m: Message) {
    if (m.media_path) await supabase.storage.from(BUCKETS.media).remove([m.media_path])
    await supabase.from('messages').delete().eq('id', m.id)
    setOpenId(null)
  }

  /* ---------- kelompokkan per hari ---------- */
  const groups = useMemo(() => {
    const out: { day: string; items: Message[] }[] = []
    for (const m of msgs) {
      const key = m.created_at.slice(0, 10)
      const last = out[out.length - 1]
      if (last && last.day === key) last.items.push(m)
      else out.push({ day: key, items: [m] })
    }
    return out
  }, [msgs])

  const p = profiles[partner]

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-[color:var(--bg)]/85 px-3 py-2.5 backdrop-blur-xl">
        <Link href="/home" aria-label="Kembali" className="grid h-9 w-9 place-items-center rounded-full text-primary-600">
          <ChevronLeft size={24} />
        </Link>
        <Avatar url={p.avatar_url} name={p.display_name} size={38} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold leading-tight text-ink">{p.display_name}</p>
          <p className="text-[12px] text-muted">{partnerTyping ? 'sedang mengetik…' : 'terhubung'}</p>
        </div>
        <button onClick={() => start(false)} aria-label="Telepon" className="grid h-10 w-10 place-items-center rounded-full text-primary-600 active:scale-95">
          <Phone size={20} />
        </button>
        <button onClick={() => start(true)} aria-label="Video call" className="grid h-10 w-10 place-items-center rounded-full text-primary-600 active:scale-95">
          <Video size={21} />
        </button>
      </header>

      {/* Pesan */}
      <div className="scroll-thin flex-1 overflow-y-auto px-3 py-4">
        {groups.length === 0 && (
          <p className="mt-16 text-center text-[14px] text-muted">
            Belum ada pesan. Mulai dengan menyapa {p.display_name}.
          </p>
        )}

        {groups.map((g) => (
          <section key={g.day}>
            <p className="my-4 text-center text-[12px] font-medium text-muted">{dayLabel(g.day)}</p>
            {g.items.map((m, i) => {
              const mine = m.sender === me
              const prev = g.items[i - 1]
              const next = g.items[i + 1]
              const first = !prev || prev.sender !== m.sender
              const last = !next || next.sender !== m.sender

              if (m.kind === 'call') {
                return (
                  <p key={m.id} className="my-3 text-center text-[12.5px] text-muted">
                    ☎️ {m.body}
                  </p>
                )
              }

              return (
                <div key={m.id} className={cx('flex', mine ? 'justify-end' : 'justify-start', last ? 'mb-2.5' : 'mb-0.5')}>
                  <div className={cx('max-w-[80%]', mine ? 'items-end' : 'items-start', 'flex flex-col')}>
                    {m.reply_snip && (
                      <p
                        className={cx(
                          'mb-1 max-w-full truncate rounded-xl border-l-2 border-primary bg-surface2 px-2.5 py-1 text-[12px] text-muted',
                          mine ? 'self-end' : 'self-start',
                        )}
                      >
                        {m.reply_snip}
                      </p>
                    )}

                    <button
                      onClick={() => setOpenId(openId === m.id ? null : m.id)}
                      onDoubleClick={() => react(m)}
                      className={cx(
                        'relative text-left transition active:scale-[0.985]',
                        bubbleClass(mine, first, last),
                        m.kind === 'image' && 'overflow-hidden p-1',
                      )}
                    >
                      {m.kind === 'text' && (
                        <span className="block whitespace-pre-wrap break-words text-[15.5px] leading-[1.35]">{m.body}</span>
                      )}

                      {m.kind === 'image' && m.media_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.media_url}
                          alt="Foto"
                          loading="lazy"
                          onClick={(e) => { e.stopPropagation(); setLightbox(m.media_url) }}
                          className="max-h-72 w-56 rounded-[18px] object-cover"
                        />
                      )}

                      {m.kind === 'audio' && m.media_url && (
                        <VoiceBubble url={m.media_url} seconds={m.duration ?? 0} mine={mine} />
                      )}

                      {m.reaction && (
                        <span
                          className={cx(
                            'absolute -bottom-2.5 rounded-full border border-line bg-surface px-1.5 text-[12px]',
                            mine ? 'left-1' : 'right-1',
                          )}
                        >
                          {m.reaction}
                        </span>
                      )}
                    </button>

                    {openId === m.id && (
                      <div className="animate-pop mt-2 flex gap-1.5 rounded-full border border-line bg-surface p-1 shadow-lift">
                        <IconBtn onClick={() => react(m)} label="Suka"><span className="text-[15px]">❤️</span></IconBtn>
                        <IconBtn onClick={() => { setReplyTo(m); setOpenId(null) }} label="Balas"><Reply size={16} /></IconBtn>
                        {mine && <IconBtn onClick={() => remove(m)} label="Hapus"><Trash2 size={16} /></IconBtn>}
                      </div>
                    )}

                    {last && (
                      <p className="mt-1 px-1 text-[11px] text-muted">
                        {clockTime(m.created_at)}
                        {mine && (m.read_at ? ' · Dibaca' : ' · Terkirim')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        ))}

        {partnerTyping && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-bubble bg-surface2 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Status unggah */}
      {uploading && (
        <p className="px-4 pb-1 text-center text-[12.5px] text-muted">{uploading}</p>
      )}

      {/* Balasan aktif */}
      {replyTo && (
        <div className="flex items-center gap-3 border-t border-line bg-surface2 px-4 py-2">
          <Reply size={16} className="shrink-0 text-primary-600" />
          <p className="min-w-0 flex-1 truncate text-[13px] text-muted">{snip(replyTo)}</p>
          <button onClick={() => setReplyTo(null)} aria-label="Batal balas" className="text-muted"><X size={16} /></button>
        </div>
      )}

      <Composer
        text={text}
        onText={onTyping}
        onSend={sendText}
        onPickImage={() => fileRef.current?.click()}
        onVoice={sendVoice}
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) sendImage(f)
        }}
      />

      {lightbox && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Foto" className="max-h-full max-w-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function bubbleClass(mine: boolean, first: boolean, last: boolean) {
  const base = 'px-3.5 py-2.5 rounded-bubble'
  if (mine) {
    return cx(
      base,
      'bg-gradient-to-br from-primary-400 to-primary-600 text-white',
      !first && 'rounded-tr-md',
      !last && 'rounded-br-md',
    )
  }
  return cx(base, 'bg-surface2 text-ink', !first && 'rounded-tl-md', !last && 'rounded-bl-md')
}

function snip(m: Message) {
  if (m.kind === 'image') return '📷 Foto'
  if (m.kind === 'audio') return '🎙️ Voice note'
  return (m.body ?? '').slice(0, 80)
}

function IconBtn({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-9 w-9 place-items-center rounded-full text-ink transition active:scale-90 hover:bg-surface2"
    >
      {children}
    </button>
  )
}

/* ---------------- Voice bubble ---------------- */

function VoiceBubble({ url, seconds, mine }: { url: string; seconds: number; mine: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)

  const bars = useMemo(
    () => Array.from({ length: 26 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7 + seconds)) * 0.75),
    [seconds],
  )
  const progress = seconds ? pos / seconds : 0

  return (
    <span className="flex w-52 items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => {
          const a = audio.current!
          if (a.paused) { a.play(); setPlaying(true) } else { a.pause(); setPlaying(false) }
        }}
        aria-label={playing ? 'Jeda' : 'Putar'}
        className={cx(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full',
          mine ? 'bg-white/25 text-white' : 'bg-primary text-white',
        )}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-[1px]" />}
      </button>

      <span className="flex h-8 flex-1 items-center gap-[3px]">
        {bars.map((h, i) => (
          <span
            key={i}
            style={{ height: `${h * 100}%` }}
            className={cx(
              'w-[3px] rounded-full transition-opacity',
              mine ? 'bg-white' : 'bg-primary-500',
              i / bars.length <= progress ? 'opacity-100' : 'opacity-35',
            )}
          />
        ))}
      </span>

      <span className={cx('shrink-0 text-[11px] tabular-nums', mine ? 'text-white/80' : 'text-muted')}>
        {mmss(playing ? pos : seconds)}
      </span>

      <audio
        ref={audio}
        src={url}
        preload="none"
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onEnded={() => { setPlaying(false); setPos(0) }}
      />
    </span>
  )
}

/* ---------------- Composer ---------------- */

function Composer({
  text, onText, onSend, onPickImage, onVoice,
}: {
  text: string
  onText: (v: string) => void
  onSend: (e?: React.FormEvent) => void
  onPickImage: () => void
  onVoice: (blob: Blob, seconds: number) => void
}) {
  const [rec, setRec] = useState<MediaRecorder | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const chunks = useRef<Blob[]>([])
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const cancelled = useRef(false)
  const elapsedRef = useRef(0)

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: pickMime() })
      chunks.current = []
      cancelled.current = false
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (timer.current) clearInterval(timer.current)
        const secs = elapsedRef.current
        setElapsed(0)
        setRec(null)
        if (!cancelled.current && secs >= 1) {
          onVoice(new Blob(chunks.current, { type: 'audio/webm' }), secs)
        }
      }
      mr.start()
      setRec(mr)
      elapsedRef.current = 0
      timer.current = setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
      }, 1000)
    } catch {
      alert('Browser tidak mengizinkan akses mikrofon.')
    }
  }

  if (rec) {
    return (
      <div className="safe-bottom flex items-center gap-3 border-t border-line bg-surface px-4 py-3">
        <button onClick={() => { cancelled.current = true; rec.stop() }} aria-label="Batal" className="text-muted">
          <Trash2 size={20} />
        </button>
        <span className="flex flex-1 items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          <span className="text-[15px] tabular-nums text-ink">{mmss(elapsed)}</span>
          <span className="text-[13px] text-muted">merekam…</span>
        </span>
        <button
          onClick={() => rec.stop()}
          aria-label="Kirim voice note"
          className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white active:scale-95"
        >
          <SendHorizontal size={19} />
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSend} className="safe-bottom flex items-end gap-2 border-t border-line bg-surface px-3 py-2.5">
      <button type="button" onClick={onPickImage} aria-label="Kirim foto" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary-600 active:scale-95">
        <ImagePlus size={22} />
      </button>

      <textarea
        rows={1}
        value={text}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend() }
        }}
        placeholder="Tulis pesan"
        className="field max-h-32 flex-1 resize-none rounded-3xl bg-surface2 py-2.5"
      />

      {text.trim() ? (
        <button
          type="submit"
          aria-label="Kirim"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white active:scale-95"
        >
          <SendHorizontal size={19} />
        </button>
      ) : (
        <button
          type="button"
          onClick={startRec}
          aria-label="Rekam voice note"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-primary-600 active:scale-95"
        >
          <Mic size={22} />
        </button>
      )}
    </form>
  )
}

function pickMime() {
  const opts = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return opts.find((m) => MediaRecorder.isTypeSupported(m)) || ''
}
