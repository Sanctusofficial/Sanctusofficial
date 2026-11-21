// A team's quiz score = average points of its players who answered at least once.
// Averaging means a team can't win just by having more phones playing.
export function quizTeamScores(answers: { player_id: string; team_slug: string; points: number }[]) {
  const sum: Record<string, number> = {}
  const players: Record<string, Set<string>> = {}
  for (const a of answers) {
    sum[a.team_slug] = (sum[a.team_slug] ?? 0) + a.points
    ;(players[a.team_slug] ??= new Set()).add(a.player_id)
  }
  const totals: Record<string, number> = {}
  for (const team of Object.keys(sum)) totals[team] = Math.round(sum[team] / Math.max(1, players[team].size))
  return totals
}
