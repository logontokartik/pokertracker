'use client'

import { useState, useTransition } from 'react'
import { deleteGame } from '@/app/actions/games'

export function DeleteGameButton({ gameId }: { gameId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center justify-center px-1 text-sm text-neutral-500 underline active:text-red-400"
      >
        Delete this game
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-300">Delete permanently?</span>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteGame(gameId)
              if (result?.error === 'Unauthorized') {
                window.location.reload()
                return
              }
              setError(result?.error ?? null)
            })
          }
          className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-50"
        >
          {pending ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="min-h-11 px-1 text-sm text-neutral-400 underline active:text-neutral-200"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
