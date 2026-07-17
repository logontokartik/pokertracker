# UI Polish Pass — Design

**Date:** 2026-07-17
**Status:** Approved

## Purpose

The app is live on Vercel and functionally correct, but reads as unfinished: it
partially follows the phone's system theme with styling that only assumes
dark mode, spacing is cramped on mobile, one control overflows its container,
copy is slightly wrong in one place, and the results table is easy to
misread as wrong even though the underlying math is correct. This pass
fixes all of that without adding a component library or changing any
derivation logic in `@/lib/money`.

## Confirmed non-bug

Investigating the "$370 vs $360" report: recomputed both columns from the
reported screenshot by hand. Buy-ins summed to $360, cash-out stacks summed
to $360, profits summed to $0 — all correct. `@/lib/money` is not touched by
this spec. The confusion was a human addition error, made easy by having no
totals row to check against and a results table that's easy to misread.

## Scope

All seven screens (`/login`, `/`, `/game/new`, `/game/[id]`, `/players`,
`/stats`, `/v/[slug]`). Pure Tailwind, no new dependencies. Explicitly out of
scope: replacing native `confirm()`/`prompt()` dialogs, toasts, any change to
`src/lib/money.ts`'s derivations.

## 1. Bug fixes

**Login placeholder.** `src/app/login/page.tsx`: the password input's
placeholder reads "Edit password" instead of "Enter password" — one-line
copy fix.

**Buy-in control overflow.** `src/components/game/LivePlayerRow.tsx`'s
expanded panel currently lays the amount input and the Rebuy/Undo buttons
out in a single flex row. The input can't shrink below its content width,
the buttons don't shrink at all, and together they exceed the actual
content width once page padding and card padding are subtracted from a
narrow phone screen — that's the overflow. Fix: stack the panel into two
rows — the amount input full-width on its own row, then Rebuy/Undo/Remove
as three equal-width (`flex-1`) buttons in a row beneath it. Equal-width
flex children shrink together, so this can't overflow regardless of screen
width. Error text moves to its own line below, never sharing a row with
the input or buttons.

**Same root cause, same fix, in `StackInput`.** Today's row is
`name (flex-1) + error (inline) + input (w-24) + display (w-14)` — four
things competing for one row's width, which starts to break with a long
player name or a long error message. Restructure to name + input on one
row, error on its own line beneath.

## 2. Simplification: remove the duplicate stack display

`StackInput` currently shows the chip count twice: the editable field
(showing what you typed, e.g. `20`) and a separate greyed-out read-only
label next to it once saved (`$20`). Two representations of one number, in
two formats, side by side — remove the read-only label; the input alone is
sufficient.

## 3. Results table clarity

`src/components/game/ResultsTable.tsx`:
- Rename headers: **In → Buy-ins**, **Stack → Cash out** (Profit and Player
  unchanged).
- Add a totals footer row: sum of Buy-ins, sum of Cash out, and sum of
  Profit. The profit total reads **$0** whenever `tableBalance` is zero —
  a visible checksum instead of one you compute by hand. Sums use the same
  `formatCents`/integer-cents arithmetic as every other total in the app;
  no new derivation, just `reduce` over the already-computed row values.
- Wrap the `<table>` in an `overflow-x-auto` div so a long name can never
  force the page itself to scroll sideways.

## 4. Visual system

**Dark-only theme.** `src/app/globals.css` currently defines a light
palette as `:root` default and overrides to dark only under
`prefers-color-scheme: dark` — but every component was hand-styled
assuming dark, so on a light-mode phone the app looks broken, not just
different. Remove the light variant and the media query; ship one dark
theme unconditionally; add `color-scheme: dark` so native form controls
(date pickers, etc., none currently in use, but cheap insurance) render
dark too.

**Spacing and touch targets.** Page padding and inter-element gaps increase
across every screen: page padding `p-4` → `p-5`, card padding `p-3`/`p-4` →
`p-4`, row/list gaps `gap-2` → `gap-3`, section gaps `gap-4` → `gap-5`
(matches the "a bit larger on mobile" request). Every tappable control gets
a real minimum touch target (44px), including
the rebuy `+` (grows from `size-12` to `size-14`, since it's the most-tapped
control), undo/remove/archive/rename, and checkboxes. Buttons gain
`active:` background/text-color states, since phones have no `:hover` and
today's buttons give zero visual feedback on tap.

**Typography.** Player names in list rows become larger and bolder
(`text-lg font-semibold`); secondary text (totals, dates, rebuy counts)
stays smaller and dimmer for hierarchy.

**Shared primitives.** Every page currently hand-rolls the same "centered
column, page padding, header row with a title and a right-aligned link"
markup slightly differently. Since every screen is being touched anyway,
three small shared components replace the duplication:

```ts
// src/components/ui/PageShell.tsx
// wraps <main>: mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-5

// src/components/ui/Card.tsx
// rounded-2xl border border-neutral-800 bg-neutral-900 p-4

// src/components/ui/PageHeader.tsx
// props: title, subtitle?, action? — replaces each page's repeated
// flex-items-center-justify-between header block
```

These are presentational only — no new behavior. `PageHeader`'s `action`
prop accepts any node, since the home page needs two links together
(roster + logout form) while other pages need just one ("home") or none
(`/login`).

**Tables get the same overflow safety net** as the results table: the
roster list and stats table also wrap their tabular content in
`overflow-x-auto`.

## Error handling

No new error paths — this is a presentational pass. The one behavior
change: error messages move from inline (sharing a row with inputs/buttons)
to block-level (their own line), everywhere they appear
(`LivePlayerRow`, `StackInput`, `NewGameForm`, `PlayerAdmin`, `/login`).
This is the actual fix for the overflow bug, not just a style preference.

## Testing

This is a styling and markup pass with one small piece of real logic: the
`ResultsTable` totals footer (sum of three already-computed columns). That
sum gets a unit-level check that it equals zero for a balanced game and
matches the sum of inputs otherwise — expressed as a plain function so it's
testable without rendering: `sumResultRows(rows): { buyIns, cashOut,
profit }` in `ResultsTable.tsx`, covered in a new `ResultsTable.test.ts`.
Everything else (spacing, colors, shared primitives) is verified by driving
the running app, not unit tests.

## Open questions

None.
