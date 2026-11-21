-- Team games: 4 teams, a list of games, an append-only points log, and a
-- team quiz (our own Kahoot). Only the service role (server routes) touches
-- these tables; RLS is on with no policies.

create table if not exists public.game_teams (
  slug text primary key,
  name text not null,
  color text not null,
  sort smallint not null
);

create table if not exists public.games (
  id text primary key,
  name text not null,
  sort smallint not null
);

create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id),
  team_slug text not null references public.game_teams(slug),
  points int not null check (points between -1000 and 100000),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists game_scores_team_idx on public.game_scores(team_slug, game_id);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  position int not null default 0,
  prompt text not null check (char_length(prompt) between 1 and 300),
  options text[] not null check (cardinality(options) between 2 and 4),
  correct smallint not null,
  seconds smallint not null default 20 check (seconds between 5 and 120),
  created_at timestamptz not null default now(),
  check (correct >= 0 and correct < cardinality(options))
);

-- One row: where the live quiz is.
create table if not exists public.quiz_session (
  id smallint primary key default 1 check (id = 1),
  status text not null default 'lobby' check (status in ('lobby', 'question', 'reveal', 'finished')),
  question_id uuid references public.quiz_questions(id) on delete set null,
  question_number int not null default 0,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.quiz_session (id) values (1) on conflict do nothing;

-- One answer per team per question (each team shares one phone).
create table if not exists public.quiz_answers (
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  team_slug text not null references public.game_teams(slug),
  choice smallint not null,
  correct boolean not null,
  points int not null,
  answered_at timestamptz not null default now(),
  primary key (question_id, team_slug)
);

alter table public.game_teams enable row level security;
alter table public.games enable row level security;
alter table public.game_scores enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_session enable row level security;
alter table public.quiz_answers enable row level security;

insert into public.game_teams (slug, name, color, sort) values
  ('volts', 'Team Volts', '#facc15', 1),
  ('amps', 'Team Amps', '#38bdf8', 2),
  ('tesla', 'Team Tesla', '#f43f5e', 3),
  ('ohms', 'Team Ohms', '#22c55e', 4)
on conflict (slug) do update set name = excluded.name, color = excluded.color, sort = excluded.sort;

insert into public.games (id, name, sort) values
  ('cup', 'Cup Game', 1),
  ('numbers', 'Numbers Game', 2),
  ('pass-object', 'Pass the Object', 3),
  ('reaction', 'Reaction/Throwing Game', 4),
  ('taboo', 'Taboo', 5),
  ('balloon', 'Pop the Balloon', 6),
  ('cross-lines', 'Cross Lines', 7),
  ('speed-friendship', 'Speed Friendship', 8),
  ('quiz', 'Kahoot (SEES Quiz)', 9)
on conflict (id) do update set name = excluded.name, sort = excluded.sort;

-- Answer the live question. Timing and points use the database clock, so a
-- phone can't answer late or claim speed it didn't have.
-- Correct: 500-1000 points (faster = more). Wrong or late: 0.
create or replace function public.quiz_submit(p_team text, p_choice int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.quiz_session;
  q public.quiz_questions;
  elapsed numeric;
  is_correct boolean;
  pts int;
begin
  if not exists (select 1 from public.game_teams where slug = p_team) then
    return json_build_object('error', 'bad_team');
  end if;
  select * into s from public.quiz_session where id = 1;
  if s.status <> 'question' or s.question_id is null then
    return json_build_object('error', 'not_open');
  end if;
  select * into q from public.quiz_questions where id = s.question_id;
  if p_choice is null or p_choice < 0 or p_choice >= cardinality(q.options) then
    return json_build_object('error', 'bad_choice');
  end if;

  elapsed := extract(epoch from (now() - s.started_at));
  if elapsed > q.seconds + 1 then
    return json_build_object('error', 'too_late');
  end if;

  is_correct := p_choice = q.correct;
  pts := case when is_correct
              then round(1000 * (1 - least(greatest(elapsed, 0), q.seconds) / (2.0 * q.seconds)))::int
              else 0 end;

  insert into public.quiz_answers (question_id, team_slug, choice, correct, points)
  values (q.id, p_team, p_choice, is_correct, pts)
  on conflict (question_id, team_slug) do nothing;
  if not found then
    return json_build_object('error', 'already_answered');
  end if;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.quiz_submit(text, int) from public, anon, authenticated;
grant execute on function public.quiz_submit(text, int) to service_role;
