import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getEvent } from '@/lib/events'
import { getSupabase, initializeTransaction } from '@/lib/paystack'

const DEPARTMENTS = ['elect', 'computer']
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Saves the registration as "awaiting payment", then sends back a Paystack payment link.
// The spot is only confirmed once Paystack tells us the money arrived (see lib/paystack.ts).
export async function POST(request: Request) {
  try {
    const data = await request.json()
    const name = clean(data.name)
    const email = clean(data.email).toLowerCase()
    const matricNumber = clean(data.matricNumber)
    const lookingForwardTo = clean(data.lookingForwardTo)
    const departments: string[] = Array.isArray(data.departments)
      ? data.departments.filter((d: unknown) => typeof d === 'string' && DEPARTMENTS.includes(d))
      : []

    const event = getEvent(String(data.eventSlug))
    if (!event || !event.registrationOpen) {
      return NextResponse.json({ error: 'Registration for this event is closed' }, { status: 400 })
    }
    if (event.priceNaira == null) {
      return NextResponse.json({ error: 'Payment is not set up for this event yet' }, { status: 503 })
    }
    if (
      !name || !email || !matricNumber || !lookingForwardTo || departments.length === 0 ||
      !/^\S+@\S+\.\S+$/.test(email) || [name, email, matricNumber, lookingForwardTo].some((v) => v.length > 300)
    ) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const supabase = getSupabase()
    const [byEmail, byMatric] = await Promise.all([
      supabase.from('registrations').select('id, status').eq('event_slug', event.slug).eq('email', email).maybeSingle(),
      supabase.from('registrations').select('id, status').eq('event_slug', event.slug).eq('matric_number', matricNumber).maybeSingle(),
    ])
    const found = [byEmail.data, byMatric.data].filter((r): r is { id: string; status: string } => !!r)

    // Anyone who already holds a spot (paid, or an older receipt-based sign-up) is blocked.
    if (found.some((r) => r.status !== 'awaiting_payment')) {
      return NextResponse.json(
        { error: `You've already registered for ${event.title} — one spot per person!` },
        { status: 409 },
      )
    }
    // Earlier unpaid attempts (closed tab, failed card) are cleared so they can try again.
    if (found.length > 0) {
      await supabase.from('registrations').delete().in('id', found.map((r) => r.id))
    }

    const reference = `${event.slug}-${randomUUID()}`
    const amountKobo = Math.round(event.priceNaira * 100)
    const { error: dbError } = await supabase.from('registrations').insert({
      event_slug: event.slug,
      name,
      email,
      departments: departments.join(', '),
      matric_number: matricNumber,
      looking_forward_to: lookingForwardTo,
      status: 'awaiting_payment',
      payment_reference: reference,
      amount_kobo: amountKobo,
    })
    if (dbError) {
      console.error('[submit] insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 502 })
    }

    const tx = await initializeTransaction({
      email,
      amountKobo,
      reference,
      callbackUrl: `${new URL(request.url).origin}/payment/complete`,
      metadata: { eventSlug: event.slug, name },
    })
    return NextResponse.json({ url: tx.authorization_url })
  } catch (error) {
    console.error('[submit] error:', error)
    return NextResponse.json({ error: 'Could not start payment. Please try again.' }, { status: 500 })
  }
}
