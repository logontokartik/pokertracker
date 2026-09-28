import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { canAdminGroup, getViewer } from '@/lib/access'
import { totalInPlay, formatCents } from '@/lib/money'
import { buildResultRows } from '@/lib/results'
import { ResultsTable } from '@/components/game/ResultsTable'
import { DownloadImageButton } from '@/components/game/DownloadImageButton'
import { Poller } from '@/components/Poller'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function ViewGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await prisma.game.findUnique({
    where: { viewSlug: slug },
    include: {
      players: {
        include: { player: true, buyIns: true },
        orderBy: { player: { name: 'asc' } },
      },
      group: { select: { slug: true } },
    },
  })
  if (!game) notFound()

  // Only live games are public. A finished game is visible to its group's admins only.
  if (game.status === 'FINISHED') {
    const viewer = await getViewer()
    if (await canAdminGroup(viewer, game.groupId)) {
      redirect(`/g/${game.group.slug}/game/${game.id}`)
    }
    notFound()
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
