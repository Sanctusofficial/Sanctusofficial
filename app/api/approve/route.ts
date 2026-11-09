import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

// The admin page sends the same secret it was opened with.
function isAdmin(request: Request) {
  const secret = process.env.ADMIN_SECRET
  const given = request.headers.get('x-admin-key')
  if (!secret || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  try {
    if (!isAdmin(request)) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const { data: registrant, error: fetchError } = await supabase
      .from('registrations')
      .select('status, event_id')
      .eq('id', id)
      .single()

    if (fetchError || !registrant) {
      return NextResponse.json({ error: 'Registrant not found' }, { status: 404 })
    }

    if (registrant.status === 'approved') {
      return NextResponse.json({ error: 'Already approved' }, { status: 409 })
    }

    // Pending people are approved as normal. Expired ones are late payers.
    if (registrant.status !== 'pending' && registrant.status !== 'expired') {
      return NextResponse.json(
        { error: `Cannot approve a registration marked "${registrant.status}".` },
        { status: 409 },
      )
    }

    let capacity: number | null = null
    if (registrant.event_id) {
      const { data: event } = await supabase
        .from('events')
        .select('capacity')
        .eq('id', registrant.event_id)
        .maybeSingle()
      capacity = event?.capacity ?? null
    }

    // A late payer no longer holds a spot, so approving adds one more person.
    if (registrant.status === 'expired' && capacity !== null && registrant.event_id) {
      const { count } = await supabase
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', registrant.event_id)
        .in('status', ['pending', 'approved'])
      if ((count ?? 0) >= capacity) {
        return NextResponse.json(
          { error: 'The event is full, so this late payment cannot be approved.' },
          { status: 409 },
        )
      }
    }

    // Only updates if the status is still pending or expired, so a double tap
    // or two admins at once cannot approve the same person twice.
    const { data: updated, error: updateError } = await supabase
      .from('registrations')
      .update({
        status: 'approved',
        confirmed_at: new Date().toISOString(),
        confirmed_by: 'admin',
      })
      .eq('id', id)
      .in('status', ['pending', 'expired'])
      .select('id')

    if (updateError) {
      if (updateError.code === '23505') {
        return NextResponse.json(
          { error: 'This person already has another active registration for this event.' },
          { status: 409 },
        )
      }
      console.error('[approve] update error:', updateError.message)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 502 })
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'This registration just changed. Refresh and try again.' },
        { status: 409 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[approve] error:', error)
    return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
  }
}
