import type { Metadata } from 'next'

import { SiteHeader } from '@/components/site-header'
import { TeamLeaderboard } from '@/components/team-leaderboard'

export const metadata: Metadata = {
  title: "Team Games · SEES '30",
  description: 'Live team standings for Volts, Amps, Tesla and Ohms at the SEES ’30 Mixer.',
}

export default function GamesPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-3 py-8 sm:px-4 sm:py-12">
        <section className="mx-auto max-w-3xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">SEES&apos;30 Mixer · live</p>
              <h1 className="mt-3 font-display text-4xl text-primary text-glow-pink">Team Leaderboard</h1>
            </div>
            <div className="flex gap-2">
              <a href="/quiz" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Play the quiz →</a>
              <a href="/play" className="rounded-full border border-primary px-4 py-2 text-sm text-primary">Bingo</a>
            </div>
          </div>
          <TeamLeaderboard />
        </section>
      </main>
    </>
  )
}
