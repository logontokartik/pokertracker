import { formatCents } from '@/lib/money'

export type ResultRow = {
  name: string
  totalInCents: number
  rebuys: number
  finalStackCents: number | null
  profitCents: number | null
}

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

export function ResultsTable({ players }: { players: ResultRow[] }) {
  const sorted = [...players].sort((a, b) => (b.profitCents ?? 0) - (a.profitCents ?? 0))
  const totals = sumResultRows(players)
  const allCashedOut = players.every((r) => r.finalStackCents !== null)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Player</th>
            <th className="p-2 text-right">Buy-ins</th>
            <th className="p-2 text-right">Cash out</th>
            <th className="p-2 text-right">Profit</th>
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
              <td
                className={`p-2 text-right font-semibold ${
                  p.profitCents === null ? '' : p.profitCents >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {p.profitCents === null ? '—' : formatCents(p.profitCents)}
              </td>
            </tr>
          ))}
        </tbody>
        {allCashedOut && (
          <tfoot>
            <tr className="border-t-2 border-neutral-700 font-semibold text-neutral-200">
              <td className="p-2">Total</td>
              <td className="p-2 text-right">{formatCents(totals.buyIns)}</td>
              <td className="p-2 text-right">{formatCents(totals.cashOut)}</td>
              <td className={`p-2 text-right ${totals.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatCents(totals.profit)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
