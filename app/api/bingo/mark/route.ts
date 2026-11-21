import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const MESSAGES: Record<string, string> = {
  not_joined: 'Join the game first.',
  bad_square: 'That square can’t be marked.',
  you_not_checked_in: 'You need to be checked in at the door before you can play.',
  bad_code: 'That code doesn’t belong to any player. Ask them to open their bingo page and show their code.',
  self: 'Nice try. You can’t use your own code!',
  them_not_checked_in: 'They haven’t been checked in at the door yet.',
  square_taken: 'You already filled that square.',
  already_used: 'You already used this person on another square. Find someone new!',
}

// POST { token, square, code } -> fill a square with the scanned/typed code of the person you met.
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const raw = String(body.code ?? '')
    // QR codes carry "SEES30BINGO:<code>"; typed codes are just the 6 characters.
    const code = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw
    const { data, error } = await createServiceClient().rpc('bingo_mark', {
      p_token: String(body.token ?? ''),
      p_square: Number(body.square),
      p_code: code,
    })
    if (error) {
      console.error('[bingo] mark error:', error.message)
      return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 502 })
    }
    if (data?.error) {
      const message = MESSAGES[data.error] ?? 'Could not mark that square.'
      return NextResponse.json({ error: data.name ? `${message} (${data.name})` : message, reason: data.error }, { status: 409 })
    }
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
