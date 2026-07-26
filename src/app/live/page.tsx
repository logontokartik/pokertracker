import { prisma } from '@/lib/db'
import { totalInPlay, formatCents } from '@/lib/money'
import { buildResultRows } from '@/lib/results'
import { ResultsTable } from '@/components/game/ResultsTable'
import { DownloadImageButton } from '@/components/game/DownloadImageButton'
import { Poller } from '@/components/Poller'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

export default async function LivePage() {
  // Prefer the game that's currently live; otherwise show the most recent one.
  const game =
    (await prisma.game.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { playedOn: 'desc' },
      include: {
        players: { include: { player: true, buyIns: true }, orderBy: { player: { name: 'asc' } } },
      },
    })) ??
    (await prisma.game.findFirst({
      orderBy: { playedOn: 'desc' },
      include: {
        players: { include: { player: true, buyIns: true }, orderBy: { player: { name: 'asc' } } },
      },
    }))

  if (!game) {
    return (
      <PageShell>
        <PageHeader title="Public view" />
        <p className="text-neutral-500">No games yet.</p>
      </PageShell>
    )
  }

  const rows = buildResultRows(game.players, game.foodBillCents)
  const title = game.label ?? 'Poker night'
  const subtitle = `${game.playedOn.toLocaleDateString()} · ${formatCents(game.defaultBuyIn)} buy-in · ${formatCents(totalInPlay(game.players))} in play · ${game.status === 'ACTIVE' ? 'live' : 'finished'}`

  return (
    <PageShell wide>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <DownloadImageButton
            players={rows}
            foodBillCents={game.foodBillCents}
            title={title}
            subtitle={subtitle}
            filename={`poker-${game.playedOn.toISOString().slice(0, 10)}.png`}
          />
        }
      />
      <ResultsTable players={rows} foodBillCents={game.foodBillCents} />
      {game.status === 'ACTIVE' && <Poller intervalMs={10_000} />}
    </PageShell>
  )
}
