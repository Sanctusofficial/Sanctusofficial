'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Outcome = 'ok' | 'already' | 'not_approved' | 'not_found' | 'too_early' | 'ended' | 'invalid' | 'error'
type Guest = {
  name: string
  matric: string | null
  department: string | null
  event: string
  checkedInAt: string | null
}
type Result = { outcome: Outcome; message: string; guest?: Guest; at: number }
type Stats = { approved: number; checkedIn: number }

const LOOK: Record<Outcome, { title: string; bg: string }> = {
  ok: { title: 'ADMIT', bg: 'bg-green-600' },
  already: { title: 'ALREADY USED', bg: 'bg-amber-500' },
  not_approved: { title: 'NOT PAID', bg: 'bg-red-600' },
  not_found: { title: 'INVALID TICKET', bg: 'bg-red-600' },
  invalid: { title: 'NOT A TICKET', bg: 'bg-red-600' },
  too_early: { title: 'TOO EARLY', bg: 'bg-zinc-700' },
  ended: { title: 'EVENT ENDED', bg: 'bg-zinc-700' },
  error: { title: 'TRY AGAIN', bg: 'bg-zinc-700' },
}

const lagosTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) : ''

function signal(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 120 : [200, 100, 200])
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    osc.frequency.value = ok ? 880 : 220
    osc.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.15 : 0.4))
  } catch {
    // Sound/vibration are nice-to-have.
  }
}

