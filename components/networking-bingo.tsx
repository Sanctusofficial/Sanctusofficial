'use client'

import { useEffect, useMemo, useState } from 'react'

const PROMPTS = [
  'Is in a different department from you',
  'Is in their final year',
  'Is a fresher at their first SEES event',
  'Has built a project with an Arduino or Raspberry Pi',
  'Has done an internship (SIWES counts)',
  'Can name 3 logic gates in 5 seconds',
  'Has pulled an all-nighter before an exam this semester',
  'Codes in a language other than Python',
  'Has a side hustle',
  'Plays a musical instrument',
  'Was born outside Lagos',
  'Speaks 3 or more languages',
  'Wants to start their own company',
  'Has a GitHub account with a project on it',
  'Has repaired a phone or laptop themselves',
  'Supports the same football club as you',
  'Has the same birth month as you',
  'Has never missed an 8am lecture (they claim)',
  'Wants to work abroad after school',
  'Has used ChatGPT or Claude for an assignment (they admit it)',
  'Has been to a hackathon',
  'Can solve a Rubik’s cube',
  'Has the same favourite Nollywood movie as you',
  'Is wearing something with the SEES colours',
  'Has a hobby you have never tried',
  'Knows what Ohm’s law is without googling',
  'Has designed a PCB or circuit diagram',
  'Is part of a club or society besides SEES',
  'Wants to go into renewable energy',
  'Can recommend a good place to eat near campus',
  'Has taken a photo with you tonight',
  'Has a LinkedIn profile you connected to today',
]

const SIZE = 5
const CENTER = 12
const STORE_KEY = 'sees30-bingo-v1'

type Square = { prompt: string; who: string }
type Card = { squares: Square[] }

const LINES: number[][] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c)),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => r * SIZE + c)),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + i),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)),
]

function newCard(): Card {
  const pool = [...PROMPTS]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  const picks = pool.slice(0, SIZE * SIZE - 1)
  const squares = picks.map((prompt) => ({ prompt, who: '' }))
  squares.splice(CENTER, 0, { prompt: 'Made it to the SEES ’30 Mixer', who: 'You' })
  return { squares }
}

function load(): Card | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    const card = raw ? (JSON.parse(raw) as Card) : null
    return card?.squares?.length === SIZE * SIZE ? card : null
  } catch {
    return null
  }
}

function save(card: Card) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(card))
  } catch {
    // The card still works for this visit without storage.
  }
}

export function NetworkingBingo() {
  const [card, setCard] = useState<Card | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [warning, setWarning] = useState('')

  useEffect(() => {
    const existing = load()
    const next = existing ?? newCard()
    if (!existing) save(next)
    setCard(next)
  }, [])

  const done = useMemo(() => new Set(card?.squares.flatMap((s, i) => (s.who ? [i] : [])) ?? []), [card])
  const lines = useMemo(() => LINES.filter((line) => line.every((i) => done.has(i))), [done])
  const inLine = useMemo(() => new Set(lines.flat()), [lines])
  const blackout = done.size === SIZE * SIZE

  if (!card) return <div className="aspect-square w-full animate-pulse rounded-2xl bg-card" />

  function update(next: Card) {
    setCard(next)
    save(next)
  }

  function openSquare(index: number) {
    if (index === CENTER || !card) return
    setOpen(index)
    setName(card.squares[index].who)
    setWarning('')
  }

  function mark(event: React.FormEvent) {
    event.preventDefault()
    if (open === null || !card) return
    const who = name.trim()
    if (!who) return setWarning('Type the name of the person you met.')
    const reused = card.squares.findIndex((s, i) => i !== open && i !== CENTER && s.who.toLowerCase() === who.toLowerCase())
    if (reused !== -1) return setWarning(`You already used ${who} for another square. Find someone new!`)
    update({ squares: card.squares.map((s, i) => (i === open ? { ...s, who } : s)) })
    setOpen(null)
  }

  function clearSquare() {
    if (open === null || !card) return
    update({ squares: card.squares.map((s, i) => (i === open ? { ...s, who: '' } : s)) })
    setOpen(null)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Find someone who matches a square, ask their name, and tap the square to add it. One person per square.
        </p>
        <p className="shrink-0 text-right">
          <span className="block font-display text-3xl text-secondary">{done.size - 1}<span className="text-lg text-muted-foreground">/24</span></span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">people met</span>
        </p>
      </div>

      {lines.length > 0 && (
        <div role="status" className="rounded-2xl border-2 border-secondary bg-secondary/15 p-4 text-center">
          <p className="font-display text-3xl text-secondary">{blackout ? 'BLACKOUT!' : lines.length === 1 ? 'BINGO!' : `${lines.length}× BINGO!`}</p>
          <p className="mt-1 text-sm">Show this screen to an organizer to claim your prize. Keep going for more lines!</p>
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="grid" aria-label="Networking bingo card">
        {card.squares.map((square, index) => {
          const filled = Boolean(square.who)
          const free = index === CENTER
          return (
            <button
              key={index}
              type="button"
              onClick={() => openSquare(index)}
              aria-pressed={filled}
              aria-label={`${square.prompt}${filled ? `: ${square.who}` : ''}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg border p-1 text-center text-[9px] leading-tight transition sm:rounded-xl sm:p-2 sm:text-xs ${
                free
                  ? 'border-primary bg-primary text-primary-foreground'
                  : inLine.has(index)
                    ? 'border-secondary bg-secondary text-secondary-foreground'
                    : filled
                      ? 'border-secondary/70 bg-secondary/25'
                      : 'border-border bg-card hover:border-secondary'
              }`}
            >
              <span className={filled ? 'line-clamp-2 opacity-80' : 'line-clamp-5'}>{square.prompt}</span>
              {filled && <span className="mt-0.5 line-clamp-1 font-bold sm:mt-1 sm:text-sm">{square.who}</span>}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          if (window.confirm('Start a new card? Your current card will be cleared.')) update(newCard())
        }}
        className="text-sm text-muted-foreground underline"
      >
        New card
      </button>

      {open !== null && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setOpen(null)}>
          <form onSubmit={mark} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-secondary/40 bg-card p-5">
            <p className="text-xs uppercase tracking-[0.25em] text-secondary">Find someone who…</p>
            <h2 className="mt-2 font-display text-2xl text-primary">{card.squares[open].prompt}</h2>
            <label htmlFor="bingo-name" className="mt-5 block text-sm">Their name</label>
            <input
              id="bingo-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tolu"
              className="mt-1 w-full rounded-lg border bg-background p-3"
            />
            {warning && <p role="alert" className="mt-2 text-sm text-amber-500">{warning}</p>}
            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-lg bg-secondary p-3 font-semibold text-secondary-foreground">Mark it</button>
              {card.squares[open].who && (
                <button type="button" onClick={clearSquare} className="rounded-lg border px-4">Clear</button>
              )}
              <button type="button" onClick={() => setOpen(null)} className="rounded-lg border px-4">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
