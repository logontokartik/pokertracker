'use client'

import { useState } from 'react'
import { formatCents } from '@/lib/money'
import type { ResultRow } from '@/lib/results'

// The results as a PNG: drawn straight onto a canvas rather than screenshotting the
// DOM, so every column is in the image at full width no matter how narrow the phone is.

const FONT = 'Arial, Helvetica, sans-serif'
const PAD = 24
const ROW_H = 30
const COL_GAP = 22
const SCALE = 2

const INK = '#111827'
const MUTED = '#6b7280'
const RULE = '#d1d5db'
const POS = '#067647'
const NEG = '#b42318'

type Cell = { text: string; color: string; bold?: boolean }
type Column = { label: string; align: 'left' | 'right'; cells: Cell[]; total: Cell | null }

const money = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? '—' : formatCents(cents)

const tone = (cents: number | null | undefined) =>
  cents === null || cents === undefined ? INK : cents >= 0 ? POS : NEG

export function DownloadImageButton({
  players,
  foodBillCents = null,
  title,
  subtitle,
  filename,
}: {
  players: ResultRow[]
  foodBillCents?: number | null
  title: string
  subtitle: string
  filename: string
}) {
  const [busy, setBusy] = useState(false)

  return (
    <button
      className="inline-flex min-h-11 items-center text-sm text-neutral-400 underline active:text-neutral-200"
      onClick={() => {
        setBusy(true)
        try {
          const canvas = renderResults({ players, foodBillCents, title, subtitle })
          canvas.toBlob((blob) => {
            setBusy(false)
            if (!blob) return
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            a.click()
            URL.revokeObjectURL(url)
          }, 'image/png')
        } catch {
          setBusy(false)
        }
      }}
    >
      {busy ? 'Saving…' : 'Download image'}
    </button>
  )
}

export function buildColumns(players: ResultRow[], settle: boolean): Column[] {
  const sorted = [...players].sort((a, b) =>
    settle
      ? (b.finalCents ?? 0) - (a.finalCents ?? 0)
      : (b.profitCents ?? 0) - (a.profitCents ?? 0)
  )
  const allCashedOut = players.every((r) => r.finalStackCents !== null)
  const sum = (pick: (r: ResultRow) => number | null | undefined) =>
    players.reduce((s, r) => s + (pick(r) ?? 0), 0)

  const plain = (text: string, color = INK): Cell => ({ text, color })
  const totalCell = (cents: number, color = INK): Cell | null =>
    allCashedOut ? { text: formatCents(cents), color, bold: true } : null

  const columns: Column[] = [
    {
      label: 'Name',
      align: 'left',
      cells: sorted.map((r) => ({ text: r.name, color: INK, bold: true })),
      total: allCashedOut ? { text: 'Total', color: INK, bold: true } : null,
    },
    {
      label: 'Total taken',
      align: 'right',
      cells: sorted.map((r) => plain(formatCents(r.totalInCents))),
      total: totalCell(sum((r) => r.totalInCents)),
    },
    {
      label: 'Balance',
      align: 'right',
      cells: sorted.map((r) => plain(money(r.finalStackCents))),
      total: totalCell(sum((r) => r.finalStackCents)),
    },
    {
      label: settle ? 'Poker final' : 'Profit',
      align: 'right',
      cells: sorted.map((r) =>
        settle
          ? plain(money(r.profitCents))
          : { text: money(r.profitCents), color: tone(r.profitCents), bold: true }
      ),
      total: totalCell(sum((r) => r.profitCents), tone(sum((r) => r.profitCents))),
    },
  ]

  if (settle) {
    columns.push(
      {
        label: 'Food winners',
        align: 'right',
        cells: sorted.map((r) => plain(formatCents(r.foodWinnerCents ?? 0), MUTED)),
        total: totalCell(sum((r) => r.foodWinnerCents), MUTED),
      },
      {
        label: 'Food remaining',
        align: 'right',
        cells: sorted.map((r) => plain(formatCents(r.foodEqualCents ?? 0), MUTED)),
        total: totalCell(sum((r) => r.foodEqualCents), MUTED),
      },
      {
        label: 'Misc. adj',
        align: 'right',
        cells: sorted.map((r) => plain(r.miscAdjCents ? formatCents(r.miscAdjCents) : '—', MUTED)),
        total: allCashedOut ? { text: '', color: MUTED } : null,
      },
      {
        label: 'Final',
        align: 'right',
        cells: sorted.map((r) => ({
          text: money(r.finalCents),
          color: tone(r.finalCents),
          bold: true,
        })),
        total: totalCell(sum((r) => r.finalCents), tone(sum((r) => r.finalCents))),
      }
    )
  }

  return columns
}

