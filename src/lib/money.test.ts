import { describe, it, expect } from 'vitest'
import {
  totalIn, rebuyCount, profit, totalInPlay, totalCounted,
  allCounted, tableBalance, formatCents, parseDollarsToCents,
  centsToDollarInput,
  type GamePlayerLike,
} from '@/lib/money'

const gp = (finalStack: number | null, ...amounts: number[]): GamePlayerLike => ({
  finalStack,
  buyIns: amounts.map((amount) => ({ amount })),
})

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
