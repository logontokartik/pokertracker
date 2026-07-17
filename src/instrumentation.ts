export async function register() {
  if (!process.env.POKER_EDIT_PASSWORD) {
    throw new Error(
      'POKER_EDIT_PASSWORD is not set. Set it in .env (local) or Vercel project env vars.'
    )
  }
}
