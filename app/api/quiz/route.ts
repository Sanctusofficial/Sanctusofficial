import { NextResponse } from 'next/server'

import { getQuizState } from '@/lib/quiz'
import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const MESSAGES: Record<string, string> = {
  bad_team: 'Pick your team first.',
  not_open: 'This question is closed.',
  bad_choice: 'That answer isn’t an option.',
  too_late: 'Time’s up!',
  already_answered: 'Your team already answered this one.',
}

// GET -> live quiz state for team phones (polled every second or so).
export async function GET() {
  try {
    return NextResponse.json(await getQuizState(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('[quiz] state error:', error)
    return NextResponse.json({ error: 'Quiz unavailable' }, { status: 502 })
  }
}

// POST { team, choice } -> lock in the team's answer for the live question.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data, error } = await createServiceClient().rpc('quiz_submit', {
      p_team: String(body.team ?? ''),
      p_choice: Number(body.choice),
    })
    if (error) {
      console.error('[quiz] submit error:', error.message)
      return NextResponse.json({ error: 'Could not send your answer. Tap again.' }, { status: 502 })
    }
    if (data?.error) return NextResponse.json({ error: MESSAGES[data.error] ?? 'Answer not accepted.', reason: data.error }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
