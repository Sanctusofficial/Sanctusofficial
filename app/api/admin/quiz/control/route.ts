import { NextResponse } from 'next/server'

import { isAdmin } from '@/lib/admin-key'
import { getQuizState } from '@/lib/quiz'
import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const denied = () => NextResponse.json({ error: 'Not allowed' }, { status: 401 })

// GET -> host view of the live quiz (includes correct answer and who answered what).
export async function GET(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    return NextResponse.json(await getQuizState({ host: true }), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 502 })
  }
}

// POST { action: 'next' | 'reveal' | 'finish' | 'reset' }
export async function POST(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    const { action } = await request.json()
    const db = createServiceClient()
    const now = new Date().toISOString()

    if (action === 'next') {
      // Questions are played in position order; "next" after the last one ends the quiz.
      const { data: session } = await db.from('quiz_session').select('question_number').eq('id', 1).single()
      const played = session?.question_number ?? 0
      const { data: list } = await db.from('quiz_questions').select('id').order('position').order('created_at')
      const next = (list ?? [])[played]
      if (!next) {
        await db.from('quiz_session').update({ status: 'finished', updated_at: now }).eq('id', 1)
      } else {
        await db.from('quiz_session').update({
          status: 'question',
          question_id: next.id,
          question_number: played + 1,
          started_at: now,
          updated_at: now,
        }).eq('id', 1)
      }
    } else if (action === 'reveal') {
      await db.from('quiz_session').update({ status: 'reveal', updated_at: now }).eq('id', 1).eq('status', 'question')
    } else if (action === 'finish') {
      await db.from('quiz_session').update({ status: 'finished', updated_at: now }).eq('id', 1)
    } else if (action === 'reset') {
      // Wipes quiz answers (and therefore quiz points) so the quiz can be played from the start.
      await db.from('quiz_answers').delete().not('team_slug', 'is', null)
      await db.from('quiz_session').update({
        status: 'lobby', question_id: null, question_number: 0, started_at: null, updated_at: now,
      }).eq('id', 1)
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
    return NextResponse.json(await getQuizState({ host: true }))
  } catch (error) {
    console.error('[quiz] control error:', error)
    return NextResponse.json({ error: 'Could not update the quiz.' }, { status: 502 })
  }
}
