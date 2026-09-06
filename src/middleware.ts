import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, readSessionToken } from '@/lib/auth'

const PROTECTED = ['/home', '/chat', '/calendar', '/moments', '/games', '/profile']

export async function middleware(req: NextRequest) {
  const role = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value)
  const { pathname } = req.nextUrl

  if (PROTECTED.some((p) => pathname.startsWith(p)) && !role) {
    return NextResponse.redirect(new URL('/', req.url))
  }
  if (pathname === '/' && role) {
    return NextResponse.redirect(new URL('/home', req.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/home/:path*', '/chat/:path*', '/calendar/:path*', '/moments/:path*', '/games/:path*', '/profile/:path*'],
}
