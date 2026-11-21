import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { AdminMemories } from '@/components/admin-memories'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Memories admin', robots: { index: false, follow: false }, referrer: 'no-referrer' }

// Organizers open /admin/memories?key=<ADMIN_SECRET>.
export default async function AdminMemoriesPage({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const params = await searchParams
  if (!process.env.ADMIN_SECRET || params.key !== process.env.ADMIN_SECRET) notFound()
  const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) as string
  return (
    <main className="min-h-screen px-4 py-8">
      <AdminMemories adminKey={params.key as string} baseUrl={baseUrl} />
    </main>
  )
}
