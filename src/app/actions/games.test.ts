import { describe, it, expect, vi } from 'vitest'

// Unauthenticated caller: cookie store has no auth cookie.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect') } }))

import { addRebuy, finishGame, setFinalStack, undoLastBuyIn } from '@/app/actions/games'

describe('server action auth', () => {
  it('rejects an unauthenticated addRebuy before touching the database', async () => {
    expect(await addRebuy('some-id')).toEqual({ error: 'Unauthorized' })
  })
  it('rejects an unauthenticated undoLastBuyIn', async () => {
    expect(await undoLastBuyIn('some-id')).toEqual({ error: 'Unauthorized' })
  })
  it('rejects an unauthenticated setFinalStack', async () => {
    expect(await setFinalStack('some-id', 1000)).toEqual({ error: 'Unauthorized' })
  })
  it('rejects an unauthenticated finishGame', async () => {
    expect(await finishGame('some-id')).toEqual({ error: 'Unauthorized' })
  })
})
