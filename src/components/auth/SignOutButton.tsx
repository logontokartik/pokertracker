'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function SignOutButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut()
          router.refresh()
        })
      }
      className="inline-flex min-h-11 items-center px-1 underline active:text-neutral-200 disabled:opacity-50"
    >
      {pending ? 'signing out…' : 'sign out'}
    </button>
  )
}
