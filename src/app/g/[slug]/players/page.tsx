import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getGroupForViewer } from '@/lib/access'
import { PlayerAdmin } from '@/components/PlayerAdmin'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function PlayersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await getGroupForViewer(slug)
  if (!ctx) notFound()
  const { group, isAdmin } = ctx
  // The roster is admin-only.
  if (!isAdmin) redirect(`/g/${group.slug}`)

  const players = await prisma.player.findMany({
    where: { groupId: group.id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, archived: true },
  })
  return (
    <PageShell>
      <PageHeader title="Roster" subtitle={group.name} />
      <PlayerAdmin groupId={group.id} players={players} />
    </PageShell>
  )
}
