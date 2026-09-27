import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getGroupForViewer } from '@/lib/access'
import { NewGameForm } from '@/components/NewGameForm'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function NewGamePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await getGroupForViewer(slug)
  if (!ctx) notFound()
  const { group, isAdmin } = ctx
  // Admin-only; a non-admin who lands here is bounced back to the group page.
  if (!isAdmin) redirect(`/g/${group.slug}`)

  const roster = await prisma.player.findMany({
    where: { groupId: group.id, archived: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return (
    <PageShell>
      <PageHeader
        title="New game"
        subtitle={group.name}
        action={
          <Link
            href={`/g/${group.slug}`}
            className="inline-flex min-h-11 items-center px-1 underline active:text-neutral-200"
          >
            games
          </Link>
        }
      />
      <NewGameForm groupId={group.id} roster={roster} />
    </PageShell>
  )
}
