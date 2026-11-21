import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// POST { name, team } -> { token, id, name, team }. The token stays on the phone.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await createServiceClient().rpc('quiz_join', {
      p_name: String(body.name ?? ''),
      p_team: String(body.team ?? ''),
    })
    if (error) {
      console.error('[quiz] join error:', error.message)
      return NextResponse.json({ error: 'Could not join right now. Try again.' }, { status: 502 })
    }
    if (data?.error === 'need_name') return NextResponse.json({ error: 'Enter your name.' }, { status: 400 })
    if (data?.error) return NextResponse.json({ error: 'Pick your team.' }, { status: 400 })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
