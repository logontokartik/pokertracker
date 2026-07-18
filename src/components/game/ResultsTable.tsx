import { formatCents } from '@/lib/money'
import type { ResultRow } from '@/lib/results'

export type { ResultRow } from '@/lib/results'

export function sumResultRows(rows: ResultRow[]): { buyIns: number; cashOut: number; profit: number } {
  return rows.reduce(
    (acc, r) => ({
      buyIns: acc.buyIns + r.totalInCents,
      cashOut: acc.cashOut + (r.finalStackCents ?? 0),
      profit: acc.profit + (r.profitCents ?? 0),
    }),
    { buyIns: 0, cashOut: 0, profit: 0 }
  )
}

const signed = (cents: number | null | undefined) =>
  cents === null || cents === undefined
    ? ''
    : cents >= 0
      ? 'text-emerald-500'
      : 'text-red-500'

export function ResultsTable({ players }: { players: ResultRow[] }) {
  const settle = players.some((r) => r.finalCents !== undefined)
  const sorted = [...players].sort((a, b) =>
    settle
      ? (b.finalCents ?? 0) - (a.finalCents ?? 0)
      : (b.profitCents ?? 0) - (a.profitCents ?? 0)
  )
  const totals = sumResultRows(players)
  const allCashedOut = players.every((r) => r.finalStackCents !== null)
  const foodTotal = players.reduce((s, r) => s + (r.foodWinnerCents ?? 0) + (r.foodEqualCents ?? 0), 0)
  const finalTotal = players.reduce((s, r) => s + (r.finalCents ?? 0), 0)

  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Player</th>
            <th className="p-2 text-right">Buy-ins</th>
            <th className="p-2 text-right">Cash out</th>
            <th className="p-2 text-right">{settle ? 'Poker' : 'Profit'}</th>
            {settle && (
              <>
                <th className="p-2 text-right">Food</th>
                <th className="p-2 text-right">Adj</th>
                <th className="p-2 text-right">Final</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.name} className="border-t border-neutral-800">
              <td className="p-2 font-medium text-neutral-50">{p.name}</td>
              <td className="p-2 text-right">{formatCents(p.totalInCents)}</td>
              <td className="p-2 text-right">
                {p.finalStackCents === null ? '—' : formatCents(p.finalStackCents)}
              </td>
              <td className={`p-2 text-right ${settle ? 'text-neutral-300' : `font-semibold ${signed(p.profitCents)}`}`}>
                {p.profitCents === null ? '—' : formatCents(p.profitCents)}
              </td>
              {settle && (
                <>
                  <td className="p-2 text-right text-neutral-400">
                    {formatCents((p.foodWinnerCents ?? 0) + (p.foodEqualCents ?? 0))}
                  </td>
                  <td className="p-2 text-right text-neutral-400">
                    {p.miscAdjCents ? formatCents(p.miscAdjCents) : '—'}
                  </td>
                  <td className={`p-2 text-right font-semibold ${signed(p.finalCents)}`}>
                    {p.finalCents === null || p.finalCents === undefined ? '—' : formatCents(p.finalCents)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        {allCashedOut && (
          <tfoot>
            <tr className="border-t-2 border-neutral-700 font-semibold text-neutral-200">
              <td className="p-2">Total</td>
              <td className="p-2 text-right">{formatCents(totals.buyIns)}</td>
              <td className="p-2 text-right">{formatCents(totals.cashOut)}</td>
              <td className={`p-2 text-right ${signed(totals.profit)}`}>{formatCents(totals.profit)}</td>
              {settle && (
                <>
                  <td className="p-2 text-right text-neutral-400">{formatCents(foodTotal)}</td>
                  <td className="p-2 text-right" />
                  <td className={`p-2 text-right ${signed(finalTotal)}`}>{formatCents(finalTotal)}</td>
                </>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
