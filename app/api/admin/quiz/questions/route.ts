import { NextResponse } from 'next/server'

import { isAdmin } from '@/lib/admin-key'
import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const denied = () => NextResponse.json({ error: 'Not allowed' }, { status: 401 })

function clean(body: Record<string, unknown>) {
  const prompt = String(body.prompt ?? '').trim()
  const options = (Array.isArray(body.options) ? body.options : []).map((o) => String(o ?? '').trim()).filter(Boolean)
  const correct = Number(body.correct)
  const seconds = Math.round(Number(body.seconds) || 20)
  if (!prompt || prompt.length > 300) return { error: 'Write a question (up to 300 characters).' }
  if (options.length < 2 || options.length > 4) return { error: 'Give 2 to 4 answer options.' }
  if (options.some((o) => o.length > 80)) return { error: 'Keep each answer under 80 characters.' }
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) return { error: 'Pick which answer is correct.' }
  if (seconds < 5 || seconds > 120) return { error: 'Time limit must be 5–120 seconds.' }
  return { prompt, options, correct, seconds, double_points: Boolean(body.double) }
}

// GET -> all questions in play order.
export async function GET(request: Request) {
  if (!isAdmin(request)) return denied()
  const { data, error } = await createServiceClient()
    .from('quiz_questions')
    .select('id, position, prompt, options, correct, seconds, double_points')
    .order('position')
    .order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ questions: data ?? [] })
}

// POST { prompt, options[], correct, seconds } -> add at the end.
export async function POST(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    const q = clean(await request.json())
    if ('error' in q) return NextResponse.json(q, { status: 400 })
    const db = createServiceClient()
    const { data: last } = await db.from('quiz_questions').select('position').order('position', { ascending: false }).limit(1).maybeSingle()
    const { error } = await db.from('quiz_questions').insert({ ...q, position: (last?.position ?? 0) + 1 })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}

// PUT { id, prompt, options[], correct, seconds } or { id, move: -1 | 1 }
export async function PUT(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    const body = await request.json()
    const db = createServiceClient()
    const id = String(body.id ?? '')
    if (body.move === -1 || body.move === 1) {
      const { data: all } = await db.from('quiz_questions').select('id, position').order('position').order('created_at')
      const list = all ?? []
      const i = list.findIndex((q) => q.id === id)
      const j = i + body.move
      if (i < 0 || j < 0 || j >= list.length) return NextResponse.json({ success: true })
      ;[list[i], list[j]] = [list[j], list[i]]
      await Promise.all(list.map((q, index) => db.from('quiz_questions').update({ position: index + 1 }).eq('id', q.id)))
      return NextResponse.json({ success: true })
    }
    const q = clean(body)
    if ('error' in q) return NextResponse.json(q, { status: 400 })
    const { error } = await db.from('quiz_questions').update(q).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}

// DELETE { id }
export async function DELETE(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    const { id } = await request.json()
    const { error } = await createServiceClient().from('quiz_questions').delete().eq('id', String(id))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
