import { prisma } from '@/lib/db'
import { isAuthed } from '@/lib/auth'
import { PlayerAdmin } from '@/components/PlayerAdmin'
import { PageShell } from '@/components/ui/PageShell'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'

export default async function PlayersPage() {
  const isAdmin = await isAuthed()
  const players = await prisma.player.findMany({ orderBy: { name: 'asc' } })

  if (isAdmin) {
    return (
      <PageShell>
        <PageHeader title="Roster" />
        <PlayerAdmin players={players.map(({ id, name, archived }) => ({ id, name, archived }))} />
      </PageShell>
    )
  }

  const active = players.filter((p) => !p.archived)
  return (
    <PageShell>
      <PageHeader
        title="Roster"
        subtitle={`${active.length} ${active.length === 1 ? 'player' : 'players'}`}
      />
      {active.length === 0 ? (
        <p className="text-neutral-500">No players yet.</p>
      ) : (
        <Card className="!p-0">
          <ul className="divide-y divide-neutral-800">
            {active.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-sm font-semibold text-emerald-400">
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-base font-medium text-neutral-100">{p.name}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </PageShell>
  )
}
