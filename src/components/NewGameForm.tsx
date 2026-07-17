'use client'

import { useActionState } from 'react'
import { createGame } from '@/app/actions/games'

type RosterPlayer = { id: string; name: string }

export function NewGameForm({ roster }: { roster: RosterPlayer[] }) {
  const [state, formAction, pending] = useActionState(createGame, undefined)
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        name="label"
        placeholder="Label (optional, e.g. Friday night)"
        className="rounded-lg border border-neutral-600 bg-transparent p-3"
      />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-400">Buy-in ($)</span>
        <input
          name="buyIn"
          inputMode="decimal"
          defaultValue="20"
          className="rounded-lg border border-neutral-600 bg-transparent p-3"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-neutral-400">Who&apos;s playing?</legend>
        {roster.map((p) => (
          <label key={p.id} className="flex items-center gap-3 rounded-lg border border-neutral-700 p-3">
            <input type="checkbox" name="playerIds" value={p.id} className="size-5 accent-emerald-600" />
            {p.name}
          </label>
        ))}
      </fieldset>
      <input
        name="newNames"
        placeholder="New players (comma-separated)"
        className="rounded-lg border border-neutral-600 bg-transparent p-3"
      />
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Starting…' : 'Start game'}
      </button>
    </form>
  )
}
