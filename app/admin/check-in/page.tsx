import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CheckInScanner } from '@/components/check-in-scanner'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Door check-in',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

// Door staff open /admin/check-in?key=<ADMIN_SECRET> on their phone.
export default async function DoorCheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; event?: string }>
}) {
  const params = await searchParams
  if (!process.env.ADMIN_SECRET || params.key !== process.env.ADMIN_SECRET) notFound()

  return (
    <main className="min-h-screen px-4 py-6">
      <CheckInScanner adminKey={params.key as string}eventSlug={params.event || 'mixer'} />
    </main>
  )
}
