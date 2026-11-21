-- Optional double points per question (Kahoot's 2000-point questions).
alter table public.quiz_questions
  add column if not exists double_points boolean not null default false;

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
  -- Correct: 500-1000 points (faster = more), doubled on double-points questions.
  pts := case when is_correct
              then round(1000 * (1 - least(greatest(elapsed, 0), q.seconds) / (2.0 * q.seconds)))::int
                   * case when q.double_points then 2 else 1 end
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
