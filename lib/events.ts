import { createClient } from '@supabase/supabase-js'

// Only columns that the rest of the app already relies on, so this works with
// the existing `events` table without a migration.
const EVENT_COLUMNS =
  'slug, title, starts_at, venue, price_naira, registration_open, capacity, created_at'

export type SeesEvent = {
  slug: string
  title: string
  starts_at: string | null
  venue: string | null
  price_naira: number | null
  registration_open: boolean | null
  capacity: number | null
  created_at: string | null
}

function supabase() {
  return createClient(
    process.env.SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  )
}

// An event counts as over 12 hours after it starts.
const ENDED_AFTER_MS = 12 * 60 * 60 * 1000

export function hasEnded(event: SeesEvent, nowMs = Date.now()) {
  if (!event.starts_at) return false
  return Date.parse(event.starts_at) + ENDED_AFTER_MS < nowMs
}

export function isOpen(event: SeesEvent, nowMs = Date.now()) {
  return !!event.registration_open && !hasEnded(event, nowMs)
}

export async function getEvents(): Promise<{
  upcoming: SeesEvent[]
  past: SeesEvent[]
  failed: boolean
}> {
  try {
    const { data, error } = await supabase()
      .from('events')
      .select(EVENT_COLUMNS)
      .order('starts_at', { ascending: true, nullsFirst: false })

    if (error) throw error

    const now = Date.now()
    const all = (data ?? []) as SeesEvent[]
    return {
      upcoming: all.filter((e) => !hasEnded(e, now)),
      past: all.filter((e) => hasEnded(e, now)).reverse(),
      failed: false,
    }
  } catch (error) {
    // The landing page still renders; it just shows a friendly message.
    console.error('[events] could not load events:', error)
    return { upcoming: [], past: [], failed: true }
  }
}

export async function getEvent(slug: string): Promise<SeesEvent | null> {
  try {
    const { data, error } = await supabase()
      .from('events')
      .select(EVENT_COLUMNS)
      .eq('slug', slug)
      .maybeSingle()
    if (error) throw error
    return (data as SeesEvent | null) ?? null
  } catch (error) {
    console.error(`[events] could not load "${slug}":`, error)
    return null
  }
}

export function formatEventDate(startsAt: string | null) {
  if (!startsAt) return null
  const d = new Date(startsAt)
  const date = d.toLocaleDateString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Lagos',
  })
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Lagos',
  })
  return { date, time }
}

export function formatPrice(priceNaira: number | null) {
  if (priceNaira === null || priceNaira === undefined) return null
  if (priceNaira === 0) return 'Free'
  return `\u20A6${priceNaira.toLocaleString('en-NG')}`
}
