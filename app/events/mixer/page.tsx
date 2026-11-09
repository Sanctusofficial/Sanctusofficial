import type { Metadata } from 'next'

import { EventDetails } from '@/components/event-details'
import { EventWhenWhere } from '@/components/event-when-where'
import { Hero } from '@/components/hero'
import { RegistrationForm } from '@/components/registration-form'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'

// This page used to be the home page. It now lives at /events/mixer and the
// home page lists every SEES'30 event.

export const revalidate = 60

export const metadata: Metadata = {
  title: { absolute: "SEES'30 MIXER" },
  description:
    "SEES'30 MIXER: unwind after shege. Picnic, outdoor games, good music, and meet & greet.",
}

export default function MixerPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-background">
        <Hero />
        <EventWhenWhere eventSlug="mixer" />
        <EventDetails />
        <section className="px-6 pb-16">
          <h2 className="mb-6 text-center font-display text-2xl text-primary text-glow-pink">
            Register Now
          </h2>
          <RegistrationForm eventSlug="mixer" />
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
