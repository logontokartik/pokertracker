# Poker Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phone-friendly web app for a recurring home poker game: roster, buy-ins/rebuys, chip-count cash-out with balance check, history, public read-only view links, hidden lifetime stats.

**Architecture:** Next.js App Router on Vercel with Postgres via Prisma. Server Components read, Server Actions write; no client state store, no API layer. Single tenant: one shared edit password sets an httpOnly HMAC cookie; every mutation re-checks it server-side. All money is integer cents; profit and table balance are derived, never stored.

**Tech Stack:** Next.js 15 (App Router, TypeScript, Tailwind), Prisma 6 (`prisma-client` generator + `@prisma/adapter-pg`), Postgres, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-17-poker-tracker-design.md`

## Global Constraints

- All money stored and computed as **integer cents**. No floats anywhere in currency math.
- Every Server Action that mutates data calls `requireAuth()` (or returns `{ error: 'Unauthorized' }`) **before** touching the database. Hiding a button is not access control.
- Derived values (`totalIn`, `profit`, `tableBalance`) are **never persisted**.
- `viewSlug` is generated independently of `id`; the view link must not reveal the edit URL.
- App refuses to boot if `POKER_EDIT_PASSWORD` is unset (via `instrumentation.ts`).
- Players are archived, never deleted.
- Unbalanced cash-out **warns but does not block**, and states the exact discrepancy.
- Next 15: `cookies()` and page `params` are async — always `await` them.
- Case-insensitive duplicate player names are rejected with a friendly message.

---

### Task 1: Scaffold Next.js app + Vitest

**Files:**
- Create: entire Next.js scaffold at repo root (via `create-next-app`)
- Create: `vitest.config.ts`
- Modify: `package.json` (test script)

**Interfaces:**
- Consumes: nothing (empty repo except `docs/` and `.git`)
- Produces: runnable Next.js app (`npm run dev`), `npm test` runs Vitest, `@/*` alias → `src/*`

- [ ] **Step 1: Scaffold (repo root is non-empty, so scaffold via temp dir)**

```bash
cd /Users/kartik/aiworkspace/pokertracker
npx create-next-app@latest tmp-scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --yes
rsync -a tmp-scaffold/ ./ && rm -rf tmp-scaffold
```

Expected: `src/app/page.tsx`, `package.json`, `tsconfig.json` exist at repo root.

- [ ] **Step 2: Install Vitest and add scripts**

```bash
npm install -D vitest
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
  },
})
```

In `package.json` scripts, add:

```json
"test": "vitest run"
```

- [ ] **Step 3: Verify dev server boots**

Run: `npm run dev` (then Ctrl-C). Expected: "Ready" with local URL, no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: Prisma schema, migration, client singleton

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `.env`, `.env.example`
- Modify: `package.json` (postinstall), `.gitignore`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `prisma` singleton exported from `@/lib/db`
  - Generated types at `@/generated/prisma/client`: `PrismaClient`, `Prisma` (error types), model types `Player`, `Game`, `GamePlayer`, `BuyIn`, enum `GameStatus` (`ACTIVE | FINISHED`)
  - All money columns are `Int` cents: `Game.defaultBuyIn`, `GamePlayer.finalStack` (nullable), `BuyIn.amount`

- [ ] **Step 1: Install Prisma packages**

```bash
npm install @prisma/client @prisma/adapter-pg
npm install -D prisma
```

- [ ] **Step 2: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Player {
  id        String       @id @default(cuid())
  name      String       @unique
  archived  Boolean      @default(false)
  createdAt DateTime     @default(now())
  games     GamePlayer[]
}

enum GameStatus {
  ACTIVE
  FINISHED
}

model Game {
  id           String       @id @default(cuid())
  label        String?
  playedOn     DateTime     @default(now())
  defaultBuyIn Int
  status       GameStatus   @default(ACTIVE)
  viewSlug     String       @unique
  createdAt    DateTime     @default(now())
  finishedAt   DateTime?
  players      GamePlayer[]
}

model GamePlayer {
  id         String   @id @default(cuid())
  gameId     String
  playerId   String
  finalStack Int?
  game       Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  player     Player   @relation(fields: [playerId], references: [id])
  buyIns     BuyIn[]

  @@unique([gameId, playerId])
}

model BuyIn {
  id           String     @id @default(cuid())
  gamePlayerId String
  amount       Int
  createdAt    DateTime   @default(now())
  gamePlayer   GamePlayer @relation(fields: [gamePlayerId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 3: Env files**

Create `.env` (gitignored by the scaffold's `.env*` rule):

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/pokertracker"
POKER_EDIT_PASSWORD="dev-password"
```

Create `.env.example` and force-add it:

```
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
POKER_EDIT_PASSWORD="choose-a-password"
```

If no Postgres is running locally: `docker run --name pokertracker-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pokertracker -p 5432:5432 -d postgres:16`

- [ ] **Step 4: Migrate and gitignore generated client**

Append to `.gitignore`:

```
src/generated/
```

Add to `package.json` scripts (Vercel runs postinstall, so the client regenerates on deploy):

```json
"postinstall": "prisma generate"
```

Run: `npx prisma migrate dev --name init`
Expected: "Your database is now in sync with your schema" + client generated into `src/generated/prisma`.

- [ ] **Step 5: Write `src/lib/db.ts`**

```ts
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 6: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git add -f .env.example
git commit -m "feat: Prisma schema, migration, and client singleton"
```

---

### Task 3: Money math library (TDD)

**Files:**
- Create: `src/lib/money.ts`
- Test: `src/lib/money.test.ts`

**Interfaces:**
- Consumes: nothing (pure; structurally compatible with Prisma query results)
- Produces (all cents are integers):
  - `type BuyInLike = { amount: number }`
  - `type GamePlayerLike = { finalStack: number | null; buyIns: BuyInLike[] }`
  - `totalIn(gp: GamePlayerLike): number`
  - `rebuyCount(gp: GamePlayerLike): number` — `max(0, buyIns.length - 1)`
  - `profit(gp: GamePlayerLike): number | null` — null until cashed out
  - `totalInPlay(gps: GamePlayerLike[]): number`
  - `totalCounted(gps: GamePlayerLike[]): number` — nulls count as 0
  - `allCounted(gps: GamePlayerLike[]): boolean`
  - `tableBalance(gps: GamePlayerLike[]): number` — `totalCounted - totalInPlay`
  - `formatCents(cents: number): string` — `"$20"`, `"-$3.50"`
  - `parseDollarsToCents(input: string): number | null` — accepts `"20"`, `"20.5"`, `"$20.50"`; rejects negatives, >2 decimals, garbage; null on reject

- [ ] **Step 1: Write the failing tests** — `src/lib/money.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  totalIn, rebuyCount, profit, totalInPlay, totalCounted,
  allCounted, tableBalance, formatCents, parseDollarsToCents,
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/money`.

- [ ] **Step 3: Write `src/lib/money.ts`**

```ts
export type BuyInLike = { amount: number }
export type GamePlayerLike = { finalStack: number | null; buyIns: BuyInLike[] }

export function totalIn(gp: GamePlayerLike): number {
  return gp.buyIns.reduce((sum, b) => sum + b.amount, 0)
}

export function rebuyCount(gp: GamePlayerLike): number {
  return Math.max(0, gp.buyIns.length - 1)
}

export function profit(gp: GamePlayerLike): number | null {
  return gp.finalStack === null ? null : gp.finalStack - totalIn(gp)
}

export function totalInPlay(gps: GamePlayerLike[]): number {
  return gps.reduce((sum, gp) => sum + totalIn(gp), 0)
}

export function totalCounted(gps: GamePlayerLike[]): number {
  return gps.reduce((sum, gp) => sum + (gp.finalStack ?? 0), 0)
}

export function allCounted(gps: GamePlayerLike[]): boolean {
  return gps.every((gp) => gp.finalStack !== null)
}

export function tableBalance(gps: GamePlayerLike[]): number {
  return totalCounted(gps) - totalInPlay(gps)
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rem = abs % 100
  if (rem === 0) return `${sign}$${dollars}`
  return `${sign}$${dollars}.${String(rem).padStart(2, '0')}`
}

// String-based parsing: the input never touches floating point.
export function parseDollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [whole, frac = ''] = cleaned.split('.')
  return parseInt(whole, 10) * 100 + (frac ? parseInt(frac.padEnd(2, '0'), 10) : 0)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all money tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/money.ts src/lib/money.test.ts
git commit -m "feat: money math library (integer cents, derived values)"
```

---

### Task 4: Auth — password check, signed cookie, login/logout, boot guard

**Files:**
- Create: `src/lib/auth-core.ts` (pure, testable — no Next imports)
- Create: `src/lib/auth.ts` (cookie/redirect helpers)
- Create: `src/app/actions/auth.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/instrumentation.ts`
- Test: `src/lib/auth-core.test.ts`

**Interfaces:**
- Consumes: `POKER_EDIT_PASSWORD` env var
- Produces:
  - `@/lib/auth-core`: `editPassword(): string` (throws if unset), `authToken(): string`, `isValidToken(token: string | undefined): boolean`, `isCorrectPassword(candidate: string): boolean`
  - `@/lib/auth`: `AUTH_COOKIE = 'poker_auth'`, `isAuthed(): Promise<boolean>`, `requireAuth(): Promise<void>` (throws `Error('Unauthorized')`), `requireAuthPage(): Promise<void>` (redirects to `/login`)
  - `@/app/actions/auth`: `login(prev, formData): Promise<{ error: string }>` (form field `password`; sets cookie + redirects `/` on success), `logout(): Promise<void>`

- [ ] **Step 1: Write the failing tests** — `src/lib/auth-core.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { authToken, isValidToken, isCorrectPassword, editPassword } from '@/lib/auth-core'

beforeEach(() => {
  process.env.POKER_EDIT_PASSWORD = 'test-secret'
})

describe('editPassword', () => {
  it('throws when the env var is unset', () => {
    delete process.env.POKER_EDIT_PASSWORD
    expect(() => editPassword()).toThrow(/POKER_EDIT_PASSWORD/)
  })
})

describe('authToken / isValidToken', () => {
  it('accepts its own token', () => {
    expect(isValidToken(authToken())).toBe(true)
  })
  it('rejects undefined, garbage, and wrong-length tokens', () => {
    expect(isValidToken(undefined)).toBe(false)
    expect(isValidToken('nope')).toBe(false)
    expect(isValidToken(authToken() + 'a')).toBe(false)
  })
  it('invalidates tokens minted under a different password', () => {
    const old = authToken()
    process.env.POKER_EDIT_PASSWORD = 'rotated'
    expect(isValidToken(old)).toBe(false)
  })
})

describe('isCorrectPassword', () => {
  it('accepts the configured password and rejects others', () => {
    expect(isCorrectPassword('test-secret')).toBe(true)
    expect(isCorrectPassword('wrong')).toBe(false)
    expect(isCorrectPassword('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — cannot resolve `@/lib/auth-core`.

- [ ] **Step 3: Write `src/lib/auth-core.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto'

export function editPassword(): string {
  const p = process.env.POKER_EDIT_PASSWORD
  if (!p) {
    throw new Error('POKER_EDIT_PASSWORD is not set — refusing to run without an edit password.')
  }
  return p
}

export function authToken(): string {
  return createHmac('sha256', editPassword()).update('poker-edit-v1').digest('hex')
}

export function isValidToken(token: string | undefined): boolean {
  if (!token) return false
  const expected = Buffer.from(authToken())
  const actual = Buffer.from(token)
  if (actual.length !== expected.length) return false
  return timingSafeEqual(actual, expected)
}

// Hash both sides so timingSafeEqual gets equal-length buffers.
export function isCorrectPassword(candidate: string): boolean {
  const a = createHmac('sha256', 'pw-check').update(candidate).digest()
  const b = createHmac('sha256', 'pw-check').update(editPassword()).digest()
  return timingSafeEqual(a, b)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — expected: PASS.

- [ ] **Step 5: Write `src/lib/auth.ts`**

```ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isValidToken } from '@/lib/auth-core'

export const AUTH_COOKIE = 'poker_auth'

export async function isAuthed(): Promise<boolean> {
  const store = await cookies()
  return isValidToken(store.get(AUTH_COOKIE)?.value)
}

export async function requireAuth(): Promise<void> {
  if (!(await isAuthed())) throw new Error('Unauthorized')
}

export async function requireAuthPage(): Promise<void> {
  if (!(await isAuthed())) redirect('/login')
}
```

- [ ] **Step 6: Write `src/app/actions/auth.ts`**

```ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authToken, isCorrectPassword } from '@/lib/auth-core'
import { AUTH_COOKIE } from '@/lib/auth'

export async function login(
  _prev: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string }> {
  const password = String(formData.get('password') ?? '')
  if (!isCorrectPassword(password)) return { error: 'Wrong password' }
  const store = await cookies()
  store.set(AUTH_COOKIE, authToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365,
    path: '/',
  })
  redirect('/')
}

export async function logout(): Promise<void> {
  const store = await cookies()
  store.delete(AUTH_COOKIE)
  redirect('/login')
}
```

- [ ] **Step 7: Write `src/app/login/page.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined)
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Poker Tracker</h1>
      <form action={formAction} className="flex flex-col gap-3">
        <input
          type="password"
          name="password"
          placeholder="Edit password"
          autoFocus
          className="rounded-lg border border-neutral-600 bg-transparent p-3"
        />
        {state?.error && <p className="text-red-500">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 8: Write `src/instrumentation.ts` (boot guard)**

```ts
export async function register() {
  if (!process.env.POKER_EDIT_PASSWORD) {
    throw new Error(
      'POKER_EDIT_PASSWORD is not set. Set it in .env (local) or Vercel project env vars.'
    )
  }
}
```

- [ ] **Step 9: Verify by driving the app**

Run: `npm run dev`. Visit `/login`: wrong password shows "Wrong password"; correct password (`dev-password`) redirects to `/`. Also confirm boot guard: `POKER_EDIT_PASSWORD= npm run build` should fail with the explicit message (run `npm run build` normally afterward to confirm it passes).

- [ ] **Step 10: Commit**

```bash
git add src/lib/auth-core.ts src/lib/auth-core.test.ts src/lib/auth.ts src/app/actions/auth.ts src/app/login src/instrumentation.ts
git commit -m "feat: password auth with signed httpOnly cookie and boot guard"
```

---

### Task 5: Roster — player actions + /players page

**Files:**
- Create: `src/app/actions/players.ts`
- Create: `src/app/players/page.tsx`
- Create: `src/components/PlayerAdmin.tsx`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db`, `requireAuth` from `@/lib/auth`
- Produces (`@/app/actions/players`, all return `Promise<{ error?: string }>`):
  - `createPlayer(name: string)` — trims; rejects empty and case-insensitive duplicates ("X is already on the roster")
  - `renamePlayer(id: string, name: string)` — same validation
  - `setPlayerArchived(id: string, archived: boolean)`

- [ ] **Step 1: Write `src/app/actions/players.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

async function guard(): Promise<{ error: string } | null> {
  try {
    await requireAuth()
    return null
  } catch {
    return { error: 'Unauthorized' }
  }
}

async function findByNameInsensitive(name: string, excludeId?: string) {
  return prisma.player.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createPlayer(name: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }
  const existing = await findByNameInsensitive(trimmed)
  if (existing) return { error: `"${existing.name}" is already on the roster` }
  await prisma.player.create({ data: { name: trimmed } })
  revalidatePath('/players')
  return {}
}

export async function renamePlayer(id: string, name: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }
  const existing = await findByNameInsensitive(trimmed, id)
  if (existing) return { error: `"${existing.name}" is already on the roster` }
  await prisma.player.update({ where: { id }, data: { name: trimmed } })
  revalidatePath('/players')
  return {}
}

export async function setPlayerArchived(id: string, archived: boolean): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  await prisma.player.update({ where: { id }, data: { archived } })
  revalidatePath('/players')
  return {}
}
```

- [ ] **Step 2: Write `src/components/PlayerAdmin.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { createPlayer, renamePlayer, setPlayerArchived } from '@/app/actions/players'

type PlayerRow = { id: string; name: string; archived: boolean }

export function PlayerAdmin({ players }: { players: PlayerRow[] }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error === 'Unauthorized') {
        window.location.href = '/login' // spec: unauthenticated mutation redirects, never a silent no-op
        return
      }
      setError(result.error ?? null)
    })

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          run(async () => {
            const result = await createPlayer(newName)
            if (!result.error) setNewName('')
            return result
          })
        }}
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New player name"
          className="flex-1 rounded-lg border border-neutral-600 bg-transparent p-3"
        />
        <button disabled={pending} className="rounded-lg bg-emerald-600 px-4 font-semibold text-white disabled:opacity-50">
          Add
        </button>
      </form>
      {error && <p className="text-red-500">{error}</p>}
      <ul className="flex flex-col gap-2">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-lg border border-neutral-700 p-3">
            <span className={`flex-1 ${p.archived ? 'text-neutral-500 line-through' : ''}`}>{p.name}</span>
            <button
              className="text-sm text-neutral-400 underline"
              onClick={() => {
                const name = prompt('Rename player', p.name)
                if (name !== null) run(() => renamePlayer(p.id, name))
              }}
            >
              rename
            </button>
            <button
              className="text-sm text-neutral-400 underline"
              onClick={() => run(() => setPlayerArchived(p.id, !p.archived))}
            >
              {p.archived ? 'unarchive' : 'archive'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/players/page.tsx`**

```tsx
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { PlayerAdmin } from '@/components/PlayerAdmin'

export default async function PlayersPage() {
  await requireAuthPage()
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } })
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Roster</h1>
        <Link href="/" className="text-sm text-neutral-400 underline">home</Link>
      </div>
      <PlayerAdmin players={players.map(({ id, name, archived }) => ({ id, name, archived }))} />
    </main>
  )
}
```

- [ ] **Step 4: Verify by driving the app**

`npm run dev` → `/players`: add "Dave", then try adding "dave" (must show `"Dave" is already on the roster`), rename, archive/unarchive. Log out (clear cookie in devtools) and confirm `/players` redirects to `/login`.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/players.ts src/app/players src/components/PlayerAdmin.tsx
git commit -m "feat: roster management with case-insensitive duplicate guard"
```

---

### Task 6: New game — createGame action + /game/new page

**Files:**
- Create: `src/app/actions/games.ts` (createGame only; later tasks extend this file)
- Create: `src/app/game/new/page.tsx`
- Create: `src/components/NewGameForm.tsx`

**Interfaces:**
- Consumes: `prisma`, `requireAuth`, `parseDollarsToCents` from `@/lib/money`
- Produces:
  - `createGame(prev, formData): Promise<{ error: string }>` — form fields: `label` (optional text), `buyIn` (dollars string), `playerIds` (repeated checkbox), `newNames` (comma-separated). Creates game with unguessable `viewSlug`, one `GamePlayer` per player, and **one initial `BuyIn` at `defaultBuyIn` per player**. Redirects to `/game/[id]`.
  - Later tasks append more actions to `src/app/actions/games.ts`.

- [ ] **Step 1: Start `src/app/actions/games.ts`**

```ts
'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { parseDollarsToCents } from '@/lib/money'

async function guard(): Promise<{ error: string } | null> {
  try {
    await requireAuth()
    return null
  } catch {
    return { error: 'Unauthorized' }
  }
}

export async function createGame(
  _prev: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string }> {
  const denied = await guard()
  if (denied) return denied

  const label = String(formData.get('label') ?? '').trim() || null
  const buyIn = parseDollarsToCents(String(formData.get('buyIn') ?? ''))
  if (buyIn === null || buyIn <= 0) return { error: 'Buy-in must be a positive amount' }

  const playerIds = formData.getAll('playerIds').map(String)
  const newNames = String(formData.get('newNames') ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

  const gameId = await prisma.$transaction(async (tx) => {
    const allIds = [...playerIds]
    for (const name of newNames) {
      const existing = await tx.player.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      })
      const player = existing ?? (await tx.player.create({ data: { name } }))
      if (!allIds.includes(player.id)) allIds.push(player.id)
    }
    if (allIds.length === 0) throw new Error('no-players')

    const game = await tx.game.create({
      data: {
        label,
        defaultBuyIn: buyIn,
        viewSlug: randomBytes(9).toString('base64url'),
        players: {
          create: allIds.map((playerId) => ({
            playerId,
            buyIns: { create: { amount: buyIn } },
          })),
        },
      },
    })
    return game.id
  }).catch((e) => (e instanceof Error && e.message === 'no-players' ? null : Promise.reject(e)))

  if (gameId === null) return { error: 'Pick at least one player' }
  revalidatePath('/')
  redirect(`/game/${gameId}`)
}
```

- [ ] **Step 2: Write `src/components/NewGameForm.tsx`**

```tsx
'use client'

import { useActionState } from 'react'
import { createGame } from '@/app/actions/games'

type RosterPlayer = { id: string; name: string }

export function NewGameForm({ roster }: { roster: RosterPlayer[] }) {
  const [state, formAction, pending] = useActionState(createGame, undefined)
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        name="label"
        placeholder="Label (optional, e.g. Friday night)"
        className="rounded-lg border border-neutral-600 bg-transparent p-3"
      />
      <label className="flex flex-col gap-1">
        <span className="text-sm text-neutral-400">Buy-in ($)</span>
        <input
          name="buyIn"
          inputMode="decimal"
          defaultValue="20"
          className="rounded-lg border border-neutral-600 bg-transparent p-3"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-neutral-400">Who&apos;s playing?</legend>
        {roster.map((p) => (
          <label key={p.id} className="flex items-center gap-3 rounded-lg border border-neutral-700 p-3">
            <input type="checkbox" name="playerIds" value={p.id} className="size-5 accent-emerald-600" />
            {p.name}
          </label>
        ))}
      </fieldset>
      <input
        name="newNames"
        placeholder="New players (comma-separated)"
        className="rounded-lg border border-neutral-600 bg-transparent p-3"
      />
      {state?.error && <p className="text-red-500">{state.error}</p>}
      <button
        disabled={pending}
        className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50"
      >
        {pending ? 'Starting…' : 'Start game'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Write `src/app/game/new/page.tsx`**

```tsx
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { NewGameForm } from '@/components/NewGameForm'

export default async function NewGamePage() {
  await requireAuthPage()
  const roster = await prisma.player.findMany({
    where: { archived: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">New game</h1>
        <Link href="/" className="text-sm text-neutral-400 underline">home</Link>
      </div>
      <NewGameForm roster={roster} />
    </main>
  )
}
```

- [ ] **Step 4: Verify by driving the app**

`/game/new`: no players selected → "Pick at least one player"; buy-in `0` → error; select two roster players + `newNames` = "Priya" → redirects to `/game/<id>` (404 until Task 7 — the URL and DB rows are what's being verified). Check rows: `npx prisma studio` — game has viewSlug, each GamePlayer has exactly one BuyIn at 2000.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/games.ts src/app/game/new src/components/NewGameForm.tsx
git commit -m "feat: create game with roster picker and initial buy-ins"
```

---

### Task 7: Live game — buy-in actions + live page

**Files:**
- Modify: `src/app/actions/games.ts` (append actions)
- Create: `src/app/game/[id]/page.tsx`
- Create: `src/components/game/LivePlayerRow.tsx`
- Create: `src/components/game/AddPlayerPicker.tsx`
- Create: `src/components/game/ShareLink.tsx`
- Test: `src/app/actions/games.test.ts` (auth rejection)

**Interfaces:**
- Consumes: everything prior; `formatCents`, `totalIn`, `rebuyCount`, `parseDollarsToCents` from `@/lib/money`
- Produces (appended to `@/app/actions/games`, all return `Promise<{ error?: string }>`, all reject when game is not `ACTIVE`):
  - `addRebuy(gamePlayerId: string, amountCents?: number)` — omitted amount → game's `defaultBuyIn`; rejects non-integer or `<= 0`
  - `undoLastBuyIn(gamePlayerId: string)` — deletes newest `BuyIn`; no-op error if none left
  - `addPlayerToGame(gameId: string, playerId: string)` — creates GamePlayer + initial BuyIn at default
  - `removePlayerFromGame(gamePlayerId: string)` — only when that player has zero buy-ins
- Client components receive only serializable props (numbers/strings), never Prisma objects.

- [ ] **Step 1: Write the failing auth test** — `src/app/actions/games.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

// Unauthenticated caller: cookie store has no auth cookie.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect') } }))

import { addRebuy, undoLastBuyIn } from '@/app/actions/games'

describe('server action auth', () => {
  it('rejects an unauthenticated addRebuy before touching the database', async () => {
    expect(await addRebuy('some-id')).toEqual({ error: 'Unauthorized' })
  })
  it('rejects an unauthenticated undoLastBuyIn', async () => {
    expect(await undoLastBuyIn('some-id')).toEqual({ error: 'Unauthorized' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `addRebuy` is not exported.

- [ ] **Step 3: Append actions to `src/app/actions/games.ts`**

```ts
async function loadActiveGamePlayer(gamePlayerId: string) {
  const gp = await prisma.gamePlayer.findUnique({
    where: { id: gamePlayerId },
    include: { game: true },
  })
  if (!gp) return { gp: null, error: 'Player not found' }
  if (gp.game.status !== 'ACTIVE') return { gp: null, error: 'Game is finished' }
  return { gp, error: null }
}

function revalidateGame(game: { id: string; viewSlug: string }) {
  revalidatePath(`/game/${game.id}`)
  revalidatePath(`/v/${game.viewSlug}`)
}

export async function addRebuy(
  gamePlayerId: string,
  amountCents?: number
): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  const amount = amountCents ?? gp.game.defaultBuyIn
  if (!Number.isInteger(amount) || amount <= 0) return { error: 'Amount must be positive' }
  await prisma.buyIn.create({ data: { gamePlayerId, amount } })
  revalidateGame(gp.game)
  return {}
}

export async function undoLastBuyIn(gamePlayerId: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  const last = await prisma.buyIn.findFirst({
    where: { gamePlayerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  if (!last) return { error: 'No buy-ins to undo' }
  await prisma.buyIn.delete({ where: { id: last.id } })
  revalidateGame(gp.game)
  return {}
}

export async function addPlayerToGame(
  gameId: string,
  playerId: string
): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) return { error: 'Game not found' }
  if (game.status !== 'ACTIVE') return { error: 'Game is finished' }
  await prisma.gamePlayer.create({
    data: { gameId, playerId, buyIns: { create: { amount: game.defaultBuyIn } } },
  })
  revalidateGame(game)
  return {}
}

export async function removePlayerFromGame(gamePlayerId: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  const buyInCount = await prisma.buyIn.count({ where: { gamePlayerId } })
  if (buyInCount > 0) {
    return { error: 'Player has buy-ins — undo them first, or cash them out instead' }
  }
  await prisma.gamePlayer.delete({ where: { id: gamePlayerId } })
  revalidateGame(gp.game)
  return {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test` — expected: auth tests PASS (alongside money and auth-core suites).

- [ ] **Step 5: Write `src/components/game/LivePlayerRow.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { addRebuy, undoLastBuyIn } from '@/app/actions/games'
import { formatCents, parseDollarsToCents } from '@/lib/money'

type Props = {
  gamePlayerId: string
  name: string
  totalInCents: number
  rebuys: number
  defaultBuyInCents: number
}

export function LivePlayerRow({ gamePlayerId, name, totalInCents, rebuys, defaultBuyInCents }: Props) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (fn: () => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await fn()
      if (result.error === 'Unauthorized') {
        window.location.href = '/login' // spec: unauthenticated mutation redirects, never a silent no-op
        return
      }
      setError(result.error ?? null)
    })

  return (
    <div className="rounded-lg border border-neutral-700 p-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="font-semibold">{name}</div>
          <div className="text-sm text-neutral-400">
            {formatCents(totalInCents)} in · {rebuys} rebuy{rebuys === 1 ? '' : 's'}
          </div>
        </div>
        <button
          aria-label={`Rebuy ${name} for ${formatCents(defaultBuyInCents)}`}
          disabled={pending}
          onClick={() => run(() => addRebuy(gamePlayerId))}
          className="size-12 rounded-full bg-emerald-600 text-2xl font-bold text-white disabled:opacity-50"
        >
          +
        </button>
        <button
          aria-label="Custom amount"
          onClick={() => setOpen(!open)}
          className="px-1 text-neutral-400"
        >
          {open ? '▴' : '▾'}
        </button>
      </div>
      {open && (
        <div className="mt-2 flex gap-2">
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            inputMode="decimal"
            placeholder="Amount ($)"
            className="flex-1 rounded-lg border border-neutral-600 bg-transparent p-2"
          />
          <button
            disabled={pending}
            onClick={() => {
              const cents = parseDollarsToCents(custom)
              if (cents === null || cents <= 0) {
                setError('Enter a positive amount')
                return
              }
              run(async () => {
                const result = await addRebuy(gamePlayerId, cents)
                if (!result.error) {
                  setCustom('')
                  setOpen(false)
                }
                return result
              })
            }}
            className="rounded-lg bg-emerald-700 px-3 text-white disabled:opacity-50"
          >
            Rebuy
          </button>
          <button
            disabled={pending}
            onClick={() => run(() => undoLastBuyIn(gamePlayerId))}
            className="rounded-lg border border-neutral-600 px-3 text-neutral-300 disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Write `src/components/game/AddPlayerPicker.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { addPlayerToGame } from '@/app/actions/games'

type Props = { gameId: string; candidates: { id: string; name: string }[] }

export function AddPlayerPicker({ gameId, candidates }: Props) {
  const [pending, startTransition] = useTransition()
  if (candidates.length === 0) return null
  return (
    <details className="rounded-lg border border-neutral-700 p-3">
      <summary className="cursor-pointer text-sm text-neutral-400">Add a late arrival</summary>
      <div className="mt-2 flex flex-wrap gap-2">
        {candidates.map((p) => (
          <button
            key={p.id}
            disabled={pending}
            onClick={() => startTransition(async () => { await addPlayerToGame(gameId, p.id) })}
            className="rounded-lg border border-neutral-600 px-3 py-2 disabled:opacity-50"
          >
            + {p.name}
          </button>
        ))}
      </div>
    </details>
  )
}
```

- [ ] **Step 7: Write `src/components/game/ShareLink.tsx`**

```tsx
'use client'

import { useState } from 'react'

export function ShareLink({ viewSlug }: { viewSlug: string }) {
  const [copied, setCopied] = useState(false)
  const path = `/v/${viewSlug}`
  return (
    <button
      className="text-sm text-neutral-400 underline"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}${path}`)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
    >
      {copied ? 'Copied!' : 'Copy view link'}
    </button>
  )
}
```

- [ ] **Step 8: Write `src/app/game/[id]/page.tsx`** (ACTIVE branch; Task 8 adds cash-out and the FINISHED branch — placeholders here render nothing yet)

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { totalIn, rebuyCount, totalInPlay, formatCents } from '@/lib/money'
import { LivePlayerRow } from '@/components/game/LivePlayerRow'
import { AddPlayerPicker } from '@/components/game/AddPlayerPicker'
import { ShareLink } from '@/components/game/ShareLink'

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await requireAuthPage()

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      players: {
        include: { player: true, buyIns: true },
        orderBy: { player: { name: 'asc' } },
      },
    },
  })
  if (!game) notFound()

  const candidates = await prisma.player.findMany({
    where: { archived: false, id: { notIn: game.players.map((gp) => gp.playerId) } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{game.label ?? 'Poker night'}</h1>
          <p className="text-sm text-neutral-400">
            {game.playedOn.toLocaleDateString()} · {formatCents(game.defaultBuyIn)} buy-in ·{' '}
            {formatCents(totalInPlay(game.players))} in play
          </p>
        </div>
        <Link href="/" className="text-sm text-neutral-400 underline">home</Link>
      </div>
      <ShareLink viewSlug={game.viewSlug} />

      {game.status === 'ACTIVE' ? (
        <>
          {game.players.map((gp) => (
            <LivePlayerRow
              key={gp.id}
              gamePlayerId={gp.id}
              name={gp.player.name}
              totalInCents={totalIn(gp)}
              rebuys={rebuyCount(gp)}
              defaultBuyInCents={game.defaultBuyIn}
            />
          ))}
          <AddPlayerPicker gameId={game.id} candidates={candidates} />
          {/* Task 8: cash-out section + finish button render here */}
        </>
      ) : null /* Task 8: FINISHED results table */}
    </main>
  )
}
```

- [ ] **Step 9: Verify by driving the app**

Open the game from Task 6: tap `+` on a player → total jumps by $20 and rebuys increments; caret → custom rebuy $10 → total +$10; Undo removes it; add a late arrival from the picker (they appear with one buy-in); `removePlayerFromGame` guard: undo a late arrival's only buy-in, confirm remove works only then (temporarily test via the picker flow or Prisma studio).

- [ ] **Step 10: Commit**

```bash
git add src/app/actions/games.ts src/app/actions/games.test.ts src/app/game/[id] src/components/game
git commit -m "feat: live game screen with one-tap rebuys, custom amounts, undo"
```

---

### Task 8: Cash out, finish game, finished results

**Files:**
- Modify: `src/app/actions/games.ts` (append `setFinalStack`, `finishGame`)
- Modify: `src/app/game/[id]/page.tsx` (cash-out section, balance banner, FINISHED branch)
- Create: `src/components/game/StackInput.tsx`
- Create: `src/components/game/FinishButton.tsx`
- Create: `src/components/game/ResultsTable.tsx`

**Interfaces:**
- Consumes: prior actions/lib; `tableBalance`, `totalCounted`, `allCounted`, `profit` from `@/lib/money`
- Produces:
  - `setFinalStack(gamePlayerId: string, stackCents: number | null)` — null clears; rejects negative/non-integer; ACTIVE games only
  - `finishGame(gameId: string)` — sets `status: FINISHED`, `finishedAt`; **does not block on imbalance** (warning is client-side, with the exact discrepancy)
  - `ResultsTable` — server-renderable; props `players: { name: string; totalInCents: number; rebuys: number; finalStackCents: number | null; profitCents: number | null }[]`; sorted by profit desc; reused by the public view page in Task 9

- [ ] **Step 1: Append to `src/app/actions/games.ts`**

```ts
export async function setFinalStack(
  gamePlayerId: string,
  stackCents: number | null
): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  if (stackCents !== null && (!Number.isInteger(stackCents) || stackCents < 0)) {
    return { error: 'Stack must be zero or more' }
  }
  await prisma.gamePlayer.update({ where: { id: gamePlayerId }, data: { finalStack: stackCents } })
  revalidateGame(gp.game)
  return {}
}

