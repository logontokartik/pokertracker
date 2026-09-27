import { describe, it, expect, vi, beforeEach } from 'vitest'

// Session and database are mocked; the real access helpers run in between.
const getSession = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: (...a: unknown[]) => getSession(...a) } },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('redirect')
  },
}))

const db = vi.hoisted(() => {
  const fn = () => vi.fn()
  return {
    game: { findUnique: fn(), update: fn(), delete: fn(), create: fn() },
    gamePlayer: { findUnique: fn(), update: fn(), updateMany: fn(), delete: fn(), create: fn() },
    buyIn: { create: fn(), findFirst: fn(), delete: fn(), count: fn() },
    player: { findUnique: fn(), findFirst: fn(), findMany: fn(), create: fn(), update: fn() },
    group: { findUnique: fn(), create: fn(), update: fn() },
    groupMember: { findUnique: fn(), create: fn(), delete: fn(), count: fn() },
    groupInvite: { findUnique: fn(), upsert: fn(), delete: fn() },
    user: { findFirst: fn() },
    $transaction: fn(),
  }
})
vi.mock('@/lib/db', () => ({ prisma: db }))

import {
  addPlayerToGame,
  addRebuy,
  createGame,
  finishGame,
  removePlayerFromGame,
  setFinalStack,
  setMiscAdj,
  undoLastBuyIn,
} from '@/app/actions/games'
import { createPlayer, renamePlayer, setPlayerArchived } from '@/app/actions/players'
import {
  createGroup,
  inviteAdmin,
  removeMember,
  renameGroup,
  revokeInvite,
} from '@/app/actions/groups'

const UNAUTHORIZED = { error: 'Unauthorized' }

function game(groupId: string, status: 'ACTIVE' | 'FINISHED' = 'ACTIVE') {
  return {
    id: `game-${groupId}`,
    groupId,
    viewSlug: `view-${groupId}`,
    status,
    defaultBuyIn: 2000,
    group: { slug: `slug-${groupId}` },
  }
}
function gamePlayer(groupId: string, status: 'ACTIVE' | 'FINISHED' = 'ACTIVE') {
  return { id: `gp-${groupId}`, finalStack: null, game: game(groupId, status) }
}
function player(groupId: string) {
  return { id: `p-${groupId}`, groupId, name: `Player ${groupId}`, archived: false, group: { slug: `slug-${groupId}` } }
}
function formData(entries: Record<string, string | string[]>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(entries)) for (const x of [v].flat()) fd.append(k, x)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  // Every record lookup succeeds, so any rejection comes from the access check.
  db.game.findUnique.mockImplementation(async ({ where }) => game(where.id === 'game-A' ? 'A' : 'B'))
  db.gamePlayer.findUnique.mockImplementation(async ({ where }) =>
    where.id ? gamePlayer(where.id === 'gp-A' ? 'A' : 'B') : null
  )
  db.player.findUnique.mockImplementation(async ({ where }) => player(where.id === 'p-A' ? 'A' : 'B'))
  db.group.findUnique.mockImplementation(async ({ where }) => ({ id: where.id, slug: `slug-${where.id}` }))
  db.groupInvite.findUnique.mockResolvedValue({ id: 'inv', groupId: 'B', group: { slug: 'slug-B' } })
  db.groupMember.findUnique.mockImplementation(async ({ where }) => {
    if (where.id) return { id: where.id, groupId: 'B', userId: 'u2', role: 'admin', group: { slug: 'slug-B' } }
    const { groupId, userId } = where.groupId_userId
    return groupId === 'A' && userId === 'u1' ? { id: 'm1', groupId, userId, role: 'admin' } : null
  })
})

