'use client'

import { CheckCircle2, Clock, Copy } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const DEPARTMENTS = [
  { id: 'elect', label: 'Elect' },
  { id: 'computer', label: 'Computer' },
]

type FormErrors = Partial<
  Record<'name' | 'email' | 'departments' | 'matricNumber' | 'lookingForwardTo', string>
>

type RegisterResult = {
  status: 'pending' | 'approved'
  paymentCode: string | null
  expiresAt: string | null
  amountNaira: number
  emailSent: boolean
  event: {
    title: string
    bankName: string | null
    accountNumber: string | null
    accountName: string | null
  }
}

export function RegistrationForm({ eventSlug = 'mixer' }: { eventSlug?: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [matricNumber, setMatricNumber] = useState('')
  const [lookingForwardTo, setLookingForwardTo] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  function toggleDepartment(id: string, checked: boolean) {
    setDepartments((prev) =>
      checked ? [...prev, id] : prev.filter((d) => d !== id),
    )
  }

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (!name.trim()) next.name = 'Name is required.'
    if (!email.trim()) {
      next.email = 'Email is required.'
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      next.email = 'Enter a valid email address.'
    }
    if (departments.length === 0) next.departments = 'Select at least one department.'
    if (!matricNumber.trim()) next.matricNumber = 'Matric number is required.'
    if (!lookingForwardTo.trim())
      next.lookingForwardTo = 'Tell us what you\u2019re looking forward to.'
    return next
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nextErrors = validate()
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setStatus('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug,
          name,
          email,
          departments,
          matricNumber,
          lookingForwardTo,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Submission failed. Try again.')
      }

      setResult(data as RegisterResult)
      setStatus('idle')
    } catch (err) {
      console.error('Form submission error:', err)
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
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

  // Free event: confirmed straight away.
  if (result && result.status === 'approved') {
    return (
      <div
        role="status"
        className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-secondary/30 bg-card px-6 py-12 text-center"
      >
        <CheckCircle2 className="size-12 text-secondary text-glow-green" aria-hidden="true" />
        <h2 className="font-display text-2xl text-primary text-glow-pink">You&apos;re in!</h2>
        <p className="text-muted-foreground">
          Your spot at {result.event.title} is confirmed. Check your email for details.
        </p>
      </div>
    )
  }

  // Paid event: spot is held, waiting for the transfer.
  if (result) {
    const deadline = result.expiresAt
      ? new Date(result.expiresAt).toLocaleString('en-NG', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : null

    return (
      <div
        role="status"
        className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl border border-secondary/30 bg-card px-6 py-10"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="size-12 text-secondary text-glow-green" aria-hidden="true" />
          <h2 className="font-display text-2xl text-primary text-glow-pink">Spot reserved</h2>
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
          {result.emailSent ? 'We also emailed you these details. ' : ''}
          Once we see your payment you&apos;ll get a confirmation email.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md" noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name}
            placeholder="Your full name"
            autoComplete="name"
          />
          <FieldError>{errors.name}</FieldError>
        </Field>

        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
            placeholder="you@example.com"
            autoComplete="email"
          />
          <FieldError>{errors.email}</FieldError>
        </Field>

        <FieldSet data-invalid={!!errors.departments}>
          <FieldLegend variant="label">Department</FieldLegend>
          <FieldGroup data-slot="checkbox-group" className="flex-row gap-6">
            {DEPARTMENTS.map((dept) => (
              <Field key={dept.id} orientation="horizontal" className="w-auto">
                <Checkbox
                  id={dept.id}
                  checked={departments.includes(dept.id)}
                  onCheckedChange={(checked) => toggleDepartment(dept.id, !!checked)}
                  aria-invalid={!!errors.departments}
                />
                <FieldLabel htmlFor={dept.id} className="font-normal">
                  {dept.label}
                </FieldLabel>
              </Field>
            ))}
          </FieldGroup>
          <FieldError>{errors.departments}</FieldError>
        </FieldSet>

        <Field data-invalid={!!errors.matricNumber}>
          <FieldLabel htmlFor="matric">Matric Number</FieldLabel>
          <Input
            id="matric"
            value={matricNumber}
            onChange={(e) => setMatricNumber(e.target.value)}
            aria-invalid={!!errors.matricNumber}
            placeholder="e.g. 20/1234"
          />
          <FieldError>{errors.matricNumber}</FieldError>
        </Field>

        <Field data-invalid={!!errors.lookingForwardTo}>
          <FieldLabel htmlFor="looking-forward">What are you looking forward to?</FieldLabel>
          <Input
            id="looking-forward"
            value={lookingForwardTo}
            onChange={(e) => setLookingForwardTo(e.target.value)}
            aria-invalid={!!errors.lookingForwardTo}
            placeholder="e.g. the games, meeting new people..."
          />
          <FieldError>{errors.lookingForwardTo}</FieldError>
        </Field>

        {status === 'error' && (
          <p role="alert" className="text-sm text-destructive font-medium">
            {errorMessage}
          </p>
        )}

        <Button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full bg-primary text-primary-foreground shadow-[0_0_20px_oklch(0.73_0.24_355_/_50%)] hover:bg-primary/90"
        >
          {status === 'submitting' && <Spinner />}
          {status === 'submitting' ? 'Reserving...' : 'Reserve My Spot'}
        </Button>
      </FieldGroup>
    </form>
  )
}
