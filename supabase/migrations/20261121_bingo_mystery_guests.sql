-- Mystery-guest bingo: players can't choose who fills their card.
-- Each of the 8 squares on a 3x3 card (centre free) draws a random checked-in
-- player, preferring people outside your department + admission year and people
-- who have been assigned to fewer others. The square only counts when you scan
-- THAT person's code. Finding each other counts for both players.

alter table public.bingo_players
  add column if not exists clue_food text,
  add column if not exists clue_fact text,
  add column if not exists skips_left smallint not null default 3,
  add column if not exists skipped uuid[] not null default '{}';

create table if not exists public.bingo_targets (
  registration_id uuid not null references public.bingo_players(registration_id) on delete cascade,
  slot smallint not null check (slot between 0 and 8 and slot <> 4),
  target_registration_id uuid not null references public.registrations(id) on delete cascade,
  icebreaker smallint not null,
  assigned_at timestamptz not null default now(),
  met_at timestamptz,
  primary key (registration_id, slot),
  unique (registration_id, target_registration_id)
);
alter table public.bingo_targets enable row level security;

drop function if exists public.bingo_join(text, text, int);
drop function if exists public.bingo_mark(text, int, text);
drop function if exists public.bingo_state(text);

create or replace function public.bingo_line_count9(met smallint[])
returns smallint
language sql
immutable
set search_path = ''
as $$
  select count(*)::smallint
  from (values (array[0,1,2]), (array[3,4,5]), (array[6,7,8]),
               (array[0,3,6]), (array[1,4,7]), (array[2,5,8]),
               (array[0,4,8]), (array[2,4,6])) as l(line)
  where l.line <@ (coalesce(met, '{}')::int[] || array[4]);
$$;

