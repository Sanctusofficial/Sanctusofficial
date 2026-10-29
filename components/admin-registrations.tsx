'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

export type Registration = {
  id: string
  created_at: string | null
  name: string | null
  email: string | null
  departments: string | null
  matric_number: string | null
  receipt_url: string | null
  looking_forward_to: string | null
  status: string
  event_slug: string
  payment_code: string | null
  expires_at: string | null
  confirmed_at: string | null
}

export type EventInfo = {
  slug: string
  title: string
  price_naira: number | null
}

type Tab = 'pending' | 'approved' | 'expired' | 'all'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'expired', label: 'Expired' },
  { id: 'all', label: 'All' },
]

const BADGE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  approved: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  expired: 'bg-neutral-500/15 text-neutral-300 border-neutral-500/40',
}

function formatDate(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDepartments(value: string | null) {
  if (!value) return '—'
  return value
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => d.charAt(0).toUpperCase() + d.slice(1))
    .join(', ')
}

// A pending registration whose payment time has passed counts as expired,
// even before the database row is updated.
function effectiveStatus(r: Registration, nowMs: number) {
  if (r.status === 'pending' && r.expires_at && Date.parse(r.expires_at) < nowMs) {
    return 'expired'
  }
  return r.status
}

export function AdminRegistrations({
  initialRows,
  events,
  adminKey,
  serverNow,
}: {
  initialRows: Registration[]
  events: EventInfo[]
  adminKey: string
  serverNow: string
}) {
  const router = useRouter()
  const [isRefreshing, startTransition] = useTransition()
  const [rows, setRows] = useState<Registration[]>(initialRows)
  const [tab, setTab] = useState<Tab>('pending')
  const [eventFilter, setEventFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'warn' | 'error'; text: string } | null>(
    null,
  )

  // When the page is refreshed, replace the list with the fresh data.
  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  const nowMs = Date.parse(serverNow)

  const inEvent = useMemo(
    () => rows.filter((r) => eventFilter === 'all' || r.event_slug === eventFilter),
    [rows, eventFilter],
  )

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, expired: 0, all: inEvent.length }
    for (const r of inEvent) {
      const s = effectiveStatus(r, nowMs)
      if (s === 'pending' || s === 'approved' || s === 'expired') c[s] += 1
    }
    return c
  }, [inEvent, nowMs])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return inEvent.filter((r) => {
      if (tab !== 'all' && effectiveStatus(r, nowMs) !== tab) return false
      if (!q) return true
      const haystack = [r.name, r.email, r.matric_number, r.payment_code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [inEvent, tab, query, nowMs])

  const selectedEvent = events.find((e) => e.slug === eventFilter)
  const expectedNaira =
    selectedEvent && selectedEvent.price_naira
      ? counts.approved * selectedEvent.price_naira
      : null

  async function approve(r: Registration) {
    const who = r.name ?? 'this person'
    if (!window.confirm(`Approve ${who}? This emails them a confirmation.`)) return

    setBusyId(r.id)
    setBanner(null)
    try {
      const res = await fetch('/api/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ id: r.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not approve.')

      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id ? { ...x, status: 'approved', confirmed_at: new Date().toISOString() } : x,
        ),
      )
      setBanner(
        data.emailSent === false
          ? { kind: 'warn', text: `${who} is approved, but the confirmation email did not send.` }
          : { kind: 'ok', text: `${who} is approved and has been emailed.` },
      )
    } catch (err) {
      setBanner({
        kind: 'error',
        text: err instanceof Error ? err.message : 'Could not approve.',
      })
    } finally {
      setBusyId(null)
    }
  }

  const bannerStyle = {
    ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
    warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
    error: 'border-red-500/40 bg-red-500/10 text-red-200',
  }

  return (
    <main className="min-h-screen bg-black p-4 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Registrations</h1>
            <p className="text-sm text-neutral-400">
              {counts.pending} waiting for payment &middot; {counts.approved} approved
            </p>
            {expectedNaira !== null && (
              <p className="text-sm text-neutral-400">
                Expected in the account: &#8358;{expectedNaira.toLocaleString('en-NG')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => startTransition(() => router.refresh())}
            disabled={isRefreshing}
            className="shrink-0 rounded-lg border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-900 disabled:opacity-50"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {events.length > 1 && (
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            aria-label="Filter by event"
            className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
          >
            <option value="all">All events</option>
            {events.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.title}
              </option>
            ))}
          </select>
        )}

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by payment code, name, email or matric"
          aria-label="Search registrations"
          className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm placeholder:text-neutral-500"
        />

        <div className="mb-4 flex gap-2 overflow-x-auto" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
                tab === t.id
                  ? 'border-pink-400 bg-pink-500/15 text-pink-200'
                  : 'border-neutral-700 text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              {t.label} ({counts[t.id]})
            </button>
          ))}
        </div>

        {banner && (
          <p role="status" className={`mb-4 rounded-lg border p-3 text-sm ${bannerStyle[banner.kind]}`}>
            {banner.text}
          </p>
        )}

        {visible.length === 0 ? (
          <p className="rounded-lg border border-neutral-800 p-6 text-center text-sm text-neutral-400">
            {query.trim() ? 'No one matches that search.' : 'Nothing here yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {visible.map((r) => {
              const status = effectiveStatus(r, nowMs)
              const canApprove = status === 'pending' || status === 'expired'
              return (
                <div key={r.id} className="rounded-lg border border-neutral-700 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.name}</div>
                      <div className="truncate text-neutral-400">{r.email}</div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-xs ${
                        BADGE[status] ?? 'border-neutral-600 text-neutral-300'
                      }`}
                    >
                      {status}
                    </span>
                  </div>

                  {r.payment_code && (
                    <div className="mt-2 font-mono text-lg tracking-widest text-pink-300">
                      {r.payment_code}
                    </div>
                  )}

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-neutral-300">
                    <span>Dept: {formatDepartments(r.departments)}</span>
                    <span>Matric: {r.matric_number}</span>
                  </div>

                  {r.looking_forward_to && (
                    <div className="mt-1 italic text-neutral-400">&quot;{r.looking_forward_to}&quot;</div>
                  )}

                  {r.receipt_url && (
                    <div className="mt-1">
                      <a
                        href={r.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-pink-400 underline"
                      >
                        View receipt
                      </a>
                    </div>
                  )}

                  <div className="mt-2 text-xs text-neutral-500" suppressHydrationWarning>
                    Registered {formatDate(r.created_at)}
                    {status === 'pending' && r.expires_at && <> &middot; hold ends {formatDate(r.expires_at)}</>}
                    {status === 'expired' && r.expires_at && (
                      <> &middot; hold ended {formatDate(r.expires_at)}</>
                    )}
                    {status === 'approved' && r.confirmed_at && (
                      <> &middot; approved {formatDate(r.confirmed_at)}</>
                    )}
                  </div>

                  {canApprove && (
                    <button
                      type="button"
                      onClick={() => approve(r)}
                      disabled={busyId === r.id}
                      className="mt-3 w-full rounded-lg bg-pink-500 px-3 py-2 font-medium text-black hover:bg-pink-400 disabled:opacity-50"
                    >
                      {busyId === r.id
                        ? 'Approving...'
                        : status === 'expired'
                          ? 'Approve late payment'
                          : 'Approve'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
