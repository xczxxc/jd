import Link from 'next/link'
import { Dices, Brush, ArrowUpRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

const games = [
  {
    href: '/games/snake',
    title: 'Ular Tangga Bucin',
    desc: 'Papan 100 kotak, ular, tangga, plus kotak tantangan yang bikin salah tingkah.',
    Icon: Dices,
    tint: 'from-primary-300 to-primary-600',
  },
  {
    href: '/games/draw',
    title: 'Tebak Gambar',
    desc: 'Satu orang gambar pakai kuas, satunya nebak. Kuas dan tebakannya jalan realtime.',
    Icon: Brush,
    tint: 'from-gold to-primary-400',
  },
]

export default function Page() {
  return (
    <div className="mx-auto max-w-md px-5 py-6">
      <h1 className="font-display text-[30px] leading-tight text-ink">Main berdua</h1>
      <p className="mt-1.5 text-[14px] text-muted">Dua-duanya butuh kalian online bareng.</p>

      <div className="mt-6 space-y-4">
        {games.map(({ href, title, desc, Icon, tint }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-start gap-4 rounded-[26px] border border-line bg-surface p-5 transition active:scale-[0.99]"
          >
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${tint} text-white`}>
              <Icon size={26} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[17px] font-semibold text-ink">
                {title}
                <ArrowUpRight size={16} className="text-muted transition group-active:translate-x-0.5" />
              </span>
              <span className="mt-1 block text-[13.5px] leading-relaxed text-muted">{desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
