import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const EVENT = 'mixer'

// "Abdulhameed Umar Opeyemi" -> "Abdulhameed U." (enough to find them, not a full name on a big screen)
function publicName(full: string | null) {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Guest'
  const first = parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase()
  return parts[1] ? `${first} ${parts[1][0].toUpperCase()}.` : first
}

// GET /api/bingo -> public leaderboard (top 50).
export async function GET() {
  const { data, error } = await createServiceClient()
    .from('bingo_players')
    .select('display_name, squares, lines, first_bingo_at, blackout_at, updated_at')
    .eq('event_slug', EVENT)
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

// POST { email, matric, squares, lines } -> join / update your score.
// Email + matric must match an approved Mixer registration (same check as /status).
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body.email ?? '').trim().toLowerCase()
    const matric = String(body.matric ?? '').replace(/\s+/g, '').toUpperCase()
    const squares = Math.max(0, Math.min(24, Math.floor(Number(body.squares) || 0)))
    const lines = Math.max(0, Math.min(12, Math.floor(Number(body.lines) || 0)))
    if (!email || !matric) {
      return NextResponse.json({ error: 'Enter the email and matric number you registered with.' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: rows } = await supabase
      .from('registrations')
      .select('id, name, email, status')
      .eq('event_slug', EVENT)
      .eq('matric_number', matric)
    const reg = (rows ?? []).find((r) => (r.email ?? '').toLowerCase() === email && r.status === 'approved')
    if (!reg) {
      return NextResponse.json({ error: "We couldn't find an approved Mixer ticket with those details." }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('bingo_players')
      .select('first_bingo_at, blackout_at')
      .eq('registration_id', reg.id)
      .maybeSingle()

    const now = new Date().toISOString()
    const { error } = await supabase.from('bingo_players').upsert({
      registration_id: reg.id,
      event_slug: EVENT,
      display_name: publicName(reg.name),
      squares,
      lines,
      // First-achievement times never move once set, so clearing a square can't steal an earlier spot.
      first_bingo_at: existing?.first_bingo_at ?? (lines > 0 ? now : null),
      blackout_at: existing?.blackout_at ?? (squares >= 24 ? now : null),
      updated_at: now,
    })
    if (error) {
      console.error('[bingo] upsert error:', error.message)
      return NextResponse.json({ error: 'Could not save your score. Try again.' }, { status: 502 })
    }
    return NextResponse.json({ success: true, name: publicName(reg.name) })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
