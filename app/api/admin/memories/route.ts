import { NextResponse } from 'next/server'

import { isAdmin } from '@/lib/admin-key'
import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const denied = () => NextResponse.json({ error: 'Not allowed' }, { status: 401 })

// GET -> newest photos first (published and hidden), for moderation.
export async function GET(request: Request) {
  if (!isAdmin(request)) return denied()
  const { data, error } = await createServiceClient()
    .from('event_memories')
    .select('id, image_path, caption, published, uploader_name, created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 502 })
  return NextResponse.json({ photos: data ?? [] })
}

// PATCH { id, published } -> hide or re-show a photo.
export async function PATCH(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    const { id, published } = await request.json()
    const { error } = await createServiceClient().from('event_memories').update({ published: Boolean(published) }).eq('id', String(id))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}

// DELETE { id } -> remove the photo and its file for good.
export async function DELETE(request: Request) {
  if (!isAdmin(request)) return denied()
  try {
    const { id } = await request.json()
    const db = createServiceClient()
    const { data: row } = await db.from('event_memories').select('image_path').eq('id', String(id)).maybeSingle()
    if (!row) return NextResponse.json({ success: true })
    await db.storage.from('event-memories').remove([row.image_path])
    const { error } = await db.from('event_memories').delete().eq('id', String(id))
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
