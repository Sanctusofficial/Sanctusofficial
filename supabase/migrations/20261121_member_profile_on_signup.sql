-- Create the member profile when a login is created.
-- With email confirmation on, sign-up returns no session, so the browser cannot
-- write member_profiles itself (RLS needs auth.uid() = id). The sign-up form sends
-- name + matric_number as user metadata and this trigger copies them across.
create or replace function public.create_member_profile_from_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_name text := nullif(btrim(new.raw_user_meta_data ->> 'name'), '');
  member_matric text := nullif(upper(regexp_replace(coalesce(new.raw_user_meta_data ->> 'matric_number', ''), '\s+', '', 'g')), '');
begin
  if member_name is null or member_matric is null or new.email is null then
    return new;
  end if;

  begin
    insert into public.member_profiles (id, name, email, matric_number)
    values (new.id, member_name, lower(new.email), member_matric)
    on conflict (id) do nothing;
  exception when unique_violation then
    -- Matric/email already linked to another login: never block sign-up.
    -- The account page reports the clash when this user first signs in.
    null;
  end;

  return new;
end;
$$;

revoke all on function public.create_member_profile_from_signup() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_member_profile on auth.users;
create trigger on_auth_user_created_member_profile
  after insert on auth.users
  for each row execute function public.create_member_profile_from_signup();
