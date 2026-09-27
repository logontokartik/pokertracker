# Groups & Google sign-in — design (2026-09-27)

Turn the single-tenant poker tracker into a multi-group app that any group of
players can use. Modeled on volleyball-score-tracker's clubs (group with slug,
members with role, email-keyed invites claimed on sign-in), rebuilt on this
app's Next 16 + Prisma 7 + Postgres stack.

## Decisions (confirmed with user 2026-09-27)

- **Auth:** Google sign-in only (sign-up == first sign-in). Library: Better Auth
  (v1.6.x) with its Prisma adapter. The shared `POKER_EDIT_PASSWORD` is removed.
- **Roles:** admins only. The group creator is an admin and can invite co-admins
  by email. Everyone else is a public viewer with no account.
- **Existing data:** migrated into a first group "Home Game" (slug `home-game`),
  with a pending admin invite for `logontokartik@gmail.com` that is claimed on
  first Google sign-in.
- **Public visibility:** only live games are public. Once a game is finished,
  its `/v/<viewSlug>` link returns 404 and it is visible only to that group's
  admins. The group page shows the public only the live game(s). Roster,
  history and stats are admin-only.

## Data model

Better Auth's core tables (`User`, `Session`, `Account`, `Verification`), in
the shape its CLI generates for the Prisma adapter, plus:

```prisma
model Group {
  id        String        @id @default(cuid())
  name      String
  slug      String        @unique
  createdAt DateTime      @default(now())
  members   GroupMember[]
  invites   GroupInvite[]
  players   Player[]
  games     Game[]
}

model GroupMember {
  id        String   @id @default(cuid())
  groupId   String
  userId    String
  role      String   @default("admin")
  createdAt DateTime @default(now())
  group     Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([groupId, userId])
}

model GroupInvite {
  id          String   @id @default(cuid())
  groupId     String
  email       String   // always lowercased
  invitedById String?
  createdAt   DateTime @default(now())
  group       Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@unique([groupId, email])
}
```

- `Player` gains `groupId` (required, cascade). `name @unique` becomes
  `@@unique([groupId, name])`.
- `Game` gains `groupId` (required, cascade, indexed).
- The migration backfills: it creates the `home-game` group, points every
  existing player and game at it, and inserts the invite row.

## Access control

- `src/lib/auth.ts` holds the Better Auth instance (Google provider, Prisma
  adapter).
- `src/lib/access.ts` holds the helpers:
  - `getViewer()` returns the session user or null.
  - `claimInvites(user)` turns pending invites for the user's verified email
    into memberships. It is called on the groups dashboard.
  - `getGroupForViewer(slug)` returns `{ group, isAdmin }` or null.
  - `requireGroupAdmin(groupId)` returns the user, or throws `Unauthorized`.
- **Every server action resolves the target record's `groupId` from the DB**
  (never from the client) and calls `requireGroupAdmin(groupId)` before any
  write. A cross-group ID must fail with `Unauthorized`.
- Last-admin guard: a group always keeps at least one admin.

## Routes

| Route | Who | What |
|---|---|---|
| `/` | all | Signed out: pitch + "Sign in with Google". Signed in: my groups, pending invites auto-claimed, create-group form. |
| `/g/[slug]` | admin | Games list (live + history), start game. |
| `/g/[slug]` | public | Live game(s) only, each linking to `/v/<viewSlug>`. Otherwise "No game live right now". |
| `/g/[slug]/game/new` | admin | New game form (roster scoped to group). |
| `/g/[slug]/game/[id]` | admin | Current live-edit / results / food admin page. Non-admins get a redirect to `/v/<viewSlug>` if live, else 404. |
| `/g/[slug]/players` | admin | Roster admin. |
| `/g/[slug]/stats` | admin | Lifetime stats for the group. |
| `/g/[slug]/settings` | admin | Rename group, admins list, invite by email, revoke invite, remove admin, leave. |
| `/v/[viewSlug]` | public | Results table while ACTIVE; 404 when FINISHED. |

Removed: `/live`, `/game/*`, `/players`, `/stats`, `AdminBar`, `auth-core`.
`BottomNav` becomes group-scoped (Games / Roster / Stats / Settings) and shows
only for admins inside `/g/[slug]`. It is hidden on `/v/*` and `/`.

Slugs: `slugify(name)` gives `[a-z0-9-]`, 3–40 chars. On collision, append a
short random suffix.

## Bug fixes folded in (from review)

- `addPlayerToGame`: verify the player belongs to the game's group and is not
  archived, and return a friendly error on duplicates instead of throwing.
- `removePlayerFromGame`: allowed when the player has only their auto-created
  entry buy-in and no final stack ("added by mistake"). Otherwise the current
  error is kept.
- `setMiscAdj`: only allowed on FINISHED games (it's a settlement adjustment).

## Env

`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`. The Google OAuth redirect URI is
`<BETTER_AUTH_URL>/api/auth/callback/google`.

## Out of scope

Invite emails (the admin shares the app URL; an invite is claimed on sign-in),
scorer role, super-admin console, and moving games between groups.
