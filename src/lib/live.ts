import { prisma } from '@/lib/db'

export type LiveGame = { id: string; label: string }

// A group can run several games at once; admins get warned (never blocked) when
// a player they pick is already seated in another live game.
export async function liveGamesForGroup(groupId: string, excludeGameId?: string) {
  const games = await prisma.game.findMany({
    where: { groupId, status: 'ACTIVE', ...(excludeGameId ? { id: { not: excludeGameId } } : {}) },
    orderBy: { playedOn: 'asc' },
    select: { id: true, label: true, players: { select: { playerId: true } } },
  })
  const live: LiveGame[] = games.map((g) => ({ id: g.id, label: g.label ?? 'Poker night' }))
  const busy: Record<string, string> = {}
  for (const g of games) {
    for (const { playerId } of g.players) busy[playerId] ??= g.label ?? 'Poker night'
  }
  return { live, busy }
}
