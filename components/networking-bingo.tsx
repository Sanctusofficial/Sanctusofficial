'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { BINGO_ICEBREAKERS, BINGO_JOIN_QUESTIONS } from '@/lib/bingo-prompts'

const CENTER = 4
const TOKEN_KEY = 'sees30-bingo-token-v3'
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

type Slot = { slot: number; name: string; food: string | null; fact: string | null; icebreaker: number; met: boolean }
type State = {
  name: string
  code: string
  squares: number
  lines: number
  skipsLeft: number
  checkedIn: boolean
  slots: Slot[]
}

const readToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
const writeToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Works for this visit without storage; re-joining restores the same card.
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.error ?? 'Something went wrong.'), { status: response.status })
  return data as T
}

function QrReader({ onCode }: { onCode: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let controls: { stop: () => void } | undefined
    let active = true
    let fired = false
    void import('@zxing/browser').then(async ({ BrowserQRCodeReader }) => {
      if (!active || !videoRef.current) return
      try {
        controls = await new BrowserQRCodeReader().decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (result) => {
            if (!result || fired) return
            fired = true
            onCode(result.getText())
          },
        )
        if (!active) controls.stop()
      } catch {
        if (active) setFailed(true)
      }
    })
    return () => {
      active = false
      controls?.stop()
    }
  }, [onCode])
  return failed ? (
    <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Camera unavailable. Type their code below instead.</p>
  ) : (
    <video ref={videoRef} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
  )
}

