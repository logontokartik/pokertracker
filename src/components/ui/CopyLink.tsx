'use client'

import { useState } from 'react'

/** Copies `${origin}${path}` to the clipboard. */
export function CopyLink({ path, label }: { path: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center text-sm text-neutral-400 underline active:text-neutral-200"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied!' : label}
    </button>
  )
}
