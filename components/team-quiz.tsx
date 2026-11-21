'use client'

import { useEffect, useState } from 'react'

type Team = { slug: string; name: string; color: string }
type State = {
  status: 'lobby' | 'question' | 'reveal' | 'finished'
  number: number
  total: number
  teams: Team[]
  question: { id: string; prompt: string; options: string[]; seconds: number; remainingMs: number; correct: number | null; double?: boolean } | null
  answeredTeams: string[]
  results: { team: string; choice: number; correct: boolean; points: number }[] | null
  totals: Record<string, number>
}

const TEAM_KEY = 'sees30-quiz-team'
const SHAPES = ['▲', '◆', '●', '■']
const COLORS = ['bg-red-600', 'bg-blue-600', 'bg-amber-500', 'bg-green-600']

export function TeamQuiz() {
  const [team, setTeam] = useState<string | null>(null)
  const [state, setState] = useState<State | null>(null)
  const [offline, setOffline] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [picked, setPicked] = useState<{ q: string; choice: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [fetchedAt, setFetchedAt] = useState(Date.now())

  useEffect(() => {
    try {
      setTeam(localStorage.getItem(TEAM_KEY))
    } catch {
      // Pick again on each visit.
    }
  }, [])

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const response = await fetch('/api/quiz', { cache: 'no-store' })
        if (!response.ok) throw new Error()
        const json = (await response.json()) as State
        if (!alive) return
        setState(json)
        setFetchedAt(Date.now())
        setOffline(false)
      } catch {
        if (alive) setOffline(true)
      }
    }
    void load()
    const timer = setInterval(load, 1500)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  // New question: clear last answer's message.
  const questionId = state?.question?.id
  useEffect(() => setMessage(''), [questionId])

  function chooseTeam(slug: string | null) {
    setTeam(slug)
    try {
      if (slug) localStorage.setItem(TEAM_KEY, slug)
      else localStorage.removeItem(TEAM_KEY)
    } catch {
      // Not saved; still works for this visit.
    }
  }

  async function answer(choice: number) {
    if (!team || !state?.question || sending) return
    setSending(true)
    setMessage('')
    setPicked({ q: state.question.id, choice })
    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, choice }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) setMessage(data.error ?? 'Answer not sent.')
      setState((s) => (s && response.ok ? { ...s, answeredTeams: [...s.answeredTeams, team] } : s))
    } catch {
      setMessage('No connection. Tap again!')
      setPicked(null)
    } finally {
      setSending(false)
    }
  }

  if (!state) return <p className="text-muted-foreground">{offline ? 'Connecting…' : 'Loading the quiz…'}</p>

  const myTeam = state.teams.find((t) => t.slug === team)
  if (!myTeam) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">One phone per team. Which team is this phone playing for?</p>
        <div className="grid grid-cols-2 gap-3">
          {state.teams.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => chooseTeam(t.slug)}
              className="aspect-[4/3] rounded-2xl border-2 p-4 font-display text-2xl"
              style={{ borderColor: t.color, color: t.color }}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const q = state.question
  const answered = state.answeredTeams.includes(myTeam.slug)
  const remaining = q ? Math.max(0, Math.ceil((q.remainingMs - (now - fetchedAt)) / 1000)) : 0
  const myResult = state.results?.find((r) => r.team === myTeam.slug)
  const ranked = [...state.teams].sort((a, b) => (state.totals[b.slug] ?? 0) - (state.totals[a.slug] ?? 0))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-2xl border-2 p-3" style={{ borderColor: myTeam.color }}>
        <span className="font-display text-xl" style={{ color: myTeam.color }}>{myTeam.name}</span>
        <span className="font-display text-xl tabular-nums">{(state.totals[myTeam.slug] ?? 0).toLocaleString()} pts</span>
      </div>

      {state.status === 'lobby' && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="font-display text-3xl text-primary">You&apos;re in! 🎉</p>
          <p className="mt-2 text-muted-foreground">Waiting for the host to start the quiz. Keep this page open.</p>
        </div>
      )}

      {q && (state.status === 'question' || state.status === 'reveal') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Question {state.number} of {state.total}{q.double && <b className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">2× POINTS</b>}</span>
            {state.status === 'question' && (
              <span className={`font-display text-3xl tabular-nums ${remaining <= 5 ? 'text-red-500' : 'text-secondary'}`}>{remaining}</span>
            )}
          </div>
          <h2 className="rounded-2xl bg-card p-5 text-center text-xl font-semibold leading-snug sm:text-2xl">{q.prompt}</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {q.options.map((option, i) => {
              const isCorrect = q.correct === i
              const mine = (myResult?.choice ?? (picked?.q === q.id ? picked.choice : -1)) === i
              const dim = state.status === 'reveal' && !isCorrect
              return (
                <button
                  key={i}
                  type="button"
                  disabled={state.status !== 'question' || answered || sending || remaining === 0}
                  onClick={() => void answer(i)}
                  className={`flex min-h-20 items-center gap-3 rounded-2xl p-4 text-left text-lg font-semibold text-white transition ${COLORS[i]} ${dim ? 'opacity-30' : ''} ${mine ? 'ring-4 ring-white' : ''} disabled:cursor-default`}
                >
                  <span className="text-2xl">{SHAPES[i]}</span>
                  <span className="flex-1">{option}</span>
                  {state.status === 'reveal' && isCorrect && <span className="text-2xl">✓</span>}
                </button>
              )
            })}
          </div>

          {state.status === 'question' && answered && (
            <p className="rounded-xl bg-muted p-4 text-center font-semibold">Answer locked in! 🔒 Waiting for the reveal…</p>
          )}
          {state.status === 'question' && !answered && remaining === 0 && (
            <p className="rounded-xl bg-muted p-4 text-center font-semibold">Time&apos;s up! ⏰</p>
          )}
          {state.status === 'reveal' && (
            <p className={`rounded-xl p-4 text-center text-xl font-bold text-white ${myResult?.correct ? 'bg-green-600' : 'bg-red-600'}`}>
              {myResult ? (myResult.correct ? `Correct! +${myResult.points} 🎉` : 'Not quite! 😅') : 'No answer this time'}
            </p>
          )}
          {message && <p role="alert" className="text-center text-sm text-amber-500">{message}</p>}
        </div>
      )}

      {(state.status === 'reveal' || state.status === 'finished') && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-display text-lg text-secondary">{state.status === 'finished' ? 'Final quiz scores 🏆' : 'Quiz standings'}</h3>
          <ol className="mt-2 space-y-2">
            {ranked.map((t, i) => (
              <li key={t.slug} className="flex items-center justify-between">
                <span style={{ color: t.color }} className="font-semibold">{i + 1}. {t.name}</span>
                <span className="tabular-nums">{(state.totals[t.slug] ?? 0).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {offline && <p className="text-center text-xs text-amber-500">Reconnecting…</p>}
      <button type="button" onClick={() => chooseTeam(null)} className="text-xs text-muted-foreground underline">Wrong team? Change</button>
    </div>
  )
}
