import { NextResponse } from 'next/server'

import { isAdmin } from '@/lib/admin-key'
import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const denied = () => NextResponse.json({ error: 'Not allowed' }, { status: 401 })

// GET -> recent awards (newest first), for the admin log.
export async function GET(request: Request) {
  if (!isAdmin(request)) return denied()
  const { data, error } = await createServiceClient()
    .from('game_scores')
    .select('id, game_id, team_slug, points, note, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ log: data ?? [] })
}

// POST { game, team, points, note? } -> award (or deduct) points.
export async function POST(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    const body = await request.json()
    const points = Math.trunc(Number(body.points))
    if (!Number.isFinite(points) || points === 0 || points < -1000 || points > 100000) {
      return NextResponse.json({ error: 'Points must be a whole number between -1000 and 100000.' }, { status: 400 })
    }
    const { error } = await createServiceClient().from('game_scores').insert({
      game_id: String(body.game ?? ''),
      team_slug: String(body.team ?? ''),
      points,
      note: body.note ? String(body.note).slice(0, 120) : null,
    })
    if (error) return NextResponse.json({ error: 'Unknown game or team.' }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}

// DELETE { id } -> undo an award.
export async function DELETE(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    const { id } = await request.json()
    const { error } = await createServiceClient().from('game_scores').delete().eq('id', String(id))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
