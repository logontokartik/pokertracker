'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireGroupAdmin } from '@/lib/access'
import { parseDollarsToCents } from '@/lib/money'
import { isUniqueViolation } from '@/lib/db-errors'

type Result = { error?: string }

/** Admin check for the group that owns a record. `groupId` always comes from the DB. */
async function guard(groupId: string): Promise<{ error: string } | null> {
  try {
    await requireGroupAdmin(groupId)
    return null
  } catch {
    return { error: 'Unauthorized' }
  }
}

const withGroupSlug = { group: { select: { slug: true } } } as const

function loadGame(gameId: string) {
  return prisma.game.findUnique({ where: { id: gameId }, include: withGroupSlug })
}

function loadGamePlayer(gamePlayerId: string) {
  return prisma.gamePlayer.findUnique({
    where: { id: gamePlayerId },
    include: { game: { include: withGroupSlug } },
  })
}

function revalidateGame(game: { id: string; viewSlug: string }, slug: string) {
  revalidatePath(`/g/${slug}`)
  revalidatePath(`/g/${slug}/game/${game.id}`)
  revalidatePath(`/g/${slug}/stats`)
  revalidatePath(`/v/${game.viewSlug}`)
}

/** Loads a game player, checks admin rights on its group, and requires the game to be live. */
async function loadActiveGamePlayer(gamePlayerId: string) {
  const gp = await loadGamePlayer(gamePlayerId)
  if (!gp) return { gp: null, error: 'Player not found' }
  const denied = await guard(gp.game.groupId)
  if (denied) return { gp: null, error: denied.error }
  if (gp.game.status !== 'ACTIVE') return { gp: null, error: 'Game is finished' }
  return { gp, error: null }
}

export async function createGame(
  groupId: string,
  _prev: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string }> {
  const denied = await guard(groupId)
  if (denied) return denied
  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) return { error: 'Group not found' }

  const label = String(formData.get('label') ?? '').trim() || null
  const buyIn = parseDollarsToCents(String(formData.get('buyIn') ?? ''))
  if (buyIn === null || buyIn <= 0) return { error: 'Buy-in must be a positive amount' }

  const requestedIds = [...new Set(formData.getAll('playerIds').map(String))]
  const newNames = String(formData.get('newNames') ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

  const rosterIds = (
    await prisma.player.findMany({
      where: { id: { in: requestedIds }, groupId, archived: false },
      select: { id: true },
    })
  ).map((p) => p.id)
  if (rosterIds.length !== requestedIds.length) {
    return { error: 'Some selected players are not on this roster — reload and try again' }
  }

  const gameId = await prisma.$transaction(async (tx) => {
    const allIds = [...rosterIds]
    for (const name of newNames) {
      const existing = await tx.player.findFirst({
        where: { groupId, name: { equals: name, mode: 'insensitive' } },
      })
      const player = existing ?? (await tx.player.create({ data: { groupId, name } }))
      if (!allIds.includes(player.id)) allIds.push(player.id)
    }
    if (allIds.length === 0) throw new Error('no-players')

    const game = await tx.game.create({
      data: {
        groupId,
        label,
        defaultBuyIn: buyIn,
        viewSlug: randomBytes(9).toString('base64url'),
        players: {
          create: allIds.map((playerId) => ({
            playerId,
            buyIns: { create: { amount: buyIn } },
          })),
        },
      },
    })
    return game.id
  }).catch((e) => (e instanceof Error && e.message === 'no-players' ? null : Promise.reject(e)))

  if (gameId === null) return { error: 'Pick at least one player' }
  revalidatePath(`/g/${group.slug}`)
  revalidatePath(`/g/${group.slug}/players`)
  redirect(`/g/${group.slug}/game/${gameId}`)
}

export async function deleteGame(gameId: string): Promise<Result> {
  const game = await loadGame(gameId)
  if (!game) return { error: 'Game not found' }
  const denied = await guard(game.groupId)
  if (denied) return denied
  await prisma.game.delete({ where: { id: gameId } })
  revalidateGame(game, game.group.slug)
  redirect(`/g/${game.group.slug}`)
}

export async function setFoodBill(gameId: string, foodBillCents: number | null): Promise<Result> {
  const game = await loadGame(gameId)
  if (!game) return { error: 'Game not found' }
  const denied = await guard(game.groupId)
  if (denied) return denied
  if (foodBillCents !== null && (!Number.isInteger(foodBillCents) || foodBillCents < 0)) {
    return { error: 'Food bill must be zero or more' }
  }
  await prisma.game.update({ where: { id: gameId }, data: { foodBillCents } })
  revalidateGame(game, game.group.slug)
  return {}
}

