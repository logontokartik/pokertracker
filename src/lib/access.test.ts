import { describe, it, expect, vi, beforeEach } from 'vitest'

const getSession = vi.fn()
const findUnique = vi.fn()

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } } }))
vi.mock('@/lib/db', () => ({
  prisma: { groupMember: { findUnique: (...a: unknown[]) => findUnique(...a) } },
}))

import { requireGroupAdmin } from '@/lib/access'

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