export async function finishGame(gameId: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) return { error: 'Game not found' }
  if (game.status !== 'ACTIVE') return { error: 'Game is already finished' }
  await prisma.game.update({
    where: { id: gameId },
    data: { status: 'FINISHED', finishedAt: new Date() },
  })
  revalidateGame(game)
  return {}
}
```

- [ ] **Step 2: Write `src/components/game/StackInput.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { setFinalStack } from '@/app/actions/games'
import { formatCents, parseDollarsToCents } from '@/lib/money'

type Props = { gamePlayerId: string; name: string; finalStackCents: number | null }

export function StackInput({ gamePlayerId, name, finalStackCents }: Props) {
  const [value, setValue] = useState(
    finalStackCents === null ? '' : (finalStackCents / 100).toFixed(2).replace(/\.00$/, '')
  )
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const save = () => {
    const trimmed = value.trim()
    const cents = trimmed === '' ? null : parseDollarsToCents(trimmed)
    if (trimmed !== '' && cents === null) {
      setError('Enter a dollar amount')
      return
    }
    startTransition(async () => {
      const result = await setFinalStack(gamePlayerId, cents)
      if (result.error === 'Unauthorized') {
        window.location.href = '/login'
        return
      }
      setError(result.error ?? null)
    })
  }

  return (
    <label className="flex items-center gap-2">
      <span className="flex-1">{name}</span>
      {error && <span className="text-sm text-red-500">{error}</span>}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        inputMode="decimal"
        placeholder="chips $"
        className="w-24 rounded-lg border border-neutral-600 bg-transparent p-2 text-right"
      />
      {finalStackCents !== null && (
        <span className="w-14 text-right text-sm text-neutral-400">{formatCents(finalStackCents)}</span>
      )}
    </label>
  )
}
```

- [ ] **Step 3: Write `src/components/game/FinishButton.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { finishGame } from '@/app/actions/games'

