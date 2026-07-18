import Link from 'next/link'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { isAuthed } from '@/lib/auth'
import { NewGameForm } from '@/components/NewGameForm'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function NewGamePage() {
  // Admin-only; a non-admin who lands here is bounced back to the public Games tab.
  if (!(await isAuthed())) redirect('/')
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
