'use client'

import { CheckCircle2, Clock, Copy } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type StatusResult = {
  status: 'pending' | 'approved' | 'expired'
  name: string | null
  paymentCode: string | null
  expiresAt: string | null
  amountNaira: number
  event: {
    title: string
    bankName: string | null
    accountNumber: string | null
    accountName: string | null
  }
}

export function StatusLookup({ eventSlug = 'mixer' }: { eventSlug?: string }) {
  const [email, setEmail] = useState('')
  const [matricNumber, setMatricNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<StatusResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault()
    if (!email.trim() || !matricNumber.trim()) {
      setError('Enter both your email and your matric number.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, email, matricNumber }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not look that up. Try again.')
      setResult(data as StatusResult)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Copying is a convenience only. The text stays on screen to copy by hand.
    }
  }

  const deadline =
    result?.expiresAt
      ? new Date(result.expiresAt).toLocaleString('en-NG', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : null

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={lookup} noValidate>
        <FieldGroup>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="status-email">Email</FieldLabel>
            <Input
              id="status-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>

          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="status-matric">Matric Number</FieldLabel>
            <Input
              id="status-matric"
              value={matricNumber}
              onChange={(e) => setMatricNumber(e.target.value)}
              placeholder="e.g. 20/1234"
            />
            <FieldError>{error}</FieldError>
          </Field>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground shadow-[0_0_20px_oklch(0.73_0.24_355_/_50%)] hover:bg-primary/90"
          >
            {loading && <Spinner />}
            {loading ? 'Checking...' : 'Check status'}
          </Button>
        </FieldGroup>
      </form>

      {result && result.status === 'approved' && (
        <div
          role="status"
          className="flex flex-col items-center gap-3 rounded-2xl border border-secondary/30 bg-card px-6 py-10 text-center"
        >
          <CheckCircle2 className="size-12 text-secondary text-glow-green" aria-hidden="true" />
          <h2 className="font-display text-2xl text-primary text-glow-pink">You&apos;re confirmed!</h2>
          <p className="text-muted-foreground">
            {result.name ? `${result.name}, your` : 'Your'} spot at {result.event.title} is
            confirmed. See you there.
          </p>
        </div>
      )}

      {result && result.status === 'pending' && (
        <div
          role="status"
          className="flex flex-col gap-6 rounded-2xl border border-secondary/30 bg-card px-6 py-10"
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <Clock className="size-12 text-primary" aria-hidden="true" />
            <h2 className="font-display text-2xl text-primary text-glow-pink">
              Waiting for payment
            </h2>
            <p className="text-muted-foreground">
              Pay &#8358;{result.amountNaira.toLocaleString('en-NG')} to confirm your spot at{' '}
              {result.event.title}.
            </p>
          </div>

          {result.event.accountNumber && (
            <div className="flex flex-col gap-3 rounded-xl border border-secondary/30 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Bank</span>
                <span className="font-medium">{result.event.bankName}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Account number</span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-base font-medium">
                    {result.event.accountNumber}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyText('account', result.event.accountNumber as string)}
                    aria-label="Copy account number"
                  >
                    <Copy />
                    {copied === 'account' ? 'Copied' : 'Copy'}
                  </Button>
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Account name</span>
                <span className="text-right font-medium">{result.event.accountName}</span>
              </div>
            </div>
          )}

          {result.paymentCode && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/40 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Put this code in the transfer description so we can match your payment.
              </p>
              <p className="font-mono text-3xl font-semibold tracking-widest text-primary">
                {result.paymentCode}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyText('code', result.paymentCode as string)}
                aria-label="Copy payment code"
              >
                <Copy />
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </Button>
            </div>
          )}

          {deadline && (
            <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <Clock className="size-4" aria-hidden="true" />
              We hold your spot until {deadline}.
            </p>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Paid already? It can take a little while for us to see it.{' '}
            <button
              type="button"
              onClick={() => lookup()}
              disabled={loading}
              className="text-primary underline"
            >
              Check again
            </button>
          </p>
        </div>
      )}

      {result && result.status === 'expired' && (
        <div
          role="status"
          className="flex flex-col items-center gap-4 rounded-2xl border border-secondary/30 bg-card px-6 py-10 text-center"
        >
          <Clock className="size-12 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-display text-2xl text-primary text-glow-pink">Your spot was released</h2>
          <p className="text-muted-foreground">
            The payment time for {result.event.title} ran out.
            {result.paymentCode
              ? ` If you already paid, send the organizers your code ${result.paymentCode} so they can confirm it.`
              : ''}{' '}
            If you haven&apos;t paid, you can register again.
          </p>
          <Link href="/" className="text-primary underline">
            Register again
          </Link>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="text-primary underline">
          Back to registration
        </Link>
      </p>
    </div>
  )
}
