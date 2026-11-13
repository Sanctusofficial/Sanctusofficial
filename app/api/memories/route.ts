import { randomUUID, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

import { createServiceClient } from '@/lib/supabase-server'

function isAdmin(request: Request) {
  const expected = process.env.ADMIN_SECRET
  const given = request.headers.get('x-admin-key')
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(request: Request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not allowed' }, { status: 401 })
  try {
    const form = await request.formData()
    const eventSlug = String(form.get('eventSlug') ?? '')
    const caption = String(form.get('caption') ?? '').trim().slice(0, 300)
    const file = form.get('file')
    if (!(file instanceof File) || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Upload a JPEG, PNG, or WebP image.' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'Image is too large.' }, { status: 413 })
    const supabase = createServiceClient()
    const { data: event } = await supabase.from('events').select('id').eq('slug', eventSlug).maybeSingle()
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
    const image = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 84 })
      .toBuffer()
    const path = `${eventSlug}/${randomUUID()}.jpg`
    const { error: uploadError } = await supabase.storage.from('event-memories').upload(path, image, { contentType: 'image/jpeg', upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 502 })
    const { error: rowError } = await supabase.from('event_memories').insert({ event_id: event.id, image_path: path, caption, published: true })
    if (rowError) return NextResponse.json({ error: rowError.message }, { status: 502 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[memories] upload error:', error)
    return NextResponse.json({ error: 'Could not upload memory.' }, { status: 500 })
  }
}
