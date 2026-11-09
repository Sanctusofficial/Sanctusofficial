import { ArrowRight, Camera, CheckCircle2, PartyPopper, Ticket, Users, Wallet } from 'lucide-react'
import Link from 'next/link'

import { EventCard } from '@/components/event-card'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { formatEventDate, getEvents, isOpen } from '@/lib/events'
import { SITE } from '@/lib/site-content'

// Re-check the events table at most once a minute, so a new event or a
// change in the database shows up here without a redeploy.
export const revalidate = 60

const PILLAR_ICONS = {
  unwind: PartyPopper,
  connect: Users,
  memories: Camera,
} as const

const STEPS = [
  {
    icon: Ticket,
    title: 'Reserve your spot',
    body: 'Pick an event and fill a short form with your name, email and matric number.',
  },
  {
    icon: Wallet,
    title: 'Pay with your code',
    body: 'Paid events give you a payment code. Add it to your transfer description before your hold runs out.',
  },
  {
    icon: CheckCircle2,
    title: "You're in",
    body: 'Once we match your payment you get a confirmation email. Free events confirm instantly.',
  },
]

const primaryCta =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_oklch(0.73_0.24_355/50%)] transition hover:shadow-[0_0_36px_oklch(0.73_0.24_355/75%)] hover:-translate-y-px'
const secondaryCta =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-secondary/50 px-6 text-sm font-semibold text-secondary transition hover:bg-secondary/10'

export default async function HomePage() {
  const { upcoming, past, failed } = await getEvents()
  const nextUp = upcoming.find((e) => isOpen(e))
  const nextUpWhen = nextUp ? formatEventDate(nextUp.starts_at) : null

  return (
    <>
      <SiteHeader />
      <main className="bg-background">
        {/* ---------- Hero ---------- */}
        <section className="relative isolate overflow-hidden">
          <div aria-hidden="true" className="vapor-glow absolute inset-0 -z-20" />
          <div aria-hidden="true" className="vapor-grid absolute -inset-x-1/2 bottom-0 -z-10 h-2/5" />
          <div aria-hidden="true" className="scanlines absolute inset-0 -z-10" />

          <div className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-24 pt-16 text-center sm:pb-32 sm:pt-24">
            <p className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-secondary">
              {SITE.kicker}
            </p>

            <h1 className="mt-6 font-display text-7xl leading-none text-primary text-glow-pink sm:text-9xl">
              <span className="glitch-text" data-text={SITE.name}>
                {SITE.name}
              </span>
            </h1>

            <p className="mt-6 text-xl font-semibold text-foreground sm:text-2xl">{SITE.tagline}</p>
            <p className="mt-4 max-w-xl text-pretty text-muted-foreground">{SITE.intro}</p>

            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="#events" className={primaryCta}>
                See upcoming events
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link href="/status" className={secondaryCta}>
                Check my registration
              </Link>
            </div>

            {nextUp && (
              <Link
                href={`/events/${nextUp.slug}`}
                className="group mt-10 inline-flex max-w-full items-center gap-3 rounded-full border border-border bg-card/80 py-1.5 pl-1.5 pr-4 text-left text-sm backdrop-blur transition-colors hover:border-primary/60"
              >
                <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
                  Next up
                </span>
                <span className="truncate">
                  <span className="font-semibold text-foreground">{nextUp.title}</span>
                  {nextUpWhen && (
                    <span className="text-muted-foreground"> &middot; {nextUpWhen.date}</span>
                  )}
                </span>
                <ArrowRight
                  className="size-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            )}
          </div>
        </section>

        {/* ---------- Events ---------- */}
        <section id="events" className="scroll-mt-16 px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-8 text-center">
              <h2 className="font-display text-3xl text-primary text-glow-pink sm:text-4xl">
                Upcoming events
              </h2>
              <p className="mt-2 text-muted-foreground">Pick one and pull up with your gang.</p>
            </div>

            {upcoming.length > 0 ? (
              <ul className="grid gap-6 md:grid-cols-2">
                {upcoming.map((e) => (
                  <li key={e.slug}>
                    <EventCard event={e} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">
                {failed
                  ? "We couldn't load the events right now. Refresh in a moment."
                  : 'No events announced yet. Check back soon, something is cooking.'}
              </p>
            )}

            {past.length > 0 && (
              <div className="mt-14">
                <h3 className="mb-4 text-center font-display text-xl text-secondary text-glow-green">
                  Past events
                </h3>
                <ul className="mx-auto flex max-w-2xl flex-col divide-y divide-border rounded-2xl border border-border bg-card">
                  {past.map((e) => {
                    const when = formatEventDate(e.starts_at)
                    return (
                      <li key={e.slug}>
                        <Link
                          href={`/events/${e.slug}`}
                          className="flex items-center justify-between gap-4 px-5 py-4 text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className="font-medium text-foreground">{e.title}</span>
                          {when && <span className="text-muted-foreground">{when.date}</span>}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ---------- About ---------- */}
        <section id="about" className="scroll-mt-16 border-y border-border bg-card/40 px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl text-secondary text-glow-green sm:text-4xl">
                {SITE.about.heading}
              </h2>
              <p className="mt-4 text-pretty text-muted-foreground">{SITE.about.body}</p>
            </div>

            <ul className="mt-10 grid gap-4 sm:grid-cols-3">
              {SITE.about.pillars.map((p) => {
                const Icon = PILLAR_ICONS[p.icon]
                return (
                  <li
                    key={p.title}
                    className="rounded-2xl border border-secondary/30 bg-background/60 p-6"
                  >
                    <Icon className="size-7 text-primary" aria-hidden="true" />
                    <h3 className="mt-4 text-lg font-semibold text-foreground">{p.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{p.body}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="px-6 py-16 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center font-display text-3xl text-primary text-glow-pink sm:text-4xl">
              How it works
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
                  <span
                    aria-hidden="true"
                    className="absolute right-5 top-4 font-display text-4xl text-primary/25"
                  >
                    {i + 1}
                  </span>
                  <s.icon className="size-7 text-secondary" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>

            <div className="mt-12 flex flex-col items-center gap-3 text-center">
              <p className="text-muted-foreground">Already registered for something?</p>
              <Link href="/status" className={secondaryCta}>
                Check my registration
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
