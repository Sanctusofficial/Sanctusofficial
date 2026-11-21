import type { Metadata } from 'next'

import { BingoLeaderboard } from '@/components/bingo-leaderboard'
import { SiteHeader } from '@/components/site-header'

export const metadata: Metadata = {
  title: "Bingo Leaderboard · SEES '30",
  description: 'Live Networking Bingo standings at the SEES ’30 Mixer.',
}

export default function BingoLeaderboardPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-3 py-8 sm:px-4 sm:py-12">
        <section className="mx-auto max-w-2xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">SEES&apos;30 Mixer · live</p>
              <h1 className="mt-3 font-display text-4xl text-primary text-glow-pink">Bingo Leaderboard</h1>
            </div>
            <a href="/play" className="rounded-full border border-primary px-4 py-2 text-sm text-primary">Play bingo →</a>
          </div>
          <BingoLeaderboard />
        </section>
      </main>
    </>
  )
}
