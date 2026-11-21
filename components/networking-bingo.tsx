'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { BINGO_CENTER_PROMPT, BINGO_PROMPTS } from '@/lib/bingo-prompts'

const SIZE = 5
const CENTER = 12
const TOKEN_KEY = 'sees30-bingo-token-v2'

const LINES: number[][] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c)),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => r * SIZE + c)),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + i),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)),
]

type State = {
  name: string
  code: string
  card: number[]
  squares: number
  lines: number
  checkedIn: boolean
  marks: { square: number; name: string }[]
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
    // Works for this visit without storage; re-join restores the same card.
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.error ?? 'Something went wrong.'), { status: response.status })
  return data as T
}

function promptFor(card: number[], square: number) {
  if (square === CENTER) return BINGO_CENTER_PROMPT
  const index = card[square < CENTER ? square : square - 1]
  return BINGO_PROMPTS[index] ?? 'Find someone new'
}

// Camera QR reader used inside the "fill a square" sheet.
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
  const [email, setEmail] = useState('')
  const [matric, setMatric] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [code, setCode] = useState('')
  const [marking, setMarking] = useState(false)
  const [markError, setMarkError] = useState('')
  const [toast, setToast] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [qr, setQr] = useState('')

  const refresh = useCallback(async (t: string) => {
    try {
      setState(await post<State>('/api/bingo/state', { token: t }))
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
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

  // Picks up door check-in (and marks made on another phone) without a manual refresh.
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
    const timer = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  const marked = useMemo(() => new Map(state?.marks.map((m) => [m.square, m.name]) ?? []), [state])
  const lines = useMemo(() => LINES.filter((line) => line.every((i) => i === CENTER || marked.has(i))), [marked])
  const inLine = useMemo(() => new Set(lines.flat()), [lines])

  const submitCode = useCallback(
    async (raw: string) => {
      if (!token || open === null || marking) return
      setMarking(true)
      setMarkError('')
      try {
        const result = await post<{ name: string; lines: number }>('/api/bingo/mark', { token, square: open, code: raw })
        setOpen(null)
        setCode('')
        setToast(`✓ ${result.name} verified!`)
        await refresh(token)
      } catch (error) {
        setMarkError((error as Error).message)
      } finally {
        setMarking(false)
      }
    },
    [token, open, marking, refresh],
  )

  async function join(event: React.FormEvent) {
    event.preventDefault()
    setJoining(true)
    setJoinError('')
    try {
      const result = await post<{ token: string }>('/api/bingo/join', { email, matric })
      writeToken(result.token)
      setToken(result.token)
      await refresh(result.token)
    } catch (error) {
      setJoinError((error as Error).message)
    } finally {
      setJoining(false)
    }
  }

  if (!ready) return <div className="aspect-square w-full animate-pulse rounded-2xl bg-card" />

  if (!token || !state) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-5 text-sm">
          <p className="font-semibold">How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Find someone who matches a square.</li>
            <li>Scan their bingo QR (or type their 6-letter code). That&apos;s the proof you met.</li>
            <li>One person per square. Complete a row, column or diagonal for BINGO!</li>
          </ol>
          <p className="mt-3 text-muted-foreground">Everyone must be checked in at the door. Scores update the <a href="/play/leaderboard" className="text-primary underline">live leaderboard</a>.</p>
        </div>
        <form onSubmit={join} className="space-y-3 rounded-2xl border border-primary/40 bg-card p-5">
          <p className="font-semibold">Get your bingo card</p>
          <p className="text-xs text-muted-foreground">Use the email and matric number you registered with. Only your first name and initial are shown to others.</p>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border bg-background p-3" />
          <input required value={matric} onChange={(e) => setMatric(e.target.value)} placeholder="Matric number" autoCapitalize="characters" className="w-full rounded-lg border bg-background p-3 font-mono" />
          {joinError && <p role="alert" className="text-sm text-amber-500">{joinError}</p>}
          <button disabled={joining} className="w-full rounded-lg bg-primary p-3 font-semibold text-primary-foreground disabled:opacity-60">
            {joining ? 'Dealing your card…' : 'Start playing'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-secondary/40 bg-card p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your code</p>
          <p className="font-mono text-3xl font-bold tracking-[0.2em] text-secondary">{state.code}</p>
          <p className="text-xs text-muted-foreground">Others scan this to add you to their card.</p>
        </div>
        <button type="button" onClick={() => setShowQr(true)} className="shrink-0 rounded-xl bg-secondary px-4 py-3 font-semibold text-secondary-foreground">
          Show my QR
        </button>
      </div>

      {!state.checkedIn && (
        <p role="status" className="rounded-xl border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
          Get your ticket scanned at the door to start filling squares. This page updates by itself once you&apos;re in.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 text-sm">
        <span>
          <b>{state.name}</b> · {state.squares}/24 met · {state.lines} {state.lines === 1 ? 'line' : 'lines'}
        </span>
        <a href="/play/leaderboard" className="font-semibold text-primary underline">Leaderboard →</a>
      </div>

      {lines.length > 0 && (
        <div role="status" className="rounded-2xl border-2 border-secondary bg-secondary/15 p-4 text-center">
          <p className="font-display text-3xl text-secondary">{state.squares >= 24 ? 'BLACKOUT!' : lines.length === 1 ? 'BINGO!' : `${lines.length}× BINGO!`}</p>
          <p className="mt-1 text-sm">Verified and on the leaderboard. Keep going for more lines!</p>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="grid" aria-label="Networking bingo card">
        {Array.from({ length: SIZE * SIZE }, (_, square) => {
          const who = square === CENTER ? 'You' : marked.get(square)
          const prompt = promptFor(state.card, square)
          return (
            <button
              key={square}
              type="button"
              disabled={square === CENTER || Boolean(who)}
              onClick={() => {
                setOpen(square)
                setCode('')
                setMarkError('')
              }}
              aria-label={`${prompt}${who ? `: ${who}` : ''}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border p-1 text-center text-[9px] leading-tight transition sm:rounded-xl sm:p-2 sm:text-xs ${
                square === CENTER
                  ? 'border-primary bg-primary text-primary-foreground'
                  : inLine.has(square)
                    ? 'border-secondary bg-secondary text-secondary-foreground'
                    : who
                      ? 'border-secondary/70 bg-secondary/25'
                      : 'border-border bg-card hover:border-secondary'
              }`}
            >
              <span className={who ? 'line-clamp-2 opacity-80' : 'line-clamp-5'}>{prompt}</span>
              {who && <span className="mt-0.5 line-clamp-1 font-bold sm:mt-1 sm:text-sm">✓ {who}</span>}
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
        <p role="status" className="fixed inset-x-4 bottom-6 z-50 mx-auto max-w-sm rounded-xl bg-green-600 p-4 text-center font-semibold text-white shadow-lg">
          {toast}
        </p>
      )}

      {showQr && (
        <button type="button" onClick={() => setShowQr(false)} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/85 p-6 text-white">
          <span className="text-sm uppercase tracking-[0.25em]">Scan to add {state.name}</span>
          {qr && <img src={qr} alt={`Bingo QR code for ${state.name}`} width={300} height={300} className="rounded-2xl" />}
          <span className="font-mono text-4xl font-bold tracking-[0.25em]">{state.code}</span>
          <span className="text-sm opacity-80">Tap anywhere to close</span>
        </button>
      )}

      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setOpen(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border border-secondary/40 bg-card p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-secondary">Find someone who…</p>
            <h2 className="font-display text-2xl text-primary">{promptFor(state.card, open)}</h2>
            {state.checkedIn ? (
              <>
                <p className="text-sm text-muted-foreground">Ask them to tap <b>Show my QR</b> on their bingo page, then scan it.</p>
                <QrReader onCode={submitCode} />
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (code.trim()) void submitCode(code)
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
                  <button disabled={marking || !code.trim()} className="rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground disabled:opacity-50">
                    {marking ? '…' : 'Add'}
                  </button>
                </form>
              </>
            ) : (
              <p className="rounded-lg border border-amber-500/60 p-3 text-sm">Get checked in at the door first.</p>
            )}
            {markError && <p role="alert" className="text-sm text-amber-500">{markError}</p>}
            <button type="button" onClick={() => setOpen(null)} className="w-full rounded-lg border p-3">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
