import Link from 'next/link'
import { redirect } from 'next/navigation'

import { getAuthenticatedUser } from '@/lib/auth/server'
import { createServiceClient } from '@/lib/supabase-server'
import { getMemberTickets } from '@/lib/passport'

export const dynamic = 'force-dynamic'

export default async function PassportPage() {
  const user = await getAuthenticatedUser()
  if (!user?.email) redirect('/account')
  const supabase = createServiceClient()
  const { data: profile } = await supabase
    .from('member_profiles')
    .select('name, matric_number')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) redirect('/account')
  const tickets = await getMemberTickets(user.email, profile.matric_number)

  return (
    <main className="min-h-screen px-4 py-12">
      <section className="mx-auto max-w-3xl">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">Authenticated passport</p>
        <h1 className="mt-3 font-display text-4xl text-primary text-glow-pink">{profile.name}&apos;s stamps</h1>
        <p className="mt-3 text-muted-foreground">Your private tickets and checked-in event history.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {tickets.map((ticket) => (
            <article key={ticket.id} className="rounded-2xl border border-border bg-card p-5">
              <h2 className="font-display text-xl text-primary">{ticket.event?.title ?? ticket.event_slug}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Status: {ticket.status}</p>
              {ticket.checked_in_at ? (
                <p className="mt-3 text-sm text-secondary">✓ Attended {new Date(ticket.checked_in_at).toLocaleDateString('en-NG')}</p>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No attendance stamp yet</p>
              )}
              {ticket.status === 'approved' && <Link href={`/tickets/${ticket.ticket_token}`} className="mt-4 inline-block text-primary underline">Open private ticket</Link>}
            </article>
          ))}
        </div>
        {tickets.length === 0 && <p className="mt-8 rounded-xl border border-border p-6 text-muted-foreground">No registrations match this verified profile yet.</p>}
      </section>
    </main>
  )
}