create or replace function public.bingo_recompute(p_reg uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  met smallint[];
  n_met smallint;
  n_lines smallint;
begin
  select array_agg(slot) into met from public.bingo_targets where registration_id = p_reg and met_at is not null;
  n_met := coalesce(cardinality(met), 0);
  n_lines := public.bingo_line_count9(met);
  update public.bingo_players set
    squares = n_met,
    lines = n_lines,
    first_bingo_at = coalesce(first_bingo_at, case when n_lines > 0 then now() end),
    blackout_at = coalesce(blackout_at, case when n_met >= 8 then now() end),
    updated_at = now()
  where registration_id = p_reg;
end;
$$;

create or replace function public.bingo_join(p_email text, p_matric text, p_food text, p_fact text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  reg record;
  pl public.bingo_players;
  new_code text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  clean_name text;
  food text := nullif(left(btrim(coalesce(p_food, '')), 60), '');
  fact text := nullif(left(btrim(coalesce(p_fact, '')), 80), '');
  i int;
begin
  select r.id, r.name into reg
  from public.registrations r
  where r.event_slug = 'mixer'
    and r.status = 'approved'
    and r.matric_number = upper(regexp_replace(coalesce(p_matric, ''), '\s+', '', 'g'))
    and lower(r.email) = lower(btrim(coalesce(p_email, '')))
  limit 1;
  if reg.id is null then return json_build_object('error', 'not_found'); end if;

  select * into pl from public.bingo_players where registration_id = reg.id;

  -- Already playing (e.g. new phone): same card and code; update clues if given.
  if pl.registration_id is not null and pl.player_token is not null and pl.clue_food is not null then
    update public.bingo_players set
      clue_food = coalesce(food, clue_food),
      clue_fact = coalesce(fact, clue_fact)
    where registration_id = reg.id;
    return json_build_object('token', pl.player_token, 'code', pl.connect_code, 'name', pl.display_name);
  end if;

  if food is null or fact is null then return json_build_object('error', 'need_clues'); end if;

  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.bingo_players where connect_code = new_code);
  end loop;

  clean_name := btrim(regexp_replace(coalesce(reg.name, ''), '\s+', ' ', 'g'));

  insert into public.bingo_players (registration_id, event_slug, display_name, player_token, connect_code,
                                    clue_food, clue_fact, squares, lines, skips_left, skipped)
  values (
    reg.id, 'mixer',
    coalesce(nullif(initcap(split_part(clean_name, ' ', 1)), ''), 'Guest')
      || case when split_part(clean_name, ' ', 2) <> '' then ' ' || upper(left(split_part(clean_name, ' ', 2), 1)) || '.' else '' end,
    encode(extensions.gen_random_bytes(24), 'hex'), new_code, food, fact, 0, 0, 3, '{}'
  )
  on conflict (registration_id) do update set
    player_token = excluded.player_token,
    connect_code = excluded.connect_code,
    clue_food = excluded.clue_food,
    clue_fact = excluded.clue_fact,
    squares = 0, lines = 0, skips_left = 3, skipped = '{}',
    first_bingo_at = null, blackout_at = null, updated_at = now()
  returning * into pl;

  return json_build_object('token', pl.player_token, 'code', pl.connect_code, 'name', pl.display_name);
end;
$$;

create or replace function public.bingo_state(p_token text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  pl public.bingo_players;
  checked timestamptz;
begin
  select * into pl from public.bingo_players where player_token = p_token;
  if pl.registration_id is null then return json_build_object('error', 'not_joined'); end if;
  select checked_in_at into checked from public.registrations where id = pl.registration_id;

  return json_build_object(
    'name', pl.display_name,
    'code', pl.connect_code,
    'squares', pl.squares,
    'lines', pl.lines,
    'skipsLeft', pl.skips_left,
    'checkedIn', checked is not null,
    'slots', coalesce((
      select json_agg(json_build_object(
        'slot', t.slot,
        'name', p.display_name,
        'food', p.clue_food,
        'fact', p.clue_fact,
        'icebreaker', t.icebreaker,
        'met', t.met_at is not null
      ) order by t.slot)
      from public.bingo_targets t
      join public.bingo_players p on p.registration_id = t.target_registration_id
      where t.registration_id = pl.registration_id
    ), '[]'::json)
  );
end;
$$;

-- Assign a mystery guest to an empty square.
create or replace function public.bingo_draw(p_token text, p_slot int, p_icebreakers int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  pl public.bingo_players;
  me record;
  pick uuid;
begin
  select * into pl from public.bingo_players where player_token = p_token for update;
  if pl.registration_id is null then return json_build_object('error', 'not_joined'); end if;
  if p_slot is null or p_slot < 0 or p_slot > 8 or p_slot = 4 then return json_build_object('error', 'bad_square'); end if;

  select checked_in_at, departments, left(matric_number, 2) as yr into me
  from public.registrations where id = pl.registration_id;
  if me.checked_in_at is null then return json_build_object('error', 'you_not_checked_in'); end if;

  if exists (select 1 from public.bingo_targets where registration_id = pl.registration_id and slot = p_slot) then
    return json_build_object('error', 'square_taken');
  end if;

  select p.registration_id into pick
  from public.bingo_players p
  join public.registrations r on r.id = p.registration_id
  where p.event_slug = pl.event_slug
    and p.player_token is not null
    and r.checked_in_at is not null
    and p.registration_id <> pl.registration_id
    and not (p.registration_id = any (pl.skipped))
    and not exists (select 1 from public.bingo_targets t
                    where t.registration_id = pl.registration_id and t.target_registration_id = p.registration_id)
  order by
    (select count(*) from public.bingo_targets t2 where t2.target_registration_id = p.registration_id),
    (r.departments is not distinct from me.departments and left(r.matric_number, 2) = me.yr),
    random()
  limit 1;

  if pick is null then return json_build_object('error', 'no_one_available'); end if;

  insert into public.bingo_targets (registration_id, slot, target_registration_id, icebreaker)
  values (pl.registration_id, p_slot, pick, floor(random() * greatest(p_icebreakers, 1))::smallint);

  return json_build_object('ok', true);
end;
$$;

-- Can't find them? Swap for someone else (limited). If nobody else is free yet,
-- the current guest and the skip are both kept.
create or replace function public.bingo_skip(p_token text, p_slot int, p_icebreakers int)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  pl public.bingo_players;
  t public.bingo_targets;
  res json;
begin
  select * into pl from public.bingo_players where player_token = p_token for update;
  if pl.registration_id is null then return json_build_object('error', 'not_joined'); end if;
  select * into t from public.bingo_targets where registration_id = pl.registration_id and slot = p_slot;
  if t.registration_id is null then return json_build_object('error', 'bad_square'); end if;
  if t.met_at is not null then return json_build_object('error', 'already_met'); end if;
  if pl.skips_left <= 0 then return json_build_object('error', 'no_skips'); end if;

  begin
    delete from public.bingo_targets where registration_id = pl.registration_id and slot = p_slot;
    update public.bingo_players set
      skips_left = skips_left - 1,
      skipped = array_append(skipped, t.target_registration_id)
    where registration_id = pl.registration_id;
    res := public.bingo_draw(p_token, p_slot, p_icebreakers);
    if res->>'error' is not null then
      raise exception using errcode = 'P0B01';
    end if;
    return res;
  exception when sqlstate 'P0B01' then
    return json_build_object('error', 'no_one_available');
  end;
end;
$$;

-- Found them: scan their code. Must be the exact person assigned to that square.
create or replace function public.bingo_mark(p_token text, p_slot int, p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  pl public.bingo_players;
  t public.bingo_targets;
  target public.bingo_players;
  scanned text := upper(regexp_replace(regexp_replace(coalesce(p_code, ''), '^.*:', ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into pl from public.bingo_players where player_token = p_token for update;
  if pl.registration_id is null then return json_build_object('error', 'not_joined'); end if;
  select * into t from public.bingo_targets where registration_id = pl.registration_id and slot = p_slot;
  if t.registration_id is null then return json_build_object('error', 'bad_square'); end if;
  if t.met_at is not null then return json_build_object('error', 'already_met'); end if;

  select * into target from public.bingo_players where registration_id = t.target_registration_id;
  if scanned = pl.connect_code then return json_build_object('error', 'self'); end if;
  if scanned <> target.connect_code then
    return json_build_object('error', 'wrong_person', 'name', target.display_name);
  end if;

  update public.bingo_targets set met_at = now()
  where registration_id = pl.registration_id and slot = p_slot;
  perform public.bingo_recompute(pl.registration_id);

  -- If you were on their card too, it counts for them as well.
  update public.bingo_targets set met_at = now()
  where registration_id = t.target_registration_id
    and target_registration_id = pl.registration_id
    and met_at is null;
  if found then perform public.bingo_recompute(t.target_registration_id); end if;

  return json_build_object('ok', true, 'name', target.display_name);
end;
$$;

revoke all on function public.bingo_recompute(uuid) from public, anon, authenticated;
revoke all on function public.bingo_join(text, text, text, text) from public, anon, authenticated;
revoke all on function public.bingo_state(text) from public, anon, authenticated;
revoke all on function public.bingo_draw(text, int, int) from public, anon, authenticated;
revoke all on function public.bingo_skip(text, int, int) from public, anon, authenticated;
revoke all on function public.bingo_mark(text, int, text) from public, anon, authenticated;
grant execute on function public.bingo_join(text, text, text, text) to service_role;
grant execute on function public.bingo_state(text) to service_role;
grant execute on function public.bingo_draw(text, int, int) to service_role;
grant execute on function public.bingo_skip(text, int, int) to service_role;
grant execute on function public.bingo_mark(text, int, text) to service_role;

-- Fresh start for the new game (only test/early rows exist).
delete from public.bingo_marks;
update public.bingo_players set player_token = null, connect_code = null, squares = 0, lines = 0,
  first_bingo_at = null, blackout_at = null;
