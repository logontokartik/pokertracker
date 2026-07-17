'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Poker Tracker</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Edit password"
          autoFocus
          className="rounded-lg border border-neutral-600 bg-transparent p-3"
        />
        {state?.error && <p className="text-red-500">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </main>
  )
}
