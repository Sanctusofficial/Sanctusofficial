'use client'

import { useEffect, useState } from 'react'

type Row = {
  display_name: string
  squares: number
  lines: number
  first_bingo_at: string | null
  blackout_at: string | null
}

const lagosTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) : ''

const MEDALS = ['🥇', '🥈', '🥉']

export function BingoLeaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState(false)
  const [updated, setUpdated] = useState<Date | null>(null)

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const response = await fetch('/api/bingo', { cache: 'no-store' })
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!alive) return
        setRows(data.players ?? [])
        setError(false)
        setUpdated(new Date())
      } catch {
        if (alive) setError(true)
      }
    }
    void load()
    const timer = setInterval(load, 5000)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [])

  const firstBingo = rows
    ?.filter((r) => r.first_bingo_at)
    .sort((a, b) => Date.parse(a.first_bingo_at!) - Date.parse(b.first_bingo_at!))[0]
  const firstBlackout = rows
    ?.filter((r) => r.blackout_at)
    .sort((a, b) => Date.parse(a.blackout_at!) - Date.parse(b.blackout_at!))[0]

  return (
    <div className="space-y-6">
      {(firstBingo || firstBlackout) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {firstBingo && (
            <div className="rounded-2xl border-2 border-secondary bg-secondary/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-secondary">First BINGO</p>
              <p className="mt-1 font-display text-2xl">{firstBingo.display_name}</p>
              <p className="text-sm text-muted-foreground">at {lagosTime(firstBingo.first_bingo_at)}</p>
            </div>
          )}
          {firstBlackout && (
            <div className="rounded-2xl border-2 border-primary bg-primary/10 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-primary">First BLACKOUT</p>
              <p className="mt-1 font-display text-2xl">{firstBlackout.display_name}</p>
              <p className="text-sm text-muted-foreground">at {lagosTime(firstBlackout.blackout_at)}</p>
            </div>
          )}
        </div>
      )}

      {rows === null ? (
        <p className="text-muted-foreground">{error ? 'Leaderboard unavailable. Retrying…' : 'Loading…'}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
          No players yet. Open <b>/play</b>, join the leaderboard and start meeting people!
        </p>
      ) : (
        <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {rows.map((row, index) => (
            <li key={`${row.display_name}-${index}`} className={`flex items-center gap-4 px-4 py-3 ${index < 3 ? 'text-lg' : ''}`}>
              <span className="w-8 shrink-0 text-center font-display text-xl text-muted-foreground">{MEDALS[index] ?? index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {row.display_name}
                {row.blackout_at ? <span className="ml-2 text-xs font-bold text-primary">BLACKOUT</span> : null}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-secondary">{row.lines} {row.lines === 1 ? 'line' : 'lines'}</span>
                <span className="text-xs text-muted-foreground">{row.squares}/8 found</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="text-xs text-muted-foreground">
        Guests are assigned at random and every square is verified by scanning that person&apos;s code.
        Ranked by completed lines, then people met, then who got BINGO first. Updates every 5 seconds
        {updated ? ` · last ${updated.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos' })}` : ''}
        {error && rows ? ' · reconnecting…' : ''}
      </p>
    </div>
  )
}
