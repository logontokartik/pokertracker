# Poker Tracker — Design

**Date:** 2026-07-17
**Status:** Approved

## Purpose

A phone-friendly web app to track a recurring friendly poker game: who played, what
they bought in for, how many times they reloaded, and what each person won or lost.
One host runs it from their phone at the table; other players can watch a read-only
link.

## Scope

**In scope**
- Persistent player roster reused across games
- Start a game with a fixed default buy-in
- Record buy-ins and rebuys per player; rebuys may deviate from the default amount
- Cash out by counting final chips; app derives profit and validates the table balances
- Game history list
- Read-only share link per game
- Hidden lifetime player stats screen

**Out of scope**
- Settlement calculator (who pays whom). The host settles up by hand.
- Multi-tenant accounts, user registration, per-user data isolation
- Real-time push/websockets
- Native app packaging or app store distribution
- Tournament structures, blind timers, seat assignment, chip denominations

## Constraints

- Deploys to Vercel with a free-tier Postgres. Host has prior experience with this stack.
- Must be usable one-handed on a phone, at a table, possibly on poor wifi.
- Single tenant: one household's game, one shared edit password.

## Architecture

Next.js (App Router) on Vercel. Postgres via Prisma. Server Components for reads,
Server Actions for writes. No client state store and no separate API layer — at six
players and a few dozen taps per session, a Server Action plus revalidation is fast
enough and keeps one source of truth.

Single-tenant by decision. There is no `User` table, no ownership column, and no
row-level filtering. This holds only while the app serves one crew; introducing a
second host would require revisiting it.

## Auth

One password stored as an env var (`POKER_EDIT_PASSWORD`). A login form POSTs it;
the server compares and, on success, sets an httpOnly, signed, SameSite=Lax cookie.

**Every mutation re-checks the cookie server-side.** Hiding a button in the UI is not
an access control; the Server Action itself must reject an unauthenticated caller.
The stats route performs the same server-side check before rendering.

View links (`/v/[viewSlug]`) are intentionally public — unguessable, not
authenticated. Nothing sensitive lives in a game record.

## Data model

```prisma
model Player {
  id        String       @id @default(cuid())
  name      String       @unique
  archived  Boolean      @default(false)   // hidden from new-game picker, kept in history
  createdAt DateTime     @default(now())
  games     GamePlayer[]
}

model Game {
  id           String       @id @default(cuid())
  label        String?
  playedOn     DateTime     @default(now())
  defaultBuyIn Int                        // cents
  status       GameStatus   @default(ACTIVE)
  viewSlug     String       @unique       // unguessable, distinct from id
  createdAt    DateTime     @default(now())
  finishedAt   DateTime?
  players      GamePlayer[]
}

enum GameStatus { ACTIVE FINISHED }

model GamePlayer {
  id         String   @id @default(cuid())
  gameId     String
  playerId   String
  finalStack Int?                         // cents; null until cashed out
  game       Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  player     Player   @relation(fields: [playerId], references: [id])
  buyIns     BuyIn[]

  @@unique([gameId, playerId])
}

model BuyIn {
  id           String     @id @default(cuid())
  gamePlayerId String
  amount       Int                        // cents
  createdAt    DateTime   @default(now())
  gamePlayer   GamePlayer @relation(fields: [gamePlayerId], references: [id], onDelete: Cascade)
}
```

### Money representation

All money is stored as integer cents. Floats are not used for currency anywhere,
including intermediate computation.

### Why buy-ins are rows, not a counter

Rebuys may vary in amount, so a `rebuyCount` integer cannot represent reality. Each
buy-in is its own row: the earliest row for a `GamePlayer` is the original buy-in,
subsequent rows are rebuys. This yields a natural undo (delete the most recent row)
and a timeline of reload activity.

### Derived values (never stored)

| Value | Definition |
|---|---|
| `totalIn(gamePlayer)` | sum of `buyIns.amount` |
| `rebuyCount(gamePlayer)` | `buyIns.length - 1` |
| `profit(gamePlayer)` | `finalStack - totalIn`, null if `finalStack` is null |
| `totalInPlay(game)` | sum of `totalIn` across players |
| `totalCounted(game)` | sum of non-null `finalStack` across players |
| `tableBalance(game)` | `totalCounted - totalInPlay`; must be 0 to settle cleanly |

Persisting profit would let it drift out of sync with the buy-in rows. Deriving it
makes that class of bug impossible.

## Screens

| Route | Access | Purpose |
|---|---|---|
| `/` | password | Game history list; start new game |
| `/game/new` | password | Pick players from roster, add newcomers, set default buy-in |
| `/game/[id]` | password | Live game: record buy-ins, then cash out |
| `/game/[id]` (FINISHED) | password | Final results table |
| `/v/[viewSlug]` | public | Read-only view of a game |
| `/players` | password | Roster management (rename, archive) |

| `/stats` | password | Lifetime per-player stats. No link from any other screen. |
| `/login` | public | Password entry |

### `/game/[id]` — live game

The primary screen. One row per player: name, total in, rebuy count. A large `+`
button adds a rebuy at the game's default amount in a single tap. A caret next to it
opens an amount field for a non-standard rebuy (half-buy, top-up). Undo removes the
most recent buy-in for that player.

Touch targets sized for one-handed thumb use.

### Cash out

Each row gains a chip-count field. A running balance renders at the bottom, e.g.
"$140 counted, $160 in play — $20 unaccounted", turning green at zero.

Finishing an unbalanced game **warns but does not block** — a chip genuinely does end
up on the floor sometimes, and the host may want the real number recorded. The
warning must state the discrepancy explicitly.

### `/v/[viewSlug]` — read-only

Renders the live table with no controls. Polls every 10 seconds. A 10-second lag on
"Dave rebought" is imperceptible to a human and avoids realtime infrastructure
entirely.

`viewSlug` is generated independently of `id` so that sharing the view link cannot
reveal the edit URL.

### `/players` — roster

Rename players and archive ones who no longer play. Archiving hides someone from the
new-game picker but preserves them in past games and stats; players are never deleted,
because deleting one would orphan the money in every game they played.

### `/stats` — hidden

Per-player lifetime profit, games played, biggest single-game win and loss. Reachable
only by typing the URL. Password-gated like any other edit route. Deliberately
unlinked at the host's request.

## Error handling

- **Unbalanced table at cash-out:** warn with the exact discrepancy; allow override.
- **Duplicate player name:** `Player.name` is unique; the new-player field surfaces a
  clear message and offers the existing roster entry instead. Prevents "Dave" and
  "dave" becoming two people.
- **Removing a player mid-game:** allowed only if they have no buy-ins; otherwise the
  host must cash them out at their current stack. Prevents orphaned money.
- **Unauthenticated mutation:** Server Action returns an error and the client redirects
  to `/login`. Never a silent no-op.
- **Negative or zero buy-in amount:** rejected at the Server Action boundary.
- **Missing `POKER_EDIT_PASSWORD` env var:** the app fails to boot with an explicit
  error rather than defaulting to open access.

## Testing

The money math is pure functions over buy-in rows and is where the real risk lives.
Unit tests cover:

- `totalIn` with the original buy-in only, and with varied-amount rebuys
- `profit` for winning, losing, and exactly-break-even players
- `tableBalance` at zero, over, and under
- `tableBalance` while some players are not yet counted (partial cash-out)
- Rounding: no float drift across a full game's arithmetic

Server Action auth is tested by asserting an unauthenticated call is rejected — the
test targets the action, not the UI.

Screens are verified by driving the running app.

## Open questions

None.
