-- Networking Bingo leaderboard. Written only by /api/bingo (service role);
-- RLS is on with no policies, so the public API keys cannot read or write it.
create table if not exists public.bingo_players (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  event_slug text not null,
  display_name text not null,
  squares smallint not null default 0 check (squares between 0 and 24),
  lines smallint not null default 0 check (lines between 0 and 12),
  first_bingo_at timestamptz,
  blackout_at timestamptz,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bingo_players_rank_idx
  on public.bingo_players (event_slug, lines desc, squares desc, first_bingo_at);

alter table public.bingo_players enable row level security;
