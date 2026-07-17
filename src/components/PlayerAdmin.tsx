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
        window.location.href = '/login' // spec: unauthenticated mutation redirects, never a silent no-op
        return
      }
      setError(result.error ?? null)
    })

  return (
    <div className="flex flex-col gap-4">
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
          className="flex-1 rounded-lg border border-neutral-600 bg-transparent p-3"
        />
        <button disabled={pending} className="rounded-lg bg-emerald-600 px-4 font-semibold text-white disabled:opacity-50">
          Add
        </button>
      </form>
      {error && <p className="text-red-500">{error}</p>}
      <ul className="flex flex-col gap-2">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg border border-neutral-700 p-3">
            <span className={`flex-1 ${p.archived ? 'text-neutral-500 line-through' : ''}`}>{p.name}</span>
            <button
              className="text-sm text-neutral-400 underline"
              onClick={() => {
                const name = prompt('Rename player', p.name)
                if (name !== null) run(() => renamePlayer(p.id, name))
              }}
            >
              rename
            </button>
            <button
              className="text-sm text-neutral-400 underline"
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
