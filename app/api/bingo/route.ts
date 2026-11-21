import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// GET /api/bingo -> public leaderboard (top 50). Scores are computed in the
// database from verified connections (see bingo_mark), never sent by phones.
export async function GET() {
  const { data, error } = await createServiceClient()
    .from('bingo_players')
    .select('display_name, squares, lines, first_bingo_at, blackout_at, updated_at')
    .eq('event_slug', 'mixer')
    .not('player_token', 'is', null)
    .order('lines', { ascending: false })
    .order('squares', { ascending: false })
    .order('first_bingo_at', { ascending: true, nullsFirst: false })
    .order('updated_at', { ascending: true })
    .limit(50)
  if (error) {
    console.error('[bingo] leaderboard error:', error.message)
    return NextResponse.json({ error: 'Leaderboard unavailable' }, { status: 502 })
  }
  return NextResponse.json({ players: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}
