'use client'

import { upload } from '@vercel/blob/client'
import { CheckCircle2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldDescription,
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
    'name' | 'email' | 'departments' | 'matricNumber' | 'receipt' | 'lookingForwardTo',
    string
  >
>

// Resizes and compresses a phone camera photo in-browser before upload,
// so weak mobile connections don't stall on a 5-10MB original file.
async function compressImage(file: File, maxWidth = 1200, quality = 0.7): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      const ctx = canvas.getContext('2d')
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Compression failed.'))
            return
          }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality,
      )
    }
    img.onerror = reject
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function RegistrationForm({ eventSlug }: { eventSlug: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [departments, setDepartments] = useState<string[]>([])
  const [matricNumber, setMatricNumber] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [lookingForwardTo, setLookingForwardTo] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  )
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
    if (!receiptFile) next.receipt = 'Upload your payment receipt.'
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
      if (!receiptFile) {
        throw new Error('Please select a payment receipt image.')
      }

      // Compress before upload so large phone camera photos don't stall on slow connections.
      const fileToUpload = await compressImage(receiptFile).catch(() => receiptFile)

      // Upload execution with automatic fallback
      const uploadPromise = (async () => {
        try {
          // Attempt 1: Vercel Blob client upload
          const blob = await upload(fileToUpload.name, fileToUpload, {
            access: 'public',
            handleUploadUrl: '/api/receipt-upload',
          })
          return blob.url
        } catch {
          // Attempt 2: Fallback to direct FormData POST
          const formData = new FormData()
          formData.append('file', fileToUpload)
          const res = await fetch('/api/receipt-upload', {
            method: 'POST',
            body: formData,
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'Failed to upload receipt.')
          return data.url || data.receiptUrl || ''
        }
      })()

      // 30-second safety timeout to stop infinite spinning
      const timeoutPromise = new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('Upload timed out. Please try again.')), 30000)
      )

      const receiptUrl = await Promise.race([uploadPromise, timeoutPromise])

      if (!receiptUrl) {
        throw new Error('Could not retrieve image URL after upload.')
      }

      // Submit registration data to Google Sheets API route
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventSlug,
          name,
          email,
          departments,
          matricNumber,
          receiptUrl,
          lookingForwardTo,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Submission failed. Try again.')
      }

      setStatus('success')
    } catch (err) {
      console.error('Form submission error:', err)
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-secondary/30 bg-card px-6 py-12 text-center"
      >
        <CheckCircle2 className="size-12 text-secondary text-glow-green" aria-hidden="true" />
        <h2 className="font-display text-2xl text-primary text-glow-pink">You&apos;re in!</h2>
        <p className="text-muted-foreground">
          Your spot is locked. See you there.
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

        <Field data-invalid={!!errors.receipt}>
          <FieldLabel htmlFor="receipt">Payment Receipt</FieldLabel>
          <input
            ref={fileInputRef}
            id="receipt"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full justify-start border-secondary/40 text-foreground hover:bg-secondary/10"
          >
            <Upload data-icon="inline-start" />
            {receiptFile ? receiptFile.name : 'Upload receipt image'}
          </Button>
          <FieldDescription>Screenshot or photo of your payment receipt.</FieldDescription>
          <FieldError>{errors.receipt}</FieldError>
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
          {status === 'submitting' ? 'Submitting...' : 'Reserve My Spot'}
        </Button>
      </FieldGroup>
    </form>
  )
}
