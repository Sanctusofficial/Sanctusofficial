alter table public.registrations
  add column if not exists ticket_token text unique,
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by text;

create index if not exists registrations_ticket_token_idx
  on public.registrations(ticket_token);

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  matric_number text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, matric_number)
);

create table if not exists public.event_memories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  image_path text not null,
  caption text,
  sort_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists event_memories_event_idx
  on public.event_memories(event_id, sort_order, created_at);

alter table public.member_profiles enable row level security;
alter table public.event_memories enable row level security;

drop policy if exists "Members read own profile" on public.member_profiles;
create policy "Members read own profile" on public.member_profiles
  for select using (auth.uid() = id);

drop policy if exists "Members manage own profile" on public.member_profiles;
create policy "Members manage own profile" on public.member_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Published memories are public" on public.event_memories;
create policy "Published memories are public" on public.event_memories
  for select using (published = true);

insert into storage.buckets (id, name, public)
values ('event-memories', 'event-memories', true)
on conflict (id) do update set public = true;

drop policy if exists "Public event memories" on storage.objects;
create policy "Public event memories" on storage.objects
  for select using (bucket_id = 'event-memories');
