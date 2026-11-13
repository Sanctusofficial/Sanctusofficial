import { createServiceClient } from '@/lib/supabase-server'

export type EventMemory = {
  id: string
  event_id: string
  image_path: string
  caption: string | null
  sort_order: number
  created_at: string
  event?: { slug: string; title: string } | null
}

export async function getMemories(slug?: string) {
  const supabase = createServiceClient()
  let query = supabase
    .from('event_memories')
    .select('id, event_id, image_path, caption, sort_order, created_at, events(slug, title)')
    .eq('published', true)
    .order('sort_order')
    .order('created_at', { ascending: false })
  if (slug) {
    const { data: event } = await supabase.from('events').select('id').eq('slug', slug).maybeSingle()
    if (!event) return []
    query = query.eq('event_id', event.id)
  }
  const { data } = await query
  return (data ?? []) as EventMemory[]
}

export function memoryUrl(path: string) {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL) as string
  return `${base}/storage/v1/object/public/event-memories/${path}`
}
