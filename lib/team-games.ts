import 'server-only'

import { quizTeamScores } from '@/lib/quiz-score'
import { createServiceClient } from '@/lib/supabase-server'

export type Team = { slug: string; name: string; color: string }
export type Game = { id: string; name: string }
export type Standing = Team & { total: number; byGame: Record<string, number> }

// Team totals = points awarded by organizers + the team's average quiz score.
export async function getStandings() {
  const db = createServiceClient()
  const [teams, games, scores, answers] = await Promise.all([
    db.from('game_teams').select('slug, name, color').order('sort'),
    db.from('games').select('id, name').order('sort'),
    db.from('game_scores').select('game_id, team_slug, points'),
    db.from('quiz_answers').select('player_id, team_slug, points'),
  ])
  const error = teams.error ?? games.error ?? scores.error ?? answers.error
  if (error) throw new Error(error.message)

  const standings: Standing[] = (teams.data ?? []).map((t) => ({ ...t, total: 0, byGame: {} }))
  const bySlug = new Map(standings.map((s) => [s.slug, s]))
  const add = (team: string, game: string, points: number) => {
    const s = bySlug.get(team)
    if (!s) return
    s.byGame[game] = (s.byGame[game] ?? 0) + points
    s.total += points
  }
  for (const row of scores.data ?? []) add(row.team_slug, row.game_id, row.points)
  // Quiz: each team gets the average score of its players.
  for (const [team, points] of Object.entries(quizTeamScores(answers.data ?? []))) add(team, 'quiz', points)

  standings.sort((a, b) => b.total - a.total)
  return { standings, games: (games.data ?? []) as Game[] }
}
