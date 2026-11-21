import type { Metadata } from 'next'

import { SiteHeader } from '@/components/site-header'
import { TeamQuiz } from '@/components/team-quiz'

export const metadata: Metadata = {
  title: "SEES Quiz · SEES '30",
  description: 'The live team quiz at the SEES ’30 Mixer. One phone per team!',
}

export default function QuizPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen px-3 py-8 sm:px-4 sm:py-12">
        <section className="mx-auto max-w-xl space-y-6">
          <div>
            <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">SEES&apos;30 Mixer · live</p>
            <h1 className="mt-3 font-display text-4xl text-primary text-glow-pink">SEES Quiz</h1>
          </div>
          <TeamQuiz />
        </section>
      </main>
    </>
  )
}
