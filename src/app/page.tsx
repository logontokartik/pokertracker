import Link from 'next/link'
import { prisma } from '@/lib/db'
import { isAuthed } from '@/lib/auth'
import { totalInPlay, formatCents } from '@/lib/money'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { AdminBar } from '@/components/nav/AdminBar'

export default async function HomePage() {
  const isAdmin = await isAuthed()
  const games = await prisma.game.findMany({
    orderBy: { playedOn: 'desc' },
    include: { players: { include: { player: true, buyIns: true } } },
  })

  return (
    <PageShell>
      <PageHeader
        title="Poker Tracker"
        action={
          <Link
            href="/stats"
            className="inline-flex min-h-11 items-center px-1 underline active:text-neutral-200"
          >
            stats
          </Link>
        }
      />
      <AdminBar isAdmin={isAdmin} />
      {isAdmin && (
        <Link
          href="/game/new"
          className="w-full rounded-xl bg-emerald-600 p-3.5 text-center text-base font-semibold text-white active:bg-emerald-700"
        >
          Start a new game
        </Link>
      )}
      <ul className="flex flex-col gap-3">
        {games.map((g) => (
          <li key={g.id}>
            <Link href={`/game/${g.id}`} className="block active:opacity-80">
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
      {games.length === 0 && <p className="text-neutral-500">No games yet.</p>}
    </PageShell>
  )
}
