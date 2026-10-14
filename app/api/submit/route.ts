import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getEvent } from '@/lib/events'

// Created when needed, not when the file loads, so a build without secrets doesn't crash.
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  )
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase()
    const data = await request.json()
    const { eventSlug, name, email, departments, matricNumber, receiptUrl, lookingForwardTo } = data

    const event = getEvent(String(eventSlug))
    if (!event || !event.registrationOpen) {
      return NextResponse.json({ error: 'Registration for this event is closed' }, { status: 400 })
    }

    if (
      !name ||
      !email ||
      !Array.isArray(departments) ||
      departments.length === 0 ||
      !matricNumber ||
      !receiptUrl ||
      !lookingForwardTo
    ) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check first, so the person gets a clear message instead of a raw database error.
    // One spot per person *per event*: the same email or matric number can register for a different event.
    const [byEmail, byMatric] = await Promise.all([
      supabase.from('registrations').select('id').eq('event_slug', event.slug).eq('email', email).maybeSingle(),
      supabase.from('registrations').select('id').eq('event_slug', event.slug).eq('matric_number', matricNumber).maybeSingle(),
    ])
    const duplicateMessage = `You've already registered for ${event.title} — one spot per person!`

    if (byEmail.data || byMatric.data) {
      return NextResponse.json({ error: duplicateMessage }, { status: 409 })
    }

    const { error: dbError } = await supabase.from('registrations').insert({
      event_slug: event.slug,
      name,
      email,
      departments: departments.join(', '),
      matric_number: matricNumber,
      receipt_url: receiptUrl,
      looking_forward_to: lookingForwardTo,
    })

    if (dbError) {
      // Backup check: catches the rare case of two identical submissions
      // landing at the exact same moment, before the check above could catch it.
      if (dbError.code === '23505') {
        return NextResponse.json({ error: duplicateMessage }, { status: 409 })
      }
      console.error('[v0] Supabase insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save registration' }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Submit error:', error)
    return NextResponse.json({ error: 'Failed to submit registration' }, { status: 500 })
  }
}
