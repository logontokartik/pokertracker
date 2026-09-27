import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getGroupForViewer } from '@/lib/access'
import { totalInPlay, formatCents } from '@/lib/money'
import { Poller } from '@/components/Poller'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

const linkClass = 'inline-flex min-h-11 items-center px-1 underline active:text-neutral-200'

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await getGroupForViewer(slug)
  if (!ctx) notFound()
  const { group, isAdmin, viewer } = ctx

  // The public only ever sees live games; history is admin-only.
  const games = await prisma.game.findMany({
    where: isAdmin ? { groupId: group.id } : { groupId: group.id, status: 'ACTIVE' },
    orderBy: { playedOn: 'desc' },
    include: { players: { include: { player: true, buyIns: true } } },
  })

  return (
    <PageShell>
      <PageHeader
        title={group.name}
        subtitle={
          isAdmin || viewer ? (
            <Link href="/" className="inline-flex min-h-11 items-center underline active:text-neutral-200">
              ← My groups
            </Link>
          ) : undefined
        }
      />
      {isAdmin && (
        <Link
          href={`/g/${group.slug}/game/new`}
          className="w-full rounded-xl bg-emerald-600 p-3.5 text-center text-base font-semibold text-white active:bg-emerald-700"
        >
          Start a new game
        </Link>
      )}
      <ul className="flex flex-col gap-3">
        {games.map((g) => (
          <li key={g.id}>
            <Link
              href={isAdmin ? `/g/${group.slug}/game/${g.id}` : `/v/${g.viewSlug}`}
              className="block active:opacity-80"
            >
              <Card>
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-neutral-50">
                    {g.label ?? 'Poker night'}
                  </span>
                  <span className={g.status === 'ACTIVE' ? 'text-emerald-500' : 'text-neutral-500'}>
                    {g.status === 'ACTIVE' ? 'live' : g.playedOn.toLocaleDateString()}
                  </span>
                </div>
                <div className="mt-1 text-sm text-neutral-400">
                  {g.players.map((gp) => gp.player.name).join(', ')} ·{' '}
                  {formatCents(g.defaultBuyIn)} buy-in · {formatCents(totalInPlay(g.players))} total
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {games.length === 0 && (
        <p className="text-neutral-500">{isAdmin ? 'No games yet.' : 'No game live right now.'}</p>
      )}
      {!isAdmin && (
        <>
          <Poller intervalMs={15_000} />
          {!viewer && (
            <p className="mt-auto text-center text-sm text-neutral-500">
              Group admin?{' '}
              <Link href="/" className={linkClass}>
                Sign in
              </Link>
            </p>
          )}
        </>
      )}
    </PageShell>
  )
}
