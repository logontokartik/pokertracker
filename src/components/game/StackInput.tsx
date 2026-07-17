'use client'

import { useState, useTransition } from 'react'
import { setFinalStack } from '@/app/actions/games'
import { centsToDollarInput, formatCents, parseDollarsToCents } from '@/lib/money'

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
    <label className="flex items-center gap-2">
      <span className="flex-1">{name}</span>
      {error && <span className="text-sm text-red-500">{error}</span>}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        inputMode="decimal"
        placeholder="chips $"
        className="w-24 rounded-lg border border-neutral-600 bg-transparent p-2 text-right"
      />
      {finalStackCents !== null && (
        <span className="w-14 text-right text-sm text-neutral-400">{formatCents(finalStackCents)}</span>
      )}
    </label>
  )
}