export async function setMiscAdj(gamePlayerId: string, miscAdjCents: number): Promise<Result> {
  const gp = await loadGamePlayer(gamePlayerId)
  if (!gp) return { error: 'Player not found' }
  const denied = await guard(gp.game.groupId)
  if (denied) return denied
  if (gp.game.status !== 'FINISHED') {
    return { error: 'Adjustments can only be made after the game is finished' }
  }
  if (!Number.isInteger(miscAdjCents)) return { error: 'Adjustment must be a dollar amount' }
  await prisma.gamePlayer.update({ where: { id: gamePlayerId }, data: { miscAdjCents } })
  revalidateGame(gp.game, gp.game.group.slug)
  return {}
}

export async function addRebuy(gamePlayerId: string, amountCents?: number): Promise<Result> {
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  const amount = amountCents ?? gp.game.defaultBuyIn
  if (!Number.isInteger(amount) || amount <= 0) return { error: 'Amount must be positive' }
  await prisma.buyIn.create({ data: { gamePlayerId, amount } })
  revalidateGame(gp.game, gp.game.group.slug)
  return {}
}

export async function undoLastBuyIn(gamePlayerId: string): Promise<Result> {
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  const last = await prisma.buyIn.findFirst({
    where: { gamePlayerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  if (!last) return { error: 'No buy-ins to undo' }
  await prisma.buyIn.delete({ where: { id: last.id } })
  revalidateGame(gp.game, gp.game.group.slug)
  return {}
}

export async function addPlayerToGame(gameId: string, playerId: string): Promise<Result> {
  const game = await loadGame(gameId)
  if (!game) return { error: 'Game not found' }
  const denied = await guard(game.groupId)
  if (denied) return denied
  if (game.status !== 'ACTIVE') return { error: 'Game is finished' }

  const player = await prisma.player.findUnique({ where: { id: playerId } })
  if (!player || player.groupId !== game.groupId) return { error: 'Player not found' }
  if (player.archived) return { error: `${player.name} is archived — unarchive them first` }

  const already = await prisma.gamePlayer.findUnique({
    where: { gameId_playerId: { gameId, playerId } },
  })
  if (already) return { error: `${player.name} is already in this game` }

  try {
    await prisma.gamePlayer.create({
      data: { gameId, playerId, buyIns: { create: { amount: game.defaultBuyIn } } },
    })
  } catch (e) {
    // Lost a race with a concurrent add of the same player.
    if (isUniqueViolation(e)) {
      return { error: `${player.name} is already in this game` }
    }
    throw e
  }
  revalidateGame(game, game.group.slug)
  return {}
}

export async function removePlayerFromGame(gamePlayerId: string): Promise<Result> {
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  // "Added by mistake": only the auto-created entry buy-in and no final stack.
  const buyInCount = await prisma.buyIn.count({ where: { gamePlayerId } })
  if (buyInCount > 1 || gp.finalStack !== null) {
    return { error: 'Player has buy-ins — undo them first, or cash them out instead' }
  }
  await prisma.gamePlayer.delete({ where: { id: gamePlayerId } })
  revalidateGame(gp.game, gp.game.group.slug)
  return {}
}

export async function setFinalStack(
  gamePlayerId: string,
  stackCents: number | null
): Promise<Result> {
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  if (stackCents !== null && (!Number.isInteger(stackCents) || stackCents < 0)) {
    return { error: 'Stack must be zero or more' }
  }
  await prisma.gamePlayer.update({ where: { id: gamePlayerId }, data: { finalStack: stackCents } })
  revalidateGame(gp.game, gp.game.group.slug)
  return {}
}

export async function finishGame(gameId: string): Promise<Result> {
  const game = await loadGame(gameId)
  if (!game) return { error: 'Game not found' }
  const denied = await guard(game.groupId)
  if (denied) return denied
  if (game.status !== 'ACTIVE') return { error: 'Game is already finished' }
  // Anyone still uncounted at the finish busted out: they leave with no chips.
  await prisma.$transaction([
    prisma.gamePlayer.updateMany({
      where: { gameId, finalStack: null },
      data: { finalStack: 0 },
    }),
    prisma.game.update({
      where: { id: gameId },
      data: { status: 'FINISHED', finishedAt: new Date() },
    }),
  ])
  revalidateGame(game, game.group.slug)
  return {}
}
