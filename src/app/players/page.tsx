import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { PlayerAdmin } from '@/components/PlayerAdmin'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function PlayersPage() {
  await requireAuthPage()
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } })
  return (
    <PageShell>
      <PageHeader
        title="Roster"
        action={
          <Link href="/" className="inline-flex min-h-11 items-center px-1 underline active:text-neutral-200">
            home
          </Link>
        }
      />
      <PlayerAdmin players={players.map(({ id, name, archived }) => ({ id, name, archived }))} />
    </PageShell>
  )
}
