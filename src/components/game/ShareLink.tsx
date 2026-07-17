'use client'

import { useState } from 'react'

export function ShareLink({ viewSlug }: { viewSlug: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/v/${viewSlug}`
  return (
    <button
      className="inline-flex min-h-11 items-center text-sm text-neutral-400 underline active:text-neutral-200"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied!' : 'Copy view link'}
    </button>
  )
}
