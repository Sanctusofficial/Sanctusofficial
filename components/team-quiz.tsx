'use client'

import { useEffect, useState } from 'react'

type Team = { slug: string; name: string; color: string }
type State = {
  status: 'lobby' | 'question' | 'reveal' | 'finished'
  number: number
  total: number
  teams: Team[]
  question: { id: string; prompt: string; options: string[]; seconds: number; remainingMs: number; correct: number | null; double?: boolean } | null
  teamProgress: Record<string, { players: number; answered: number; correct: number }>
  totals: Record<string, number>
  playerCount: number
  topPlayers: { name: string; team: string; points: number }[]
  me: {
    name: string
    team: string
    points: number | null
    rank: number | null
    answer: { choice: number; correct: boolean | null; points: number | null } | null
  } | null
}
type Player = { token: string; id: string; name: string; team: string }

const PLAYER_KEY = 'sees30-quiz-player-v2'
const SHAPES = ['▲', '◆', '●', '■']
const COLORS = ['bg-red-600', 'bg-blue-600', 'bg-amber-500', 'bg-green-600']

export function TeamQuiz() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<State | null>(null)
  const [offline, setOffline] = useState(false)
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [picked, setPicked] = useState<{ q: string; choice: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [fetchedAt, setFetchedAt] = useState(Date.now())

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PLAYER_KEY)
      if (raw) setPlayer(JSON.parse(raw) as Player)
    } catch {
      // Join again on this visit.
    }
    setReady(true)
  }, [])

  const playerId = player?.id ?? ''
  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const response = await fetch(`/api/quiz${playerId ? `?me=${playerId}` : ''}`, { cache: 'no-store' })
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
  }, [playerId])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [])

  const questionId = state?.question?.id
  useEffect(() => setMessage(''), [questionId])

  function savePlayer(next: Player | null) {
    setPlayer(next)
    try {
      if (next) localStorage.setItem(PLAYER_KEY, JSON.stringify(next))
      else localStorage.removeItem(PLAYER_KEY)
    } catch {
      // Not saved; still works for this visit.
    }
  }

  async function join(event: React.FormEvent) {
    event.preventDefault()
    if (!team) return setJoinError('Pick your team.')
    setJoining(true)
    setJoinError('')
    try {
      const response = await fetch('/api/quiz/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, team }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'Could not join.')
      savePlayer(data as Player)
    } catch (e) {
      setJoinError((e as Error).message)
    } finally {
      setJoining(false)
    }
  }

  async function answer(choice: number) {
    if (!player || !state?.question || sending) return
    setSending(true)
    setMessage('')
    setPicked({ q: state.question.id, choice })
    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: player.token, choice }),
      })
      const data = await response.json().catch(() => ({}))
      if (response.status === 401) {
        savePlayer(null)
        return
      }
      if (!response.ok) {
        setMessage(data.error ?? 'Answer not sent.')
        if (data.reason !== 'already_answered') setPicked(null)
      }
    } catch {
      setMessage('No connection. Tap again!')
      setPicked(null)
    } finally {
      setSending(false)
    }
  }

  if (!ready || !state) return <p className="text-muted-foreground">{offline ? 'Connecting…' : 'Loading the quiz…'}</p>

  const myTeam = state.teams.find((t) => t.slug === player?.team)
  if (!player || !myTeam) {
    return (
      <form onSubmit={join} className="space-y-4">
        <p className="text-muted-foreground">Play on your own phone. Your points help your team!</p>
        <input
          required
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="w-full rounded-xl border bg-background p-4 text-lg"
        />
        <p className="text-sm font-semibold">Your team</p>
        <div className="grid grid-cols-2 gap-3">
          {state.teams.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => setTeam(t.slug)}
              aria-pressed={team === t.slug}
              className="rounded-2xl border-2 p-4 font-display text-xl"
              style={{ borderColor: t.color, color: team === t.slug ? '#000' : t.color, background: team === t.slug ? t.color : 'transparent' }}
            >
              {t.name}
            </button>
          ))}
        </div>
        {joinError && <p role="alert" className="text-sm text-amber-500">{joinError}</p>}
        <button disabled={joining} className="w-full rounded-xl bg-primary p-4 text-lg font-semibold text-primary-foreground disabled:opacity-60">
          {joining ? 'Joining…' : 'Join the quiz'}
        </button>
      </form>
    )
  }

  const q = state.question
  const answeredChoice = state.me?.answer?.choice ?? (picked && q && picked.q === q.id ? picked.choice : null)
  const answered = answeredChoice !== null
  const remaining = q ? Math.max(0, Math.ceil((q.remainingMs - (now - fetchedAt)) / 1000)) : 0
  const myResult = state.me?.answer
  const rankedTeams = [...state.teams].sort((a, b) => (state.totals[b.slug] ?? 0) - (state.totals[a.slug] ?? 0))
  const teamColor = (slug: string) => state.teams.find((t) => t.slug === slug)?.color

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-2xl border-2 p-3" style={{ borderColor: myTeam.color }}>
        <span className="min-w-0 truncate">
          <b>{player.name}</b> · <span style={{ color: myTeam.color }}>{myTeam.name}</span>
        </span>
        {state.me?.points != null && <span className="shrink-0 font-display text-xl tabular-nums">{state.me.points.toLocaleString()} pts</span>}
      </div>

      {state.status === 'lobby' && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="font-display text-3xl text-primary">You&apos;re in! 🎉</p>
          <p className="mt-2 text-muted-foreground">Waiting for the host to start. Keep this page open.</p>
          <p className="mt-4 text-sm">{state.playerCount} {state.playerCount === 1 ? 'player has' : 'players have'} joined</p>
        </div>
      )}

      {q && (state.status === 'question' || state.status === 'reveal') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Question {state.number} of {state.total}
              {q.double && <b className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">2× POINTS</b>}
            </span>
            {state.status === 'question' && (
              <span className={`font-display text-3xl tabular-nums ${remaining <= 3 ? 'text-red-500' : 'text-secondary'}`}>{remaining}</span>
            )}
          </div>
          <h2 className="rounded-2xl bg-card p-5 text-center text-xl font-semibold leading-snug sm:text-2xl">{q.prompt}</h2>

          <div className="grid grid-cols-2 gap-3">
            {q.options.map((option, i) => {
              const isCorrect = q.correct === i
              const mine = answeredChoice === i
              const dim = (state.status === 'reveal' && !isCorrect) || (state.status === 'question' && answered && !mine)
              return (
                <button
                  key={i}
                  type="button"
                  disabled={state.status !== 'question' || answered || sending || remaining === 0}
                  onClick={() => void answer(i)}
                  className={`flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl p-3 text-left text-base font-semibold text-white transition ${COLORS[i]} ${dim ? 'opacity-30' : ''} ${mine ? 'ring-4 ring-white' : ''} disabled:cursor-default`}
                >
                  <span className="text-xl">{SHAPES[i]}{state.status === 'reveal' && isCorrect ? ' ✓' : ''}</span>
                  <span>{option}</span>
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
              {state.me?.rank ? <span className="mt-1 block text-sm font-normal">You&apos;re #{state.me.rank} of {state.playerCount}</span> : null}
            </p>
          )}
          {message && <p role="alert" className="text-center text-sm text-amber-500">{message}</p>}
        </div>
      )}

      {(state.status === 'reveal' || state.status === 'finished') && (
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-display text-lg text-secondary">{state.status === 'finished' ? 'Final team scores 🏆' : 'Team standings'}</h3>
            <p className="text-xs text-muted-foreground">Average points per player</p>
            <ol className="mt-2 space-y-2">
              {rankedTeams.map((t, i) => (
                <li key={t.slug} className="flex items-center justify-between">
                  <span style={{ color: t.color }} className="font-semibold">{i + 1}. {t.name}</span>
                  <span className="tabular-nums">{(state.totals[t.slug] ?? 0).toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-2xl border border-border bg-card p-4">
            <h3 className="font-display text-lg text-secondary">Top players</h3>
            <ol className="mt-2 space-y-1 text-sm">
              {state.topPlayers.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate"><span style={{ color: teamColor(p.team) }}>●</span> {i + 1}. {p.name}</span>
                  <span className="tabular-nums">{p.points.toLocaleString()}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      {offline && <p className="text-center text-xs text-amber-500">Reconnecting…</p>}
      {state.status === 'lobby' && (
        <button type="button" onClick={() => savePlayer(null)} className="text-xs text-muted-foreground underline">Wrong name or team? Change</button>
      )}
    </div>
  )
}
