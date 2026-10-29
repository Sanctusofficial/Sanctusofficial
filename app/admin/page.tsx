import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

import { AdminRegistrations } from '@/components/admin-registrations'

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
    <AdminRegistrations
      initialRows={registrationsResult.data ?? []}
      events={eventsResult.data ?? []}
      adminKey={params.key as string}
      serverNow={new Date().toISOString()}
    />
  )
}
