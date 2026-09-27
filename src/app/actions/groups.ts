'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getViewer, requireGroupAdmin } from '@/lib/access'
import { isUniqueViolation } from '@/lib/db-errors'
import { slugify } from '@/lib/slug'

type Result = { error?: string }

const MAX_NAME = 60
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function guard(groupId: string): Promise<{ error: string } | null> {
  try {
    await requireGroupAdmin(groupId)
    return null
  } catch {
    return { error: 'Unauthorized' }
  }
}

function validateName(raw: string): { name: string } | { error: string } {
  const name = raw.trim()
  if (!name) return { error: 'Group name is required' }
  if (name.length > MAX_NAME) return { error: `Group name must be ${MAX_NAME} characters or fewer` }
  return { name }
}

function revalidateGroup(slug: string) {
  revalidatePath('/')
  revalidatePath(`/g/${slug}`, 'layout')
}

export async function createGroup(
  _prev: { error: string } | undefined,
  formData: FormData
): Promise<{ error: string }> {
  const viewer = await getViewer()
  if (!viewer) return { error: 'Unauthorized' }
  const parsed = validateName(String(formData.get('name') ?? ''))
  if ('error' in parsed) return parsed

  const base = slugify(parsed.name)
  let slug: string | null = null
  for (let attempt = 0; attempt < 5 && slug === null; attempt++) {
    const candidate =
      attempt === 0 ? base : `${base.slice(0, 33).replace(/-+$/, '')}-${randomBytes(3).toString('hex')}`
    try {
      await prisma.group.create({
        data: {
          name: parsed.name,
          slug: candidate,
          members: { create: { userId: viewer.id, role: 'admin' } },
        },
      })
      slug = candidate
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
    }
  }
  if (slug === null) return { error: 'Could not create the group — please try again' }

  revalidatePath('/')
  redirect(`/g/${slug}`)
}

export async function renameGroup(groupId: string, name: string): Promise<Result> {
  const denied = await guard(groupId)
  if (denied) return denied
  const parsed = validateName(name)
  if ('error' in parsed) return parsed
  const group = await prisma.group.update({ where: { id: groupId }, data: { name: parsed.name } })
  revalidateGroup(group.slug)
  return {}
}

export async function inviteAdmin(groupId: string, email: string): Promise<Result> {
  let inviter
  try {
    inviter = await requireGroupAdmin(groupId)
  } catch {
    return { error: 'Unauthorized' }
  }
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalized)) return { error: 'Enter a valid email address' }
  const group = await prisma.group.findUnique({ where: { id: groupId } })
  if (!group) return { error: 'Group not found' }

  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
  })
  if (user) {
    const existing = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId: user.id } },
    })
    if (existing) return { error: `${normalized} is already an admin` }
    await prisma.groupMember.create({ data: { groupId, userId: user.id, role: 'admin' } })
  } else {
    await prisma.groupInvite.upsert({
      where: { groupId_email: { groupId, email: normalized } },
      create: { groupId, email: normalized, invitedById: inviter.id },
      update: {},
    })
  }
  revalidatePath(`/g/${group.slug}/settings`)
  return {}
}

export async function revokeInvite(inviteId: string): Promise<Result> {
  const invite = await prisma.groupInvite.findUnique({
    where: { id: inviteId },
    include: { group: { select: { slug: true } } },
  })
  if (!invite) return { error: 'Invite not found' }
  const denied = await guard(invite.groupId)
  if (denied) return denied
  await prisma.groupInvite.delete({ where: { id: inviteId } })
  revalidatePath(`/g/${invite.group.slug}/settings`)
  return {}
}

/** Removes an admin from a group. Removing yourself is "leave group". */
export async function removeMember(memberId: string): Promise<Result> {
  const member = await prisma.groupMember.findUnique({
    where: { id: memberId },
    include: { group: { select: { slug: true } } },
  })
  if (!member) return { error: 'Admin not found' }
  let viewer
  try {
    viewer = await requireGroupAdmin(member.groupId)
  } catch {
    return { error: 'Unauthorized' }
  }

  const removed = await prisma.$transaction(async (tx) => {
    const admins = await tx.groupMember.count({
      where: { groupId: member.groupId, role: 'admin' },
    })
    if (member.role === 'admin' && admins <= 1) return false
    await tx.groupMember.delete({ where: { id: memberId } })
    return true
  })
  if (!removed) {
    return { error: 'A group needs at least one admin — invite another admin first' }
  }

  revalidateGroup(member.group.slug)
  if (member.userId === viewer.id) redirect('/')
  return {}
}
