import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { logout } from '@/app/actions/auth'
import { totalInPlay, formatCents } from '@/lib/money'

export default async function HomePage() {
  await requireAuthPage()
  const games = await prisma.game.findMany({
    orderBy: { playedOn: 'desc' },
    include: { players: { include: { player: true, buyIns: true } } },
  })

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Poker Tracker</h1>
        <div className="flex gap-3 text-sm text-neutral-400">
          <Link href="/players" className="underline">roster</Link>
          <form action={logout}>
            <button className="underline">log out</button>
          </form>
        </div>
      </div>
      <Link
        href="/game/new"
        className="rounded-lg bg-emerald-600 p-3 text-center font-semibold text-white"
      >
        Start a new game
      </Link>
      <ul className="flex flex-col gap-2">
        {games.map((g) => (
          <li key={g.id}>
            <Link
              href={`/game/${g.id}`}
              className="block rounded-lg border border-neutral-700 p-3"
            >
              <div className="flex justify-between">
                <span className="font-semibold">{g.label ?? 'Poker night'}</span>
                <span className={g.status === 'ACTIVE' ? 'text-emerald-500' : 'text-neutral-500'}>
                  {g.status === 'ACTIVE' ? 'live' : g.playedOn.toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-neutral-400">
                {g.players.map((gp) => gp.player.name).join(', ')} ·{' '}
                {formatCents(g.defaultBuyIn)} buy-in · {formatCents(totalInPlay(g.players))} total
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {games.length === 0 && <p className="text-neutral-500">No games yet.</p>}
    </main>
  )
}
