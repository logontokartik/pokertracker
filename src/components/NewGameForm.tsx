'use client'

import { useActionState } from 'react'
import { createGame } from '@/app/actions/games'

type RosterPlayer = { id: string; name: string }

export function NewGameForm({ roster }: { roster: RosterPlayer[] }) {
  const [state, formAction, pending] = useActionState(createGame, undefined)
  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input
        name="label"
        placeholder="Label (optional, e.g. Friday night)"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-neutral-400">Buy-in ($)</span>
        <input
          name="buyIn"
          inputMode="decimal"
          defaultValue="20"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 focus:border-emerald-600 focus:outline-none"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-neutral-400">Who&apos;s playing?</legend>
        {roster.map((p) => (
          <label
            key={p.id}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-neutral-700 p-3 text-neutral-50 active:bg-neutral-800"
          >
            <input type="checkbox" name="playerIds" value={p.id} className="size-5 accent-emerald-600" />
            {p.name}
          </label>
        ))}
      </fieldset>
      <input
        name="newNames"
        placeholder="New players (comma-separated)"
        className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
      />
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-emerald-600 p-3.5 text-base font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? 'Starting…' : 'Start game'}
      </button>
    </form>
  )
}
