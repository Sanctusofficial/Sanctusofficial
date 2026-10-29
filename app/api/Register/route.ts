import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { resend, FROM_EMAIL, approvalEmailHtml } from '@/lib/resend'

export const maxDuration = 30

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
)

// The form sends these ids for the department checkboxes.
const ALLOWED_DEPARTMENTS = ['elect', 'computer']

// No 0/O/1/I, so codes are easy to read and type into a bank app.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function makePaymentCode() {
  let s = ''
  for (let i = 0; i < 5; i++) s += CODE_CHARS[randomInt(CODE_CHARS.length)]
  return `SEES-${s}`
}

// Stops a name like "<b>x</b>" from being treated as HTML inside the email.
function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paymentEmailHtml(o: {
  name: string
  eventTitle: string
  amountNaira: number
  code: string
  deadline: string
  bankName: string | null
  accountNumber: string | null
  accountName: string | null
}) {
  const bank = o.accountNumber
    ? `<p>Bank: <b>${esc(o.bankName ?? '')}</b><br>Account number: <b>${esc(o.accountNumber)}</b><br>Account name: <b>${esc(o.accountName ?? '')}</b></p>`
    : ''
  return `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;line-height:1.5">
  <h2>Your spot is reserved</h2>
  <p>Hi ${esc(o.name)}, you're registered for <b>${esc(o.eventTitle)}</b>. Pay to confirm your spot.</p>
  <p>Amount: <b>&#8358;${o.amountNaira.toLocaleString('en-NG')}</b></p>
  ${bank}
  <p>Put this code in the transfer description so we can match your payment:</p>
  <p style="font-size:24px;letter-spacing:2px"><b>${esc(o.code)}</b></p>
  <p>Your spot is held until <b>${esc(o.deadline)}</b>. After that it is released to other people.</p>
</div>`
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const eventSlug = String(body.eventSlug ?? 'mixer').trim()
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const matricNumber = String(body.matricNumber ?? '').replace(/\s+/g, '').toUpperCase()
    const lookingForwardTo = String(body.lookingForwardTo ?? '').trim()
    const departments: unknown[] = Array.isArray(body.departments) ? body.departments : []

    if (!name || !email || !matricNumber || !lookingForwardTo || departments.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!departments.every((d) => typeof d === 'string' && ALLOWED_DEPARTMENTS.includes(d))) {
      return NextResponse.json({ error: 'Invalid department.' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    // 1. Find the event and make sure it is open.
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('slug', eventSlug)
      .maybeSingle()

    if (eventError) {
      console.error('[register] event lookup error:', eventError.message)
      return NextResponse.json({ error: 'Could not load the event.' }, { status: 500 })
    }
    if (!event) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    }
    if (!event.registration_open) {
      return NextResponse.json(
        { error: 'Registration for this event is closed.' },
        { status: 403 },
      )
    }

    // 2. Release spots whose payment time ran out, before checking anything else.
    //    Old registrations have no expiry time, so they are never touched.
    await supabase
      .from('registrations')
      .update({ status: 'expired' })
      .eq('event_id', event.id)
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString())

    // 3. Capacity check. Pending spots count as taken.
    if (event.capacity !== null && event.capacity !== undefined) {
      const { count, error: countError } = await supabase
        .from('registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .in('status', ['pending', 'approved'])

      if (countError) {
        console.error('[register] count error:', countError.message)
        return NextResponse.json({ error: 'Could not check availability.' }, { status: 500 })
      }
      if ((count ?? 0) >= event.capacity) {
        return NextResponse.json({ error: 'This event is full.' }, { status: 409 })
      }
    }

    // 4. Save the registration. Free events are approved straight away.
    const priceNaira: number = event.price_naira ?? 0
    const isFree = priceNaira === 0
    const holdHours: number = event.payment_hold_hours ?? 24
    const now = new Date()
    const expiresAt = isFree
      ? null
      : new Date(now.getTime() + holdHours * 60 * 60 * 1000).toISOString()

    for (let attempt = 0; attempt < 5; attempt++) {
      const paymentCode = isFree ? null : makePaymentCode()

      const { error: insertError } = await supabase.from('registrations').insert({
        event_id: event.id,
        event_slug: event.slug,
        name,
        email,
        departments: departments.join(', '),
        matric_number: matricNumber,
        looking_forward_to: lookingForwardTo,
        status: isFree ? 'approved' : 'pending',
        payment_code: paymentCode,
        expires_at: expiresAt,
        confirmed_at: isFree ? now.toISOString() : null,
        confirmed_by: isFree ? 'auto (free event)' : null,
      })

      if (!insertError) {
        // 5. Email the person. A failed email must not undo the registration.
        let emailSent = false
        try {
          if (isFree) {
            await resend.emails.send({
              from: FROM_EMAIL,
              to: email,
              subject: `You're confirmed — ${event.title}`,
              html: approvalEmailHtml(name),
            })
          } else if (paymentCode && expiresAt) {
            await resend.emails.send({
              from: FROM_EMAIL,
              to: email,
              subject: `Your spot is reserved — ${event.title}`,
              html: paymentEmailHtml({
                name,
                eventTitle: event.title,
                amountNaira: priceNaira,
                code: paymentCode,
                deadline: new Date(expiresAt).toLocaleString('en-NG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                  timeZone: 'Africa/Lagos',
                }),
                bankName: event.bank_name ?? null,
                accountNumber: event.account_number ?? null,
                accountName: event.account_name ?? null,
              }),
            })
          }
          emailSent = true
        } catch (emailError) {
          console.error('[register] email error:', emailError)
        }

        return NextResponse.json({
          success: true,
          status: isFree ? 'approved' : 'pending',
          paymentCode,
          expiresAt,
          amountNaira: priceNaira,
          emailSent,
          event: {
            title: event.title,
            bankName: event.bank_name ?? null,
            accountNumber: event.account_number ?? null,
            accountName: event.account_name ?? null,
          },
        })
      }

      if (insertError.code === '23505') {
        // Two people drew the same random code: draw a new one and try again.
        if (insertError.message.includes('payment_code_is_unique')) continue
        return NextResponse.json(
          { error: `You've already registered for ${event.title} — one spot per person!` },
          { status: 409 },
        )
      }

      console.error('[register] insert error:', insertError.message)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 502 })
    }

    return NextResponse.json(
      { error: 'Could not generate a payment code. Please try again.' },
      { status: 500 },
    )
  } catch (error) {
    console.error('[register] error:', error)
    return NextResponse.json({ error: 'Failed to submit registration' }, { status: 500 })
  }
}
