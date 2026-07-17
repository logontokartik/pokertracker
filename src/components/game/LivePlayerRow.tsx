'use client'

import { useState, useTransition } from 'react'
import { addRebuy, undoLastBuyIn } from '@/app/actions/games'
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
        window.location.href = '/login' // spec: unauthenticated mutation redirects, never a silent no-op
        return
      }
      setError(result.error ?? null)
    })

  return (
    <div className="rounded-lg border border-neutral-700 p-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="font-semibold">{name}</div>
          <div className="text-sm text-neutral-400">
            {formatCents(totalInCents)} in · {rebuys} rebuy{rebuys === 1 ? '' : 's'}
          </div>
        </div>
        <button
          aria-label={`Rebuy ${name} for ${formatCents(defaultBuyInCents)}`}
          disabled={pending}
          onClick={() => run(() => addRebuy(gamePlayerId))}
          className="size-12 rounded-full bg-emerald-600 text-2xl font-bold text-white disabled:opacity-50"
        >
          +
        </button>
        <button
          aria-label="Custom amount"
          onClick={() => setOpen(!open)}
          className="px-1 text-neutral-400"
        >
          {open ? '▴' : '▾'}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            inputMode="decimal"
            placeholder="Amount ($)"
            className="flex-1 rounded-lg border border-neutral-600 bg-transparent p-2"
          />
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
            className="rounded-lg bg-emerald-700 px-3 text-white disabled:opacity-50"
          >
            Rebuy
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => undoLastBuyIn(gamePlayerId))}
            className="rounded-lg border border-neutral-600 px-3 text-neutral-300 disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
