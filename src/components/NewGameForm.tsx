'use client'

import { useActionState, useState } from 'react'
import { createGame } from '@/app/actions/games'
import type { LiveGame } from '@/lib/live'

type RosterPlayer = { id: string; name: string }

type Props = {
  groupId: string
  roster: RosterPlayer[]
  // Other games live in this group, and which of them each busy player is in.
  liveGames: LiveGame[]
  busy: Record<string, string>
}

export function NewGameForm({ groupId, roster, liveGames, busy }: Props) {
  const [state, formAction, pending] = useActionState(createGame.bind(null, groupId), undefined)
  const [label, setLabel] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const doubleBooked = roster.filter((p) => picked.includes(p.id) && busy[p.id])
  return (
    <form action={formAction} className="flex flex-col gap-5">
      {liveGames.length > 0 && (
        <p className="rounded-xl border border-amber-800 bg-amber-950/40 p-3 text-sm text-amber-400">
          Already live: {liveGames.map((g) => g.label).join(', ')}.
          {!label.trim() && ' Give this game a label so players can tell the tables apart.'}
        </p>
      )}
      <input
        name="label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
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
            <input
              type="checkbox"
              name="playerIds"
              value={p.id}
              onChange={(e) =>
                setPicked((ids) => (e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id)))
              }
              className="size-5 accent-emerald-600"
            />
            {p.name}
            {busy[p.id] && <span className="text-sm text-amber-500">in {busy[p.id]}</span>}
          </label>
        ))}
      </fieldset>
      {doubleBooked.length > 0 && (
        <p className="text-sm text-amber-400">
          {doubleBooked.map((p) => `${p.name} (${busy[p.id]})`).join(', ')}{' '}
          {doubleBooked.length === 1 ? 'is' : 'are'} already in another live game. You can still start —
          just double-check.
        </p>
      )}
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