type Props = { gameId: string; warning: string | null }

export function FinishButton({ gameId, warning }: Props) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (warning && !confirm(`${warning}\n\nFinish anyway?`)) return
        startTransition(async () => { await finishGame(gameId) })
      }}
      className="rounded-lg bg-emerald-600 p-3 font-semibold text-white disabled:opacity-50"
    >
      Finish game
    </button>
  )
}
```

- [ ] **Step 4: Write `src/components/game/ResultsTable.tsx`** (no `'use client'` — server-renderable)

```tsx
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
```

- [ ] **Step 5: Wire into `src/app/game/[id]/page.tsx`**

Add imports:

```tsx
import { totalCounted, tableBalance, allCounted, profit } from '@/lib/money'
import { StackInput } from '@/components/game/StackInput'
import { FinishButton } from '@/components/game/FinishButton'
import { ResultsTable, type ResultRow } from '@/components/game/ResultsTable'
```

Above the `return`, compute:

```tsx
const balance = tableBalance(game.players)
const anyCounted = game.players.some((gp) => gp.finalStack !== null)
const warning =
  balance === 0 && allCounted(game.players)
    ? null
    : `${formatCents(totalCounted(game.players))} counted, ${formatCents(totalInPlay(game.players))} in play — ${formatCents(Math.abs(balance))} ${balance < 0 ? 'unaccounted' : 'over'}`
