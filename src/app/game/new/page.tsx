import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { NewGameForm } from '@/components/NewGameForm'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function NewGamePage() {
  await requireAuthPage()
  const roster = await prisma.player.findMany({
    where: { archived: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return (
    <PageShell>
      <PageHeader
        title="New game"
        action={
          <Link href="/" className="inline-flex min-h-11 items-center px-1 underline active:text-neutral-200">
            home
          </Link>
        }
      />
      <NewGameForm roster={roster} />
    </PageShell>
  )
}
