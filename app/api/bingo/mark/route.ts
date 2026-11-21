import { NextResponse } from 'next/server'

import { BINGO_ICEBREAKERS } from '@/lib/bingo-prompts'
import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const MESSAGES: Record<string, string> = {
  not_joined: 'Join the game first.',
  bad_square: 'That square can’t be used.',
  you_not_checked_in: 'Get your ticket scanned at the door first.',
  no_one_available: 'Nobody new is available yet. More guests are arriving, so try again in a minute!',
  square_taken: 'That square already has a guest.',
  already_met: 'You already found this person. 🎉',
  no_skips: 'You’ve used all your skips. Go find them!',
  self: 'That’s your own code! Scan your mystery guest’s QR.',
  wrong_person: 'That’s not your mystery guest for this square. Keep looking for',
}

// POST { token, slot, action: 'draw' | 'skip' | 'scan', code? }
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const supabase = createServiceClient()
    const token = String(body.token ?? '')
    const slot = Number(body.slot)
    const action = String(body.action ?? 'scan')

    const { data, error } =
      action === 'draw'
        ? await supabase.rpc('bingo_draw', { p_token: token, p_slot: slot, p_icebreakers: BINGO_ICEBREAKERS.length })
        : action === 'skip'
          ? await supabase.rpc('bingo_skip', { p_token: token, p_slot: slot, p_icebreakers: BINGO_ICEBREAKERS.length })
          : await supabase.rpc('bingo_mark', { p_token: token, p_slot: slot, p_code: String(body.code ?? '') })

    if (error) {
      console.error('[bingo] mark error:', error.message)
      return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 502 })
    }
    if (data?.error) {
      const base = MESSAGES[data.error] ?? 'Something went wrong.'
      const message = data.error === 'wrong_person' ? `${base} ${data.name}.` : base
      return NextResponse.json({ error: message, reason: data.error }, { status: 409 })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
