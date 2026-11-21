'use client'

import { useState } from 'react'
import { usePoll } from '@/lib/use-poll'

type Standing = { slug: string; name: string; color: string; total: number; byGame: Record<string, number> }
type Game = { id: string; name: string }

const MEDALS = ['🥇', '🥈', '🥉', '4th']

export function TeamLeaderboard() {
  const [data, setData] = useState<{ standings: Standing[]; games: Game[] } | null>(null)
  const [error, setError] = useState(false)

  usePoll(async () => {
    try {
      const response = await fetch('/api/games', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      setData(await response.json())
      setError(false)
      return true
    } catch {
      setError(true)
      return false
    }
  }, 10000)

  if (!data) return <p className="text-muted-foreground">{error ? 'Leaderboard unavailable. Retrying…' : 'Loading…'}</p>

  const top = Math.max(1, ...data.standings.map((s) => s.total))
  const played = data.games.filter((g) => data.standings.some((s) => s.byGame[g.id]))

  return (
    <div className="space-y-8">
      <ol className="space-y-3">
        {data.standings.map((team, index) => (
          <li key={team.slug} className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-4 p-4">
              <span className="w-10 shrink-0 text-center font-display text-2xl">{MEDALS[index]}</span>
              <span className="h-10 w-2 shrink-0 rounded-full" style={{ background: team.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate font-display text-2xl" style={{ color: team.color }}>{team.name}</span>
              <span className="shrink-0 font-display text-3xl tabular-nums">{team.total.toLocaleString()}</span>
            </div>
            <div className="h-1.5 bg-muted">
              <div className="h-full transition-all duration-700" style={{ width: `${Math.max(0, (team.total / top) * 100)}%`, background: team.color }} />
            </div>
          </li>
        ))}
      </ol>

      <section>
        <h2 className="font-display text-xl text-secondary">Points by game</h2>
        {played.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-muted-foreground">No games played yet. Let the games begin! 🎉</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="p-3 font-normal">Game</th>
                  {data.standings.map((t) => (
                    <th key={t.slug} className="p-3 text-right font-semibold" style={{ color: t.color }}>{t.name.replace('Team ', '')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {played.map((g) => (
                  <tr key={g.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3">{g.name}</td>
                    {data.standings.map((t) => (
                      <td key={t.slug} className="p-3 text-right tabular-nums">{(t.byGame[g.id] ?? 0).toLocaleString()}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">Updates every 10 seconds{error ? ' · reconnecting…' : ''}</p>
    </div>
  )
}
