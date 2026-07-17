'use client'

import { useTransition } from 'react'
import { finishGame } from '@/app/actions/games'

type Props = { gameId: string; warning: string | null }

export function FinishButton({ gameId, warning }: Props) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (warning && !confirm(`${warning}\n\nFinish anyway?`)) return
        startTransition(async () => { await finishGame(gameId) })
      }}
      className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50"
    >
      Finish game
    </button>
  )
}
