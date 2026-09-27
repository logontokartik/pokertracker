'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireGroupAdmin } from '@/lib/access'
import { isUniqueViolation } from '@/lib/db-errors'

type Result = { error?: string }

async function guard(groupId: string): Promise<{ error: string } | null> {
  try {
    await requireGroupAdmin(groupId)
    return null
  } catch {
    return { error: 'Unauthorized' }
  }
}

function loadPlayer(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: { group: { select: { slug: true } } },
  })
}

async function findByNameInsensitive(groupId: string, name: string, excludeId?: string) {
  return prisma.player.findFirst({
    where: {
      groupId,
      name: { equals: name, mode: 'insensitive' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

function revalidateRoster(slug: string) {
  revalidatePath(`/g/${slug}/players`)
  revalidatePath(`/g/${slug}/game/new`)
}

export async function createPlayer(groupId: string, name: string): Promise<Result> {
  const denied = await guard(groupId)
  if (denied) return denied
  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) return { error: 'Group not found' }
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }
  const existing = await findByNameInsensitive(groupId, trimmed)
  if (existing) return { error: `"${existing.name}" is already on the roster` }
  try {
    await prisma.player.create({ data: { groupId, name: trimmed } })
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `"${trimmed}" is already on the roster` }
    throw e
  }
  revalidateRoster(group.slug)
  return {}
}

export async function renamePlayer(id: string, name: string): Promise<Result> {
  const player = await loadPlayer(id)
  if (!player) return { error: 'Player not found' }
  const denied = await guard(player.groupId)
  if (denied) return denied
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }
  const existing = await findByNameInsensitive(player.groupId, trimmed, id)
  if (existing) return { error: `"${existing.name}" is already on the roster` }
  try {
    await prisma.player.update({ where: { id }, data: { name: trimmed } })
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `"${trimmed}" is already on the roster` }
    throw e
  }
  revalidateRoster(player.group.slug)
  return {}
}

export async function setPlayerArchived(id: string, archived: boolean): Promise<Result> {
  const player = await loadPlayer(id)
  if (!player) return { error: 'Player not found' }
  const denied = await guard(player.groupId)
  if (denied) return denied
  await prisma.player.update({ where: { id }, data: { archived } })
  revalidateRoster(player.group.slug)
  return {}
}
