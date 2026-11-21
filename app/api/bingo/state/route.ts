import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// POST { token } -> the player's card, verified marks and check-in status.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await createServiceClient().rpc('bingo_state', { p_token: String(body.token ?? '') })
    if (error) {
      console.error('[bingo] state error:', error.message)
      return NextResponse.json({ error: 'Could not load your card.' }, { status: 502 })
    }
    if (data?.error) return NextResponse.json({ error: 'not_joined' }, { status: 401 })
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
