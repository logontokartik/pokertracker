import { cache } from 'react'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

export type Viewer = typeof auth.$Infer.Session.user

/** The signed-in user, or null. */
// cache(): the group layout and page both resolve the viewer in one request.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
})

/** Turn pending invites for the user's verified email into admin memberships. */
export async function claimInvites(user: Pick<Viewer, 'id' | 'email' | 'emailVerified'>) {
  if (!user.emailVerified) return
  const email = user.email.toLowerCase()
  await prisma.$transaction(async (tx) => {
    const invites = await tx.groupInvite.findMany({ where: { email } })
    if (invites.length === 0) return
    for (const invite of invites) {
      await tx.groupMember.upsert({
        where: { groupId_userId: { groupId: invite.groupId, userId: user.id } },
        create: { groupId: invite.groupId, userId: user.id, role: 'admin' },
        update: {},
      })
    }
    await tx.groupInvite.deleteMany({ where: { id: { in: invites.map((i) => i.id) } } })
  })
}

export async function isGroupAdmin(userId: string, groupId: string): Promise<boolean> {
  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  })
  return member?.role === 'admin'
}

/** Emails in SUPER_ADMIN_EMAILS (comma-separated) admin every group. Verified emails only. */
export function isSuperAdmin(viewer: Pick<Viewer, 'email' | 'emailVerified'> | null): boolean {
  if (!viewer?.emailVerified) return false
  const supers = (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return supers.includes(viewer.email.toLowerCase())
}

export async function canAdminGroup(viewer: Viewer | null, groupId: string): Promise<boolean> {
  if (!viewer) return false
  return isSuperAdmin(viewer) || isGroupAdmin(viewer.id, groupId)
}

/** Returns the signed-in user when they admin `groupId`; throws `Unauthorized` otherwise. */
export async function requireGroupAdmin(groupId: string): Promise<Viewer> {
  const viewer = await getViewer()
  if (!viewer || !(await canAdminGroup(viewer, groupId))) throw new Error('Unauthorized')
  return viewer
}

export const getGroupForViewer = cache(async (slug: string) => {
  const group = await prisma.group.findUnique({ where: { slug } })
  if (!group) return null
  const viewer = await getViewer()
  const isAdmin = await canAdminGroup(viewer, group.id)
  return { group, isAdmin, viewer }
})
