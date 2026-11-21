import Link from 'next/link'

import { GuestPhotoUpload } from '@/components/guest-photo-upload'
import { SiteHeader } from '@/components/site-header'

import { getMemories, memoryUrl } from '@/lib/memories'

export const revalidate = 15

export default async function MemoriesPage() {
  const memories = await getMemories()
  return (
    <>
    <SiteHeader />
    <main className="min-h-screen px-4 py-12">
      <section className="mx-auto max-w-5xl">
        <p className="font-display text-sm uppercase tracking-[0.3em] text-secondary">Shared by all of us</p>
        <h1 className="mt-3 font-display text-4xl text-primary text-glow-pink">The memories wall</h1>
        <div className="mt-6 max-w-xl">
          <GuestPhotoUpload />
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {memories.map((memory) => (
            <Link key={memory.id} href={`/memories/${memory.events?.slug ?? memory.event_id}`} className="overflow-hidden rounded-2xl border border-border bg-card">
              <img src={memoryUrl(memory.image_path)} alt={memory.caption ?? 'SEES event memory'} className="aspect-square w-full object-cover" />
              <div className="p-4">
                <p className="font-display text-primary">{memory.events?.title}</p>
                {memory.caption && <p className="mt-1 text-sm text-muted-foreground">{memory.caption}</p>}
                {memory.uploader_name && <p className="mt-1 text-xs text-muted-foreground">📸 {memory.uploader_name}</p>}
              </div>
            </Link>
          ))}
        </div>
        {memories.length === 0 && <p className="mt-8 text-muted-foreground">Memories are being developed in the lab.</p>}
      </section>
    </main>
    </>
  )
}
