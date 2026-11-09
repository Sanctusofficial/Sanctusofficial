import { ArrowRight, CalendarDays, MapPin, Ticket } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import {
  formatEventDate,
  formatPrice,
  hasEnded,
  isOpen,
  type SeesEvent,
} from '@/lib/events'
import { EVENT_EXTRAS } from '@/lib/site-content'

function StatusBadge({ event }: { event: SeesEvent }) {
  if (hasEnded(event)) {
    return (
      <span className="self-start rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
        Ended
      </span>
    )
  }
  if (isOpen(event)) {
    return (
      <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-secondary/50 bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary">
        <span className="size-1.5 animate-pulse rounded-full bg-secondary" aria-hidden="true" />
        Registration open
      </span>
    )
  }
  return (
    <span className="self-start rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
      Registration closed
    </span>
  )
}

export function EventCard({ event }: { event: SeesEvent }) {
  const extras = EVENT_EXTRAS[event.slug] ?? {}
  const when = formatEventDate(event.starts_at)
  const price = formatPrice(event.price_naira)
  const open = isOpen(event)

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-secondary/30 bg-card transition-colors hover:border-primary/60">
      <div className="flex flex-col sm:flex-row">
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden sm:aspect-[4/5] sm:w-56">
          {extras.poster ? (
            <Image
              src={extras.poster}
              alt={extras.posterAlt ?? `${event.title} poster`}
              fill
              className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
              sizes="(min-width: 640px) 224px, 100vw"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_30%_20%,oklch(0.73_0.24_355/35%),transparent_60%),radial-gradient(circle_at_70%_80%,oklch(0.75_0.22_145/30%),transparent_60%)] p-6 text-center font-display text-2xl text-foreground"
            >
              {event.title}
            </div>
          )}
          <div aria-hidden="true" className="scanlines absolute inset-0" />
        </div>

        <div className="flex flex-1 flex-col gap-3 p-5">
          <StatusBadge event={event} />
          <h3 className="font-display text-2xl leading-tight text-foreground">
            <Link
              href={`/events/${event.slug}`}
              className="after:absolute after:inset-0 focus-visible:outline-none"
            >
              {event.title}
            </Link>
          </h3>
          {extras.tagline && <p className="text-sm text-muted-foreground">{extras.tagline}</p>}

          <dl className="flex flex-col gap-2 text-sm">
            {when && (
              <div className="flex items-center gap-2">
                <dt className="sr-only">When</dt>
                <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <dd>
                  {when.date} &middot; {when.time}
                </dd>
              </div>
            )}
            {event.venue && (
              <div className="flex items-center gap-2">
                <dt className="sr-only">Where</dt>
                <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <dd>{event.venue}</dd>
              </div>
            )}
            {price && (
              <div className="flex items-center gap-2">
                <dt className="sr-only">Price</dt>
                <Ticket className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <dd>{price}</dd>
              </div>
            )}
          </dl>

          <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-primary">
            {open ? 'View & register' : 'View details'}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </span>
        </div>
      </div>
    </article>
  )
}
