import Link from 'next/link'

import { SITE } from '@/lib/site-content'

const LINKS = [
  { href: '/#events', label: 'Events' },
  { href: '/#about', label: 'About' },
  { href: '/status', label: 'Status' },
  { href: '/account', label: 'Passport' },
  { href: '/memories', label: 'Memories' },
  { href: '/play', label: 'Play' },
]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6"
      >
        <Link
          href="/"
          className="font-display text-xl text-primary text-glow-pink"
          aria-label={`${SITE.name} home`}
        >
          {SITE.name}
        </Link>
        <ul className="flex items-center gap-1 text-sm sm:gap-2">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
