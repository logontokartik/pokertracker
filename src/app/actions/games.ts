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
