import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getViewer, isSuperAdmin } from '@/lib/access'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

export default async function SuperAdminPage() {
  // Don't reveal the page exists to anyone else.
  if (!isSuperAdmin(await getViewer())) notFound()

  const groups = await prisma.group.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { games: true, players: true } },
      games: { where: { status: 'ACTIVE' }, select: { id: true } },
      members: { select: { user: { select: { email: true } } }, orderBy: { createdAt: 'asc' } },
    },
  })

  return (
    <PageShell>
      <PageHeader
        title="All groups"
        subtitle={`${groups.length} ${groups.length === 1 ? 'group' : 'groups'}`}
        action={
          <Link href="/" className="inline-flex min-h-11 items-center px-1 underline active:text-neutral-200">
            my groups
          </Link>
        }
      />
      <ul className="flex flex-col gap-3">
        {groups.map((g) => (
          <li key={g.id}>
            <Link href={`/g/${g.slug}`} className="block active:opacity-80">
              <Card>
                <div className="flex justify-between gap-3">
                  <span className="text-lg font-semibold text-neutral-50">{g.name}</span>
                  {g.games.length > 0 ? (
                    <span className="text-emerald-500">live</span>
                  ) : (
                    <span className="text-neutral-500">{g.createdAt.toLocaleDateString()}</span>
                  )}
                </div>
                <div className="mt-1 text-sm text-neutral-400">
                  {g._count.games} {g._count.games === 1 ? 'game' : 'games'} · {g._count.players}{' '}
                  {g._count.players === 1 ? 'player' : 'players'}
                </div>
                <div className="mt-1 break-all text-sm text-neutral-500">
                  {g.members.length > 0 ? g.members.map((m) => m.user.email).join(', ') : 'No admins yet'}
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      {groups.length === 0 && <p className="text-neutral-500">No groups yet.</p>}
    </PageShell>
  )
}
