import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const TICKET_COLUMNS =
  'id, event_id, event_slug, name, matric_number, departments, status, checked_in_at, events(starts_at, title)'

type TicketRow = {
  id: string
  event_id: string | null
  event_slug: string
  name: string | null
  matric_number: string | null
  departments: unknown
  status: string
  checked_in_at: string | null
  events: { starts_at: string | null; title: string | null } | { starts_at: string | null; title: string | null }[] | null
}

// Outcomes the door screen understands. `ok` is the only green one.
type Outcome = 'ok' | 'already' | 'not_approved' | 'not_found' | 'too_early' | 'ended' | 'invalid'

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_SECRET
  const given = request.headers.get('x-admin-key')
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Accept the raw token, a ticket URL (…/tickets/<token>) or older "SEES30:<token>" codes.
function extractToken(raw: string): string | null {
  const text = raw.trim()
  const match = text.match(/([0-9a-f]{64})/i) ?? text.match(/([A-Za-z0-9_-]{32,128})$/)
  return match ? match[1] : null
}

function guest(ticket: TicketRow) {
  const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
  return {
    name: ticket.name ?? 'Unnamed guest',
    matric: ticket.matric_number,
    department: Array.isArray(ticket.departments) ? ticket.departments.join(', ') : (ticket.departments as string | null) ?? null,
    event: event?.title ?? ticket.event_slug,
    eventSlug: ticket.event_slug,
    checkedInAt: ticket.checked_in_at,
  }
}

async function stats(eventSlug: string) {
  const supabase = createServiceClient()
  const [approved, checkedIn] = await Promise.all([
    supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('event_slug', eventSlug).eq('status', 'approved'),
    supabase.from('registrations').select('id', { count: 'exact', head: true }).eq('event_slug', eventSlug).eq('status', 'approved').not('checked_in_at', 'is', null),
  ])
  return { approved: approved.count ?? 0, checkedIn: checkedIn.count ?? 0 }
}

function reply(outcome: Outcome, message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ outcome, message, ...extra }, { status })
}

// GET /api/check-in?event=mixer → live counts for the door screen.
export async function GET(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  const eventSlug = new URL(request.url).searchParams.get('event') || 'mixer'
  return NextResponse.json({ stats: await stats(eventSlug) })
}

// POST { code } (scanned QR or typed token) or { matric, event } (guest without QR).
export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  try {
    const body = await request.json()
    const supabase = createServiceClient()
    const eventSlug = typeof body.event === 'string' && body.event ? body.event : 'mixer'

    let ticket: TicketRow | null = null
    if (typeof body.matric === 'string' && body.matric.trim()) {
      const matric = body.matric.replace(/\s+/g, '').toUpperCase()
      const { data } = await supabase
        .from('registrations')
        .select(TICKET_COLUMNS)
        .eq('event_slug', eventSlug)
        .eq('matric_number', matric)
        .order('created_at', { ascending: false })
      const rows = (data ?? []) as TicketRow[]
      ticket = rows.find((r) => r.status === 'approved') ?? rows[0] ?? null
    } else {
      const token = typeof body.code === 'string' ? extractToken(body.code) : null
      if (!token) return reply('invalid', 'This is not a SEES ticket QR code.', 400)
      const { data } = await supabase.from('registrations').select(TICKET_COLUMNS).eq('ticket_token', token).maybeSingle()
      ticket = (data as TicketRow | null) ?? null
    }

    if (!ticket) return reply('not_found', 'No ticket found. Do not admit.', 404)
    const info = guest(ticket)
    const counts = () => stats(ticket!.event_slug)

    if (ticket.status !== 'approved') {
      const why = ticket.status === 'pending' ? 'Payment not confirmed yet.' : `Ticket is ${ticket.status}.`
      return reply('not_approved', `${why} Do not admit.`, 409, { guest: info, stats: await counts() })
    }
    if (ticket.checked_in_at) {
      return reply('already', 'Already checked in. This ticket has been used.', 409, { guest: info, stats: await counts() })
    }

    const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    const startsAt = event?.starts_at ? Date.parse(event.starts_at) : NaN
    if (Number.isFinite(startsAt) && Date.now() < startsAt - 6 * 60 * 60 * 1000) {
      return reply('too_early', 'Check-in opens 6 hours before the event.', 403, { guest: info })
    }
    if (Number.isFinite(startsAt) && Date.now() > startsAt + 12 * 60 * 60 * 1000) {
      return reply('ended', 'This event has ended.', 410, { guest: info })
    }

    // Only succeeds if nobody checked this ticket in a moment ago (two scanners at once).
    const { data, error } = await supabase
      .from('registrations')
      .update({ checked_in_at: new Date().toISOString(), checked_in_by: body.matric ? 'door:matric' : 'door:qr' })
      .eq('id', ticket.id)
      .is('checked_in_at', null)
      .select('checked_in_at')
      .maybeSingle()

    if (error) {
      console.error('[check-in] update error:', error.message)
      return NextResponse.json({ outcome: 'error', message: 'Could not save check-in. Try again.' }, { status: 502 })
    }
    if (!data) {
      return reply('already', 'Already checked in on another phone.', 409, { guest: info, stats: await counts() })
    }
    return reply('ok', 'Valid ticket. Admit guest.', 200, {
      guest: { ...info, checkedInAt: data.checked_in_at },
      stats: await counts(),
    })
  } catch (error) {
    console.error('[check-in] error:', error)
    return NextResponse.json({ outcome: 'error', message: 'Invalid check-in request.' }, { status: 400 })
  }
}
