'use client'

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
  Record<
    'name' | 'email' | 'departments' | 'matricNumber' | 'lookingForwardTo',
    string
  >
>

export function RegistrationForm({ eventSlug, priceNaira }: { eventSlug: string; priceNaira: number }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [matricNumber, setMatricNumber] = useState('')
  const [lookingForwardTo, setLookingForwardTo] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

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
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventSlug, name, email, departments, matricNumber, lookingForwardTo }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok || !body.url) {
        throw new Error(body.error ?? 'Could not start payment. Try again.')
      }
      // Hand over to Paystack's secure payment page. Staying in 'submitting' keeps the button locked meanwhile.
      window.location.href = body.url
    } catch (err) {
      console.error('Form submission error:', err)
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
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
          {status === 'submitting' ? 'Taking you to payment...' : `Pay ₦${priceNaira.toLocaleString('en-NG')} & Reserve My Spot`}
        </Button>
      </FieldGroup>
    </form>
  )
}