export function NetworkingBingo() {
  const [token, setToken] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<State | null>(null)
  const [form, setForm] = useState({ email: '', matric: '', food: '', fact: '' })
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [qr, setQr] = useState('')

  const refresh = useCallback(async (t: string) => {
    try {
      setState(await post<State>('/api/bingo/state', { token: t }))
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        writeToken(null)
        setToken(null)
        setState(null)
      }
    }
  }, [])

  useEffect(() => {
    const t = readToken()
    setToken(t)
    setReady(true)
    if (t) void refresh(t)
  }, [refresh])

  // Picks up door check-in and squares completed by the other person finding you.
  useEffect(() => {
    if (!token) return
    const timer = setInterval(() => void refresh(token), 15000)
    return () => clearInterval(timer)
  }, [token, refresh])

  useEffect(() => {
    if (!state?.code) return
    void import('qrcode').then((QR) =>
      QR.toDataURL(`SEES30BINGO:${state.code}`, { margin: 2, width: 360, color: { dark: '#14001f', light: '#ffffff' } }).then(setQr),
    )
  }, [state?.code])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const bySlot = useMemo(() => new Map(state?.slots.map((s) => [s.slot, s]) ?? []), [state])
  const metSlots = useMemo(() => new Set(state?.slots.filter((s) => s.met).map((s) => s.slot) ?? []), [state])
  const lines = useMemo(() => LINES.filter((line) => line.every((i) => i === CENTER || metSlots.has(i))), [metSlots])
  const inLine = useMemo(() => new Set(lines.flat()), [lines])

  const act = useCallback(
    async (slot: number, action: 'draw' | 'skip' | 'scan', scanned?: string) => {
      if (!token || busy) return
      setBusy(true)
      setError('')
      try {
        const result = await post<{ name?: string }>('/api/bingo/mark', { token, slot, action, code: scanned })
        if (action === 'scan') {
          setOpen(null)
          setCode('')
          setToast(`✓ You found ${result.name}!`)
        } else {
          setOpen(slot)
        }
        await refresh(token)
      } catch (e) {
        setError((e as Error).message)
        if (action === 'draw') setToast((e as Error).message)
      } finally {
        setBusy(false)
      }
    },
    [token, busy, refresh],
  )

  const onScan = useCallback((text: string) => {
    if (open !== null) void act(open, 'scan', text)
  }, [open, act])

  async function join(event: React.FormEvent) {
    event.preventDefault()
    setJoining(true)
    setJoinError('')
    try {
      const result = await post<{ token: string }>('/api/bingo/join', form)
      writeToken(result.token)
      setToken(result.token)
      await refresh(result.token)
    } catch (e) {
      setJoinError((e as Error).message)
    } finally {
      setJoining(false)
    }
  }

  if (!ready) return <div className="aspect-square w-full animate-pulse rounded-2xl bg-card" />

  if (!token || !state) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 text-sm">
          <p className="font-semibold">Meet people you don&apos;t know yet 👋</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Tap a square to reveal a <b>mystery guest</b>. The app picks them for you, so no friends allowed!</li>
            <li>Find them using their name and clues, and chat using the icebreaker.</li>
            <li>Scan their bingo QR to prove you met. Three in a row = <b>BINGO!</b></li>
          </ol>
        </div>
        <form onSubmit={join} className="space-y-3 rounded-2xl border border-primary/40 bg-card p-5">
          <p className="font-semibold">Get your card</p>
          <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email you registered with" className="w-full rounded-lg border bg-background p-3" />
          <input required value={form.matric} onChange={(e) => setForm({ ...form, matric: e.target.value })} placeholder="Matric number" autoCapitalize="characters" className="w-full rounded-lg border bg-background p-3 font-mono" />
          <p className="pt-2 text-sm font-semibold">Two clues so people can find you</p>
          <input required maxLength={60} value={form.food} onChange={(e) => setForm({ ...form, food: e.target.value })} placeholder={BINGO_JOIN_QUESTIONS.food} className="w-full rounded-lg border bg-background p-3" />
          <input required maxLength={80} value={form.fact} onChange={(e) => setForm({ ...form, fact: e.target.value })} placeholder={BINGO_JOIN_QUESTIONS.fact} className="w-full rounded-lg border bg-background p-3" />
          <p className="text-xs text-muted-foreground">Others see your first name, last initial and these clues. Tip: tell them what you&apos;re wearing today!</p>
          {joinError && <p role="alert" className="text-sm text-amber-500">{joinError}</p>}
          <button disabled={joining} className="w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-60">
            {joining ? 'Dealing your card…' : 'Start playing'}
          </button>
        </form>
      </div>
    )
  }

  const current = open !== null ? bySlot.get(open) : undefined

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-secondary/40 bg-card p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your code</p>
          <p className="font-mono text-3xl font-bold tracking-[0.2em] text-secondary">{state.code}</p>
          <p className="text-xs text-muted-foreground">Show this when someone finds you.</p>
        </div>
        <button type="button" onClick={() => setShowQr(true)} className="shrink-0 rounded-xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground">
          Show my QR
        </button>
      </div>

      {!state.checkedIn && (
        <p role="status" className="rounded-xl border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
          Get your ticket scanned at the door to start. This page updates by itself once you&apos;re in.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 text-sm">
        <span>
          <b>{state.name}</b> · {state.squares}/8 found · {state.lines} {state.lines === 1 ? 'line' : 'lines'}
        </span>
        <a href="/play/leaderboard" className="font-semibold text-primary underline">Leaderboard →</a>
      </div>

      {lines.length > 0 && (
        <div role="status" className="rounded-2xl border-2 border-secondary bg-secondary/15 p-4 text-center">
          <p className="font-display text-3xl text-secondary">{state.squares >= 8 ? 'BLACKOUT!' : lines.length === 1 ? 'BINGO!' : `${lines.length}× BINGO!`}</p>
          <p className="mt-1 text-sm">Verified and on the leaderboard. Keep going!</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2" role="grid" aria-label="Mystery guest bingo card">
        {Array.from({ length: 9 }, (_, square) => {
          if (square === CENTER) {
            return (
              <div key={square} className="flex aspect-square flex-col items-center justify-center rounded-xl border border-primary bg-primary p-2 text-center text-primary-foreground">
                <span className="text-xs">FREE</span>
                <span className="font-bold">You made it!</span>
              </div>
            )
          }
          const s = bySlot.get(square)
          return (
            <button
              key={square}
              type="button"
              disabled={busy || !state.checkedIn || s?.met}
              onClick={() => {
                setError('')
                setCode('')
                if (s) setOpen(square)
                else void act(square, 'draw')
              }}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl border p-2 text-center text-xs leading-tight transition disabled:cursor-default ${
                inLine.has(square)
                  ? 'border-secondary bg-secondary text-secondary-foreground'
                  : s?.met
                    ? 'border-secondary/70 bg-secondary/25'
                    : s
                      ? 'border-primary/60 bg-card'
                      : 'border-dashed border-border bg-card hover:border-secondary'
              }`}
            >
              {s?.met ? (
                <>
                  <span className="text-2xl">✓</span>
                  <span className="font-bold">{s.name}</span>
                </>
              ) : s ? (
                <>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Find</span>
                  <span className="text-sm font-bold text-primary">{s.name}</span>
                  <span className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{s.fact}</span>
                </>
              ) : (
                <>
                  <span className="text-2xl">❓</span>
                  <span>Tap to reveal a mystery guest</span>
                </>
              )}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          writeToken(null)
          setToken(null)
          setState(null)
        }}
        className="text-xs text-muted-foreground underline"
      >
        Not you? Switch player
      </button>

      {toast && (
        <p role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-xl bg-zinc-900 p-4 text-center font-semibold text-white shadow-lg">
          {toast}
        </p>
      )}

      {showQr && (
        <button type="button" onClick={() => setShowQr(false)} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-6 text-white">
          <span className="text-sm uppercase tracking-[0.25em]">{state.name}</span>
          {qr && <img src={qr} alt={`Bingo QR code for ${state.name}`} width={300} height={300} className="rounded-2xl" />}
          <span className="font-mono text-4xl font-bold tracking-[0.25em]">{state.code}</span>
          <span className="text-sm opacity-80">Tap anywhere to close</span>
        </button>
      )}

      {open !== null && current && !current.met && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border border-secondary/40 bg-card p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-secondary">Your mystery guest</p>
            <h2 className="font-display text-3xl text-primary">{current.name}</h2>
            <ul className="space-y-1 text-sm">
              {current.food && <li>🍲 Go-to food: <b>{current.food}</b></li>}
              {current.fact && <li>✨ Fun fact: <b>{current.fact}</b></li>}
            </ul>
            <p className="rounded-lg bg-primary/10 p-3 text-sm">
              <span className="text-xs uppercase tracking-wider text-primary">Ask them</span>
              <br />
              {BINGO_ICEBREAKERS[current.icebreaker] ?? BINGO_ICEBREAKERS[0]}
            </p>
            <p className="text-sm text-muted-foreground">Found them? Ask them to tap <b>Show my QR</b>, then scan it:</p>
            <QrReader onCode={onScan} />
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (code.trim()) void act(open, 'scan', code)
              }}
              className="flex gap-2"
            >
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Or type their code"
                maxLength={8}
                autoCapitalize="characters"
                className="min-w-0 flex-1 rounded-lg border bg-background p-3 font-mono tracking-widest"
              />
              <button disabled={busy || !code.trim()} className="rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground disabled:opacity-50">
                {busy ? '…' : 'Add'}
              </button>
            </form>
            {error && <p role="alert" className="text-sm text-amber-500">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || state.skipsLeft <= 0}
                onClick={() => void act(open, 'skip')}
                className="flex-1 rounded-lg border p-3 text-sm disabled:opacity-50"
              >
                Can&apos;t find them · skip ({state.skipsLeft} left)
              </button>
              <button type="button" onClick={() => setOpen(null)} className="rounded-lg border px-4">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
