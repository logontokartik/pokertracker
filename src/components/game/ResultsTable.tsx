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

const dash = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '—' : formatCents(cents)

export function ResultsTable({
  players,
  foodBillCents = null,
}: {
  players: ResultRow[]
  foodBillCents?: number | null
}) {
  const settle = players.some((r) => r.finalCents !== undefined)
  const sorted = [...players].sort((a, b) =>
    settle
      ? (b.finalCents ?? 0) - (a.finalCents ?? 0)
      : (b.profitCents ?? 0) - (a.profitCents ?? 0)
  )
  const totals = sumResultRows(players)
  const allCashedOut = players.every((r) => r.finalStackCents !== null)
  const foodWinnerTotal = players.reduce((s, r) => s + (r.foodWinnerCents ?? 0), 0)
  const foodEqualTotal = players.reduce((s, r) => s + (r.foodEqualCents ?? 0), 0)
  const finalTotal = players.reduce((s, r) => s + (r.finalCents ?? 0), 0)
  const foodCharged = foodWinnerTotal + foodEqualTotal
  // Equal shares are rounded per player, so the charged total can drift a cent or two.
  const foodRounding = foodCharged - (foodBillCents ?? 0)
  const showFood = settle && foodBillCents !== null
  // Poker profits must net to zero once everyone has cashed out; anything left over
  // means the chips counted don't match what was bought in.
  const unaccounted = allCashedOut ? totals.profit : 0

  return (
    <div>
      {/* Phone: one block per player so nothing is ever cut off horizontally. */}
      <div className="flex flex-col gap-2 sm:hidden">
        {sorted.map((p) => (
          <div
            key={p.name}
            className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-neutral-50">{p.name}</span>
              <span
                className={`text-base font-semibold ${signed(settle ? p.finalCents : p.profitCents)}`}
              >
                {dash(settle ? p.finalCents : p.profitCents)}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-400">
              <Field label="Total taken" value={formatCents(p.totalInCents)} />
              <Field label="Balance" value={dash(p.finalStackCents)} />
              {settle && (
                <>
                  <Field label="Poker final" value={dash(p.profitCents)} />
                  <Field label="Food winners" value={formatCents(p.foodWinnerCents ?? 0)} />
                  <Field label="Food remaining" value={formatCents(p.foodEqualCents ?? 0)} />
                  <Field
                    label="Misc. adj"
                    value={p.miscAdjCents ? formatCents(p.miscAdjCents) : '—'}
                  />
                </>
              )}
            </dl>
          </div>
        ))}
        {allCashedOut && (
          <div className="flex items-baseline justify-between gap-3 border-t-2 border-neutral-700 px-3 pt-3 text-sm font-semibold text-neutral-200">
            <span>Total</span>
            <span className="flex gap-4">
              <span className="text-neutral-400">taken {formatCents(totals.buyIns)}</span>
              <span className={signed(settle ? finalTotal : totals.profit)}>
                {formatCents(settle ? finalTotal : totals.profit)}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Tablet and up: the full spreadsheet-style grid. */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full whitespace-nowrap text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-neutral-400">
              <th className="p-1.5 sm:p-2">Name</th>
              <th className="p-1.5 text-right sm:p-2">Total taken</th>
              <th className="p-1.5 text-right sm:p-2">Balance</th>
              <th className="p-1.5 text-right sm:p-2">{settle ? 'Poker final' : 'Profit'}</th>
              {settle && (
                <>
                  <th className="p-1.5 text-right sm:p-2">Food winners</th>
                  <th className="p-1.5 text-right sm:p-2">Food remaining</th>
                  <th className="p-1.5 text-right sm:p-2">Misc. adj</th>
                  <th className="p-1.5 text-right sm:p-2">Final</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.name} className="border-t border-neutral-800">
                <td className="p-1.5 font-medium text-neutral-50 sm:p-2">{p.name}</td>
                <td className="p-1.5 text-right sm:p-2">{formatCents(p.totalInCents)}</td>
                <td className="p-1.5 text-right sm:p-2">{dash(p.finalStackCents)}</td>
                <td
                  className={`p-1.5 text-right sm:p-2 ${settle ? 'text-neutral-300' : `font-semibold ${signed(p.profitCents)}`}`}
                >
                  {dash(p.profitCents)}
                </td>
                {settle && (
                  <>
                    <td className="p-1.5 text-right text-neutral-400 sm:p-2">
                      {formatCents(p.foodWinnerCents ?? 0)}
                    </td>
                    <td className="p-1.5 text-right text-neutral-400 sm:p-2">
                      {formatCents(p.foodEqualCents ?? 0)}
                    </td>
                    <td className="p-1.5 text-right text-neutral-400 sm:p-2">
                      {p.miscAdjCents ? formatCents(p.miscAdjCents) : '—'}
                    </td>
                    <td className={`p-1.5 text-right font-semibold sm:p-2 ${signed(p.finalCents)}`}>
                      {dash(p.finalCents)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          {allCashedOut && (
            <tfoot>
              <tr className="border-t-2 border-neutral-700 font-semibold text-neutral-200">
                <td className="p-1.5 sm:p-2">Total</td>
                <td className="p-1.5 text-right sm:p-2">{formatCents(totals.buyIns)}</td>
                <td className="p-1.5 text-right sm:p-2">{formatCents(totals.cashOut)}</td>
                <td
                  className={`p-1.5 text-right sm:p-2 ${totals.profit === 0 ? '' : 'text-red-500'}`}
                >
                  {formatCents(totals.profit)}
                </td>
                {settle && (
                  <>
                    <td className="p-1.5 text-right text-neutral-400 sm:p-2">
                      {formatCents(foodWinnerTotal)}
                    </td>
                    <td className="p-1.5 text-right text-neutral-400 sm:p-2">
                      {formatCents(foodEqualTotal)}
                    </td>
                    <td className="p-1.5 text-right sm:p-2" />
                    <td className={`p-1.5 text-right sm:p-2 ${signed(finalTotal)}`}>
                      {formatCents(finalTotal)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {(showFood || unaccounted !== 0) && (
        <div className="mt-3 flex flex-col gap-1 border-t border-neutral-800 pt-3 text-xs text-neutral-400">
          {showFood && (
            <>
              <div className="flex justify-between gap-3">
                <span>Food bill</span>
                <span className="font-medium text-neutral-200">{formatCents(foodBillCents!)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Charged to players</span>
                <span>
                  {formatCents(foodCharged)} ({formatCents(foodWinnerTotal)} winners +{' '}
                  {formatCents(foodEqualTotal)} remaining)
                  {foodRounding !== 0 && `, incl. ${formatCents(foodRounding)} rounding`}
                </span>
              </div>
            </>
          )}
          {unaccounted !== 0 && (
            <div className="flex justify-between gap-3">
              <span>Unaccounted</span>
              <span className="font-medium text-red-500">
                {formatCents(Math.abs(unaccounted))} {unaccounted > 0 ? 'over' : 'short'} — chips
                counted don&apos;t match buy-ins
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="text-neutral-300">{value}</dd>
    </div>
  )
}
