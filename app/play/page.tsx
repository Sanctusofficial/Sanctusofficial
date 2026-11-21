import type { Metadata } from 'next'

import { NetworkingBingo } from '@/components/networking-bingo'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: "Networking Bingo · SEES '30",
  description: 'Meet people you don’t know yet at the SEES ’30 Mixer.',
}

export default function PlayPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-3 py-8 sm:px-4 sm:py-12">
        <section className="mx-auto max-w-xl space-y-6">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">SEES&apos;30 Mixer</p>
            <h1 className="mt-3 font-display text-4xl text-primary text-glow-pink">Networking Bingo</h1>
          </div>
          <NetworkingBingo />
        </section>
      </main>
    </>
  )
}