export function CheckInScanner({ adminKey, eventSlug = 'mixer' }: { adminKey: string; eventSlug?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const busyRef = useRef(false)
  const showingRef = useRef(false)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const [result, setResult] = useState<Result | null>(null)
  const [recent, setRecent] = useState<Result[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [camera, setCamera] = useState<'starting' | 'on' | 'off'>('starting')
  const [cameraTry, setCameraTry] = useState(0)
  const [matric, setMatric] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const headers = { 'Content-Type': 'application/json', 'x-admin-key': adminKey }

  const submit = useCallback(
    async (payload: { code?: string; matric?: string }) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(true)
      let next: Result
      try {
        const response = await fetch('/api/check-in', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...payload, event: eventSlug }),
        })
        const data = await response.json().catch(() => ({}))
        if (response.status === 401) next = { outcome: 'error', message: 'Wrong admin key. Reopen the door link.', at: Date.now() }
        else next = { outcome: data.outcome ?? 'error', message: data.message ?? 'Check-in failed.', guest: data.guest, at: Date.now() }
        if (data.stats) setStats(data.stats)
      } catch {
        next = { outcome: 'error', message: 'No connection. Check the internet and scan again.', at: Date.now() }
      } finally {
        busyRef.current = false
        setBusy(false)
      }
      signal(next.outcome === 'ok')
      showingRef.current = true
      setResult(next)
      setRecent((list) => [next, ...list].slice(0, 8))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [adminKey, eventSlug],
  )

  const dismiss = useCallback(() => {
    showingRef.current = false
    setResult(null)
  }, [])

  // A valid ticket clears itself so the line keeps moving; problems wait for a tap.
  useEffect(() => {
    if (result?.outcome !== 'ok') return
    const timer = setTimeout(dismiss, 2500)
    return () => clearTimeout(timer)
  }, [result, dismiss])

  useEffect(() => {
    void fetch(`/api/check-in?event=${encodeURIComponent(eventSlug)}`, { headers: { 'x-admin-key': adminKey } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.stats && setStats(d.stats))
      .catch(() => {})
  }, [adminKey, eventSlug])

  useEffect(() => {
    let controls: { stop: () => void } | undefined
    let active = true
    setCamera('starting')
    void import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
      if (!active || !videoRef.current) return
      try {
        controls = await new BrowserQRCodeReader().decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (scan) => {
            if (!scan || showingRef.current || busyRef.current) return
            const text = scan.getText()
            const now = Date.now()
            // The camera sees the same code many times a second; act once.
            if (text === lastRef.current.code && now - lastRef.current.at < 5000) return
            lastRef.current = { code: text, at: now }
            void submit({ code: text })
          },
        )
        if (active) setCamera('on')
        else controls.stop()
      } catch {
        if (active) setCamera('off')
      }
    })
    return () => {
      active = false
      controls?.stop()
    }
  }, [submit, cameraTry])

  const look = result ? LOOK[result.outcome] ?? LOOK.error : null

  return (
    <div className="mx-auto max-w-md space-y-4">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-secondary">Door check-in</p>
          <h1 className="font-display text-2xl text-primary">Scan tickets</h1>
        </div>
        {stats && (
          <p className="text-right">
            <span className="block font-display text-3xl text-secondary">
              {stats.checkedIn}
              <span className="text-lg text-muted-foreground"> / {stats.approved}</span>
            </span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">checked in</span>
          </p>
        )}
      </header>

      <div className="relative overflow-hidden rounded-2xl border border-secondary/30 bg-black">
        <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        <div aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/70" />
        {camera !== 'on' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white">
            {camera === 'starting' ? (
              <p>Starting camera…</p>
            ) : (
              <>
                <p>Camera is blocked or unavailable. Allow camera access for this site, or use the matric number below.</p>
                <button type="button" onClick={() => setCameraTry((n) => n + 1)} className="rounded-lg bg-white px-4 py-2 font-semibold text-black">
                  Try camera again
                </button>
              </>
            )}
          </div>
        )}
        {busy && <p className="absolute inset-x-0 bottom-3 text-center text-sm font-semibold text-white">Checking…</p>}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (matric.trim()) void submit({ matric }).then(() => setMatric(''))
        }}
        className="rounded-2xl border border-border bg-card p-4"
      >
        <label htmlFor="door-matric" className="text-sm font-semibold">No QR code? Check in by matric number</label>
        <div className="mt-2 flex gap-2">
          <input
            id="door-matric"
            value={matric}
            onChange={(e) => setMatric(e.target.value)}
            inputMode="text"
            autoCapitalize="characters"
            placeholder="Matric number"
            className="min-w-0 flex-1 rounded-lg border bg-background p-3 font-mono"
          />
          <button disabled={busy || !matric.trim()} className="rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground disabled:opacity-50">
            Check
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Ask for their student ID and compare the name before admitting.</p>
      </form>

      <details className="rounded-2xl border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Paste a ticket code or link</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) void submit({ code }).then(() => setCode(''))
          }}
          className="mt-3 flex gap-2"
        >
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ticket code" className="min-w-0 flex-1 rounded-lg border bg-background p-3 font-mono" />
          <button disabled={busy || !code.trim()} className="rounded-lg border px-4 font-semibold disabled:opacity-50">Check</button>
        </form>
      </details>

      {recent.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Recent scans</h2>
          <ul className="mt-2 divide-y divide-border text-sm">
            {recent.map((r) => (
              <li key={r.at} className="flex items-center justify-between gap-3 py-2">
                <span className="truncate">{r.guest?.name ?? r.message}</span>
                <span className={`shrink-0 text-xs font-bold ${r.outcome === 'ok' ? 'text-green-500' : r.outcome === 'already' ? 'text-amber-500' : 'text-red-500'}`}>
                  {(LOOK[r.outcome] ?? LOOK.error).title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {result && look && (
        <button
          type="button"
          onClick={dismiss}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-8 text-center text-white ${look.bg}`}
          aria-live="assertive"
        >
          <span className="font-display text-5xl font-black tracking-wide">{look.title}</span>
          {result.guest && (
            <span className="space-y-1">
              <span className="block text-3xl font-bold">{result.guest.name}</span>
              {result.guest.matric && <span className="block font-mono text-xl">{result.guest.matric}</span>}
              {result.guest.department && <span className="block text-lg opacity-90">{result.guest.department}</span>}
              {result.outcome === 'already' && result.guest.checkedInAt && (
                <span className="block text-lg">First checked in at {lagosTime(result.guest.checkedInAt)}</span>
              )}
            </span>
          )}
          <span className="text-lg">{result.message}</span>
          <span className="mt-6 rounded-full bg-black/25 px-6 py-3 text-base font-semibold">
            {result.outcome === 'ok' ? 'Next guest…' : 'Tap to scan next'}
          </span>
        </button>
      )}
    </div>
  )
}
