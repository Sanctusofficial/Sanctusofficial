import { notFound } from 'next/navigation'

import { getEvent } from '@/lib/events'
import { getMemories, memoryUrl } from '@/lib/memories'

export const revalidate = 60

export default async function EventMemoriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [event, memories] = await Promise.all([getEvent(slug), getMemories(slug)])
  if (!event) notFound()
  return (
    <main className="min-h-screen px-4 py-12">
      <section className="mx-auto max-w-5xl">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">Memory archive</p>
        <h1 className="mt-3 font-display text-4xl text-primary text-glow-pink">{event.title}</h1>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {memories.map((memory) => (
            <figure key={memory.id} className="overflow-hidden rounded-2xl border border-border bg-card">
              <img src={memoryUrl(memory.image_path)} alt={memory.caption ?? `${event.title} memory`} className="aspect-square w-full object-cover" />
              {memory.caption && <figcaption className="p-4 text-sm text-muted-foreground">{memory.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </section>
    </main>
  )
}
