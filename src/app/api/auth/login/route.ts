import { NextResponse } from 'next/server'
import { SESSION_COOKIE, createSessionToken } from '@/lib/auth'
import { SERVER_CONFIG } from '@/lib/config.server'
import type { Role } from '@/lib/types'

export const runtime = 'nodejs'

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function POST(req: Request) {
  const { role, code } = (await req.json()) as { role: Role; code: string }

  if (role !== 'boy' && role !== 'girl') {
    return NextResponse.json({ error: 'Pilih dulu mau masuk sebagai siapa.' }, { status: 400 })
  }

  const expected = role === 'boy' ? SERVER_CONFIG.boyCode : SERVER_CONFIG.girlCode
  if (!expected) {
    return NextResponse.json({ error: 'Kode login belum diatur di src/lib/config.server.ts.' }, { status: 500 })
  }

  await new Promise((r) => setTimeout(r, 350)) // rem sederhana untuk brute force

  if (!code || !safeEqual(code, expected)) {
    return NextResponse.json({ error: 'Kodenya belum cocok. Coba lagi ya.' }, { status: 401 })
  }

  const token = await createSessionToken(role)
  const res = NextResponse.json({ ok: true, role })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
  return res
}
