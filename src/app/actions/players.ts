'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

async function guard(): Promise<{ error: string } | null> {
  try {
    await requireAuth()
    return null
  } catch {
    return { error: 'Unauthorized' }
  }
}

async function findByNameInsensitive(name: string, excludeId?: string) {
  return prisma.player.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

export async function createPlayer(name: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }
  const existing = await findByNameInsensitive(trimmed)
  if (existing) return { error: `"${existing.name}" is already on the roster` }
  await prisma.player.create({ data: { name: trimmed } })
  revalidatePath('/players')
  return {}
}

export async function renamePlayer(id: string, name: string): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }
  const existing = await findByNameInsensitive(trimmed, id)
  if (existing) return { error: `"${existing.name}" is already on the roster` }
  await prisma.player.update({ where: { id }, data: { name: trimmed } })
  revalidatePath('/players')
  return {}
}

export async function setPlayerArchived(id: string, archived: boolean): Promise<{ error?: string }> {
  const denied = await guard()
  if (denied) return denied
  await prisma.player.update({ where: { id }, data: { archived } })
  revalidatePath('/players')
  return {}
}
