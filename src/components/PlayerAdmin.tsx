'use client'

import { useState, useTransition } from 'react'
import { createPlayer, renamePlayer, setPlayerArchived } from '@/app/actions/players'

type PlayerRow = { id: string; name: string; archived: boolean }

export function PlayerAdmin({ players }: { players: PlayerRow[] }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error === 'Unauthorized') {
        window.location.href = '/login'
        return
      }
      setError(result.error ?? null)
    })

  return (
    <div className="flex flex-col gap-5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            const result = await createPlayer(newName)
            if (!result.error) setNewName('')
            return result
          })
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New player name"
          className="flex-1 rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
        />
        <button
          disabled={pending}
          className="min-h-11 rounded-xl bg-emerald-600 px-4 font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <ul className="flex flex-col gap-3 overflow-x-auto">
        {players.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
          >
            <span
              className={`flex-1 text-lg font-semibold ${p.archived ? 'text-neutral-500 line-through' : 'text-neutral-50'}`}
            >
              {p.name}
            </span>
            <button
              className="inline-flex min-h-11 items-center px-2 text-sm text-neutral-400 underline active:text-neutral-200"
              onClick={() => {
                const name = prompt('Rename player', p.name)
                if (name !== null) run(() => renamePlayer(p.id, name))
              }}
            >
              rename
            </button>
            <button
              className="inline-flex min-h-11 items-center px-2 text-sm text-neutral-400 underline active:text-neutral-200"
              onClick={() => run(() => setPlayerArchived(p.id, !p.archived))}
            >
              {p.archived ? 'unarchive' : 'archive'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
