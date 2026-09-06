import { SignJWT, jwtVerify } from 'jose'
import { SERVER_CONFIG } from './config.server'
import type { Role } from './types'

export const SESSION_COOKIE = 'ln_session'

function key() {
  return new TextEncoder().encode(SERVER_CONFIG.authSecret)
}

export async function createSessionToken(role: Role) {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('180d')
    .sign(key())
}

export async function readSessionToken(token?: string): Promise<Role | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key())
    const role = payload.role
    return role === 'boy' || role === 'girl' ? role : null
  } catch {
    return null
  }
}
