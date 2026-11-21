import 'server-only'

import { createServiceClient } from '@/lib/supabase-server'

export type QuizStatus = 'lobby' | 'question' | 'reveal' | 'finished'

// Everything a quiz screen needs. The correct answer is only included once the
// host reveals it (or for the host view), so phones can't peek.
export async function getQuizState({ host = false } = {}) {
  const db = createServiceClient()
  const [session, teams, questions] = await Promise.all([
    db.from('quiz_session').select('status, question_id, question_number, started_at').eq('id', 1).single(),
    db.from('game_teams').select('slug, name, color').order('sort'),
    db.from('quiz_questions').select('id', { count: 'exact', head: true }),
  ])
  if (session.error) throw new Error(session.error.message)
  const s = session.data
  const status = s.status as QuizStatus

  const { data: allAnswers } = await db.from('quiz_answers').select('question_id, team_slug, choice, correct, points')
  const totals: Record<string, number> = {}
  for (const a of allAnswers ?? []) totals[a.team_slug] = (totals[a.team_slug] ?? 0) + a.points

  let question = null
  let answers: { team: string; choice: number; correct: boolean; points: number }[] = []
  if (s.question_id && status !== 'lobby') {
    const { data: q } = await db.from('quiz_questions').select('id, prompt, options, correct, seconds, double_points').eq('id', s.question_id).maybeSingle()
    if (q) {
      const elapsed = s.started_at ? Date.now() - Date.parse(s.started_at) : 0
      const showCorrect = host || status === 'reveal' || status === 'finished'
      question = {
        id: q.id,
        prompt: q.prompt,
        options: q.options as string[],
        seconds: q.seconds,
        double: q.double_points as boolean,
        remainingMs: status === 'question' ? Math.max(0, q.seconds * 1000 - elapsed) : 0,
        correct: showCorrect ? q.correct : null,
      }
      answers = (allAnswers ?? [])
        .filter((a) => a.question_id === q.id)
        .map((a) => ({ team: a.team_slug, choice: a.choice, correct: a.correct, points: a.points }))
    }
  }

  const reveal = status === 'reveal' || status === 'finished' || host
  return {
    status,
    number: s.question_number,
    total: questions.count ?? 0,
    teams: teams.data ?? [],
    question,
    answeredTeams: answers.map((a) => a.team),
    // Per-team results for this question: hidden from phones until the reveal.
    results: reveal ? answers : null,
    totals,
  }
}
