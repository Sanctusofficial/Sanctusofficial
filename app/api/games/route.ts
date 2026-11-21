import { NextResponse } from 'next/server'

import { getStandings } from '@/lib/team-games'

export const dynamic = 'force-dynamic'

// GET /api/games -> public team leaderboard.
export async function GET() {
  try {
    return NextResponse.json(await getStandings(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[games] standings error:', error)
    return NextResponse.json({ error: 'Leaderboard unavailable' }, { status: 502 })
  }
}