function renderResults({
  players,
  foodBillCents,
  title,
  subtitle,
}: {
  players: ResultRow[]
  foodBillCents: number | null
  title: string
  subtitle: string
}): HTMLCanvasElement {
  const settle = players.some((r) => r.finalCents !== undefined)
  const columns = buildColumns(players, settle)
  const rowCount = players.length
  const hasTotals = columns[0].total !== null

  const foodWinnerTotal = players.reduce((s, r) => s + (r.foodWinnerCents ?? 0), 0)
  const foodEqualTotal = players.reduce((s, r) => s + (r.foodEqualCents ?? 0), 0)
  const foodCharged = foodWinnerTotal + foodEqualTotal
  const footer =
    settle && foodBillCents !== null
      ? [
          `Food bill ${formatCents(foodBillCents)}`,
          `Charged to players ${formatCents(foodCharged)} (${formatCents(foodWinnerTotal)} winners + ${formatCents(foodEqualTotal)} remaining)`,
        ]
      : []

  // Measure first on a throwaway context, then size the real canvas to fit.
  const measure = document.createElement('canvas').getContext('2d')!
  const widths = columns.map((col) => {
    measure.font = `bold 15px ${FONT}`
    let w = measure.measureText(col.label).width
    for (const cell of [...col.cells, ...(col.total ? [col.total] : [])]) {
      measure.font = `${cell.bold ? 'bold ' : ''}15px ${FONT}`
      w = Math.max(w, measure.measureText(cell.text).width)
    }
    return Math.ceil(w)
  })

  const tableWidth = widths.reduce((a, b) => a + b, 0) + COL_GAP * (columns.length - 1)
  measure.font = `bold 22px ${FONT}`
  const titleWidth = measure.measureText(title).width
  measure.font = `14px ${FONT}`
  const headWidth = Math.max(
    titleWidth,
    measure.measureText(subtitle).width,
    ...footer.map((line) => measure.measureText(line).width)
  )

  const width = Math.ceil(Math.max(tableWidth, headWidth)) + PAD * 2
  const tableTop = PAD + 28 + 22 + 14
  const tableHeight = ROW_H * (1 + rowCount + (hasTotals ? 1 : 0))
  const height = tableTop + tableHeight + (footer.length ? 14 + footer.length * 20 : 0) + PAD

  const canvas = document.createElement('canvas')
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'middle'

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = INK
  ctx.font = `bold 22px ${FONT}`
  ctx.textAlign = 'left'
  ctx.fillText(title, PAD, PAD + 12)
  ctx.fillStyle = MUTED
  ctx.font = `14px ${FONT}`
  ctx.fillText(subtitle, PAD, PAD + 38)

  // Column x offsets: left edge for left-aligned text, right edge for the rest.
  const xs: number[] = []
  let cursor = PAD
  for (const w of widths) {
    xs.push(cursor)
    cursor += w + COL_GAP
  }

  const drawRow = (y: number, cell: (i: number) => Cell | null, headerRow = false) => {
    columns.forEach((col, i) => {
      const c = headerRow ? { text: col.label, color: MUTED, bold: false } : cell(i)
      if (!c) return
      ctx.fillStyle = c.color
      ctx.font = `${c.bold ? 'bold ' : ''}15px ${FONT}`
      ctx.textAlign = col.align
      ctx.fillText(c.text, col.align === 'left' ? xs[i] : xs[i] + widths[i], y)
    })
  }

  const rule = (y: number, strong = false) => {
    ctx.strokeStyle = strong ? MUTED : RULE
    ctx.lineWidth = strong ? 1.5 : 1
    ctx.beginPath()
    ctx.moveTo(PAD, y)
    ctx.lineTo(width - PAD, y)
    ctx.stroke()
  }

  drawRow(tableTop + ROW_H / 2, () => null, true)
  rule(tableTop + ROW_H)

  for (let r = 0; r < rowCount; r++) {
    const y = tableTop + ROW_H * (r + 1)
    drawRow(y + ROW_H / 2, (i) => columns[i].cells[r] ?? null)
    if (r < rowCount - 1) rule(y + ROW_H)
  }

  if (hasTotals) {
    const y = tableTop + ROW_H * (rowCount + 1)
    rule(y, true)
    drawRow(y + ROW_H / 2, (i) => columns[i].total)
  }

  if (footer.length) {
    ctx.fillStyle = MUTED
    ctx.font = `14px ${FONT}`
    ctx.textAlign = 'left'
    footer.forEach((line, i) => {
      ctx.fillText(line, PAD, tableTop + tableHeight + 20 + i * 20)
    })
  }

  return canvas
}
