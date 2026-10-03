import { isValidSignature, settlePayment } from '@/lib/paystack'

// Paystack calls this by itself whenever a payment succeeds, even if the person closed the tab.
export async function POST(request: Request) {
  const raw = await request.text()
  if (!isValidSignature(raw, request.headers.get('x-paystack-signature'))) {
    return new Response('Invalid signature', { status: 401 })
  }
  let event: { event?: string; data?: { reference?: string } }
  try {
    event = JSON.parse(raw)
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  if (event.event === 'charge.success' && event.data?.reference) {
    try {
      await settlePayment(String(event.data.reference))
    } catch (err) {
      console.error('[webhook] settle failed:', err)
      return new Response('Try again', { status: 500 }) // a non-200 makes Paystack retry later
    }
  }
  return new Response('ok', { status: 200 })
}
