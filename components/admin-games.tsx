'use client'

import { useCallback, useEffect, useState } from 'react'

type Team = { slug: string; name: string; color: string }
type Game = { id: string; name: string }
type LogRow = { id: string; game_id: string; team_slug: string; points: number; note: string | null; created_at: string }
type Question = { id: string; position: number; prompt: string; options: string[]; correct: number; seconds: number; double_points: boolean }
type QuizState = {
  status: 'lobby' | 'question' | 'reveal' | 'finished'
  number: number
  total: number
  teams: Team[]
  question: { prompt: string; options: string[]; correct: number | null; remainingMs: number; seconds: number; double?: boolean } | null
  answeredTeams: string[]
  results: { team: string; choice: number; correct: boolean; points: number }[] | null
  totals: Record<string, number>
}

const card = 'rounded-2xl border border-border bg-card p-5'
const input = 'w-full rounded-lg border bg-background p-3'

function useAdminFetch(adminKey: string) {
  return useCallback(
    async <T,>(url: string, method = 'GET', body?: unknown): Promise<T> => {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
      return data as T
    },
    [adminKey],
  )
}

// ---------- Award points ----------
function PointsPanel({ adminKey, teams, games }: { adminKey: string; teams: Team[]; games: Game[] }) {
  const api = useAdminFetch(adminKey)
  const [game, setGame] = useState(games.find((g) => g.id !== 'quiz')?.id ?? '')
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [log, setLog] = useState<LogRow[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const loadLog = useCallback(async () => {
    try {
      setLog((await api<{ log: LogRow[] }>('/api/admin/games')).log)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [api])
  useEffect(() => void loadLog(), [loadLog])

  async function award(team: string, points: number) {
    if (!game || !points) return
    setBusy(true)
    setError('')
    try {
      await api('/api/admin/games', 'POST', { game, team, points })
      setCustom((c) => ({ ...c, [team]: '' }))
      await loadLog()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function undo(id: string) {
    setBusy(true)
    try {
      await api('/api/admin/games', 'DELETE', { id })
      await loadLog()
    } finally {
      setBusy(false)
    }
  }

  const teamName = (slug: string) => teams.find((t) => t.slug === slug)?.name ?? slug
  const gameName = (id: string) => games.find((g) => g.id === id)?.name ?? id

  return (
    <section className={card}>
      <h2 className="font-display text-2xl text-secondary">Award points</h2>
      <label className="mt-4 block text-sm font-semibold" htmlFor="award-game">Game</label>
      <select id="award-game" value={game} onChange={(e) => setGame(e.target.value)} className={`${input} mt-1`}>
        {games.map((g) => (
          <option key={g.id} value={g.id}>{g.name}{g.id === 'quiz' ? ' (bonus; quiz points add automatically)' : ''}</option>
        ))}
      </select>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {teams.map((t) => (
          <div key={t.slug} className="rounded-xl border-2 p-3" style={{ borderColor: t.color }}>
            <p className="font-display text-lg" style={{ color: t.color }}>{t.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[10, 20, 50, 100].map((p) => (
                <button key={p} type="button" disabled={busy} onClick={() => void award(t.slug, p)} className="rounded-lg bg-secondary px-3 py-2 font-semibold text-secondary-foreground disabled:opacity-50">
                  +{p}
                </button>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void award(t.slug, Number(custom[t.slug]))
              }}
            >
              <input
                inputMode="numeric"
                value={custom[t.slug] ?? ''}
                onChange={(e) => setCustom((c) => ({ ...c, [t.slug]: e.target.value }))}
                placeholder="Other (e.g. 35 or -10)"
                className="min-w-0 flex-1 rounded-lg border bg-background p-2"
              />
              <button disabled={busy || !Number(custom[t.slug])} className="rounded-lg border px-3 disabled:opacity-50">Add</button>
            </form>
          </div>
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-amber-500">{error}</p>}

      <h3 className="mt-6 font-semibold">Recent awards</h3>
      {log.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">No points awarded yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border text-sm">
          {log.slice(0, 25).map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate">
                <b>{row.points > 0 ? `+${row.points}` : row.points}</b> {teamName(row.team_slug)} · {gameName(row.game_id)}
                <span className="text-muted-foreground"> · {new Date(row.created_at).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })}</span>
              </span>
              <button type="button" disabled={busy} onClick={() => void undo(row.id)} className="shrink-0 text-xs text-red-500 underline">Undo</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------- Live quiz host ----------
function QuizHost({ adminKey }: { adminKey: string }) {
  const api = useAdminFetch(adminKey)
  const [state, setState] = useState<QuizState | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [fetchedAt, setFetchedAt] = useState(Date.now())
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      setState(await api<QuizState>('/api/admin/quiz/control'))
      setFetchedAt(Date.now())
    } catch (e) {
      setError((e as Error).message)
    }
  }, [api])

  useEffect(() => {
    void load()
    const poll = setInterval(load, 1500)
    const tick = setInterval(() => setNow(Date.now()), 250)
    return () => {
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [load])

  async function control(action: string) {
    if (action === 'reset' && !window.confirm('Reset the quiz? This deletes all quiz answers and quiz points.')) return
    setBusy(true)
    setError('')
    try {
      setState(await api<QuizState>('/api/admin/quiz/control', 'POST', { action }))
      setFetchedAt(Date.now())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!state) return <section className={card}>Loading quiz…</section>
  const q = state.question
  const remaining = q && state.status === 'question' ? Math.max(0, Math.ceil((q.remainingMs - (now - fetchedAt)) / 1000)) : 0
  const allAnswered = state.answeredTeams.length >= state.teams.length
  const isLast = state.number >= state.total

  return (
    <section className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl text-secondary">Host the quiz</h2>
        <span className="text-sm text-muted-foreground">
          {state.status === 'lobby' ? 'Lobby' : state.status === 'finished' ? 'Finished' : `Question ${state.number} of ${state.total}`}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Teams join at <b>/quiz</b> on one phone each. Read each question out loud too.</p>

      {q && state.status !== 'lobby' && (
        <div className="mt-4 space-y-2 rounded-xl bg-muted/50 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-lg font-semibold">{q.double && <b className="mr-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">2×</b>}{q.prompt}</p>
            {state.status === 'question' && <span className={`font-display text-3xl tabular-nums ${remaining <= 5 ? 'text-red-500' : 'text-secondary'}`}>{remaining}</span>}
          </div>
          <ol className="space-y-1 text-sm">
            {q.options.map((o, i) => (
              <li key={i} className={q.correct === i ? 'font-bold text-green-500' : ''}>{['▲', '◆', '●', '■'][i]} {o}{q.correct === i ? '  ✓ correct' : ''}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {state.teams.map((t) => {
          const r = state.results?.find((x) => x.team === t.slug)
          return (
            <div key={t.slug} className="rounded-xl border-2 p-2 text-center text-sm" style={{ borderColor: t.color }}>
              <p className="font-semibold" style={{ color: t.color }}>{t.name.replace('Team ', '')}</p>
              <p className="tabular-nums">{(state.totals[t.slug] ?? 0).toLocaleString()}</p>
              {state.status !== 'lobby' && state.status !== 'finished' && (
                <p className="text-xs">{r ? (r.correct ? `✓ +${r.points}` : '✗ wrong') : 'waiting…'}</p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(state.status === 'lobby' || state.status === 'reveal') && (
          <button type="button" disabled={busy || state.total === 0} onClick={() => void control('next')} className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">
            {state.status === 'lobby' ? `Start quiz (${state.total} questions)` : isLast ? 'Show final scores' : 'Next question →'}
          </button>
        )}
        {state.status === 'question' && (
          <button type="button" disabled={busy} onClick={() => void control('reveal')} className={`rounded-lg px-5 py-3 font-semibold ${remaining === 0 || allAnswered ? 'bg-primary text-primary-foreground' : 'border'}`}>
            Reveal answer{remaining > 0 && !allAnswered ? ' early' : ''}
          </button>
        )}
        {state.status !== 'finished' && state.status !== 'lobby' && (
          <button type="button" disabled={busy} onClick={() => void control('finish')} className="rounded-lg border px-4 py-3">End quiz</button>
        )}
        <button type="button" disabled={busy} onClick={() => void control('reset')} className="rounded-lg border border-red-500/50 px-4 py-3 text-red-500">Reset quiz</button>
      </div>
      {state.total === 0 && <p className="mt-2 text-sm text-amber-500">Add questions below before starting.</p>}
      {error && <p role="alert" className="mt-2 text-sm text-amber-500">{error}</p>}
    </section>
  )
}

// ---------- Question editor ----------
const EMPTY = { prompt: '', options: ['', '', '', ''], correct: 0, seconds: 20, double: false }

function QuestionEditor({ adminKey }: { adminKey: string }) {
  const api = useAdminFetch(adminKey)
  const [questions, setQuestions] = useState<Question[]>([])
  const [form, setForm] = useState(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setQuestions((await api<{ questions: Question[] }>('/api/admin/quiz/questions')).questions)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [api])
  useEffect(() => void load(), [load])

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
      await load()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    // Keep the correct answer pointing at the same option after blanks are dropped.
    const kept = form.options.map((o, i) => ({ o: o.trim(), i })).filter((x) => x.o)
    const correct = kept.findIndex((x) => x.i === form.correct)
    if (correct < 0) return setError('The correct answer can’t be an empty option.')
    const payload = { prompt: form.prompt, options: kept.map((x) => x.o), correct, seconds: form.seconds, double: form.double }
    const ok = await run(() => (editing ? api('/api/admin/quiz/questions', 'PUT', { id: editing, ...payload }) : api('/api/admin/quiz/questions', 'POST', payload)))
    if (ok) {
      setForm(EMPTY)
      setEditing(null)
    }
  }

  function edit(q: Question) {
    setEditing(q.id)
    setForm({ prompt: q.prompt, options: [...q.options, '', '', '', ''].slice(0, 4), correct: q.correct, seconds: q.seconds, double: q.double_points })
    document.getElementById('question-form')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section className={card}>
      <h2 className="font-display text-2xl text-secondary">Quiz questions ({questions.length})</h2>

      <form id="question-form" onSubmit={save} className="mt-4 space-y-3 rounded-xl border border-dashed border-border p-4">
        <p className="font-semibold">{editing ? 'Edit question' : 'Add a question'}</p>
        <textarea required maxLength={300} value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} placeholder="Question, e.g. What does SEES stand for?" rows={2} className={input} />
        <p className="text-xs text-muted-foreground">Fill 2–4 answers and tick the correct one.</p>
        {form.options.map((option, i) => (
          <label key={i} className="flex items-center gap-2">
            <input type="radio" name="correct" checked={form.correct === i} onChange={() => setForm({ ...form, correct: i })} className="size-5 shrink-0" aria-label={`Answer ${i + 1} is correct`} />
            <span className="w-5 text-center">{['▲', '◆', '●', '■'][i]}</span>
            <input
              value={option}
              maxLength={80}
              required={i < 2}
              onChange={(e) => setForm({ ...form, options: form.options.map((o, j) => (j === i ? e.target.value : o)) })}
              placeholder={`Answer ${i + 1}${i >= 2 ? ' (optional)' : ''}`}
              className="min-w-0 flex-1 rounded-lg border bg-background p-2"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          Time limit
          <select value={form.seconds} onChange={(e) => setForm({ ...form, seconds: Number(e.target.value) })} className="rounded-lg border bg-background p-2">
            {[10, 15, 20, 30, 45, 60].map((s) => <option key={s} value={s}>{s} seconds</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.double} onChange={(e) => setForm({ ...form, double: e.target.checked })} className="size-5" />
          Double points (2×)
        </label>
        {error && <p role="alert" className="text-sm text-amber-500">{error}</p>}
        <div className="flex gap-2">
          <button disabled={busy} className="rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-50">{editing ? 'Save changes' : 'Add question'}</button>
          {editing && <button type="button" onClick={() => { setEditing(null); setForm(EMPTY) }} className="rounded-lg border px-4">Cancel</button>}
        </div>
      </form>

      {questions.length > 0 && (
        <ol className="mt-4 space-y-2">
          {questions.map((q, index) => (
            <li key={q.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold">{index + 1}. {q.prompt}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{q.double_points ? '2× · ' : ''}{q.seconds}s</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {q.options.map((o, i) => (
                  <span key={i} className={i === q.correct ? 'font-semibold text-green-500' : ''}>{i > 0 ? ' · ' : ''}{o}{i === q.correct ? ' ✓' : ''}</span>
                ))}
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <button type="button" disabled={busy || index === 0} onClick={() => void run(() => api('/api/admin/quiz/questions', 'PUT', { id: q.id, move: -1 }))} className="underline disabled:opacity-40">↑ Up</button>
                <button type="button" disabled={busy || index === questions.length - 1} onClick={() => void run(() => api('/api/admin/quiz/questions', 'PUT', { id: q.id, move: 1 }))} className="underline disabled:opacity-40">↓ Down</button>
                <button type="button" disabled={busy} onClick={() => edit(q)} className="underline">Edit</button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { if (window.confirm('Delete this question?')) void run(() => api('/api/admin/quiz/questions', 'DELETE', { id: q.id })) }}
                  className="text-red-500 underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function AdminGames({ adminKey, teams, games }: { adminKey: string; teams: Team[]; games: Game[] }) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl text-primary">Team games admin</h1>
        <a href="/games" target="_blank" className="text-sm text-primary underline">Open public leaderboard ↗</a>
      </div>
      <PointsPanel adminKey={adminKey} teams={teams} games={games} />
      <QuizHost adminKey={adminKey} />
      <QuestionEditor adminKey={adminKey} />
    </div>
  )
}
