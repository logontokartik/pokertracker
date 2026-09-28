import Link from 'next/link'
import { prisma } from '@/lib/db'
import { claimInvites, getViewer, isSuperAdmin } from '@/lib/access'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { SignInButton } from '@/components/auth/SignInButton'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { CreateGroupForm } from '@/components/groups/CreateGroupForm'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const viewer = await getViewer()

  if (!viewer) {
    return (
      <PageShell>
        <PageHeader title="Poker Tracker" />
        <p className="text-base text-neutral-400">
          Track buy-ins, cash-outs and settle up for your home game — with a live link everyone at
          the table can follow.
        </p>
        <SignInButton />
      </PageShell>
    )
  }

  await claimInvites(viewer)
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: viewer.id } } },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { games: true } },
      games: { where: { status: 'ACTIVE' }, select: { id: true } },
    },
  })

  return (
    <PageShell>
      <PageHeader
        title="My groups"
        subtitle={viewer.email}
        action={<SignOutButton />}
      />
      {isSuperAdmin(viewer) && (
        <Link
          href="/super"
          className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-3.5 py-3 text-sm font-semibold text-emerald-400 active:opacity-80"
        >
          Super admin · all groups →
        </Link>
      )}
      <ul className="flex flex-col gap-3">
        {groups.map((g) => (
          <li key={g.id}>
            <Link href={`/g/${g.slug}`} className="block active:opacity-80">
              <Card>
                <div className="flex justify-between gap-3">
                  <span className="text-lg font-semibold text-neutral-50">{g.name}</span>
                  {g.games.length > 0 && <span className="text-emerald-500">live</span>}
                </div>
                <div className="mt-1 text-sm text-neutral-400">
                  {g._count.games} {g._count.games === 1 ? 'game' : 'games'}
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {groups.length === 0 && (
        <p className="text-neutral-500">
          You&apos;re not in any groups yet. Create one below, or ask a group admin to invite{' '}
          {viewer.email}.
        </p>
      )}
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-neutral-50">Create a group</h2>
        <CreateGroupForm />
      </Card>
    </PageShell>
  )
}
