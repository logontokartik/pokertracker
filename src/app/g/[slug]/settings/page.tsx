import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getGroupForViewer } from '@/lib/access'
import {
  AdminList,
  InviteForm,
  InviteList,
  LeaveGroupButton,
  RenameGroupForm,
} from '@/components/groups/GroupSettings'
import { CopyLink } from '@/components/ui/CopyLink'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export const dynamic = 'force-dynamic'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      {children}
    </section>
  )
}

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await getGroupForViewer(slug)
  if (!ctx) notFound()
  const { group, isAdmin, viewer } = ctx
  // Settings are admin-only.
  if (!isAdmin || !viewer) redirect(`/g/${group.slug}`)

  const [members, invites] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId: group.id, role: 'admin' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.groupInvite.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true },
    }),
  ])
  const admins = members.map((m) => ({
    memberId: m.id,
    name: m.user.name,
    email: m.user.email,
    isYou: m.userId === viewer.id,
  }))
  const me = admins.find((a) => a.isYou)
  const groupPath = `/g/${group.slug}`

  return (
    <PageShell>
      <PageHeader title="Settings" subtitle={group.name} />

      <Section title="Group name">
        <RenameGroupForm groupId={group.id} name={group.name} />
      </Section>

      <Section title="Public group link">
        <p className="text-sm text-neutral-400">
          Anyone with this link can follow the live game. History, roster and stats stay
          admin-only.
        </p>
        <div className="flex flex-wrap items-center gap-x-3">
          <code className="break-all text-sm text-neutral-200">{groupPath}</code>
          <CopyLink path={groupPath} label="Copy group link" />
        </div>
      </Section>

      <Section title="Admins">
        <AdminList admins={admins} />
      </Section>

      <Section title="Pending invites">
        <InviteList invites={invites} />
      </Section>

      <Section title="Invite an admin">
        <InviteForm groupId={group.id} />
      </Section>

      {me && (
        <Section title="Leave group">
          <LeaveGroupButton memberId={me.memberId} soleAdmin={admins.length <= 1} />
        </Section>
      )}
    </PageShell>
  )
}
