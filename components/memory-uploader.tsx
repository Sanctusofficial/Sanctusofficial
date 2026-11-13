'use client'

import { useState } from 'react'

export function MemoryUploader({ adminKey, eventSlugs }: { adminKey: string; eventSlugs: string[] }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const form = new FormData(event.currentTarget)
    const response = await fetch('/api/memories', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: form })
    const data = await response.json()
    setMessage(response.ok ? 'Memory published.' : data.error ?? 'Upload failed.')
    if (response.ok) event.currentTarget.reset()
    setBusy(false)
  }
  return (
    <form onSubmit={submit} className="rounded-2xl border border-primary/30 bg-card p-5">
      <h2 className="font-display text-xl text-primary">Publish a memory</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <select name="eventSlug" required className="rounded-lg border bg-background p-3">
          <option value="">Choose event</option>
          {eventSlugs.map((slug) => <option key={slug} value={slug}>{slug}</option>)}
        </select>
        <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="rounded-lg border bg-background p-2" />
        <input name="caption" placeholder="Caption (optional)" className="rounded-lg border bg-background p-3" />
      </div>
      <button disabled={busy} className="mt-3 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">{busy ? 'Publishing...' : 'Publish'}</button>
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
    </form>
  )
}
