'use client'

import { useState, useTransition } from 'react'
import { addRebuy, removePlayerFromGame, undoLastBuyIn } from '@/app/actions/games'
import { formatCents, parseDollarsToCents } from '@/lib/money'

type Props = {
  gamePlayerId: string
  name: string
  totalInCents: number
  rebuys: number
  defaultBuyInCents: number
}

export function LivePlayerRow({ gamePlayerId, name, totalInCents, rebuys, defaultBuyInCents }: Props) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error === 'Unauthorized') {
        // Admin lock expired — reload to drop back into read-only mode.
        window.location.reload()
        return
      }
      setError(result.error ?? null)
    })

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="text-lg font-semibold text-neutral-50">{name}</div>
          <div className="text-sm text-neutral-400">
            {formatCents(totalInCents)} in · {rebuys} rebuy{rebuys === 1 ? '' : 's'}
          </div>
        </div>
        <button
          aria-label={`Rebuy ${name} for ${formatCents(defaultBuyInCents)}`}
          disabled={pending}
          onClick={() => run(() => addRebuy(gamePlayerId))}
          className="flex size-14 items-center justify-center rounded-full bg-emerald-600 text-2xl font-bold text-white active:bg-emerald-700 disabled:opacity-50"
        >
          +
        </button>
        <button
          aria-label="Custom amount"
          onClick={() => setOpen(!open)}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-neutral-400 active:bg-neutral-800"
        >
          {open ? '▴' : '▾'}
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            inputMode="decimal"
            placeholder="Amount ($)"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              disabled={pending}
              onClick={() => {
                const cents = parseDollarsToCents(custom)
                if (cents === null || cents <= 0) {
                  setError('Enter a positive amount')
                  return
                }
                run(async () => {
                  const result = await addRebuy(gamePlayerId, cents)
                  if (!result.error) {
                    setCustom('')
                    setOpen(false)
                  }
                  return result
                })
              }}
              className="flex-1 min-h-11 rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white active:bg-emerald-800 disabled:opacity-50"
            >
              Rebuy
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => undoLastBuyIn(gamePlayerId))}
              className="flex-1 min-h-11 rounded-xl border border-neutral-700 py-2.5 text-sm font-medium text-neutral-300 active:bg-neutral-800 disabled:opacity-50"
            >
              Undo
            </button>
            <button
              disabled={pending}
              onClick={() => run(() => removePlayerFromGame(gamePlayerId))}
              className="flex-1 min-h-11 rounded-xl border border-red-900/60 py-2.5 text-sm font-medium text-red-400 active:bg-red-950 disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  )
}
