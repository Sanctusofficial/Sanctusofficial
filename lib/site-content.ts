// All the words on the landing page live here, so editing copy never means
// touching layout code.
//
// TODO(copy): Everything marked PLACEHOLDER was written as a starting point.
// Check it and replace it with the real wording before launch.

export const SITE = {
  name: "SEES'30",

  // PLACEHOLDER: short line shown above the big title.
  kicker: 'Elect & Computer · UNILAG',

  // PLACEHOLDER: the main one-liner under the title.
  tagline: 'Events by the set, for the set.',

  // PLACEHOLDER: the paragraph in the hero.
  intro:
    "Lectures, labs and late-night assignments are only half the story. SEES'30 events are where the set gets together to unwind, link up and make the memories worth graduating with.",

  about: {
    // PLACEHOLDER
    heading: "What is SEES'30?",
    // PLACEHOLDER
    body: "SEES'30 is the Electrical and Computer Engineering class set graduating in 2030. This is our home for everything we host together: hangouts, games days, parties and more. Every event lives here, and registering takes less than a minute.",
    // PLACEHOLDER: three short points about what the events are for.
    pillars: [
      {
        icon: 'unwind',
        title: 'Unwind',
        body: 'A break from the shege. Good music, good food and zero assignments.',
      },
      {
        icon: 'connect',
        title: 'Connect',
        body: 'Meet people from both departments you never got to talk to in class.',
      },
      {
        icon: 'memories',
        title: 'Make memories',
        body: 'The stories the set will still be telling at the final-year dinner.',
      },
    ],
  },

  // Optional links shown in the footer, e.g.
  // { label: 'Instagram', href: 'https://instagram.com/yourhandle' }
  // Left empty so no made-up links go live.
  socials: [] as { label: string; href: string }[],
} as const

// Extra details for each event that are not stored in the database.
// The key is the event's slug in the `events` table.
// Date, venue, price and whether registration is open still come from the
// database, so those stay a database edit.
export type EventExtras = {
  tagline?: string
  poster?: string
  posterAlt?: string
  highlights?: string[]
}

export const EVENT_EXTRAS: Record<string, EventExtras> = {
  mixer: {
    tagline: 'Unwind after shege. Picnic, outdoor games, good music, and meet & greet.',
    poster: '/images/hero-banner.jpg',
    posterAlt:
      "SEES'30 MIXER poster: a UFO beaming green light onto the glitchy SEES'30 MIXER title, set against neon pink vaporwave graphics.",
    highlights: ['Picnic', 'Outdoor games', 'Good music', 'Meet & greet'],
  },
}
