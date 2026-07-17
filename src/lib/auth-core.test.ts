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
