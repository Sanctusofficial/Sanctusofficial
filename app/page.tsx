import Link from 'next/link'
import { EVENTS, formatWhen, startTime } from '@/lib/events'

export default function Page() {
  const sorted = [...EVENTS].sort(
    (a, b) => Number(!a.registrationOpen) - Number(!b.registrationOpen) || startTime(a) - startTime(b),
  )
  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-12">
      <h1 className="mb-8 text-center font-display text-3xl text-primary text-glow-pink">SEES&apos;30 Events</h1>
      <ul className="space-y-4">
        {sorted.map((e) => (
          <li key={e.slug}>
            <Link href={`/e/${e.slug}`} className="block rounded-2xl border border-secondary/30 bg-card p-5 hover:border-primary">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg text-foreground">{e.title}</h2>
                {!e.registrationOpen && <span className="text-xs text-muted-foreground">Registration closed</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{formatWhen(e)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
