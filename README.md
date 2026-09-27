# Poker Tracker

Track recurring home poker games: buy-ins, rebuys, chip-count cash-out with a
balance check, history, and a read-only link for the table. Any number of
groups can use one deployment; each group is run by one or more admins who
sign in with Google.

## Google OAuth client

1. In the [Google Cloud Console](https://console.cloud.google.com/), pick or
   create a project, then open **APIs & Services → OAuth consent screen** and
   configure it (External is fine for a personal deployment).
2. Open **APIs & Services → Credentials → Create credentials → OAuth client
   ID**, application type **Web application**.
3. Add an **Authorized redirect URI** of
   `<BETTER_AUTH_URL>/api/auth/callback/google`, for example
   `http://localhost:3000/api/auth/callback/google` for local dev and
   `https://your-app.vercel.app/api/auth/callback/google` in production. Add
   one per environment.
4. Copy the client ID and client secret into the env vars below.

## Environment variables

See `.env.example`.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Random secret; generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | The app's base URL, e.g. `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | From the OAuth client above |
| `GOOGLE_CLIENT_SECRET` | From the OAuth client above |

`POKER_EDIT_PASSWORD` is no longer used and can be deleted.

## Local dev

    npm install
    cp .env.example .env   # then fill in the values
    npx prisma migrate dev
    npm run dev

Open `http://localhost:3000`, sign in with Google, and create a group.

## Tests

    npm test

## Deploy (Vercel)

1. Push this repo to GitHub and import it in Vercel.
2. Create a Postgres database (e.g. Vercel Postgres/Neon).
3. Set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (the production
   URL), `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Vercel project env
   vars, and add the production redirect URI to the Google OAuth client.
4. Set the project Build Command to `npx prisma migrate deploy && next build`
   so schema migrations run on each deploy.
5. Deploy.

### Upgrading an existing single-group deployment

The groups migration (`20260927120000_groups`) moves all existing players and
games into a new group, **Home Game** (`/g/home-game`), and creates a pending
admin invite for `logontokartik@gmail.com`. That account becomes the group's
admin the first time it signs in with Google. It can then invite co-admins from
the group's Settings page.

Back up the production database (e.g. `pg_dump`) before deploying this
migration. It changes the players and games tables (adds a required group
column, replaces the unique player-name index) and has no automatic rollback.

## Admins and invites

- Whoever creates a group is its admin. Admins can invite co-admins by email
  from **Settings**. No email is sent: share the app link, and the invite is
  claimed when that person signs in with Google using that email.
- A group always keeps at least one admin.

## Public links

- `/g/<slug>`: the group link. Anyone can open it, but the public sees only
  games that are currently live. History, roster and stats are admin-only.
- `/v/<viewSlug>`: the read-only view of one game, shareable with the table
  while the game is live. Once the game is finished the link returns 404.
  Admins who open it are sent to the admin page for that game.
- Public pages are marked `noindex, nofollow` so search engines don't list
  them.
