'use client'

import { useState } from 'react'
import { authClient } from '@/lib/auth-client'

export function SignInButton() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError(null)
          const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: '/' })
          if (error) {
            setError(error.message ?? 'Sign-in failed — please try again')
            setPending(false)
          }
        }}
        className="min-h-11 w-full rounded-xl bg-emerald-600 p-3.5 text-center text-base font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? 'Redirecting…' : 'Sign in with Google'}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
