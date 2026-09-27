'use client'

import { useActionState } from 'react'
import { createGroup } from '@/app/actions/groups'

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState(createGroup, undefined)
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={60}
          placeholder="New group name"
          className="min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-emerald-600 px-4 font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? '…' : 'Create'}
        </button>
      </div>
      {state?.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  )
}
