'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2, X } from 'lucide-react'
import { supabase, BUCKETS } from '@/lib/supabase'
import { compressImage } from '@/lib/compress'
import { bytes, dayLabel, uid } from '@/lib/utils'
import { useSession } from './SessionProvider'
import type { Moment } from '@/lib/types'

export function Gallery() {
  const { me, profiles } = useSession()
  const [items, setItems] = useState<Moment[]>([])
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Moment | null>(null)
  const [caption, setCaption] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { data } = await supabase.from('moments').select('*').order('created_at', { ascending: false })
    setItems((data as Moment[]) ?? [])
  }

  useEffect(() => {
    load()
    const ch = supabase
      .channel('moments-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'moments' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  async function upload(files: FileList) {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (!list.length) return
    setError(null)
    setBusy({ done: 0, total: list.length })

    for (let i = 0; i < list.length; i++) {
      try {
        const out = await compressImage(list[i], { maxSide: 2000, targetKB: 420 })
        const path = `${me}/${uid()}.${out.ext}`
        const { error: upErr } = await supabase.storage
          .from(BUCKETS.moments)
          .upload(path, out.blob, { contentType: out.mime, cacheControl: '31536000' })
        if (upErr) throw upErr
        const { data } = supabase.storage.from(BUCKETS.moments).getPublicUrl(path)
        await supabase.from('moments').insert({
          url: data.publicUrl,
          path,
          uploaded_by: me,
          width: out.width,
          height: out.height,
          bytes: out.bytes,
          original_bytes: out.originalBytes,
        })
      } catch {
        setError('Ada foto yang gagal diunggah. Cek koneksi lalu coba lagi.')
      }
      setBusy({ done: i + 1, total: list.length })
    }
    setBusy(null)
  }

  async function remove(m: Moment) {
    await supabase.storage.from(BUCKETS.moments).remove([m.path])
    await supabase.from('moments').delete().eq('id', m.id)
    setOpen(null)
  }

  async function saveCaption(m: Moment) {
    await supabase.from('moments').update({ caption: caption.trim() || null }).eq('id', m.id)
    setOpen({ ...m, caption: caption.trim() || null })
  }

  const saved = useMemo(() => {
    const orig = items.reduce((a, m) => a + (m.original_bytes ?? 0), 0)
    const now = items.reduce((a, m) => a + (m.bytes ?? 0), 0)
    return { orig, now, pct: orig ? Math.round((1 - now / orig) * 100) : 0 }
  }, [items])

  return (
    <div className="mx-auto max-w-md px-5 py-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[30px] leading-tight text-ink">Moment</h1>
          <p className="mt-1 text-[13.5px] text-muted">
            {items.length} foto
            {saved.orig > 0 && ` · hemat ${saved.pct}% (${bytes(saved.orig)} → ${bytes(saved.now)})`}
          </p>
        </div>
        <button onClick={() => fileRef.current?.click()} className="btn-primary shrink-0 px-4">
          <ImagePlus size={18} /> Unggah
        </button>
      </div>

      {busy && (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-surface2 px-4 py-3 text-[14px] text-muted">
          <Loader2 size={16} className="animate-spin" />
          Mengompres dan mengunggah {busy.done}/{busy.total}
        </p>
      )}
      {error && <p className="mt-4 rounded-2xl bg-primary-100 px-4 py-3 text-[14px] text-primary-800 dark:bg-primary-900/40 dark:text-primary-100">{error}</p>}

      {items.length === 0 && !busy ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="mt-6 w-full rounded-[26px] border border-dashed border-line bg-surface px-6 py-14 text-center"
        >
          <p className="text-[15px] font-semibold text-ink">Galeri masih kosong</p>
          <p className="mx-auto mt-1.5 max-w-[28ch] text-[13.5px] leading-relaxed text-muted">
            Unggah foto pertama kalian. Ukurannya otomatis dikecilkan tanpa bikin gambarnya pecah.
          </p>
        </button>
      ) : (
        <div className="mt-5 grid grid-cols-3 gap-1.5">
          {items.map((m) => (
            <button
              key={m.id}
              onClick={() => { setOpen(m); setCaption(m.caption ?? '') }}
              className="aspect-square overflow-hidden rounded-2xl bg-surface2 active:scale-[0.98]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.caption ?? 'Moment'} loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const fs = e.target.files
          e.target.value = ''
          if (fs) upload(fs)
        }}
      />

      {open && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/92">
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <button onClick={() => setOpen(null)} aria-label="Tutup"><X size={22} /></button>
            <span className="text-[13px] text-white/70">
              {profiles[open.uploaded_by].display_name} · {dayLabel(open.created_at)}
            </span>
            <button onClick={() => remove(open)} aria-label="Hapus foto"><Trash2 size={20} /></button>
          </div>

          <div className="grid flex-1 place-items-center px-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.url} alt={open.caption ?? 'Moment'} className="max-h-full max-w-full rounded-2xl object-contain" />
          </div>

          <div className="safe-bottom bg-black/40 px-4 py-4">
            <div className="flex gap-2">
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveCaption(open)}
                placeholder="Tulis caption"
                className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 text-[15px] text-white placeholder:text-white/50 outline-none focus:border-primary"
              />
              <button onClick={() => saveCaption(open)} className="btn-primary px-4">Simpan</button>
            </div>
            <p className="mt-2 text-[12px] text-white/50">
              {open.width}×{open.height} · {bytes(open.bytes)}
              {open.original_bytes ? ` (asli ${bytes(open.original_bytes)})` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
