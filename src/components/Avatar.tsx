'use client'

type Props = { url?: string | null; name: string; size?: number; ring?: boolean }

export function Avatar({ url, name, size = 40, ring = false }: Props) {
  const initials = name.trim().slice(0, 2).toUpperCase()
  return (
    <span
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-100 font-semibold text-primary-800 dark:bg-primary-900/50 dark:text-primary-100 ${
        ring ? 'ring-2 ring-primary ring-offset-2 ring-offset-[color:var(--bg)]' : ''
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  )
}
