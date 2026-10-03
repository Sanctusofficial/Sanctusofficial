export type SeesEvent = {
  slug: string
  title: string
  tagline: string
  startsAt: string // ISO time with the Lagos offset (+01:00)
  registrationOpen: boolean // true = the form shows; false = "Registration is closed". You decide, the date doesn't.
  priceNaira?: number // ticket price in naira. Leave it out and the page says payment isn't set up yet.
  venue?: string
  cover: string
  coverAlt: string
  features: string[]
}

const MIXER: SeesEvent = {
  slug: 'mixer',
  title: "SEES'30 MIXER",
  tagline: 'Unwind after shege. Pull up with your gang.',
  startsAt: '2026-08-31T12:00:00+01:00',
  registrationOpen: true,
  cover: '/images/hero-banner.jpg',
  coverAlt: "SEES'30 MIXER poster: a UFO beaming green light onto the glitchy title, neon pink vaporwave graphics.",
  features: ['Picnic', 'Outdoor Games', 'Good Music', 'Meet & Greet'],
}

// A cheap fake event for trying the payment flow. It only exists while the site is running with a
// Paystack TEST key (sk_test_...), so it disappears on its own once you switch to the live key.
const PAYMENT_TEST: SeesEvent = {
  slug: 'payment-test',
  title: 'Payment test',
  tagline: 'For testing payments only. No real money moves.',
  startsAt: '2026-12-31T12:00:00+01:00',
  registrationOpen: true,
  priceNaira: 100,
  cover: '/images/hero-banner.jpg',
  coverAlt: 'Payment test event',
  features: ['Test'],
}

// To add an event: copy the block above, change the details, and add it to this list.
export const EVENTS: SeesEvent[] = process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_test_')
  ? [MIXER, PAYMENT_TEST]
  : [MIXER]

export const getEvent = (slug: string) => EVENTS.find((e) => e.slug === slug)

export const formatWhen = (e: SeesEvent) =>
  new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date(e.startsAt))
