export type BuyInLike = { amount: number }
export type GamePlayerLike = { finalStack: number | null; buyIns: BuyInLike[] }

export function totalIn(gp: GamePlayerLike): number {
  return gp.buyIns.reduce((sum, b) => sum + b.amount, 0)
}

export function rebuyCount(gp: GamePlayerLike): number {
  return Math.max(0, gp.buyIns.length - 1)
}

export function profit(gp: GamePlayerLike): number | null {
  return gp.finalStack === null ? null : gp.finalStack - totalIn(gp)
}

export function totalInPlay(gps: GamePlayerLike[]): number {
  return gps.reduce((sum, gp) => sum + totalIn(gp), 0)
}

// Sum of every positive profit — the pot the food bill is measured against.
export function totalWinnings(gps: GamePlayerLike[]): number {
  return gps.reduce((sum, gp) => {
    const p = profit(gp)
    return sum + (p !== null && p > 0 ? p : 0)
  }, 0)
}

export type FoodShare = {
  // Pro-rata share of the food bill charged to a winner (0 for non-winners).
  winnerCents: number
  // Equal share of the leftover bill charged to every player (winners included).
  equalCents: number
}

// Food-split rule (see docs): winners cover min(bill, 25% of total winnings),
// split pro-rata to their winnings; whatever is left is split equally across all
// N players. Returns one FoodShare per player, in input order.
export function foodSplit(gps: GamePlayerLike[], foodBillCents: number): FoodShare[] {
  const n = gps.length
  if (n === 0) return []
  const winnings = totalWinnings(gps)
  const winnersCover = Math.min(foodBillCents, Math.round(0.25 * winnings))
  const remaining = foodBillCents - winnersCover
  const equalCents = Math.round(remaining / n)
  return gps.map((gp) => {
    const p = profit(gp)
    const winnerCents =
      p !== null && p > 0 && winnings > 0 ? Math.round((p / winnings) * winnersCover) : 0
    return { winnerCents, equalCents }
  })
}

// A player's final settlement: poker profit, less food owed, plus any manual adjustment.
// Null when the player hasn't cashed out (no profit yet).
export function finalCents(
  gp: GamePlayerLike,
  food: FoodShare | null,
  miscAdjCents: number
): number | null {
  const p = profit(gp)
  if (p === null) return null
  const owed = food ? food.winnerCents + food.equalCents : 0
  return p - owed + miscAdjCents
}

export function totalCounted(gps: GamePlayerLike[]): number {
  return gps.reduce((sum, gp) => sum + (gp.finalStack ?? 0), 0)
}

export function allCounted(gps: GamePlayerLike[]): boolean {
  return gps.every((gp) => gp.finalStack !== null)
}

export function tableBalance(gps: GamePlayerLike[]): number {
  return totalCounted(gps) - totalInPlay(gps)
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rem = abs % 100
  if (rem === 0) return `${sign}$${dollars}`
  return `${sign}$${dollars}.${String(rem).padStart(2, '0')}`
}

// Plain dollars string for form inputs: 2000 -> "20", 2050 -> "20.50". No floats.
export function centsToDollarInput(cents: number): string {
  const dollars = Math.floor(cents / 100)
  const rem = cents % 100
  return rem === 0 ? String(dollars) : `${dollars}.${String(rem).padStart(2, '0')}`
}

// String-based parsing: the input never touches floating point.
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  return parseInt(whole, 10) * 100 + (frac ? parseInt(frac.padEnd(2, '0'), 10) : 0)
}

// Like parseDollarsToCents but accepts a leading minus, for manual adjustments.
export function parseSignedDollarsToCents(input: string): number | null {
  const trimmed = input.trim()
  const neg = trimmed.startsWith('-')
  const magnitude = parseDollarsToCents(neg ? trimmed.slice(1) : trimmed)
  if (magnitude === null) return null
  return neg ? -magnitude : magnitude
}
