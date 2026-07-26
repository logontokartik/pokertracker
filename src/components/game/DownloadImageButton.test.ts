import { describe, it, expect } from 'vitest'
import { buildColumns, buildFooter } from '@/components/game/DownloadImageButton'
import type { ResultRow } from '@/lib/results'

const settled: ResultRow[] = [
  {
    name: 'Sridhar',
    totalInCents: 9000,
    rebuys: 0,
    finalStackCents: 38750,
    profitCents: 29750,
    foodWinnerCents: 7438,
    foodEqualCents: 1236,
    miscAdjCents: 0,
    finalCents: 21076,
  },
  {
    name: 'Srini',
    totalInCents: 24000,
    rebuys: 3,
    finalStackCents: 9950,
    profitCents: -14050,
    foodWinnerCents: 0,
    foodEqualCents: 1236,
    miscAdjCents: -500,
    finalCents: -15786,
  },
]

const text = (columns: ReturnType<typeof buildColumns>, label: string) => {
  const col = columns.find((c) => c.label === label)!
  return { cells: col.cells.map((c) => c.text), total: col.total?.text ?? null }
}

describe('buildColumns (downloaded image)', () => {
  it('keeps the two food shares in separate columns', () => {
    const columns = buildColumns(settled, true)
    expect(text(columns, 'Food winners')).toEqual({ cells: ['$74.38', '$0'], total: '$74.38' })
    expect(text(columns, 'Food remaining')).toEqual({ cells: ['$12.36', '$12.36'], total: '$24.72' })
  })

  it('sorts by final settlement and totals every money column', () => {
    const columns = buildColumns(settled, true)
    expect(text(columns, 'Name').cells).toEqual(['Sridhar', 'Srini'])
    expect(text(columns, 'Final')).toEqual({ cells: ['$210.76', '-$157.86'], total: '$52.90' })
    expect(text(columns, 'Total taken').total).toBe('$330')
    expect(text(columns, 'Misc. adj').cells).toEqual(['—', '-$5'])
  })

  it('flags the leftover when poker profits do not net to zero', () => {
    // $10 more counted than bought in — the Poker final column totals +$10, not zero.
    const over = settled.map((r, i) =>
      i === 0 ? { ...r, finalStackCents: 39750, profitCents: 30750 } : r
    )
    const lines = buildFooter(over, 21400, true, true).map((l) => l.text)
    expect(lines).toEqual([
      'Food bill $214',
      'Charged to players $99.10 ($74.38 winners + $24.72 remaining)',
      "Unaccounted $167 over — chips counted don't match buy-ins",
    ])
  })

  it('says short when buy-ins exceed the chips counted, and stays quiet when balanced', () => {
    const short = settled.map((r, i) =>
      i === 0 ? { ...r, finalStackCents: 21400, profitCents: 12400 } : r
    )
    expect(buildFooter(short, null, true, true).map((l) => l.text)).toEqual([
      "Unaccounted $16.50 short — chips counted don't match buy-ins",
    ])
    const balanced = settled.map((r, i) =>
      i === 0 ? { ...r, finalStackCents: 23050, profitCents: 14050 } : r
    )
    expect(buildFooter(balanced, null, true, true)).toEqual([])
  })

  it('stays quiet about unaccounted money while players are still cashing out', () => {
    expect(buildFooter(settled, null, true, false)).toEqual([])
  })

  it('drops the settlement columns and the totals row for an in-progress game', () => {
    const rows: ResultRow[] = [
      { name: 'Raju', totalInCents: 6000, rebuys: 0, finalStackCents: 10200, profitCents: 4200 },
      { name: 'Ryan', totalInCents: 6000, rebuys: 0, finalStackCents: null, profitCents: null },
    ]
    const columns = buildColumns(rows, false)
    expect(columns.map((c) => c.label)).toEqual(['Name', 'Total taken', 'Balance', 'Profit'])
    expect(text(columns, 'Balance').cells).toEqual(['$102', '—'])
    expect(columns.every((c) => c.total === null)).toBe(true)
  })
})
