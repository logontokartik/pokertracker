import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireAuthPage } from '@/lib/auth'
import { PlayerAdmin } from '@/components/PlayerAdmin'

export default async function PlayersPage() {
  await requireAuthPage()
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } })
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Roster</h1>
        <Link href="/" className="text-sm text-neutral-400 underline">home</Link>
      </div>
      <PlayerAdmin players={players.map(({ id, name, archived }) => ({ id, name, archived }))} />
    </main>
  )
}
