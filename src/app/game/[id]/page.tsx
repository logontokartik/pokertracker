import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import {
  totalIn,
  rebuyCount,
  totalInPlay,
  formatCents,
  totalCounted,
  tableBalance,
  allCounted,
  profit,
} from '@/lib/money'
import { LivePlayerRow } from '@/components/game/LivePlayerRow'
import { AddPlayerPicker } from '@/components/game/AddPlayerPicker'
import { ShareLink } from '@/components/game/ShareLink'
import { StackInput } from '@/components/game/StackInput'
import { FinishButton } from '@/components/game/FinishButton'
import { ResultsTable, type ResultRow } from '@/components/game/ResultsTable'

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAuthPage()

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

  const candidates = await prisma.player.findMany({
    where: { archived: false, id: { notIn: game.players.map((gp) => gp.playerId) } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  const balance = tableBalance(game.players)
  const anyCounted = game.players.some((gp) => gp.finalStack !== null)
  const warning =
    balance === 0 && allCounted(game.players)
      ? null
      : `${formatCents(totalCounted(game.players))} counted, ${formatCents(totalInPlay(game.players))} in play — ${formatCents(Math.abs(balance))} ${balance < 0 ? 'unaccounted' : 'over'}`
  const resultRows: ResultRow[] = game.players.map((gp) => ({
    name: gp.player.name,
    totalInCents: totalIn(gp),
    rebuys: rebuyCount(gp),
    finalStackCents: gp.finalStack,
    profitCents: profit(gp),
  }))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{game.label ?? 'Poker night'}</h1>
          <p className="text-sm text-neutral-400">
            {game.playedOn.toLocaleDateString()} · {formatCents(game.defaultBuyIn)} buy-in ·{' '}
            {formatCents(totalInPlay(game.players))} in play
          </p>
        </div>
        <Link href="/" className="text-sm text-neutral-400 underline">home</Link>
      </div>
      <ShareLink viewSlug={game.viewSlug} />

      {game.status === 'ACTIVE' ? (
        <>
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
          <AddPlayerPicker gameId={game.id} candidates={candidates} />
          <section className="mt-4 flex flex-col gap-3 rounded-lg border border-neutral-700 p-3">
            <h2 className="font-semibold">Cash out</h2>
            {game.players.map((gp) => (
              <StackInput
                key={gp.id}
                gamePlayerId={gp.id}
                name={gp.player.name}
                finalStackCents={gp.finalStack}
              />
            ))}
            <p className={anyCounted && balance === 0 && allCounted(game.players) ? 'text-emerald-500' : 'text-amber-500'}>
              {warning ?? 'Table balances ✓'}
            </p>
            <FinishButton gameId={game.id} warning={warning} />
          </section>
        </>
      ) : (
        <ResultsTable players={resultRows} />
      )}
    </main>
  )
}
