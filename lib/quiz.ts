import 'server-only'

import { quizTeamScores } from '@/lib/quiz-score'
import { createServiceClient } from '@/lib/supabase-server'

export type QuizStatus = 'lobby' | 'question' | 'reveal' | 'finished'

// Everything a quiz screen needs. The correct answer and how people answered
// are only included once the host reveals (or for the host view).
// `me` is a player id: adds that player's own score and answer.
export async function getQuizState({ host = false, me = '' }: { host?: boolean; me?: string } = {}) {
  const db = createServiceClient()
  const [session, teams, questions, playersRes, answersRes] = await Promise.all([
    db.from('quiz_session').select('status, question_id, question_number, started_at').eq('id', 1).single(),
    db.from('game_teams').select('slug, name, color').order('sort'),
    db.from('quiz_questions').select('id', { count: 'exact', head: true }),
    db.from('quiz_players').select('id, name, team_slug'),
    db.from('quiz_answers').select('question_id, player_id, team_slug, choice, correct, points'),
  ])
  if (session.error) throw new Error(session.error.message)
  const s = session.data
  const status = s.status as QuizStatus
  const players = playersRes.data ?? []
  const answers = answersRes.data ?? []
  const revealed = host || status === 'reveal' || status === 'finished'

  // Individual totals and ranking.
  const playerPoints = new Map<string, number>()
  for (const a of answers) playerPoints.set(a.player_id, (playerPoints.get(a.player_id) ?? 0) + a.points)
  const ranked = players
    .map((p) => ({ id: p.id, name: p.name, team: p.team_slug, points: playerPoints.get(p.id) ?? 0 }))
    .sort((a, b) => b.points - a.points)

  let question = null
  const teamProgress: Record<string, { players: number; answered: number; correct: number }> = {}
  for (const t of teams.data ?? []) {
    teamProgress[t.slug] = { players: players.filter((p) => p.team_slug === t.slug).length, answered: 0, correct: 0 }
  }
  let myAnswer: { choice: number; correct: boolean | null; points: number | null } | null = null

  if (s.question_id && status !== 'lobby') {
    const { data: q } = await db
      .from('quiz_questions')
      .select('id, prompt, options, correct, seconds, double_points')
      .eq('id', s.question_id)
      .maybeSingle()
    if (q) {
      const elapsed = s.started_at ? Date.now() - Date.parse(s.started_at) : 0
      question = {
        id: q.id,
        prompt: q.prompt,
        options: q.options as string[],
        seconds: q.seconds,
        double: q.double_points as boolean,
        remainingMs: status === 'question' ? Math.max(0, q.seconds * 1000 - elapsed) : 0,
        correct: revealed ? q.correct : null,
      }
      for (const a of answers.filter((x) => x.question_id === q.id)) {
        const t = teamProgress[a.team_slug]
        if (t) {
          t.answered += 1
          if (revealed && a.correct) t.correct += 1
        }
        if (a.player_id === me) {
          myAnswer = { choice: a.choice, correct: revealed ? a.correct : null, points: revealed ? a.points : null }
        }
      }
    }
  }

  const mine = me ? ranked.findIndex((p) => p.id === me) : -1
  return {
    status,
    number: s.question_number,
    total: questions.count ?? 0,
    teams: teams.data ?? [],
    question,
    teamProgress,
    totals: quizTeamScores(answers),
    playerCount: players.length,
    // Individual standings are shown between questions, not while one is live.
    topPlayers: revealed || status === 'lobby' ? ranked.slice(0, 10).map(({ name, team, points }) => ({ name, team, points })) : [],
    me:
      mine >= 0
        ? {
            name: ranked[mine].name,
            team: ranked[mine].team,
            points: revealed || status === 'lobby' ? ranked[mine].points : null,
            rank: revealed ? mine + 1 : null,
            answer: myAnswer,
          }
        : null,
  }
}
