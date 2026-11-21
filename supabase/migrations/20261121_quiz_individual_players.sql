-- Individual quiz players: everyone answers on their own phone.
-- Each player joins with a name + team and gets a secret token (kept on the
-- phone). One answer per player per question. A team's quiz score is the
-- average of its active players' points (computed in the app), so team size
-- doesn't decide the winner.

create table if not exists public.quiz_players (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text not null check (char_length(name) between 1 and 30),
  team_slug text not null references public.game_teams(slug),
  joined_at timestamptz not null default now()
);
alter table public.quiz_players enable row level security;

-- No answers exist yet, so the per-team answers table is replaced outright.
drop table if exists public.quiz_answers;
create table public.quiz_answers (
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  player_id uuid not null references public.quiz_players(id) on delete cascade,
  team_slug text not null references public.game_teams(slug),
  choice smallint not null,
  correct boolean not null,
  points int not null,
  answered_at timestamptz not null default now(),
  primary key (question_id, player_id)
);
alter table public.quiz_answers enable row level security;

create or replace function public.quiz_join(p_name text, p_team text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean text := left(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), 30);
  p public.quiz_players;
begin
  if clean = '' then return json_build_object('error', 'need_name'); end if;
  if not exists (select 1 from public.game_teams where slug = p_team) then
    return json_build_object('error', 'bad_team');
  end if;
  insert into public.quiz_players (token, name, team_slug)
  values (encode(extensions.gen_random_bytes(24), 'hex'), clean, p_team)
  returning * into p;
  return json_build_object('token', p.token, 'id', p.id, 'name', p.name, 'team', p.team_slug);
end;
$$;

drop function if exists public.quiz_submit(text, int);
create or replace function public.quiz_submit(p_token text, p_choice int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  pl public.quiz_players;
  s public.quiz_session;
  q public.quiz_questions;
  elapsed numeric;
  is_correct boolean;
  pts int;
begin
  select * into pl from public.quiz_players where token = p_token;
  if pl.id is null then return json_build_object('error', 'not_joined'); end if;
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
  -- Correct: 500-1000 points (faster = more), doubled on double-points questions.
  pts := case when is_correct
              then round(1000 * (1 - least(greatest(elapsed, 0), q.seconds) / (2.0 * q.seconds)))::int
                   * case when q.double_points then 2 else 1 end
              else 0 end;

  insert into public.quiz_answers (question_id, player_id, team_slug, choice, correct, points)
  values (q.id, pl.id, pl.team_slug, p_choice, is_correct, pts)
  on conflict (question_id, player_id) do nothing;
  if not found then
    return json_build_object('error', 'already_answered');
  end if;

  return json_build_object('ok', true);
end;
$$;

revoke all on function public.quiz_join(text, text) from public, anon, authenticated;
revoke all on function public.quiz_submit(text, int) from public, anon, authenticated;
grant execute on function public.quiz_join(text, text) to service_role;
grant execute on function public.quiz_submit(text, int) to service_role;
