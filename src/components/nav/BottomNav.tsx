'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/', label: 'Games', icon: '🃏' },
  { href: '/live', label: 'Public view', icon: '📺' },
  { href: '/players', label: 'Roster', icon: '👥' },
] as const

export function BottomNav() {
  const pathname = usePathname()
  // The external share page is standalone — no app chrome.
  if (pathname.startsWith('/v/')) return null

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-800 bg-neutral-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-md">
        {tabs.map((tab) => {
          const active = tab.href === '/' ? pathname === '/' : pathname.startsWith(tab.href)
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
