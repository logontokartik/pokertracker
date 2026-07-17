import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { profit, formatCents } from '@/lib/money'

type Stat = { name: string; games: number; total: number; biggestWin: number; biggestLoss: number }

export default async function StatsPage() {
  await requireAuthPage()
  const gamePlayers = await prisma.gamePlayer.findMany({
    where: { game: { status: 'FINISHED' } },
    include: { player: true, buyIns: true },
  })

  const byPlayer = new Map<string, Stat>()
  for (const gp of gamePlayers) {
    const p = profit(gp)
    if (p === null) continue // never cashed out; excluded rather than counted as a $0 game
    const stat = byPlayer.get(gp.playerId) ?? {
      name: gp.player.name, games: 0, total: 0, biggestWin: p, biggestLoss: p,
    }
    stat.games += 1
    stat.total += p
    stat.biggestWin = Math.max(stat.biggestWin, p)
    stat.biggestLoss = Math.min(stat.biggestLoss, p)
    byPlayer.set(gp.playerId, stat)
  }
  const stats = [...byPlayer.values()].sort((a, b) => b.total - a.total)

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-xl font-bold">Lifetime stats</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Player</th>
            <th className="p-2 text-right">Games</th>
            <th className="p-2 text-right">Total</th>
            <th className="p-2 text-right">Best</th>
            <th className="p-2 text-right">Worst</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.name} className="border-t border-neutral-800">
              <td className="p-2">{s.name}</td>
              <td className="p-2 text-right">{s.games}</td>
              <td className={`p-2 text-right font-semibold ${s.total >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatCents(s.total)}
              </td>
              <td className="p-2 text-right">{formatCents(s.biggestWin)}</td>
              <td className="p-2 text-right">{formatCents(s.biggestLoss)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.length === 0 && <p className="mt-4 text-neutral-500">No finished games yet.</p>}
    </main>
  )
}
