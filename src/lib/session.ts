import { cookies } from 'next/headers'
import { SESSION_COOKIE, readSessionToken } from './auth'
import type { Role } from './types'

export async function getRole(): Promise<Role | null> {
  return readSessionToken(cookies().get(SESSION_COOKIE)?.value)
}
