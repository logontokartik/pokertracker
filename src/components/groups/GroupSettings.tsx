'use client'

import { useState, useTransition } from 'react'
import { inviteAdmin, removeMember, renameGroup, revokeInvite } from '@/app/actions/groups'

type ActionResult = { error?: string } | undefined

const inputClass =
  'min-w-0 flex-1 rounded-xl border border-neutral-700 bg-neutral-950 p-3 text-base text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-600 focus:outline-none'
const primaryButtonClass =
  'min-h-11 rounded-xl bg-emerald-600 px-4 font-semibold text-white active:bg-emerald-700 disabled:opacity-50'
const linkButtonClass =
  'inline-flex min-h-11 items-center px-1 text-sm text-neutral-400 underline active:text-neutral-200'

/** Runs a group action in a transition; reloads on `Unauthorized` (signed out or no longer an admin). */
function useGroupAction() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const run = (fn: () => Promise<ActionResult>, onSuccess?: () => void) =>
    startTransition(async () => {
      const result = await fn()
      if (result?.error === 'Unauthorized') {
        window.location.reload()
        return
      }
      setError(result?.error ?? null)
      if (!result?.error) onSuccess?.()
    })
  return { error, pending, run }
}

function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="text-sm text-red-400">{error}</p> : null
}

/** Two-step destructive button: first tap asks, second tap confirms. */
function ConfirmButton({
  label,
  question,
  confirmLabel,
  pending,
  onConfirm,
}: {
  label: string
  question: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={`${linkButtonClass} active:text-red-400`}>
        {label}
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-neutral-300">{question}</span>
      <button
        type="button"
        disabled={pending}
        onClick={onConfirm}
        className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-50"
      >
        {pending ? '…' : confirmLabel}
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={linkButtonClass}>
        Cancel
      </button>
    </div>
  )
}

export function RenameGroupForm({ groupId, name }: { groupId: string; name: string }) {
  const [value, setValue] = useState(name)
  const { error, pending, run } = useGroupAction()
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => renameGroup(groupId, value))
      }}
    >
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          maxLength={60}
          aria-label="Group name"
          className={inputClass}
        />
        <button type="submit" disabled={pending || value.trim() === name} className={primaryButtonClass}>
          {pending ? '…' : 'Rename'}
        </button>
      </div>
      <ErrorText error={error} />
    </form>
  )
}

type AdminRow = { memberId: string; name: string; email: string; isYou: boolean }

function AdminItem({ admin, canRemove }: { admin: AdminRow; canRemove: boolean }) {
  const { error, pending, run } = useGroupAction()
  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="min-w-0">
        <div className="truncate text-base font-semibold text-neutral-50">
          {admin.name}
          {admin.isYou && <span className="font-normal text-neutral-400"> (you)</span>}
        </div>
        <div className="truncate text-sm text-neutral-400">{admin.email}</div>
      </div>
      {canRemove && !admin.isYou && (
        <ConfirmButton
          label="remove"
          question={`Remove ${admin.name}?`}
          confirmLabel="Yes, remove"
          pending={pending}
          onConfirm={() => run(() => removeMember(admin.memberId))}
        />
      )}
      <ErrorText error={error} />
    </li>
  )
}

export function AdminList({ admins }: { admins: AdminRow[] }) {
  // The last admin can't be removed; hide the button rather than let the action refuse.
  const canRemove = admins.length > 1
  return (
    <ul className="flex flex-col gap-3">
      {admins.map((a) => (
        <AdminItem key={a.memberId} admin={a} canRemove={canRemove} />
      ))}
    </ul>
  )
}

type InviteRow = { id: string; email: string }

function InviteItem({ invite }: { invite: InviteRow }) {
  const { error, pending, run } = useGroupAction()
  return (
    <li className="flex flex-col gap-1 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-base text-neutral-200">{invite.email}</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => revokeInvite(invite.id))}
          className={`${linkButtonClass} disabled:opacity-50`}
        >
          revoke
        </button>
      </div>
      <ErrorText error={error} />
    </li>
  )
}

export function InviteList({ invites }: { invites: InviteRow[] }) {
  if (invites.length === 0) return <p className="text-sm text-neutral-500">No pending invites.</p>
  return (
    <ul className="flex flex-col gap-3">
      {invites.map((i) => (
        <InviteItem key={i.id} invite={i} />
      ))}
    </ul>
  )
}

export function InviteForm({ groupId }: { groupId: string }) {
  const [email, setEmail] = useState('')
  const { error, pending, run } = useGroupAction()
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        run(() => inviteAdmin(groupId, email), () => setEmail(''))
      }}
    >
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="co-admin@gmail.com"
          aria-label="Email to invite"
          className={inputClass}
        />
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? '…' : 'Invite'}
        </button>
      </div>
      <ErrorText error={error} />
      <p className="text-sm text-neutral-500">
        No email is sent. Share the app link; they sign in with Google using this email.
      </p>
    </form>
  )
}

export function LeaveGroupButton({ memberId, soleAdmin }: { memberId: string; soleAdmin: boolean }) {
  const { error, pending, run } = useGroupAction()
  if (soleAdmin) {
    return (
      <p className="text-sm text-neutral-500">
        You&apos;re the only admin. Invite another admin before leaving this group.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <ConfirmButton
        label="Leave group"
        question="Leave this group? You'll lose admin access."
        confirmLabel="Yes, leave"
        pending={pending}
        onConfirm={() => run(() => removeMember(memberId))}
      />
      <ErrorText error={error} />
    </div>
  )
}
