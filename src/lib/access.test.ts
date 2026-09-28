import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const findUnique = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('@/lib/db', () => ({
  prisma: { groupMember: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}))

import { isSuperAdmin, requireGroupAdmin } from '@/lib/access'

const user = { id: 'u1', email: 'a@b.com', emailVerified: true, name: 'A' }

describe('requireGroupAdmin', () => {
  beforeEach(() => {
    getSession.mockReset()
    findUnique.mockReset()
  })

  it('throws Unauthorized with no session', async () => {
    getSession.mockResolvedValue(null)
    await expect(requireGroupAdmin('g1')).rejects.toThrow('Unauthorized')
    expect(findUnique).not.toHaveBeenCalled()
  })

  it('throws Unauthorized when the user is not a member', async () => {
    getSession.mockResolvedValue({ user, session: {} })
    findUnique.mockResolvedValue(null)
    await expect(requireGroupAdmin('g1')).rejects.toThrow('Unauthorized')
    expect(findUnique).toHaveBeenCalledWith({
      where: { groupId_userId: { groupId: 'g1', userId: 'u1' } },
    })
  })

  it('returns the user for an admin', async () => {
    getSession.mockResolvedValue({ user, session: {} })
    findUnique.mockResolvedValue({ id: 'm1', groupId: 'g1', userId: 'u1', role: 'admin' })
    await expect(requireGroupAdmin('g1')).resolves.toEqual(user)
  })
})

describe('super admin', () => {
  beforeEach(() => {
    getSession.mockReset()
    findUnique.mockReset()
    process.env.SUPER_ADMIN_EMAILS = 'Boss@Example.com, other@example.com'
  })

  it('admins any group without a membership', async () => {
    getSession.mockResolvedValue({ user: { ...user, email: 'boss@example.com' }, session: {} })
    findUnique.mockResolvedValue(null)
    await expect(requireGroupAdmin('g1')).resolves.toMatchObject({ email: 'boss@example.com' })
  })

  it('ignores unverified emails', () => {
    expect(isSuperAdmin({ email: 'boss@example.com', emailVerified: false })).toBe(false)
  })

  it('does not match other users', () => {
    expect(isSuperAdmin({ email: 'a@b.com', emailVerified: true })).toBe(false)
    expect(isSuperAdmin(null)).toBe(false)
  })
})