const resultRows: ResultRow[] = game.players.map((gp) => ({
  name: gp.player.name,
  totalInCents: totalIn(gp),
  rebuys: rebuyCount(gp),
  finalStackCents: gp.finalStack,
  profitCents: profit(gp),
}))
```

Replace the `{/* Task 8 ... */}` placeholder inside the ACTIVE branch with:

```tsx
<section className="mt-4 flex flex-col gap-3 rounded-lg border border-neutral-700 p-3">
  <h2 className="font-semibold">Cash out</h2>
  {game.players.map((gp) => (
    <StackInput
      key={gp.id}
      gamePlayerId={gp.id}
      name={gp.player.name}
      finalStackCents={gp.finalStack}
    />
  ))}
  <p className={anyCounted && balance === 0 && allCounted(game.players) ? 'text-emerald-500' : 'text-amber-500'}>
    {warning ?? 'Table balances ✓'}
  </p>
  <FinishButton gameId={game.id} warning={warning} />
</section>
```

Replace the `null /* Task 8: FINISHED results table */` branch with:

```tsx
<ResultsTable players={resultRows} />
```

- [ ] **Step 6: Verify by driving the app**

Enter stacks summing short by $20 → amber "…$20 unaccounted", Finish → confirm dialog states the discrepancy, Cancel keeps game active. Fix stacks to balance → green "Table balances ✓", Finish → results table sorted by profit, green/red profits, `+` buttons gone. Confirm profits sum to zero.

- [ ] **Step 7: Run all tests**

Run: `npm test` — expected: all suites PASS (finished-game rejection is covered by `loadActiveGamePlayer` returning "Game is finished").

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: cash out with balance check, finish game, results table"
```

