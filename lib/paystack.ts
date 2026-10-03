import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { getEvent } from '@/lib/events'
import { getResend, FROM_EMAIL, approvalEmailHtml } from '@/lib/resend'

const API = 'https://api.paystack.co'

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set')
  return key
}

// Created when needed, not when the file loads, so a build without secrets doesn't crash.
export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  )
}

export async function initializeTransaction(p: {
  email: string
  amountKobo: number
  reference: string
  callbackUrl: string
  metadata?: Record<string, unknown>
}) {
  const res = await fetch(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secretKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: p.email,
      amount: p.amountKobo,
      currency: 'NGN',
      reference: p.reference,
      callback_url: p.callbackUrl,
      metadata: p.metadata,
    }),
  })
  const json = await res.json()
  if (!res.ok || !json.status) throw new Error(json.message ?? 'Paystack initialize failed')
  return json.data as { authorization_url: string; reference: string }
}

async function verifyTransaction(reference: string) {
  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secretKey()}` },
    cache: 'no-store',
  })
  const json = await res.json()
  if (!res.ok || !json.status) throw new Error(json.message ?? 'Paystack verify failed')
  return json.data as { status: string; amount: number; currency: string; reference: string }
}

// Paystack signs the raw request body with your secret key. Anything without a matching signature is rejected.
export function isValidSignature(rawBody: string, signature: string | null) {
  if (!signature) return false
  const expected = Buffer.from(createHmac('sha512', secretKey()).update(rawBody).digest('hex'))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

export type PaymentResult = 'paid' | 'pending' | 'failed' | 'unknown'

// Asks Paystack whether this payment really succeeded, then marks the registration approved.
// Both the webhook and the page people land on after paying call this, so it must be safe to run twice.
export async function settlePayment(reference: string): Promise<PaymentResult> {
  const supabase = getSupabase()
  const { data: reg } = await supabase
    .from('registrations')
    .select('id, name, email, status, event_slug, amount_kobo')
    .eq('payment_reference', reference)
    .maybeSingle()
  if (!reg) return 'unknown'
  if (reg.status === 'approved') return 'paid'

  const tx = await verifyTransaction(reference)
  if (tx.status !== 'success') {
    return ['failed', 'abandoned', 'reversed'].includes(tx.status) ? 'failed' : 'pending'
  }
  // Never approve if the amount paid isn't the amount we asked for.
  if (tx.amount !== reg.amount_kobo || tx.currency !== 'NGN') {
    console.error('[paystack] amount mismatch', { reference, paid: tx.amount, expected: reg.amount_kobo })
    return 'failed'
  }

  // Only the first caller flips the status, so the confirmation email goes out once.
  const { data: claimed } = await supabase
    .from('registrations')
    .update({ status: 'approved', paid_at: new Date().toISOString() })
    .eq('id', reg.id)
    .eq('status', 'awaiting_payment')
    .select('id')
  if (claimed && claimed.length > 0) {
    try {
      await getResend().emails.send({
        from: FROM_EMAIL,
        to: reg.email,
        subject: `You're confirmed — ${getEvent(reg.event_slug)?.title ?? "SEES'30"}`,
        html: approvalEmailHtml(reg.name, getEvent(reg.event_slug)?.title),
      })
    } catch (err) {
      console.error('[paystack] confirmation email failed', err)
    }
  }
  return 'paid'
}
