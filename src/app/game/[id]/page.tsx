import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { isAuthed } from '@/lib/auth'
import {
  totalIn,
  rebuyCount,
  totalInPlay,
  formatCents,
  totalCounted,
  tableBalance,
  allCounted,
} from '@/lib/money'
import { buildResultRows } from '@/lib/results'
import { LivePlayerRow } from '@/components/game/LivePlayerRow'
import { AddPlayerPicker } from '@/components/game/AddPlayerPicker'
import { ShareLink } from '@/components/game/ShareLink'
import { StackInput } from '@/components/game/StackInput'
import { FinishButton } from '@/components/game/FinishButton'
import { FoodAdmin } from '@/components/game/FoodAdmin'
import { DeleteGameButton } from '@/components/game/DeleteGameButton'
import { ResultsTable } from '@/components/game/ResultsTable'
import { DownloadImageButton } from '@/components/game/DownloadImageButton'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const isAdmin = await isAuthed()

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      players: {
        include: { player: true, buyIns: true },
        orderBy: { player: { name: 'asc' } },
      },
    },
  })
  if (!game) notFound()

  const isEditing = isAdmin && game.status === 'ACTIVE'
  const candidates = isEditing
    ? await prisma.player.findMany({
        where: { archived: false, id: { notIn: game.players.map((gp) => gp.playerId) } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    : []

  const balance = tableBalance(game.players)
  const anyCounted = game.players.some((gp) => gp.finalStack !== null)
  const warning =
    balance === 0 && allCounted(game.players)
      ? null
      : `${formatCents(totalCounted(game.players))} counted, ${formatCents(totalInPlay(game.players))} in play — ${formatCents(Math.abs(balance))} ${balance < 0 ? 'unaccounted' : 'over'}`
  const uncounted = game.players.filter((gp) => gp.finalStack === null).map((gp) => gp.player.name)
  const finishWarning = [
    warning,
    uncounted.length > 0
      ? `${uncounted.join(', ')} ${uncounted.length === 1 ? 'has' : 'have'} no cash-out — they'll be recorded with $0 in chips.`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n') || null
  const resultRows = buildResultRows(game.players, game.foodBillCents)
  const title = game.label ?? 'Poker night'
  const subtitle = `${game.playedOn.toLocaleDateString()} · ${formatCents(game.defaultBuyIn)} buy-in · ${formatCents(totalInPlay(game.players))} in play`

  return (
    <PageShell wide={!isEditing}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          !isEditing && (
            <DownloadImageButton
              players={resultRows}
              foodBillCents={game.foodBillCents}
              title={title}
              subtitle={subtitle}
              filename={`poker-${game.playedOn.toISOString().slice(0, 10)}.png`}
            />
          )
        }
      />
      {isAdmin && <ShareLink viewSlug={game.viewSlug} />}

      {isEditing ? (
        <>
          <div className="flex flex-col gap-3">
            {game.players.map((gp) => (
              <LivePlayerRow
                key={gp.id}
                gamePlayerId={gp.id}
                name={gp.player.name}
                totalInCents={totalIn(gp)}
                rebuys={rebuyCount(gp)}
                defaultBuyInCents={game.defaultBuyIn}
              />
            ))}
          </div>
          <AddPlayerPicker gameId={game.id} candidates={candidates} />
          <Card className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-neutral-50">Cash out</h2>
            <div className="flex flex-col gap-3">
              {game.players.map((gp) => (
                <StackInput
                  key={gp.id}
                  gamePlayerId={gp.id}
                  name={gp.player.name}
                  finalStackCents={gp.finalStack}
                />
              ))}
            </div>
            <p className={anyCounted && balance === 0 && allCounted(game.players) ? 'text-emerald-500' : 'text-amber-500'}>
              {warning ?? 'Table balances ✓'}
            </p>
            <FinishButton gameId={game.id} warning={finishWarning} />
          </Card>
        </>
      ) : (
        <>
          <ResultsTable players={resultRows} foodBillCents={game.foodBillCents} />
          {isAdmin && game.status === 'FINISHED' && (
            <FoodAdmin
              gameId={game.id}
              foodBillCents={game.foodBillCents}
              players={game.players.map((gp) => ({
                gamePlayerId: gp.id,
                name: gp.player.name,
                miscAdjCents: gp.miscAdjCents,
              }))}
            />
          )}
        </>
      )}
      {isAdmin && (
        <div className="mt-2 flex justify-center border-t border-neutral-800 pt-4">
          <DeleteGameButton gameId={game.id} />
        </div>
      )}
    </PageShell>
  )
}
