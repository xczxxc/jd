'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession } from './SessionProvider'
import { Avatar } from './Avatar'
import { mmss } from '@/lib/utils'
import type { Role } from '@/lib/types'

type Status = 'idle' | 'calling' | 'ringing' | 'connected'
type Signal =
  | { t: 'offer'; from: Role; sdp: RTCSessionDescriptionInit; video: boolean }
  | { t: 'answer'; from: Role; sdp: RTCSessionDescriptionInit }
  | { t: 'ice'; from: Role; candidate: RTCIceCandidateInit }
  | { t: 'end'; from: Role; reason: 'tutup' | 'tolak' | 'gagal' }

const ICE: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    // Tambahkan TURN server di sini kalau mau lebih andal di jaringan ketat:
    // { urls: 'turn:host:3478', username: '...', credential: '...' },
  ],
}

const Ctx = createContext<{ start: (video: boolean) => void; status: Status }>({
  start: () => {},
  status: 'idle',
})

export const useCall = () => useContext(Ctx)

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { me, partner, profiles } = useSession()
  const [status, setStatus] = useState<Status>('idle')
  const [withVideo, setWithVideo] = useState(false)
  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)
  const [seconds, setSeconds] = useState(0)
  const [note, setNote] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localRef = useRef<MediaStream | null>(null)
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const offerRef = useRef<{ sdp: RTCSessionDescriptionInit; video: boolean } | null>(null)
  const startedAt = useRef<number | null>(null)
  const localVideo = useRef<HTMLVideoElement | null>(null)
  const remoteVideo = useRef<HTMLVideoElement | null>(null)
  const ringRef = useRef<{ ctx: AudioContext; stop: () => void } | null>(null)
  const statusRef = useRef<Status>('idle')
  const videoRef = useRef(false)

  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { videoRef.current = withVideo }, [withVideo])

  const send = useCallback((s: Signal) => {
    chanRef.current?.send({ type: 'broadcast', event: 'rtc', payload: s })
  }, [])

  /* ---------------- pembersihan ---------------- */
  const cleanup = useCallback(
    (log?: 'selesai' | 'tolak' | 'lewat') => {
      stopRing()
      pcRef.current?.getSenders().forEach((s) => s.track?.stop())
      pcRef.current?.close()
      pcRef.current = null
      localRef.current?.getTracks().forEach((t) => t.stop())
      localRef.current = null
      pendingIce.current = []
      offerRef.current = null

      const dur = startedAt.current ? Math.round((Date.now() - startedAt.current) / 1000) : 0
      startedAt.current = null
      setStatus('idle')
      setSeconds(0)
      setMicOn(true)
      setCamOn(true)

      if (log) {
        const jenis = videoRef.current ? 'Video call' : 'Panggilan'
        const label =
          log === 'selesai' ? `${jenis} ${mmss(dur)}` : log === 'tolak' ? `${jenis} ditolak` : `${jenis} tak terjawab`
        supabase.from('messages').insert({ sender: me, kind: 'call', body: label, duration: dur })
      }
    },
    [me],
  )

  /* ---------------- buat koneksi ---------------- */
  const makePc = useCallback(
    (stream: MediaStream) => {
      const pc = new RTCPeerConnection(ICE)
      stream.getTracks().forEach((t) => pc.addTrack(t, stream))

      pc.onicecandidate = (e) => {
        if (e.candidate) send({ t: 'ice', from: me, candidate: e.candidate.toJSON() })
      }
      pc.ontrack = (e) => {
        if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0]
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          stopRing()
          setStatus('connected')
          startedAt.current ??= Date.now()
        }
        if (pc.connectionState === 'failed') {
          setNote('Sambungan putus. Coba lagi ya.')
          cleanup('selesai')
        }
      }
      pcRef.current = pc
      return pc
    },
    [cleanup, me, send],
  )

  async function getMedia(video: boolean) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: video ? { facingMode: 'user', width: { ideal: 1280 } } : false,
    })
    localRef.current = stream
    if (localVideo.current) localVideo.current.srcObject = stream
    return stream
  }

  /* ---------------- mulai panggilan ---------------- */
  const start = useCallback(
    async (video: boolean) => {
      if (statusRef.current !== 'idle') return
      setNote(null)
      setWithVideo(video)
      setStatus('calling')
      try {
        const stream = await getMedia(video)
        const pc = makePc(stream)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        send({ t: 'offer', from: me, sdp: offer, video })
        playRing('out')
      } catch {
        setNote('Izin mikrofon/kamera ditolak browser.')
        cleanup()
      }
    },
    [cleanup, makePc, me, send],
  )

  const accept = useCallback(async () => {
    if (!offerRef.current) return
    stopRing()
    try {
      const stream = await getMedia(offerRef.current.video)
      const pc = makePc(stream)
      await pc.setRemoteDescription(new RTCSessionDescription(offerRef.current.sdp))
      for (const c of pendingIce.current) await pc.addIceCandidate(new RTCIceCandidate(c))
      pendingIce.current = []
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      send({ t: 'answer', from: me, sdp: answer })
      setStatus('connected')
      startedAt.current = Date.now()
    } catch {
      setNote('Izin mikrofon/kamera ditolak browser.')
      send({ t: 'end', from: me, reason: 'gagal' })
      cleanup()
    }
  }, [cleanup, makePc, me, send])

  const hangup = useCallback(
    (reason: 'tutup' | 'tolak' = 'tutup') => {
      const wasConnected = statusRef.current === 'connected'
      send({ t: 'end', from: me, reason })
      cleanup(wasConnected ? 'selesai' : reason === 'tolak' ? 'tolak' : 'lewat')
    },
    [cleanup, me, send],
  )

  /* ---------------- kanal signaling ---------------- */
  useEffect(() => {
    const ch = supabase.channel('rtc-room', { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'rtc' }, async ({ payload }) => {
      const s = payload as Signal
      if (s.from === me) return

      if (s.t === 'offer') {
        if (pcRef.current || statusRef.current !== 'idle') return
        offerRef.current = { sdp: s.sdp, video: s.video }
        setWithVideo(s.video)
        setStatus('ringing')
        playRing('in')
        navigator.vibrate?.([300, 200, 300, 200, 300])
      }
      if (s.t === 'answer') {
        stopRing()
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(s.sdp))
        for (const c of pendingIce.current) await pcRef.current?.addIceCandidate(new RTCIceCandidate(c))
        pendingIce.current = []
        setStatus('connected')
        startedAt.current ??= Date.now()
      }
      if (s.t === 'ice') {
        if (pcRef.current?.remoteDescription) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(s.candidate)) } catch {}
        } else {
          pendingIce.current.push(s.candidate)
        }
      }
      if (s.t === 'end') {
        cleanup(statusRef.current === 'connected' ? 'selesai' : undefined)
      }
    })
    ch.subscribe()
    chanRef.current = ch
    return () => { supabase.removeChannel(ch); chanRef.current = null }
  }, [cleanup, me])

  /* ---------------- timer ---------------- */
  useEffect(() => {
    if (status !== 'connected') return
    const id = setInterval(() => {
      if (startedAt.current) setSeconds(Math.round((Date.now() - startedAt.current) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [status])

  /* ---------------- nada dering ---------------- */
  function playRing(dir: 'in' | 'out') {
    try {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.value = 0.0001
      gain.connect(ctx.destination)
      let stopped = false
      const beat = () => {
        if (stopped) return
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = dir === 'in' ? 660 : 440
        osc.connect(gain)
        const t = ctx.currentTime
        gain.gain.cancelScheduledValues(t)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
        osc.start(t)
        osc.stop(t + 0.6)
      }
      beat()
      const id = setInterval(beat, dir === 'in' ? 1600 : 2400)
      ringRef.current = { ctx, stop: () => { stopped = true; clearInterval(id); ctx.close() } }
    } catch {}
  }
  function stopRing() {
    ringRef.current?.stop()
    ringRef.current = null
  }

  /* ---------------- kontrol ---------------- */
  function toggleMic() {
    const t = localRef.current?.getAudioTracks()[0]
    if (!t) return
    t.enabled = !t.enabled
    setMicOn(t.enabled)
  }
  function toggleCam() {
    const t = localRef.current?.getVideoTracks()[0]
    if (!t) return
    t.enabled = !t.enabled
    setCamOn(t.enabled)
  }
  async function flipCam() {
    const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video')
    if (!sender) return
    const current = localRef.current?.getVideoTracks()[0]
    const facing = current?.getSettings().facingMode === 'user' ? 'environment' : 'user'
    current?.stop()
    const fresh = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })
    const track = fresh.getVideoTracks()[0]
    await sender.replaceTrack(track)
    localRef.current?.removeTrack(current!)
    localRef.current?.addTrack(track)
    if (localVideo.current) localVideo.current.srcObject = localRef.current
  }

  const p = profiles[partner]
  const active = status !== 'idle'

  return (
    <Ctx.Provider value={{ start, status }}>
      {children}

      {note && !active && (
        <div className="fixed inset-x-4 bottom-24 z-[60] rounded-2xl border border-line bg-surface px-4 py-3 text-[14px] shadow-lift">
          <div className="flex items-center justify-between gap-3">
            <span>{note}</span>
            <button onClick={() => setNote(null)} className="text-muted">Tutup</button>
          </div>
        </div>
      )}

      {active && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[#160f13] text-white">
          {/* video jarak jauh */}
          <video
            ref={remoteVideo}
            autoPlay
            playsInline
            className={`absolute inset-0 h-full w-full object-cover ${
              withVideo && status === 'connected' ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute inset-0 bg-gradient-to-b from-primary-700/60 via-[#160f13]/70 to-[#160f13] ${
              withVideo && status === 'connected' ? 'opacity-40' : 'opacity-100'
            }`}
          />

          {/* video sendiri */}
          {withVideo && (
            <video
              ref={localVideo}
              autoPlay
              playsInline
              muted
              className="absolute right-4 top-6 z-10 h-40 w-28 rounded-2xl border border-white/20 object-cover shadow-lift"
            />
          )}

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-8 text-center">
            {(!withVideo || status !== 'connected') && (
              <span className="relative">
                {status !== 'connected' && (
                  <span className="absolute inset-0 animate-pulseRing rounded-full bg-primary/40" />
                )}
                <Avatar url={p.avatar_url} name={p.display_name} size={116} />
              </span>
            )}
            <div>
              <p className="font-display text-3xl">{p.display_name}</p>
              <p className="mt-1 text-[15px] text-white/70">
                {status === 'calling' && 'Memanggil…'}
                {status === 'ringing' && (withVideo ? 'Video call masuk' : 'Panggilan masuk')}
                {status === 'connected' && mmss(seconds)}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-center gap-4 pb-12 pt-4">
            {status === 'ringing' ? (
              <>
                <button
                  onClick={() => hangup('tolak')}
                  className="grid h-16 w-16 place-items-center rounded-full bg-red-500 shadow-lift active:scale-95"
                  aria-label="Tolak panggilan"
                >
                  <PhoneOff size={24} />
                </button>
                <button
                  onClick={accept}
                  className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500 shadow-lift active:scale-95"
                  aria-label="Angkat panggilan"
                >
                  <Phone size={24} />
                </button>
              </>
            ) : (
              <>
                <RoundBtn on={micOn} onClick={toggleMic} label="Mikrofon">
                  {micOn ? <Mic size={20} /> : <MicOff size={20} />}
                </RoundBtn>
                {withVideo && (
                  <>
                    <RoundBtn on={camOn} onClick={toggleCam} label="Kamera">
                      {camOn ? <Video size={20} /> : <VideoOff size={20} />}
                    </RoundBtn>
                    <RoundBtn on onClick={flipCam} label="Ganti kamera">
                      <RefreshCw size={20} />
                    </RoundBtn>
                  </>
                )}
                <button
                  onClick={() => hangup('tutup')}
                  className="grid h-16 w-16 place-items-center rounded-full bg-red-500 shadow-lift active:scale-95"
                  aria-label="Akhiri panggilan"
                >
                  <PhoneOff size={24} />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

function RoundBtn({
  on, onClick, label, children,
}: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={`grid h-14 w-14 place-items-center rounded-full backdrop-blur transition active:scale-95 ${
        on ? 'bg-white/15 text-white' : 'bg-white text-[#160f13]'
      }`}
    >
      {children}
    </button>
  )
}
