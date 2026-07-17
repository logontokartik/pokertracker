'use client'

import { useTransition } from 'react'
import { addPlayerToGame } from '@/app/actions/games'

type Props = { gameId: string; candidates: { id: string; name: string }[] }

export function AddPlayerPicker({ gameId, candidates }: Props) {
  const [pending, startTransition] = useTransition()
  if (candidates.length === 0) return null
  return (
    <details className="rounded-lg border border-neutral-700 p-3">
      <summary className="cursor-pointer text-sm text-neutral-400">Add a late arrival</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map((p) => (
          <button
            key={p.id}
            disabled={pending}
            onClick={() => startTransition(async () => { await addPlayerToGame(gameId, p.id) })}
            className="rounded-lg border border-neutral-600 px-3 py-2 disabled:opacity-50"
          >
            + {p.name}
          </button>
        ))}
      </div>
    </details>
  )
}
