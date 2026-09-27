'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/** Group-scoped tabs; rendered by the group layout for admins only. */
export function BottomNav({ slug }: { slug: string }) {
  const pathname = usePathname()
  const base = `/g/${slug}`
  const tabs = [
    { href: base, label: 'Games', icon: '🃏' },
    { href: `${base}/players`, label: 'Roster', icon: '👥' },
    { href: `${base}/stats`, label: 'Stats', icon: '📊' },
    { href: `${base}/settings`, label: 'Settings', icon: '⚙️' },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active =
            tab.href === base
              ? pathname === base || pathname.startsWith(`${base}/game`)
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
                active ? 'text-emerald-500' : 'text-neutral-500 active:text-neutral-300'
              }`}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
