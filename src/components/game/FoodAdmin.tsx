'use client'

import { useState, useTransition } from 'react'
import { setFoodBill, setMiscAdj } from '@/app/actions/games'
import { centsToDollarInput, parseDollarsToCents, parseSignedDollarsToCents } from '@/lib/money'
import { Card } from '@/components/ui/Card'

type PlayerAdj = { gamePlayerId: string; name: string; miscAdjCents: number }

function useSaver() {
  const [, startTransition] = useTransition()
  return (fn: () => Promise<{ error?: string }>, onError: (e: string | null) => void) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error === 'Unauthorized') {
        window.location.reload()
        return
      }
      onError(result.error ?? null)
    })
}

function FoodBillInput({ gameId, foodBillCents }: { gameId: string; foodBillCents: number | null }) {
  const [value, setValue] = useState(foodBillCents === null ? '' : centsToDollarInput(foodBillCents))
  const [error, setError] = useState<string | null>(null)
  const run = useSaver()

  const save = () => {
    const trimmed = value.trim()
    const cents = trimmed === '' ? null : parseDollarsToCents(trimmed)
    if (trimmed !== '' && cents === null) {
      setError('Enter a dollar amount')
      return
    }
    run(() => setFoodBill(gameId, cents), setError)
  }

  return (
    <div>
      <label className="flex items-center gap-3">
        <span className="flex-1 text-lg font-semibold text-neutral-50">Food bill</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          inputMode="decimal"
          placeholder="total $"
          className="w-28 rounded-xl border border-neutral-700 bg-neutral-950 p-2.5 text-right text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
        />
      </label>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  )
}

function MiscAdjInput({ gamePlayerId, name, miscAdjCents }: PlayerAdj) {
  const [value, setValue] = useState(miscAdjCents === 0 ? '' : centsToDollarInput(miscAdjCents))
  const [error, setError] = useState<string | null>(null)
  const run = useSaver()

  const save = () => {
    const trimmed = value.trim()
    const cents = trimmed === '' ? 0 : parseSignedDollarsToCents(trimmed)
    if (cents === null) {
      setError('Enter a dollar amount')
      return
    }
    run(() => setMiscAdj(gamePlayerId, cents), setError)
  }

  return (
    <div>
      <label className="flex items-center gap-3">
        <span className="flex-1 text-base text-neutral-200">{name}</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          inputMode="text"
          placeholder="± $"
          className="w-24 rounded-xl border border-neutral-700 bg-neutral-950 p-2 text-right text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
        />
      </label>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export function FoodAdmin({
  gameId,
  foodBillCents,
  players,
}: {
  gameId: string
  foodBillCents: number | null
  players: PlayerAdj[]
}) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-50">Food &amp; adjustments</h2>
      <p className="-mt-2 text-sm text-neutral-400">
        Winners cover up to 25% of total winnings; anything left over is split evenly.
      </p>
      <FoodBillInput gameId={gameId} foodBillCents={foodBillCents} />
      <div className="flex flex-col gap-2 border-t border-neutral-800 pt-4">
        <span className="text-sm text-neutral-400">Manual adjustments (optional)</span>
        {players.map((p) => (
          <MiscAdjInput key={p.gamePlayerId} {...p} />
        ))}
      </div>
    </Card>
  )
}
