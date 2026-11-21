import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

import { AdminRegistrations } from '@/components/admin-registrations'
import { MemoryUploader } from '@/components/memory-uploader'

// Always fetch fresh data instead of showing a cached copy.
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>
}) {
  const params = await searchParams

  if (!process.env.ADMIN_SECRET || params.key !== process.env.ADMIN_SECRET) {
    notFound()
  }

  const [registrationsResult, eventsResult] = await Promise.all([
    supabase
      .from('registrations')
      .select(
        'id, created_at, name, email, departments, matric_number, receipt_url, looking_forward_to, status, event_slug, payment_code, expires_at, confirmed_at',
      )
      .order('created_at', { ascending: false }),
    supabase.from('events').select('slug, title, price_naira').order('created_at'),
  ])

  if (registrationsResult.error) {
    return (
      <main className="min-h-screen bg-black p-4 text-white">
        <h1 className="mb-2 text-xl font-bold">Registrations</h1>
        <p className="text-red-400">
          Could not load registrations: {registrationsResult.error.message}
        </p>
      </main>
    )
  }

  return (
    <main className="min-h-screen space-y-6 p-4">
      <a
        href={`/admin/check-in?key=${encodeURIComponent(params.key as string)}`}
        className="block rounded-2xl border border-secondary/40 bg-card p-5 font-display text-xl text-secondary"
      >
        Open door check-in scanner →
        <span className="mt-1 block font-sans text-sm text-muted-foreground">Open this on each door phone. Scans verify instantly.</span>
      </a>
      <a
        href={`/admin/games?key=${encodeURIComponent(params.key as string)}`}
        className="block rounded-2xl border border-primary/40 bg-card p-5 font-display text-xl text-primary"
      >
        Team games: award points, host the quiz, edit questions →
        <span className="mt-1 block font-sans text-sm text-muted-foreground">Volts · Amps · Tesla · Ohms. The public board is at /games.</span>
      </a>
      <a
        href={`/admin/memories?key=${encodeURIComponent(params.key as string)}`}
        className="block rounded-2xl border border-secondary/40 bg-card p-5 font-display text-xl text-secondary"
      >
        Memories: review guest photos →
        <span className="mt-1 block font-sans text-sm text-muted-foreground">Guests upload at /memories. Hide or delete anything that shouldn&apos;t be public.</span>
      </a>
      <MemoryUploader adminKey={params.key as string} eventSlugs={(eventsResult.data ?? []).map((event) => event.slug)} />
      <AdminRegistrations
        initialRows={registrationsResult.data ?? []}
        events={eventsResult.data ?? []}
        adminKey={params.key as string}
        serverNow={new Date().toISOString()}
      />
    </main>
  )
}
