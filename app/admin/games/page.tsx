import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AdminGames } from '@/components/admin-games'
import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Team games admin',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

// Organizers open /admin/games?key=<ADMIN_SECRET>.
export default async function AdminGamesPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const params = await searchParams
  if (!process.env.ADMIN_SECRET || params.key !== process.env.ADMIN_SECRET) notFound()

  const db = createServiceClient()
  const [teams, games] = await Promise.all([
    db.from('game_teams').select('slug, name, color').order('sort'),
    db.from('games').select('id, name').order('sort'),
  ])

  return (
    <main className="min-h-screen px-4 py-8">
      <AdminGames adminKey={params.key as string} teams={teams.data ?? []} games={games.data ?? []} />
    </main>
  )
}
