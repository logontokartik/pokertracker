import { prisma } from '@/lib/db'
import { isAuthed } from '@/lib/auth'
import { PlayerAdmin } from '@/components/PlayerAdmin'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'

export default async function PlayersPage() {
  const isAdmin = await isAuthed()
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } })

  return (
    <PageShell>
      <PageHeader title="Roster" />
      {isAdmin ? (
        <PlayerAdmin players={players.map(({ id, name, archived }) => ({ id, name, archived }))} />
      ) : (
        <ul className="flex flex-col gap-3">
          {players
            .filter((p) => !p.archived)
            .map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-lg font-semibold text-neutral-50"
              >
                {p.name}
              </li>
            ))}
          {players.filter((p) => !p.archived).length === 0 && (
            <p className="text-neutral-500">No players yet.</p>
          )}
        </ul>
      )}
    </PageShell>
  )
}
