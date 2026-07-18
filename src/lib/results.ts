import {
  totalIn,
  rebuyCount,
  profit,
  foodSplit,
  finalCents,
  type GamePlayerLike,
} from '@/lib/money'

export type ResultRow = {
  name: string
  totalInCents: number
  rebuys: number
  finalStackCents: number | null
  profitCents: number | null
  // Settlement fields — present only when a food bill or a manual adjustment applies.
  foodWinnerCents?: number
  foodEqualCents?: number
  miscAdjCents?: number
  finalCents?: number | null
}

type PlayerInput = GamePlayerLike & {
  player: { name: string }
  miscAdjCents: number
}

// Builds the rows shown in ResultsTable. When a food bill is set (or any player
// has a manual adjustment), each row carries its food shares and final total;
// otherwise the rows are plain poker results.
export function buildResultRows(
  players: PlayerInput[],
  foodBillCents: number | null
): ResultRow[] {
  const settle = foodBillCents !== null || players.some((p) => p.miscAdjCents !== 0)
  const shares = foodBillCents !== null ? foodSplit(players, foodBillCents) : null

  return players.map((gp, i) => {
    const base: ResultRow = {
      name: gp.player.name,
      totalInCents: totalIn(gp),
      rebuys: rebuyCount(gp),
      finalStackCents: gp.finalStack,
      profitCents: profit(gp),
    }
    if (!settle) return base
    const share = shares?.[i] ?? null
    return {
      ...base,
      foodWinnerCents: share?.winnerCents ?? 0,
      foodEqualCents: share?.equalCents ?? 0,
      miscAdjCents: gp.miscAdjCents,
      finalCents: finalCents(gp, share, gp.miscAdjCents),
    }
  })
}
