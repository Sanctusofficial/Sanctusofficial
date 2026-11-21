-- Verified Networking Bingo.
-- A square only counts when the player scans (or types) the personal code of the
-- person they met. Both people must have been checked in at the door, nobody can
-- use themselves, and each person can fill only one square on a card. Scores are
-- computed here from the recorded connections, never sent by the phone.

alter table public.bingo_players
  add column if not exists player_token text unique,
  add column if not exists connect_code text unique,
  add column if not exists card smallint[];

create table if not exists public.bingo_marks (
  registration_id uuid not null references public.bingo_players(registration_id) on delete cascade,
  square smallint not null check (square between 0 and 24 and square <> 12),
  met_registration_id uuid not null references public.registrations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (registration_id, square),
  unique (registration_id, met_registration_id)
);
alter table public.bingo_marks enable row level security;

-- Completed lines on a 5x5 card; square 12 (centre) is always free.
create or replace function public.bingo_line_count(marked smallint[])
returns smallint
language sql
immutable
set search_path = ''
as $$
  select count(*)::smallint
  from (
    select array_agg(sq) as line
    from (
      select r as g, r * 5 + c as sq from generate_series(0, 4) r, generate_series(0, 4) c
      union all
      select 5 + c, r * 5 + c from generate_series(0, 4) r, generate_series(0, 4) c
      union all
      select 10, i * 5 + i from generate_series(0, 4) i
      union all
      select 11, i * 5 + (4 - i) from generate_series(0, 4) i
    ) cells
    group by g
  ) lines
  where lines.line <@ (coalesce(marked, '{}')::int[] || array[12]);
$$;

-- Join (or re-join on another phone) with the email + matric used to register.
create or replace function public.bingo_join(p_email text, p_matric text, p_prompt_count int)
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
  i int;
begin
  select r.id, r.name into reg
  from public.registrations r
  where r.event_slug = 'mixer'
    and r.status = 'approved'
    and r.matric_number = upper(regexp_replace(coalesce(p_matric, ''), '\s+', '', 'g'))
    and lower(r.email) = lower(btrim(coalesce(p_email, '')))
  limit 1;
  if reg.id is null then
    return json_build_object('error', 'not_found');
  end if;

  select * into pl from public.bingo_players where registration_id = reg.id;

  if pl.registration_id is null or pl.player_token is null then
    loop
      new_code := '';
      for i in 1..6 loop
        new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      end loop;
      exit when not exists (select 1 from public.bingo_players where connect_code = new_code);
    end loop;

    clean_name := btrim(regexp_replace(coalesce(reg.name, ''), '\s+', ' ', 'g'));

    insert into public.bingo_players (registration_id, event_slug, display_name, player_token, connect_code, card, squares, lines)
    values (
      reg.id,
      'mixer',
      coalesce(nullif(initcap(split_part(clean_name, ' ', 1)), ''), 'Guest')
        || case when split_part(clean_name, ' ', 2) <> '' then ' ' || upper(left(split_part(clean_name, ' ', 2), 1)) || '.' else '' end,
      encode(extensions.gen_random_bytes(24), 'hex'),
      new_code,
      (select array_agg(n::smallint) from (select n from generate_series(0, p_prompt_count - 1) n order by random() limit 24) s),
      0,
      0
    )
    on conflict (registration_id) do update set
      player_token = excluded.player_token,
      connect_code = excluded.connect_code,
      card = excluded.card,
      squares = 0,
      lines = 0,
      first_bingo_at = null,
      blackout_at = null,
      updated_at = now()
    returning * into pl;
  end if;

  return json_build_object('token', pl.player_token, 'code', pl.connect_code, 'name', pl.display_name);
end;
$$;

-- Everything a player's phone needs to draw their card.
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
  if pl.registration_id is null then
    return json_build_object('error', 'not_joined');
  end if;
  select checked_in_at into checked from public.registrations where id = pl.registration_id;

  return json_build_object(
    'name', pl.display_name,
    'code', pl.connect_code,
    'card', pl.card,
    'squares', pl.squares,
    'lines', pl.lines,
    'checkedIn', checked is not null,
    'marks', coalesce((
      select json_agg(json_build_object('square', m.square, 'name', met.display_name) order by m.square)
      from public.bingo_marks m
      join public.bingo_players met on met.registration_id = m.met_registration_id
      where m.registration_id = pl.registration_id
    ), '[]'::json)
  );
end;
$$;

-- Fill one square with a verified connection. All rules are checked atomically.
create or replace function public.bingo_mark(p_token text, p_square int, p_code text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  pl public.bingo_players;
  met public.bingo_players;
  me_checked timestamptz;
  met_checked timestamptz;
  marked smallint[];
  n_squares smallint;
  n_lines smallint;
begin
  select * into pl from public.bingo_players where player_token = p_token for update;
  if pl.registration_id is null then return json_build_object('error', 'not_joined'); end if;
  if p_square is null or p_square < 0 or p_square > 24 or p_square = 12 then
    return json_build_object('error', 'bad_square');
  end if;

  select checked_in_at into me_checked from public.registrations where id = pl.registration_id;
  if me_checked is null then return json_build_object('error', 'you_not_checked_in'); end if;

  select * into met from public.bingo_players
  where connect_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
    and event_slug = pl.event_slug;
  if met.registration_id is null then return json_build_object('error', 'bad_code'); end if;
  if met.registration_id = pl.registration_id then return json_build_object('error', 'self'); end if;

  select checked_in_at into met_checked from public.registrations where id = met.registration_id;
  if met_checked is null then return json_build_object('error', 'them_not_checked_in', 'name', met.display_name); end if;

  if exists (select 1 from public.bingo_marks where registration_id = pl.registration_id and square = p_square) then
    return json_build_object('error', 'square_taken');
  end if;
  if exists (select 1 from public.bingo_marks where registration_id = pl.registration_id and met_registration_id = met.registration_id) then
    return json_build_object('error', 'already_used', 'name', met.display_name);
  end if;

  insert into public.bingo_marks (registration_id, square, met_registration_id)
  values (pl.registration_id, p_square, met.registration_id);

  select array_agg(square) into marked from public.bingo_marks where registration_id = pl.registration_id;
  n_squares := coalesce(cardinality(marked), 0);
  n_lines := public.bingo_line_count(marked);

  update public.bingo_players set
    squares = n_squares,
    lines = n_lines,
    first_bingo_at = coalesce(first_bingo_at, case when n_lines > 0 then now() end),
    blackout_at = coalesce(blackout_at, case when n_squares >= 24 then now() end),
    updated_at = now()
  where registration_id = pl.registration_id;

  return json_build_object('ok', true, 'name', met.display_name, 'squares', n_squares, 'lines', n_lines);
end;
$$;

revoke all on function public.bingo_join(text, text, int) from public, anon, authenticated;
revoke all on function public.bingo_state(text) from public, anon, authenticated;
revoke all on function public.bingo_mark(text, int, text) from public, anon, authenticated;
grant execute on function public.bingo_join(text, text, int) to service_role;
grant execute on function public.bingo_state(text) to service_role;
grant execute on function public.bingo_mark(text, int, text) to service_role;
