export type SeesEvent = {
  slug: string
  title: string
  tagline: string
  startsAt: string // ISO time with the Lagos offset (+01:00)
  registrationOpen: boolean // true = the form shows; false = "Registration is closed". You decide, the date doesn't.
  venue?: string
  cover: string
  coverAlt: string
  features: string[]
}

// To add an event: copy one block below, change the details, save.
export const EVENTS: SeesEvent[] = [
  {
    slug: 'mixer',
    title: "SEES'30 MIXER",
    tagline: 'Unwind after shege. Pull up with your gang.',
    startsAt: '2026-08-31T12:00:00+01:00',
    registrationOpen: true,
    cover: '/images/hero-banner.jpg',
    coverAlt: "SEES'30 MIXER poster: a UFO beaming green light onto the glitchy title, neon pink vaporwave graphics.",
    features: ['Picnic', 'Outdoor Games', 'Good Music', 'Meet & Greet'],
  },
]

export const getEvent = (slug: string) => EVENTS.find((e) => e.slug === slug)

export const formatWhen = (e: SeesEvent) =>
  new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date(e.startsAt))
