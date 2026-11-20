import { CircuitQuiz } from '@/components/circuit-quiz'
import { SecretTerminal } from '@/components/secret-terminal'

export default function PlayPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <section className="mx-auto grid max-w-3xl gap-8">
        <div>
          <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">SEES&apos;30 playground</p>
          <h1 className="mt-3 font-display text-4xl text-primary text-glow-pink">Play with the circuit</h1>
        </div>
        <CircuitQuiz />
        <SecretTerminal />
      </section>
    </main>
  )
}
