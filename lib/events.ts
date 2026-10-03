export type SeesEvent = {
  slug: string
  title: string
  tagline: string
  startsAt?: string // ISO time with the Lagos offset (+01:00). Leave out until the date is known.
  dateNote?: string // shown in place of the date while startsAt is empty
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
    // Postponed from 31 Aug 2026. Add startsAt: '2026-MM-DDT12:00:00+01:00' once the new date is set.
    dateNote: 'Postponed — new date to be announced',
    registrationOpen: true,
    cover: '/images/hero-banner.jpg',
    coverAlt: "SEES'30 MIXER poster: a UFO beaming green light onto the glitchy title, neon pink vaporwave graphics.",
    features: ['Picnic', 'Outdoor Games', 'Good Music', 'Meet & Greet'],
  },
]

export const getEvent = (slug: string) => EVENTS.find((e) => e.slug === slug)

export const startTime = (e: SeesEvent) => (e.startsAt ? +new Date(e.startsAt) : Number.MAX_SAFE_INTEGER)

export const formatWhen = (e: SeesEvent) =>
  e.startsAt
    ? new Intl.DateTimeFormat('en-NG', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'Africa/Lagos',
      }).format(new Date(e.startsAt))
    : (e.dateNote ?? 'Date to be announced')
