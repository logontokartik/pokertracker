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
