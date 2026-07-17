import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { totalIn, rebuyCount, profit, totalInPlay, formatCents } from '@/lib/money'
import { ResultsTable, type ResultRow } from '@/components/game/ResultsTable'
import { Poller } from '@/components/Poller'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

export default async function ViewGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await prisma.game.findUnique({
    where: { viewSlug: slug },
    include: {
      players: {
        include: { player: true, buyIns: true },
        orderBy: { player: { name: 'asc' } },
      },
    },
  })
  if (!game) notFound()

  const rows: ResultRow[] = game.players.map((gp) => ({
    name: gp.player.name,
    totalInCents: totalIn(gp),
    rebuys: rebuyCount(gp),
    finalStackCents: gp.finalStack,
    profitCents: profit(gp),
  }))

  return (
    <PageShell>
      <PageHeader
        title={game.label ?? 'Poker night'}
        subtitle={
          <>
            {game.playedOn.toLocaleDateString()} · {formatCents(game.defaultBuyIn)} buy-in ·{' '}
            {formatCents(totalInPlay(game.players))} in play ·{' '}
            {game.status === 'ACTIVE' ? 'live' : 'finished'}
          </>
        }
      />
      <ResultsTable players={rows} />
      {game.status === 'ACTIVE' && <Poller intervalMs={10_000} />}
    </PageShell>
  )
}
