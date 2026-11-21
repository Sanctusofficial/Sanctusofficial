-- Guests can upload their own photos to the memories wall.
-- Rows record who uploaded (the approved registration) for credit and moderation.
alter table public.event_memories
  add column if not exists uploaded_by uuid references public.registrations(id) on delete set null,
  add column if not exists uploader_name text;

create index if not exists event_memories_uploaded_by_idx on public.event_memories(uploaded_by, created_at);
