import { describe, it, expect } from 'vitest'
import {
  totalIn, rebuyCount, profit, totalInPlay, totalCounted,
  allCounted, tableBalance, formatCents, parseDollarsToCents,
  centsToDollarInput, totalWinnings, foodSplit, finalCents,
  parseSignedDollarsToCents,
  type GamePlayerLike,
} from '@/lib/money'

const gp = (finalStack: number | null, ...amounts: number[]): GamePlayerLike => ({
  finalStack,
  buyIns: amounts.map((amount) => ({ amount })),
})

// A player whose profit is exactly `pokerCents`: one buy-in, final stack above it.
const withProfit = (pokerCents: number): GamePlayerLike => gp(10000 + pokerCents, 10000)

describe('totalIn', () => {
  it('sums a lone original buy-in', () => {
    expect(totalIn(gp(null, 2000))).toBe(2000)
  })
  it('sums varied-amount rebuys', () => {
    expect(totalIn(gp(null, 2000, 1000, 2500))).toBe(5500)
  })
  it('is 0 with no buy-ins', () => {
    expect(totalIn(gp(null))).toBe(0)
  })
})

describe('rebuyCount', () => {
  it('is 0 with only the original buy-in', () => {
    expect(rebuyCount(gp(null, 2000))).toBe(0)
  })
  it('counts rebuys after the original', () => {
    expect(rebuyCount(gp(null, 2000, 2000, 1000))).toBe(2)
  })
  it('never goes negative when all buy-ins were undone', () => {
    expect(rebuyCount(gp(null))).toBe(0)
  })
})

describe('profit', () => {
  it('is null before cash-out', () => {
    expect(profit(gp(null, 2000))).toBeNull()
  })
  it('computes a win', () => {
    expect(profit(gp(6500, 2000, 2000))).toBe(2500)
  })
  it('computes a loss', () => {
    expect(profit(gp(500, 2000))).toBe(-1500)
  })
  it('computes exact break-even', () => {
    expect(profit(gp(4000, 2000, 2000))).toBe(0)
  })
})

describe('table totals', () => {
  const players = [gp(6500, 2000, 2000), gp(500, 2000), gp(null, 2000)]

  it('totalInPlay sums everyone including uncounted', () => {
    expect(totalInPlay(players)).toBe(8000)
  })
  it('totalCounted treats uncounted players as 0', () => {
    expect(totalCounted(players)).toBe(7000)
  })
  it('allCounted is false during partial cash-out', () => {
    expect(allCounted(players)).toBe(false)
  })
  it('tableBalance is negative while chips remain uncounted', () => {
    expect(tableBalance(players)).toBe(-1000)
  })
  it('tableBalance is 0 when the table balances', () => {
    expect(tableBalance([gp(3000, 2000), gp(1000, 2000)])).toBe(0)
  })
  it('tableBalance is positive when overcounted', () => {
    expect(tableBalance([gp(4500, 2000), gp(0, 2000)])).toBe(500)
  })
})

describe('formatCents', () => {
  it('formats whole dollars without decimals', () => {
    expect(formatCents(2000)).toBe('$20')
  })
  it('formats cents with two digits', () => {
    expect(formatCents(2050)).toBe('$20.50')
    expect(formatCents(5)).toBe('$0.05')
  })
  it('formats negatives with leading minus', () => {
    expect(formatCents(-350)).toBe('-$3.50')
  })
})

describe('parseDollarsToCents', () => {
  it('parses whole dollars, decimals, and a leading $', () => {
    expect(parseDollarsToCents('20')).toBe(2000)
    expect(parseDollarsToCents('20.5')).toBe(2050)
    expect(parseDollarsToCents('$20.50')).toBe(2050)
    expect(parseDollarsToCents(' 0 ')).toBe(0)
  })
  it('rejects negatives, >2 decimals, and garbage', () => {
    expect(parseDollarsToCents('-5')).toBeNull()
    expect(parseDollarsToCents('1.234')).toBeNull()
    expect(parseDollarsToCents('abc')).toBeNull()
    expect(parseDollarsToCents('')).toBeNull()
  })
  it('never float-drifts: parse→format round-trips across a full game', () => {
    const amounts = ['0.01', '0.10', '20.30', '19.99', '100.05']
    const cents = amounts.map((a) => parseDollarsToCents(a)!)
    expect(cents).toEqual([1, 10, 2030, 1999, 10005])
    expect(cents.reduce((s, c) => s + c, 0)).toBe(14045)
    expect(formatCents(14045)).toBe('$140.45')
  })
})

