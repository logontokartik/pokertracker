import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { totalIn, rebuyCount, totalInPlay, formatCents } from '@/lib/money'
import { LivePlayerRow } from '@/components/game/LivePlayerRow'
import { AddPlayerPicker } from '@/components/game/AddPlayerPicker'
import { ShareLink } from '@/components/game/ShareLink'

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
          {/* Task 8: cash-out section + finish button render here */}
        </>
      ) : null /* Task 8: FINISHED results table */}
    </main>
  )
}
