import { describe, it, expect } from 'vitest'
import { sumResultRows, type ResultRow } from '@/components/game/ResultsTable'

const row = (
  totalInCents: number,
  finalStackCents: number | null,
  profitCents: number | null
): ResultRow => ({ name: 'x', totalInCents, rebuys: 0, finalStackCents, profitCents })

describe('sumResultRows', () => {
  it('sums a balanced finished game to zero profit (the reported "$370" case, in cents)', () => {
    const rows = [
      row(4000, 20000, 16000),
      row(4000, 6000, 2000),
      row(4000, 4500, 500),
      row(8000, 5500, -2500),
      row(4000, 0, -4000),
      row(12000, 0, -12000),
    ]
    expect(sumResultRows(rows)).toEqual({ buyIns: 36000, cashOut: 36000, profit: 0 })
  })

  it('treats an uncounted (null) player as zero in cashOut/profit, but still counts their buy-ins', () => {
    const rows = [row(2000, 3000, 1000), row(2000, null, null)]
    expect(sumResultRows(rows)).toEqual({ buyIns: 4000, cashOut: 3000, profit: 1000 })
  })

  it('returns all zeros for an empty table', () => {
    expect(sumResultRows([])).toEqual({ buyIns: 0, cashOut: 0, profit: 0 })
  })
})
