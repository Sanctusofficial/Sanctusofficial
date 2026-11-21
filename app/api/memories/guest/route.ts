import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

const EVENT_SLUG = 'mixer'
const BUCKET = 'event-memories'
const MAX_PER_GUEST = 200

// Guests prove who they are with the email + matric number they registered with.
async function findGuest(email: unknown, matric: unknown) {
  const cleanEmail = String(email ?? '').trim().toLowerCase()
  const cleanMatric = String(matric ?? '').replace(/\s+/g, '').toUpperCase()
  if (!cleanEmail || !cleanMatric) return null
  const { data } = await createServiceClient()
    .from('registrations')
    .select('id, name, email, status')
    .eq('event_slug', EVENT_SLUG)
    .eq('matric_number', cleanMatric)
  return (data ?? []).find((r) => (r.email ?? '').toLowerCase() === cleanEmail && r.status === 'approved') ?? null
}

function shortName(full: string | null) {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'A guest'
  const first = parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase()
  return parts[1] ? `${first} ${parts[1][0].toUpperCase()}.` : first
}

// POST { action: 'check' | 'sign' | 'save', email, matric, path?, caption? }
//  check -> confirms the guest (and how many photos they've shared)
//  sign  -> a one-time upload slot; the phone uploads the photo straight to storage
//  save  -> after upload, publishes the photo on the memories wall
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const guest = await findGuest(body.email, body.matric)
    if (!guest) {
      return NextResponse.json({ error: "We couldn't find an approved Mixer ticket with that email and matric number." }, { status: 404 })
    }
    const db = createServiceClient()
    const { count } = await db.from('event_memories').select('id', { count: 'exact', head: true }).eq('uploaded_by', guest.id)
    const shared = count ?? 0
    const folder = `${EVENT_SLUG}/guests/${guest.id}`

    if (body.action === 'check') {
      return NextResponse.json({ name: shortName(guest.name), shared, limit: MAX_PER_GUEST })
    }

    if (body.action === 'sign') {
      if (shared >= MAX_PER_GUEST) return NextResponse.json({ error: `You've reached the ${MAX_PER_GUEST}-photo limit. Thank you!` }, { status: 429 })
      const path = `${folder}/${randomUUID()}.jpg`
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !data) {
        console.error('[memories] sign error:', error?.message)
        return NextResponse.json({ error: 'Could not start the upload. Try again.' }, { status: 502 })
      }
      return NextResponse.json({ path: data.path, token: data.token })
    }

    if (body.action === 'save') {
      const path = String(body.path ?? '')
      const file = path.slice(folder.length + 1)
      if (!path.startsWith(`${folder}/`) || !/^[0-9a-f-]{36}\.jpg$/.test(file)) {
        return NextResponse.json({ error: 'Invalid photo.' }, { status: 400 })
      }
      // Only publish files that really made it into storage.
      const { data: found } = await db.storage.from(BUCKET).list(folder, { search: file, limit: 1 })
      if (!found?.some((f) => f.name === file)) return NextResponse.json({ error: 'Upload not found. Try again.' }, { status: 409 })
      const { data: event } = await db.from('events').select('id').eq('slug', EVENT_SLUG).single()
      const { error } = await db.from('event_memories').insert({
        event_id: event?.id,
        image_path: path,
        caption: body.caption ? String(body.caption).trim().slice(0, 200) || null : null,
        published: true,
        uploaded_by: guest.id,
        uploader_name: shortName(guest.name),
      })
      if (error) {
        console.error('[memories] save error:', error.message)
        return NextResponse.json({ error: 'Could not save the photo.' }, { status: 502 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
}
