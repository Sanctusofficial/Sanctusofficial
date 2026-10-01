import { Sparkles } from 'lucide-react'

export function EventDetails({ features }: { features: string[] }) {
  return (
    <section className="mx-auto max-w-md px-6 py-10">
      <div className="rounded-2xl border border-secondary/30 bg-card p-6">
        <h2 className="font-display text-center text-lg text-secondary text-glow-green">Featuring</h2>
        <ul className="mt-5 grid grid-cols-2 gap-4">
          {features.map((label) => (
            <li key={label} className="flex flex-col items-center gap-2 rounded-xl border border-border bg-background/40 px-3 py-4 text-center">
              <Sparkles className="size-6 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
