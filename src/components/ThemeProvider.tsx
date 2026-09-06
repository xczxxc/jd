'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Mode = 'light' | 'dark'
const Ctx = createContext<{ mode: Mode; toggle: () => void }>({ mode: 'light', toggle: () => {} })

export const useTheme = () => useContext(Ctx)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('light')

  useEffect(() => {
    const saved = localStorage.getItem('ln-theme') as Mode | null
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const next = saved ?? system
    setMode(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, [])

  const toggle = useCallback(() => {
    setMode((m) => {
      const next: Mode = m === 'dark' ? 'light' : 'dark'
      localStorage.setItem('ln-theme', next)
      document.documentElement.classList.toggle('dark', next === 'dark')
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#130d10' : '#fff7f4')
      return next
    })
  }, [])

  return <Ctx.Provider value={{ mode, toggle }}>{children}</Ctx.Provider>
}

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { mode, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'}
      className={`grid h-10 w-10 place-items-center rounded-full border border-line bg-surface text-ink transition active:scale-95 ${className}`}
    >
      {mode === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
