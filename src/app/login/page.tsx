'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-5">
      <h1 className="text-2xl font-bold text-neutral-50">Poker Tracker</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Enter password"
          autoFocus
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
        />
        {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-emerald-600 p-3.5 text-base font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </main>
  )
}
