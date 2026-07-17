import { formatCents } from '@/lib/money'

export type ResultRow = {
  name: string
  totalInCents: number
  rebuys: number
  finalStackCents: number | null
  profitCents: number | null
}

export function ResultsTable({ players }: { players: ResultRow[] }) {
  const sorted = [...players].sort((a, b) => (b.profitCents ?? 0) - (a.profitCents ?? 0))
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-neutral-400">
          <th className="p-2">Player</th>
          <th className="p-2 text-right">In</th>
          <th className="p-2 text-right">Stack</th>
          <th className="p-2 text-right">Profit</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((p) => (
          <tr key={p.name} className="border-t border-neutral-800">
            <td className="p-2">{p.name}</td>
            <td className="p-2 text-right">{formatCents(p.totalInCents)}</td>
            <td className="p-2 text-right">{p.finalStackCents === null ? '—' : formatCents(p.finalStackCents)}</td>
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
    </table>
  )
}
