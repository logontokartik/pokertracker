'use client'

import { useState, useTransition } from 'react'
import { setFinalStack } from '@/app/actions/games'
import { centsToDollarInput, parseDollarsToCents } from '@/lib/money'

type Props = { gamePlayerId: string; name: string; finalStackCents: number | null }

export function StackInput({ gamePlayerId, name, finalStackCents }: Props) {
  const [value, setValue] = useState(
    finalStackCents === null ? '' : centsToDollarInput(finalStackCents)
  )
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const save = () => {
    const trimmed = value.trim()
    const cents = trimmed === '' ? null : parseDollarsToCents(trimmed)
    if (trimmed !== '' && cents === null) {
      setError('Enter a dollar amount')
      return
    }
    startTransition(async () => {
      const result = await setFinalStack(gamePlayerId, cents)
      if (result.error === 'Unauthorized') {
        window.location.href = '/login'
        return
      }
      setError(result.error ?? null)
    })
  }

  return (
    <div>
      <label className="flex items-center gap-3">
        <span className="flex-1 text-lg font-semibold text-neutral-50">{name}</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          inputMode="decimal"
          placeholder="chips $"
          className="w-28 rounded-xl border border-neutral-700 bg-neutral-950 p-2.5 text-right text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
        />
      </label>
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
    </div>
  )
}
