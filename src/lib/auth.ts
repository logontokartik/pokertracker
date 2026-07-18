import { cookies } from 'next/headers'
import { isValidToken } from '@/lib/auth-core'

export const AUTH_COOKIE = 'poker_auth'

export async function isAuthed(): Promise<boolean> {
  const store = await cookies()
  return isValidToken(store.get(AUTH_COOKIE)?.value)
}

export async function requireAuth(): Promise<void> {
  if (!(await isAuthed())) throw new Error('Unauthorized')
}
