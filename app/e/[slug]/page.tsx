import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Calendar, MapPin } from 'lucide-react'
import { EventDetails } from '@/components/event-details'
import { Hero } from '@/components/hero'
import { RegistrationForm } from '@/components/registration-form'
import { formatWhen, getEvent, hasEnded } from '@/lib/events'

// Checked on every visit, so "ended" flips on its own when the start time passes.
export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = getEvent((await params).slug)
  if (!event) return {}
  return { title: event.title, description: event.tagline, openGraph: { images: [event.cover] } }
}

export default async function EventPage({ params }: Props) {
  const event = getEvent((await params).slug)
  if (!event) notFound()
  const ended = hasEnded(event)

  return (
    <main className="min-h-screen bg-background">
      <Hero src={event.cover} alt={event.coverAlt} startsAt={event.startsAt} />
      <section className="mx-auto max-w-md space-y-2 px-6 text-center">
        <h1 className="font-display text-3xl text-primary text-glow-pink">{event.title}</h1>
        <p className="text-muted-foreground">{event.tagline}</p>
        <p className="flex items-center justify-center gap-2 pt-2 text-sm">
          <Calendar className="size-4" aria-hidden="true" /> {formatWhen(event)}
        </p>
        {event.venue && (
          <p className="flex items-center justify-center gap-2 text-sm">
            <MapPin className="size-4" aria-hidden="true" /> {event.venue}
          </p>
        )}
      </section>
      <EventDetails features={event.features} />
      <section className="px-6 pb-16">
        {ended ? (
          <p className="text-center font-display text-xl text-muted-foreground">This event has ended.</p>
        ) : (
          <>
            <h2 className="mb-6 text-center font-display text-2xl text-primary text-glow-pink">Register Now</h2>
            <RegistrationForm eventSlug={event.slug} />
          </>
        )}
      </section>
    </main>
  )
}
