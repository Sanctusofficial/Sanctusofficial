import Link from 'next/link'

import { SITE } from '@/lib/site-content'

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-10 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
        <div>
          <Link href="/" className="font-display text-lg text-primary text-glow-pink">
            {SITE.name}
          </Link>
          <p className="mt-1">{SITE.tagline}</p>
        </div>
        <div className="flex flex-col items-center gap-2 sm:items-end">
          {SITE.socials.length > 0 && (
            <ul className="flex gap-4">
              {SITE.socials.map((s) => (
                <li key={s.href}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-foreground"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p>
            &copy; {new Date().getFullYear()} {SITE.name}
          </p>
        </div>
      </div>
    </footer>
  )
}
