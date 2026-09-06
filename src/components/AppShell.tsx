'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarHeart, Gamepad2, House, Images, MessageCircleHeart } from 'lucide-react'
import { Avatar } from './Avatar'
import { ThemeToggle } from './ThemeProvider'
import { useSession } from './SessionProvider'

const TABS = [
  { href: '/home', label: 'Beranda', Icon: House },
  { href: '/chat', label: 'Chat', Icon: MessageCircleHeart },
  { href: '/calendar', label: 'Kalender', Icon: CalendarHeart },
  { href: '/moments', label: 'Moment', Icon: Images },
  { href: '/games', label: 'Main', Icon: Gamepad2 },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const { me, profiles } = useSession()
  const bare = path.startsWith('/chat')

  return (
    <div className="flex min-h-[100dvh] flex-col">
      {!bare && (
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-[color:var(--bg)]/85 px-5 py-3 backdrop-blur-xl">
          <span className="font-display text-[22px] leading-none text-ink">LoveNest</span>
          <span className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/profile" aria-label="Profil" className="rounded-full">
              <Avatar url={profiles[me].avatar_url} name={profiles[me].display_name} size={40} ring={path === '/profile'} />
            </Link>
          </span>
        </header>
      )}

      <main className={`relative z-10 flex-1 ${bare ? '' : 'pb-28'}`}>{children}</main>

      {!bare && (
        <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-4 pb-3">
          <ul className="mx-auto flex max-w-md items-stretch justify-between rounded-[26px] border border-line bg-surface/90 px-2 py-2 shadow-lift backdrop-blur-xl">
            {TABS.map(({ href, label, Icon }) => {
              const active = path.startsWith(href)
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex flex-col items-center gap-1 rounded-[20px] py-2 text-[11px] font-medium transition ${
                      active ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/45 dark:text-primary-100' : 'text-muted'
                    }`}
                  >
                    <Icon size={21} strokeWidth={active ? 2.4 : 1.9} />
                    {label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      )}
    </div>
  )
}
