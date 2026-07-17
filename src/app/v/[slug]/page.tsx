import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { totalIn, rebuyCount, profit, totalInPlay, formatCents } from '@/lib/money'
import { ResultsTable, type ResultRow } from '@/components/game/ResultsTable'
import { Poller } from '@/components/Poller'

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
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold">{game.label ?? 'Poker night'}</h1>
        <p className="text-sm text-neutral-400">
          {game.playedOn.toLocaleDateString()} · {formatCents(game.defaultBuyIn)} buy-in ·{' '}
          {formatCents(totalInPlay(game.players))} in play ·{' '}
          {game.status === 'ACTIVE' ? 'live' : 'finished'}
        </p>
      </div>
      <ResultsTable players={rows} />
      {game.status === 'ACTIVE' && <Poller intervalMs={10_000} />}
    </main>
  )
}
