'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { parseDollarsToCents } from '@/lib/money'

async function guard(): Promise<{ error: string } | null> {
  try {
    await requireAuth()
    return null
  } catch {
    return { error: 'Unauthorized' }
  }
}

export async function createGame(
  _prev: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string }> {
  const denied = await guard()
  if (denied) return denied

  const label = String(formData.get('label') ?? '').trim() || null
  const buyIn = parseDollarsToCents(String(formData.get('buyIn') ?? ''))
  if (buyIn === null || buyIn <= 0) return { error: 'Buy-in must be a positive amount' }

  const playerIds = formData.getAll('playerIds').map(String)
  const newNames = String(formData.get('newNames') ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

  const gameId = await prisma.$transaction(async (tx) => {
    const allIds = [...playerIds]
    for (const name of newNames) {
      const existing = await tx.player.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
      })
      const player = existing ?? (await tx.player.create({ data: { name } }))
      if (!allIds.includes(player.id)) allIds.push(player.id)
    }
    if (allIds.length === 0) throw new Error('no-players')

    const game = await tx.game.create({
      data: {
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
  revalidatePath('/')
  redirect(`/game/${gameId}`)
}

async function loadActiveGamePlayer(gamePlayerId: string) {
  const gp = await prisma.gamePlayer.findUnique({
    where: { id: gamePlayerId },
    include: { game: true },
  })
  if (!gp) return { gp: null, error: 'Player not found' }
  if (gp.game.status !== 'ACTIVE') return { gp: null, error: 'Game is finished' }
  return { gp, error: null }
}

function revalidateGame(game: { id: string; viewSlug: string }) {
  revalidatePath('/')
  revalidatePath('/live')
  revalidatePath(`/game/${game.id}`)
  revalidatePath(`/v/${game.viewSlug}`)
}

export async function deleteGame(gameId: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) return { error: 'Game not found' }
  await prisma.game.delete({ where: { id: gameId } })
  revalidatePath('/')
  revalidatePath('/live')
  revalidatePath(`/v/${game.viewSlug}`)
  redirect('/')
}

export async function setFoodBill(
  gameId: string,
  foodBillCents: number | null
): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  if (foodBillCents !== null && (!Number.isInteger(foodBillCents) || foodBillCents < 0)) {
    return { error: 'Food bill must be zero or more' }
  }
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) return { error: 'Game not found' }
  await prisma.game.update({ where: { id: gameId }, data: { foodBillCents } })
  revalidateGame(game)
  return {}
}

export async function setMiscAdj(
  gamePlayerId: string,
  miscAdjCents: number
): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  if (!Number.isInteger(miscAdjCents)) return { error: 'Adjustment must be a dollar amount' }
  const gp = await prisma.gamePlayer.findUnique({
    where: { id: gamePlayerId },
    include: { game: true },
  })
  if (!gp) return { error: 'Player not found' }
  await prisma.gamePlayer.update({ where: { id: gamePlayerId }, data: { miscAdjCents } })
  revalidateGame(gp.game)
  return {}
}

export async function addRebuy(
  gamePlayerId: string,
  amountCents?: number
): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  const amount = amountCents ?? gp.game.defaultBuyIn
  if (!Number.isInteger(amount) || amount <= 0) return { error: 'Amount must be positive' }
  await prisma.buyIn.create({ data: { gamePlayerId, amount } })
  revalidateGame(gp.game)
  return {}
}

export async function undoLastBuyIn(gamePlayerId: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  const last = await prisma.buyIn.findFirst({
    where: { gamePlayerId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  if (!last) return { error: 'No buy-ins to undo' }
  await prisma.buyIn.delete({ where: { id: last.id } })
  revalidateGame(gp.game)
  return {}
}

export async function addPlayerToGame(
  gameId: string,
  playerId: string
): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) return { error: 'Game not found' }
  if (game.status !== 'ACTIVE') return { error: 'Game is finished' }
  await prisma.gamePlayer.create({
    data: { gameId, playerId, buyIns: { create: { amount: game.defaultBuyIn } } },
  })
  revalidateGame(game)
  return {}
}

export async function removePlayerFromGame(gamePlayerId: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  const buyInCount = await prisma.buyIn.count({ where: { gamePlayerId } })
  if (buyInCount > 0) {
    return { error: 'Player has buy-ins — undo them first, or cash them out instead' }
  }
  await prisma.gamePlayer.delete({ where: { id: gamePlayerId } })
  revalidateGame(gp.game)
  return {}
}

export async function setFinalStack(
  gamePlayerId: string,
  stackCents: number | null
): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const { gp, error } = await loadActiveGamePlayer(gamePlayerId)
  if (!gp) return { error: error! }
  if (stackCents !== null && (!Number.isInteger(stackCents) || stackCents < 0)) {
    return { error: 'Stack must be zero or more' }
  }
  await prisma.gamePlayer.update({ where: { id: gamePlayerId }, data: { finalStack: stackCents } })
  revalidateGame(gp.game)
  return {}
}

export async function finishGame(gameId: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const game = await prisma.game.findUnique({ where: { id: gameId } })
  if (!game) return { error: 'Game not found' }
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
  revalidateGame(game)
  return {}
}
