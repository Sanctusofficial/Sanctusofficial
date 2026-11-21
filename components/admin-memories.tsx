'use client'

import { useCallback, useEffect, useState } from 'react'

type Photo = { id: string; image_path: string; caption: string | null; published: boolean; uploader_name: string | null; created_at: string }

export function AdminMemories({ adminKey, baseUrl }: { adminKey: string; baseUrl: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'shown' | 'hidden'>('all')

  const call = useCallback(
    async (method: string, body?: unknown) => {
      const response = await fetch('/api/admin/memories', {
        method,
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Request failed')
      return data
    },
    [adminKey],
  )

  const load = useCallback(async () => {
    try {
      setPhotos((await call('GET')).photos)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [call])
  useEffect(() => void load(), [load])

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusy(id)
    setError('')
    try {
      await fn()
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const shown = photos.filter((p) => (filter === 'all' ? true : filter === 'shown' ? p.published : !p.published))

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Memories ({photos.length})</h1>
        <div className="flex gap-2 text-sm">
          {(['all', 'shown', 'hidden'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 ${filter === f ? 'bg-primary text-primary-foreground' : 'border'}`}>
              {f === 'all' ? 'All' : f === 'shown' ? 'On the wall' : 'Hidden'}
            </button>
          ))}
          <button type="button" onClick={() => void load()} className="rounded-full border px-3 py-1">Refresh</button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Guests upload at /memories. Hide anything that shouldn&apos;t be public; Delete removes the file for good.</p>
      {error && <p role="alert" className="text-sm text-amber-500">{error}</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((p) => (
          <figure key={p.id} className={`overflow-hidden rounded-xl border ${p.published ? 'border-border' : 'border-amber-500'} bg-card`}>
            <a href={`${baseUrl}/storage/v1/object/public/event-memories/${p.image_path}`} target="_blank" rel="noreferrer">
              <img src={`${baseUrl}/storage/v1/object/public/event-memories/${p.image_path}`} alt={p.caption ?? 'Memory'} loading="lazy" className={`aspect-square w-full object-cover ${p.published ? '' : 'opacity-40'}`} />
            </a>
            <figcaption className="space-y-2 p-2 text-xs">
              <p className="truncate text-muted-foreground">
                {p.uploader_name ?? 'Organizer'} · {new Date(p.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}
              </p>
              {p.caption && <p className="line-clamp-2">{p.caption}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => void act(p.id, () => call('PATCH', { id: p.id, published: !p.published }))}
                  className="flex-1 rounded-lg border px-2 py-1"
                >
                  {p.published ? 'Hide' : 'Show'}
                </button>
                <button
                  type="button"
                  disabled={busy === p.id}
                  onClick={() => { if (window.confirm('Delete this photo for good?')) void act(p.id, () => call('DELETE', { id: p.id })) }}
                  className="rounded-lg border border-red-500/50 px-2 py-1 text-red-500"
                >
                  Delete
                </button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      {shown.length === 0 && <p className="text-muted-foreground">No photos here yet.</p>}
    </div>
  )
}
