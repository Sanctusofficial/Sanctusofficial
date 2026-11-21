import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

// POST { email, matric, food, fact } -> { token, code, name }.
// Re-joining on another phone with the same email + matric returns the same player.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await createServiceClient().rpc('bingo_join', {
      p_email: String(body.email ?? ''),
      p_matric: String(body.matric ?? ''),
      p_food: String(body.food ?? ''),
      p_fact: String(body.fact ?? ''),
    })
    if (error) {
      console.error('[bingo] join error:', error.message)
      return NextResponse.json({ error: 'Could not join right now. Try again.' }, { status: 502 })
    }
    if (data?.error === 'need_clues') {
      return NextResponse.json({ error: 'Fill in your two fun clues so people can find you.' }, { status: 400 })
    }
    if (data?.error) {
      return NextResponse.json({ error: "We couldn't find an approved Mixer ticket with that email and matric number." }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
