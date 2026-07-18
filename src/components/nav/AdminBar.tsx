'use client'

import { useActionState } from 'react'
import { unlock, logout } from '@/app/actions/auth'

export function AdminBar({ isAdmin }: { isAdmin: boolean }) {
  const [state, formAction, pending] = useActionState(unlock, undefined)

  if (isAdmin) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-emerald-800 bg-emerald-950/40 px-3.5 py-2.5">
        <span className="text-sm font-semibold text-emerald-400">🔓 Admin mode</span>
        <form action={logout}>
          <button className="inline-flex min-h-11 items-center px-1 text-sm text-neutral-400 underline active:text-neutral-200">
            Lock
          </button>
        </form>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          type="password"
          name="password"
          placeholder="Admin password"
          className="flex-1 rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-emerald-600 px-4 font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? '…' : 'Unlock'}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  )
}
