import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Calendar, MapPin, Ticket } from 'lucide-react'
import { EventDetails } from '@/components/event-details'
import { Hero } from '@/components/hero'
import { RegistrationForm } from '@/components/registration-form'
import { formatWhen, getEvent } from '@/lib/events'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = getEvent((await params).slug)
  if (!event) return {}
  return { title: event.title, description: event.tagline, openGraph: { images: [event.cover] } }
}

export default async function EventPage({ params }: Props) {
  const event = getEvent((await params).slug)
  if (!event) notFound()

  return (
    <main className="min-h-screen bg-background">
      <Hero src={event.cover} alt={event.coverAlt} startsAt={event.startsAt} />
      <section className="mx-auto max-w-md space-y-2 px-6 text-center">
        <h1 className="font-display text-3xl text-primary text-glow-pink">{event.title}</h1>
        <p className="text-muted-foreground">{event.tagline}</p>
        <p className="flex items-center justify-center gap-2 pt-2 text-sm">
          <Calendar className="size-4" aria-hidden="true" /> {formatWhen(event)}
        </p>
        {event.priceNaira != null && (
          <p className="flex items-center justify-center gap-2 text-sm">
            <Ticket className="size-4" aria-hidden="true" /> ₦{event.priceNaira.toLocaleString('en-NG')}
          </p>
        )}
        {event.venue && (
          <p className="flex items-center justify-center gap-2 text-sm">
            <MapPin className="size-4" aria-hidden="true" /> {event.venue}
          </p>
        )}
      </section>
      <EventDetails features={event.features} />
      <section className="px-6 pb-16">
        {!event.registrationOpen ? (
          <p className="text-center font-display text-xl text-muted-foreground">Registration is closed.</p>
        ) : event.priceNaira == null ? (
          <p className="text-center font-display text-xl text-muted-foreground">Payment isn&apos;t set up for this event yet. Check back soon.</p>
        ) : (
          <>
            <h2 className="mb-6 text-center font-display text-2xl text-primary text-glow-pink">Register Now</h2>
            <RegistrationForm eventSlug={event.slug} priceNaira={event.priceNaira} />
          </>
        )}
      </section>
    </main>
  )
}
