import { createClient } from '@supabase/supabase-js'
import { CalendarDays, MapPin } from 'lucide-react'

// Reads the date, time and venue from the events table, so changing them is a
// database edit and not a code change.
export async function EventWhenWhere({ eventSlug = 'mixer' }: { eventSlug?: string }) {
  let startsAt: string | null = null
  let venue: string | null = null

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    )
    const { data } = await supabase
      .from('events')
      .select('starts_at, venue')
      .eq('slug', eventSlug)
      .maybeSingle()
    startsAt = data?.starts_at ?? null
    venue = data?.venue ?? null
  } catch (error) {
    // If the lookup fails the card is simply left out. The page still works.
    console.error('[when-where] could not load the event:', error)
  }

  if (!startsAt && !venue) return null

  const date = startsAt ? new Date(startsAt) : null
  const dateText = date
    ? date.toLocaleDateString('en-NG', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Africa/Lagos',
      })
    : null
  const timeText = date
    ? date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Africa/Lagos',
      })
    : null

  return (
    <section className="mx-auto max-w-md px-6 pt-2">
      <div className="flex flex-col gap-4 rounded-2xl border border-secondary/30 bg-card p-6">
        <h2 className="text-center font-display text-lg text-secondary text-glow-green">
          When &amp; Where
        </h2>

        {dateText && (
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">{dateText}</p>
              {timeText && <p className="text-sm text-muted-foreground">{timeText}</p>}
            </div>
          </div>
        )}

        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="font-medium text-foreground">
            {venue ?? 'HRDC near ISL UNILAG back gate'}
          </p>
        </div>
      </div>
    </section>
  )
}