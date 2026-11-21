'use client'

import { useEffect, useRef, useState } from 'react'

import { createBrowserAuthClient } from '@/lib/auth/browser'

const GUEST_KEY = 'sees30-photo-guest'
type Guest = { email: string; matric: string; name: string }

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/memories/guest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error ?? 'Something went wrong.')
  return data as T
}

// Resize on the phone (max 1600px JPEG) so uploads are quick on event Wi-Fi.
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (blob) return blob
  } catch {
    // Fall back to the original file below.
  }
  if (file.type === 'image/jpeg' && file.size < 10 * 1024 * 1024) return file
  throw new Error('This photo format is not supported.')
}

export function GuestPhotoUpload() {
  const [guest, setGuest] = useState<Guest | null>(null)
  const [email, setEmail] = useState('')
  const [matric, setMatric] = useState('')
  const [caption, setCaption] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ done: number; failed: number; total: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GUEST_KEY)
      if (raw) setGuest(JSON.parse(raw) as Guest)
    } catch {
      // Confirm again this visit.
    }
  }, [])

  async function confirm(event: React.FormEvent) {
    event.preventDefault()
    setChecking(true)
    setError('')
    try {
      const { name } = await api<{ name: string }>({ action: 'check', email, matric })
      const next = { email, matric, name }
      setGuest(next)
      try {
        localStorage.setItem(GUEST_KEY, JSON.stringify(next))
      } catch {
        // Not remembered; fine for this visit.
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setChecking(false)
    }
  }

  async function uploadAll(files: File[]) {
    if (!guest || !files.length) return
    setError('')
    const total = files.length
    let done = 0
    let failed = 0
    setProgress({ done, failed, total })
    const storage = createBrowserAuthClient().storage.from('event-memories')
    const queue = [...files]

    async function worker() {
      for (let file = queue.shift(); file; file = queue.shift()) {
        try {
          const blob = await shrink(file)
          const slot = await api<{ path: string; token: string }>({ action: 'sign', email: guest!.email, matric: guest!.matric })
          const { error: uploadError } = await storage.uploadToSignedUrl(slot.path, slot.token, blob, { contentType: 'image/jpeg' })
          if (uploadError) throw uploadError
          await api({ action: 'save', email: guest!.email, matric: guest!.matric, path: slot.path, caption })
          done += 1
        } catch (e) {
          failed += 1
          setError((e as Error).message)
        }
        setProgress({ done, failed, total })
      }
    }
    // A few at a time: fast, without choking the venue Wi-Fi.
    await Promise.all([worker(), worker(), worker()])
    if (fileRef.current) fileRef.current.value = ''
  }

  const busy = progress !== null && progress.done + progress.failed < progress.total

  return (
    <section className="rounded-2xl border border-primary/40 bg-card p-5">
      <h2 className="font-display text-2xl text-primary">Share your photos 📸</h2>
      <p className="mt-1 text-sm text-muted-foreground">Add the pictures you took at the Mixer. Pick as many as you like.</p>

      {!guest ? (
        <form onSubmit={confirm} className="mt-4 space-y-3">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email you registered with" className="w-full rounded-lg border bg-background p-3" />
          <input required value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="Matric number" autoCapitalize="characters" className="w-full rounded-lg border bg-background p-3 font-mono" />
          {error && <p role="alert" className="text-sm text-amber-500">{error}</p>}
          <button disabled={checking} className="w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-60">
            {checking ? 'Checking…' : 'Continue'}
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            Uploading as <b>{guest.name}</b>.{' '}
            <button type="button" disabled={busy} onClick={() => { setGuest(null); try { localStorage.removeItem(GUEST_KEY) } catch {} }} className="text-muted-foreground underline">
              Not you?
            </button>
          </p>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Caption for these photos (optional)" className="w-full rounded-lg border bg-background p-3" />
          <label className={`block w-full cursor-pointer rounded-xl bg-primary p-4 text-center text-lg font-semibold text-primary-foreground ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            {busy ? `Uploading ${progress!.done + progress!.failed + 1} of ${progress!.total}…` : 'Choose photos'}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              disabled={busy}
              onChange={(e) => void uploadAll(Array.from(e.target.files ?? []))}
              className="sr-only"
            />
          </label>
          {progress && !busy && (
            <p role="status" className={`rounded-lg p-3 text-sm ${progress.failed ? 'bg-amber-500/15' : 'bg-green-600/15'}`}>
              {progress.done} {progress.done === 1 ? 'photo' : 'photos'} added to the wall{progress.failed ? ` · ${progress.failed} failed (tap Choose photos to retry those)` : ' 🎉'}. Refresh to see them.
            </p>
          )}
          {error && busy && <p role="alert" className="text-sm text-amber-500">{error}</p>}
          <p className="text-xs text-muted-foreground">Photos appear publicly on this page with your first name and initial. Only share photos people are happy to have posted.</p>
        </div>
      )}
    </section>
  )
}
