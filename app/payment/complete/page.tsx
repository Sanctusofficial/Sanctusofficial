import Link from 'next/link'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'
import { settlePayment, type PaymentResult } from '@/lib/paystack'

export const dynamic = 'force-dynamic'

const COPY: Record<PaymentResult, { title: string; body: string }> = {
  paid: { title: "You're in!", body: 'Payment received. Your spot is locked, and a confirmation email is on its way.' },
  pending: {
    title: 'Confirming your payment…',
    body: "We haven't had the final word from the bank yet. If you were charged, your confirmation email will arrive shortly. Please don't pay again.",
  },
  failed: { title: "Payment didn't go through", body: 'You have not been charged for a spot. Go back and try again.' },
  unknown: { title: "We couldn't find that payment", body: 'Check the link, or go back and register again.' },
}

export default async function PaymentComplete({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string; trxref?: string }>
}) {
  const params = await searchParams
  const reference = params.reference ?? params.trxref
  let result: PaymentResult = 'unknown'
  if (reference) {
    try {
      result = await settlePayment(reference)
    } catch (err) {
      console.error('[payment/complete] settle failed:', err)
      result = 'pending'
    }
  }
  const Icon = result === 'paid' ? CheckCircle2 : result === 'pending' ? Clock : XCircle
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <Icon className="size-12 text-secondary text-glow-green" aria-hidden="true" />
      <h1 className="font-display text-2xl text-primary text-glow-pink">{COPY[result].title}</h1>
      <p className="text-muted-foreground">{COPY[result].body}</p>
      <Link href="/" className="text-sm text-secondary underline">Back to events</Link>
    </main>
  )
}
