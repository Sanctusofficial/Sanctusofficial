import { createServiceClient } from '@/lib/supabase-server'

export type Ticket = {
  id: string
  event_id: string | null
  event_slug: string
  name: string
  email: string
  matric_number: string
  status: string
  ticket_token: string
  checked_in_at: string | null
  created_at: string
  event?: { title: string; starts_at: string | null; venue: string | null } | null
}

export async function getTicket(token: string) {
  const { data } = await createServiceClient()
    .from('registrations')
    .select(
      'id, event_id, event_slug, name, email, matric_number, status, ticket_token, checked_in_at, created_at, events(title, starts_at, venue)',
    )
    .eq('ticket_token', token)
    .maybeSingle()
  return (data as Ticket | null) ?? null
}

export async function getMemberTickets(email: string, matricNumber: string) {
  const { data } = await createServiceClient()
    .from('registrations')
    .select(
      'id, event_id, event_slug, name, email, matric_number, status, ticket_token, checked_in_at, created_at, events(title, starts_at, venue)',
    )
    .eq('email', email.toLowerCase())
    .eq('matric_number', matricNumber.toUpperCase())
    .not('ticket_token', 'is', null)
    .order('created_at', { ascending: false })
  return (data ?? []) as Ticket[]
}