---

### Task 9: Public read-only view with polling

**Files:**
- Create: `src/app/v/[slug]/page.tsx`
- Create: `src/components/Poller.tsx`

**Interfaces:**
- Consumes: `prisma`, `ResultsTable`, money lib. **No auth imports — this page is public by design.**
- Produces: `/v/[viewSlug]` — force-dynamic (no cookies are read, so without this Next would render it static and viewers would see a stale snapshot); polls every 10 s via `router.refresh()`.

- [ ] **Step 1: Write `src/components/Poller.tsx`**

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function Poller({ intervalMs }: { intervalMs: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])
  return null
}
```

- [ ] **Step 2: Write `src/app/v/[slug]/page.tsx`**

```tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { totalIn, rebuyCount, profit, totalInPlay, formatCents } from '@/lib/money'
import { ResultsTable, type ResultRow } from '@/components/game/ResultsTable'
import { Poller } from '@/components/Poller'

export const dynamic = 'force-dynamic'

export default async function ViewGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const game = await prisma.game.findUnique({
    where: { viewSlug: slug },
    include: {
      players: {
        include: { player: true, buyIns: true },
        orderBy: { player: { name: 'asc' } },
      },
    },
  })
  if (!game) notFound()

  const rows: ResultRow[] = game.players.map((gp) => ({
    name: gp.player.name,
    totalInCents: totalIn(gp),
    rebuys: rebuyCount(gp),
    finalStackCents: gp.finalStack,
    profitCents: profit(gp),
  }))

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div>
        <h1 className="text-xl font-bold">{game.label ?? 'Poker night'}</h1>
        <p className="text-sm text-neutral-400">
          {game.playedOn.toLocaleDateString()} · {formatCents(game.defaultBuyIn)} buy-in ·{' '}
          {formatCents(totalInPlay(game.players))} in play ·{' '}
          {game.status === 'ACTIVE' ? 'live' : 'finished'}
        </p>
      </div>
      <ResultsTable players={rows} />
      {game.status === 'ACTIVE' && <Poller intervalMs={10_000} />}
    </main>
  )
}
```

- [ ] **Step 3: Verify by driving the app**

Copy the view link from a live game; open it in a private/incognito window (no auth cookie): table renders, **no buttons or inputs anywhere**. Add a rebuy from the host window → viewer updates within ~10 s without manual reload. Finished game via view link: results, no poller. Nonexistent slug → 404.

- [ ] **Step 4: Commit**

```bash
git add src/app/v src/components/Poller.tsx
git commit -m "feat: public read-only game view with 10s polling"
```

---

### Task 10: Home — game history + navigation

**Files:**
- Modify: `src/app/page.tsx` (replace scaffold content entirely)
- Modify: `src/app/layout.tsx` (title/metadata only)

**Interfaces:**
- Consumes: `prisma`, `requireAuthPage`, `logout` from `@/app/actions/auth`, money lib
- Produces: `/` — password-gated list of games (newest first) linking to `/game/[id]`, "New game" button, links to `/players`, logout. **No link to `/stats` anywhere.**

- [ ] **Step 1: Update `src/app/layout.tsx` metadata**

Replace the exported `metadata` object with:

```tsx
export const metadata: Metadata = {
  title: 'Poker Tracker',
  description: 'Home game buy-ins and tallies',
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { logout } from '@/app/actions/auth'
import { totalInPlay, formatCents } from '@/lib/money'

export default async function HomePage() {
  await requireAuthPage()
  const games = await prisma.game.findMany({
    orderBy: { playedOn: 'desc' },
    include: { players: { include: { player: true, buyIns: true } } },
  })

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Poker Tracker</h1>
        <div className="flex gap-3 text-sm text-neutral-400">
          <Link href="/players" className="underline">roster</Link>
          <form action={logout}>
            <button className="underline">log out</button>
          </form>
        </div>
      </div>
      <Link
        href="/game/new"
        className="rounded-lg bg-emerald-600 p-3 text-center font-semibold text-white"
      >
        Start a new game
      </Link>
      <ul className="flex flex-col gap-2">
        {games.map((g) => (
          <li key={g.id}>
            <Link
              href={`/game/${g.id}`}
              className="block rounded-lg border border-neutral-700 p-3"
            >
              <div className="flex justify-between">
                <span className="font-semibold">{g.label ?? 'Poker night'}</span>
                <span className={g.status === 'ACTIVE' ? 'text-emerald-500' : 'text-neutral-500'}>
                  {g.status === 'ACTIVE' ? 'live' : g.playedOn.toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-neutral-400">
                {g.players.map((gp) => gp.player.name).join(', ')} ·{' '}
                {formatCents(g.defaultBuyIn)} buy-in · {formatCents(totalInPlay(g.players))} total
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {games.length === 0 && <p className="text-neutral-500">No games yet.</p>}
    </main>
  )
}
```

- [ ] **Step 3: Verify by driving the app**

`/` lists the games created so far, newest first, live one marked "live"; links open the game; logout returns to `/login` and `/` then redirects there. Confirm no `/stats` link exists.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: home page with game history and navigation"
```

---

### Task 11: Hidden lifetime stats

**Files:**
- Create: `src/app/stats/page.tsx`

**Interfaces:**
- Consumes: `prisma`, `requireAuthPage`, money lib
- Produces: `/stats` — password-gated, unlinked. Per player across **FINISHED** games only: games played, total profit, biggest single-game win, biggest single-game loss; sorted by total profit desc.

- [ ] **Step 1: Write `src/app/stats/page.tsx`**

```tsx
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { profit, formatCents } from '@/lib/money'

type Stat = { name: string; games: number; total: number; biggestWin: number; biggestLoss: number }

export default async function StatsPage() {
  await requireAuthPage()
  const gamePlayers = await prisma.gamePlayer.findMany({
    where: { game: { status: 'FINISHED' } },
    include: { player: true, buyIns: true },
  })

  const byPlayer = new Map<string, Stat>()
  for (const gp of gamePlayers) {
    const p = profit(gp)
    if (p === null) continue // never cashed out; excluded rather than counted as a $0 game
    const stat = byPlayer.get(gp.playerId) ?? {
      name: gp.player.name, games: 0, total: 0, biggestWin: 0, biggestLoss: 0,
    }
    stat.games += 1
    stat.total += p
    stat.biggestWin = Math.max(stat.biggestWin, p)
    stat.biggestLoss = Math.min(stat.biggestLoss, p)
    byPlayer.set(gp.playerId, stat)
  }
  const stats = [...byPlayer.values()].sort((a, b) => b.total - a.total)

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-xl font-bold">Lifetime stats</h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-neutral-400">
            <th className="p-2">Player</th>
            <th className="p-2 text-right">Games</th>
            <th className="p-2 text-right">Total</th>
            <th className="p-2 text-right">Best</th>
            <th className="p-2 text-right">Worst</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.name} className="border-t border-neutral-800">
              <td className="p-2">{s.name}</td>
              <td className="p-2 text-right">{s.games}</td>
              <td className={`p-2 text-right font-semibold ${s.total >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {formatCents(s.total)}
              </td>
              <td className="p-2 text-right">{formatCents(s.biggestWin)}</td>
              <td className="p-2 text-right">{formatCents(s.biggestLoss)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {stats.length === 0 && <p className="mt-4 text-neutral-500">No finished games yet.</p>}
    </main>
  )
}
```

- [ ] **Step 2: Verify by driving the app**

Type `/stats` in the URL bar (nothing links to it): finished-game players listed with correct totals against the finished game from Task 8; unauthenticated (incognito) `/stats` redirects to `/login`.

- [ ] **Step 3: Commit**

```bash
git add src/app/stats
git commit -m "feat: hidden lifetime stats page"
```

---

### Task 12: Full verification pass + deploy notes

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: the whole app
- Produces: clean build, green tests, end-to-end walkthrough, deploy instructions

- [ ] **Step 1: Run the whole suite and a production build**

```bash
npm test && npx tsc --noEmit && npm run build
```

Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 2: End-to-end walkthrough on the dev server (phone-sized viewport)**

1. Incognito: `/` → redirected to `/login`; wrong password rejected; right one in.
2. New game: 3 players (one brand-new name), $20 buy-in.
3. Live: two default rebuys, one custom $10 rebuy, one undo.
4. View link in a second incognito window: updates within 10 s of a rebuy; no controls.
5. Cash out short by $20 → warning with exact amount → cancel → fix → green → finish.
6. Results sorted by profit; profits sum to zero; `/stats` reflects the game.
7. `/v/<slug>` of the finished game still renders for viewers.

- [ ] **Step 3: Write `README.md`**

```markdown
# Poker Tracker

Track a recurring home poker game: buy-ins, rebuys, chip-count cash-out with a
balance check, history, and a read-only link for the table.

## Local dev

    npm install
    # .env needs DATABASE_URL (Postgres) and POKER_EDIT_PASSWORD
    npx prisma migrate dev
    npm run dev

## Tests

    npm test

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Create a free Postgres database (e.g. Vercel Postgres/Neon) and set
   `DATABASE_URL` in the Vercel project env vars.
3. Set `POKER_EDIT_PASSWORD` (the app refuses to boot without it).
4. Set the project Build Command to `npx prisma migrate deploy && next build`
   so schema migrations run on each deploy.
5. Deploy. Log in at `/login`; share `/v/<slug>` links freely — they're
   read-only. `/stats` is intentionally unlinked.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with dev, test, and Vercel deploy instructions"
```

- [ ] **Step 5: Hand deploy to the user**

Deployment itself needs the user's Vercel/GitHub accounts — stop and ask before pushing anywhere external.