describe('signed out', () => {
  beforeEach(() => getSession.mockResolvedValue(null))

  it.each([
    ['addRebuy', () => addRebuy('gp-A')],
    ['undoLastBuyIn', () => undoLastBuyIn('gp-A')],
    ['setFinalStack', () => setFinalStack('gp-A', 1000)],
    ['finishGame', () => finishGame('game-A')],
    ['createGame', () => createGame('A', undefined, formData({ buyIn: '20', newNames: 'Al' }))],
    ['createPlayer', () => createPlayer('A', 'Al')],
    ['renamePlayer', () => renamePlayer('p-A', 'Al')],
    ['setPlayerArchived', () => setPlayerArchived('p-A', true)],
    ['createGroup', () => createGroup(undefined, formData({ name: 'Friday' }))],
    ['renameGroup', () => renameGroup('A', 'New name')],
    ['inviteAdmin', () => inviteAdmin('A', 'x@example.com')],
    ['revokeInvite', () => revokeInvite('inv')],
    ['removeMember', () => removeMember('m1')],
  ])('rejects %s', async (_name, call) => {
    expect(await call()).toEqual(UNAUTHORIZED)
    expect(db.buyIn.create).not.toHaveBeenCalled()
    expect(db.player.create).not.toHaveBeenCalled()
    expect(db.group.create).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe('admin of group A acting on group B records', () => {
  beforeEach(() =>
    getSession.mockResolvedValue({
      user: { id: 'u1', email: 'a@example.com', emailVerified: true, name: 'A' },
      session: {},
    })
  )

  it.each([
    ['addRebuy', () => addRebuy('gp-B')],
    ['setFinalStack', () => setFinalStack('gp-B', 1000)],
    ['setMiscAdj', () => setMiscAdj('gp-B', 100)],
    ['finishGame', () => finishGame('game-B')],
    ['addPlayerToGame', () => addPlayerToGame('game-B', 'p-B')],
    ['createGame', () => createGame('B', undefined, formData({ buyIn: '20', newNames: 'Al' }))],
    ['createPlayer', () => createPlayer('B', 'Al')],
    ['renamePlayer', () => renamePlayer('p-B', 'Al')],
    ['renameGroup', () => renameGroup('B', 'Mine now')],
    ['inviteAdmin', () => inviteAdmin('B', 'x@example.com')],
    ['revokeInvite', () => revokeInvite('inv')],
    ['removeMember', () => removeMember('m-other')],
  ])('rejects %s', async (_name, call) => {
    expect(await call()).toEqual(UNAUTHORIZED)
    expect(db.buyIn.create).not.toHaveBeenCalled()
    expect(db.game.update).not.toHaveBeenCalled()
    expect(db.gamePlayer.create).not.toHaveBeenCalled()
    expect(db.player.update).not.toHaveBeenCalled()
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('allows a rebuy in their own group', async () => {
    expect(await addRebuy('gp-A')).toEqual({})
    expect(db.buyIn.create).toHaveBeenCalledWith({ data: { gamePlayerId: 'gp-A', amount: 2000 } })
  })

  it('will not add a player from another group to their game', async () => {
    expect(await addPlayerToGame('game-A', 'p-B')).toEqual({ error: 'Player not found' })
    expect(db.gamePlayer.create).not.toHaveBeenCalled()
  })

  it('will not start a game with players from another group', async () => {
    db.player.findMany.mockResolvedValue([])
    const result = await createGame('A', undefined, formData({ buyIn: '20', playerIds: 'p-B' }))
    expect(result.error).toMatch(/not on this roster/)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('returns a friendly error when adding a player twice', async () => {
    db.gamePlayer.findUnique.mockImplementation(async ({ where }) =>
      where.gameId_playerId ? { id: 'existing' } : null
    )
    expect(await addPlayerToGame('game-A', 'p-A')).toEqual({
      error: 'Player A is already in this game',
    })
  })

  it('lets a player added by mistake be removed', async () => {
    db.buyIn.count.mockResolvedValue(1)
    expect(await removePlayerFromGame('gp-A')).toEqual({})
    expect(db.gamePlayer.delete).toHaveBeenCalledWith({ where: { id: 'gp-A' } })
  })

  it('keeps players with rebuys', async () => {
    db.buyIn.count.mockResolvedValue(2)
    expect((await removePlayerFromGame('gp-A')).error).toMatch(/buy-ins/)
    expect(db.gamePlayer.delete).not.toHaveBeenCalled()
  })

  it('only allows misc adjustments once the game is finished', async () => {
    expect((await setMiscAdj('gp-A', 500)).error).toMatch(/finished/)
    db.gamePlayer.findUnique.mockResolvedValue(gamePlayer('A', 'FINISHED'))
    expect(await setMiscAdj('gp-A', 500)).toEqual({})
  })
})
