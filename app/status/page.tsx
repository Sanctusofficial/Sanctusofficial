import { SiteHeader } from '@/components/site-header'
import { StatusLookup } from '@/components/status-lookup'

export const metadata = {
  title: 'Check your registration',
}

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>
}) {
  const { event } = await searchParams
  // Links from an event page pass ?event=<slug>. Without it, the Mixer is used,
  // which is how this page always worked.
  const eventSlug = typeof event === 'string' && event.trim() ? event.trim() : 'mixer'

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-4 py-12">
        <div className="text-center">
          <h1 className="font-display text-3xl text-primary text-glow-pink">
            Check your registration
          </h1>
          <p className="mt-2 text-muted-foreground">
            Enter the email and matric number you registered with.
          </p>
        </div>
        <StatusLookup eventSlug={eventSlug} />
      </main>
    </>
  )
}
