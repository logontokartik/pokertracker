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