describe('parseSignedDollarsToCents', () => {
  it('parses positive and negative adjustments', () => {
    expect(parseSignedDollarsToCents('5')).toBe(500)
    expect(parseSignedDollarsToCents('-5')).toBe(-500)
    expect(parseSignedDollarsToCents('-12.50')).toBe(-1250)
    expect(parseSignedDollarsToCents('0')).toBe(0)
  })
  it('rejects garbage', () => {
    expect(parseSignedDollarsToCents('--5')).toBeNull()
    expect(parseSignedDollarsToCents('abc')).toBeNull()
  })
})

describe('totalWinnings', () => {
  it('sums only positive profits, ignoring losers and uncounted', () => {
    expect(totalWinnings([withProfit(20550), withProfit(-26800), gp(null, 10000)])).toBe(20550)
  })
})

describe('foodSplit', () => {
  // Screenshot 2: bill ($187.25) exceeds 25% of winnings, so winners are capped
  // at 25% and the leftover is split evenly across all 9 players.
  it('caps winners at 25% and splits the remainder evenly (bill > 25%)', () => {
    const players = [
      withProfit(20550), withProfit(-26800), withProfit(-4150), withProfit(-17000),
      withProfit(9500), withProfit(1450), withProfit(5700), withProfit(16100),
      withProfit(-5350),
    ]
    const shares = foodSplit(players, 18725)
    // Winnings = 533.00; 25% = 133.25; remainder = 54.00 → 6.00 each of 9.
    expect(shares.every((s) => s.equalCents === 600)).toBe(true)
    expect(shares[0].winnerCents).toBe(5138) // Sridhar 51.38
    expect(shares[4].winnerCents).toBe(2375) // Pradeep 23.75
    expect(shares[5].winnerCents).toBe(363) // Ashwin 3.63
    expect(shares[7].winnerCents).toBe(4025) // Amit 40.25
    expect(shares[1].winnerCents).toBe(0) // loser pays no winner share
  })

  // Screenshot 1: bill ($188.91) is under 25% of winnings, so winners cover the
  // whole bill pro-rata and losers pay nothing.
  it('winners cover the whole bill pro-rata when under 25% (losers pay 0)', () => {
    const players = [
      withProfit(11750), withProfit(9500), withProfit(21850), withProfit(38500),
      withProfit(6700), withProfit(-14500),
    ]
    const shares = foodSplit(players, 18891)
    expect(shares.every((s) => s.equalCents === 0)).toBe(true) // nothing left over
    expect(shares[0].winnerCents).toBe(2514) // Sridhar 25.14
    expect(shares[3].winnerCents).toBe(8237) // Shiva 82.37
    expect(shares[5].winnerCents).toBe(0) // loser
  })

  it('handles a bill with no winners by splitting it all evenly', () => {
    const players = [withProfit(-1000), withProfit(-2000)]
    const shares = foodSplit(players, 3000)
    expect(shares).toEqual([
      { winnerCents: 0, equalCents: 1500 },
      { winnerCents: 0, equalCents: 1500 },
    ])
  })
})

describe('finalCents', () => {
  it('is poker profit minus food owed plus adjustment', () => {
    const player = withProfit(20550)
    expect(finalCents(player, { winnerCents: 5138, equalCents: 600 }, 0)).toBe(14812)
    expect(finalCents(player, { winnerCents: 5138, equalCents: 600 }, 500)).toBe(15312)
    expect(finalCents(player, null, -300)).toBe(20250)
  })
  it('is null when the player has not cashed out', () => {
    expect(finalCents(gp(null, 10000), null, 0)).toBeNull()
  })
})

describe('centsToDollarInput', () => {
  it('formats whole dollars without decimals', () => {
    expect(centsToDollarInput(2000)).toBe('20')
  })
  it('formats cents with two digits', () => {
    expect(centsToDollarInput(2050)).toBe('20.50')
  })
  it('pads sub-ten cents', () => {
    expect(centsToDollarInput(5)).toBe('0.05')
  })
  it('formats zero as a bare 0', () => {
    expect(centsToDollarInput(0)).toBe('0')
  })
})
