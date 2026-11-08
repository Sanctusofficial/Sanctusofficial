import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const maxDuration = 30

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const eventSlug = String(body.eventSlug ?? 'mixer').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    // Same clean-up the register route applies, so the two always match.
    const matricNumber = String(body.matricNumber ?? '').replace(/\s+/g, '').toUpperCase()

    if (!email || !matricNumber) {
      return NextResponse.json(
        { error: 'Enter both your email and your matric number.' },
        { status: 400 },
      )
    }

    const { data: rows, error } = await supabase
      .from('registrations')
      .select('name, email, status, payment_code, expires_at, created_at')
      .eq('event_slug', eventSlug)
      .eq('matric_number', matricNumber)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('[status] lookup error:', error.message)
      return NextResponse.json({ error: 'Could not look that up. Try again.' }, { status: 500 })
    }

    // Both the matric number and the email have to match. The same message is
    // used when either is wrong, so nobody can use this page to find out who
    // has registered.
    const matches = (rows ?? []).filter((r) => (r.email ?? '').toLowerCase() === email)
    const match = matches.find((r) => r.status === 'approved') ?? matches[0]

    if (!match) {
      return NextResponse.json(
        { error: "We couldn't find a registration with those details." },
        { status: 404 },
      )
    }

    // A pending spot whose time has passed counts as expired, even if the
    // database row has not been updated yet.
    let status: string = match.status
    if (status === 'pending' && match.expires_at && Date.parse(match.expires_at) < Date.now()) {
      status = 'expired'
    }

    const { data: event } = await supabase
      .from('events')
      .select('title, price_naira, bank_name, account_number, account_name')
      .eq('slug', eventSlug)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      status,
      name: match.name,
      paymentCode: match.payment_code,
      expiresAt: match.expires_at,
      amountNaira: event?.price_naira ?? 0,
      event: {
        title: event?.title ?? "SEES'30 MIXER",
        bankName: event?.bank_name ?? null,
        accountNumber: event?.account_number ?? null,
        accountName: event?.account_name ?? null,
      },
    })
  } catch (error) {
    console.error('[status] error:', error)
    return NextResponse.json({ error: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
