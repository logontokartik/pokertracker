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
