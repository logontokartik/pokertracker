import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { NewGameForm } from '@/components/NewGameForm'

export default async function NewGamePage() {
  await requireAuthPage()
  const roster = await prisma.player.findMany({
    where: { archived: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">New game</h1>
        <Link href="/" className="text-sm text-neutral-400 underline">home</Link>
      </div>
      <NewGameForm roster={roster} />
    </main>
  )
}
