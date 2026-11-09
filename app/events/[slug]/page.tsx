import { Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { EventWhenWhere } from '@/components/event-when-where'
import { RegistrationForm } from '@/components/registration-form'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { formatPrice, getEvent, hasEnded, isOpen } from '@/lib/events'
import { EVENT_EXTRAS } from '@/lib/site-content'

// Any event added to the `events` table gets a page here automatically.
// The Mixer has its own hand-made page at /events/mixer, which Next.js picks
// over this one.

export const revalidate = 60

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) return { title: 'Event not found' }
  return {
    title: event.title,
    description: EVENT_EXTRAS[slug]?.tagline,
  }
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params
  const event = await getEvent(slug)
  if (!event) notFound()

  const extras = EVENT_EXTRAS[slug] ?? {}
  const price = formatPrice(event.price_naira)
  const open = isOpen(event)
  const ended = hasEnded(event)

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        {extras.poster ? (
          <section className="relative mx-auto aspect-[4/5] w-full max-w-xl overflow-hidden">
            <Image
              src={extras.poster}
              alt={extras.posterAlt ?? `${event.title} poster`}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 640px) 576px, 100vw"
            />
            <div aria-hidden="true" className="scanlines absolute inset-0" />
          </section>
        ) : (
          <section className="relative isolate overflow-hidden px-6 pb-8 pt-16 text-center">
            <div aria-hidden="true" className="vapor-glow absolute inset-0 -z-10" />
            <h1 className="font-display text-4xl text-primary text-glow-pink sm:text-5xl">
              {event.title}
            </h1>
            {extras.tagline && (
              <p className="mx-auto mt-4 max-w-md text-muted-foreground">{extras.tagline}</p>
            )}
          </section>
        )}

        <EventWhenWhere eventSlug={slug} />

        {(price || (extras.highlights && extras.highlights.length > 0)) && (
          <section className="mx-auto max-w-md px-6 pt-6">
            <div className="flex flex-col gap-4 rounded-2xl border border-secondary/30 bg-card p-6">
              {price && (
                <p className="text-center">
                  <span className="text-muted-foreground">Ticket: </span>
                  <span className="font-semibold text-foreground">{price}</span>
                </p>
              )}
              {extras.highlights && extras.highlights.length > 0 && (
                <ul className="grid grid-cols-2 gap-3">
                  {extras.highlights.map((h) => (
                    <li
                      key={h}
                      className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-3 text-sm"
                    >
                      <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {h}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        <section className="px-6 py-12">
          {open ? (
            <>
              <h2 className="mb-6 text-center font-display text-2xl text-primary text-glow-pink">
                Register Now
              </h2>
              <RegistrationForm eventSlug={slug} />
            </>
          ) : (
            <div className="mx-auto max-w-[25rem] rounded-2xl border border-border bg-card p-6 text-center">
              <h2 className="font-display text-xl text-foreground">
                {ended ? 'This event has ended' : 'Registration is closed'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {ended
                  ? 'Thanks to everyone who pulled up. See what else is coming up.'
                  : 'Already registered? You can still check your status.'}
              </p>
              <div className="mt-4 flex justify-center gap-3 text-sm">
                <Link href="/#events" className="text-primary underline">
                  Other events
                </Link>
                {!ended && (
                  <Link href={`/status?event=${slug}`} className="text-primary underline">
                    Check status
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
