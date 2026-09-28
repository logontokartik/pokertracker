'use client'

import { useTransition } from 'react'
import { addPlayerToGame } from '@/app/actions/games'

type Props = {
  gameId: string
  candidates: { id: string; name: string }[]
  // playerId → label of another live game they're already in (warn, don't block).
  busy: Record<string, string>
}

export function AddPlayerPicker({ gameId, candidates, busy }: Props) {
  const [pending, startTransition] = useTransition()
  if (candidates.length === 0) return null
  return (
    <details className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-neutral-400">Add a late arrival</summary>
      {candidates.some((p) => busy[p.id]) && (
        <p className="mt-2 text-sm text-amber-400">Amber names are already seated in another live game.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {candidates.map((p) => (
          <button
            key={p.id}
            disabled={pending}
            onClick={() => startTransition(async () => { await addPlayerToGame(gameId, p.id) })}
            className="min-h-11 rounded-xl border border-neutral-700 px-3 py-2 text-sm text-neutral-100 active:bg-neutral-800 disabled:opacity-50"
          >
            + {p.name}
            {busy[p.id] && <span className="text-amber-500"> · in {busy[p.id]}</span>}
          </button>
        ))}
      </div>
    </details>
  )
}
