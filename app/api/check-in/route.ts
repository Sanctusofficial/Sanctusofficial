import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_SECRET
  const given = request.headers.get('x-admin-key')
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  try {
    const { token } = await request.json()
    if (typeof token !== 'string' || token.length < 32) {
      return NextResponse.json({ error: 'Invalid ticket code' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: ticket } = await supabase
      .from('registrations')
      .select('id, event_id, event_slug, name, status, checked_in_at, events(starts_at, title)')
      .eq('ticket_token', token)
      .maybeSingle()

    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    if (ticket.status !== 'approved') {
      return NextResponse.json({ error: 'This ticket is not approved.' }, { status: 409 })
    }
    if (ticket.checked_in_at) {
      return NextResponse.json(
        { error: 'This ticket was already checked in.', checkedInAt: ticket.checked_in_at },
        { status: 409 },
      )
    }
    const event = Array.isArray(ticket.events) ? ticket.events[0] : ticket.events
    const startsAt = event?.starts_at ? Date.parse(event.starts_at) : NaN
    if (Number.isFinite(startsAt) && Date.now() < startsAt - 6 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Check-in is not open yet.' }, { status: 403 })
    }
    if (Number.isFinite(startsAt) && Date.now() > startsAt + 12 * 60 * 60 * 1000) {
      return NextResponse.json({ error: 'This event has ended.' }, { status: 410 })
    }

    const { data, error } = await supabase
      .from('registrations')
      .update({ checked_in_at: new Date().toISOString(), checked_in_by: 'admin' })
      .eq('id', ticket.id)
      .is('checked_in_at', null)
      .select('id, name, event_slug, checked_in_at')
      .maybeSingle()

    if (error) {
      console.error('[check-in] update error:', error.message)
      return NextResponse.json({ error: 'Could not check in ticket.' }, { status: 502 })
    }
    if (!data) return NextResponse.json({ error: 'Ticket was checked in by another scanner.' }, { status: 409 })
    return NextResponse.json({ success: true, ticket: data })
  } catch (error) {
    console.error('[check-in] error:', error)
    return NextResponse.json({ error: 'Invalid check-in request.' }, { status: 400 })
  }
}
