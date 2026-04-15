create or replace function public.accept_household_invite(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(trim(coalesce(auth.jwt()->>'email', '')));
  v_household_id uuid;
  v_invite_id uuid;
  v_role text;
  v_user_exists boolean := false;
  v_attempt integer := 0;
  v_full_name text;
  v_household_name text;
  v_timezone text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_email = '' then
    raise exception 'Authenticated email is required';
  end if;

  while v_attempt < 12 loop
    select exists(
      select 1
      from auth.users
      where id = v_user_id
    ) into v_user_exists;

    exit when v_user_exists;

    perform pg_sleep(0.35);
    v_attempt := v_attempt + 1;
  end loop;

  if not v_user_exists then
    raise exception 'Account is still finishing setup. Please try again in a moment.';
  end if;

  select
    nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(u.raw_user_meta_data->>'household_name', '')), ''),
    nullif(trim(coalesce(u.raw_user_meta_data->>'timezone', '')), '')
  into v_full_name, v_household_name, v_timezone
  from auth.users u
  where u.id = v_user_id;

  insert into public.profiles (id, email, full_name, household_name, timezone)
  values (v_user_id, v_email, v_full_name, v_household_name, v_timezone)
  on conflict (id) do update
    set email = coalesce(excluded.email, public.profiles.email),
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        household_name = coalesce(excluded.household_name, public.profiles.household_name),
        timezone = coalesce(excluded.timezone, public.profiles.timezone);

  insert into public.subscriptions (user_id, status)
  values (v_user_id, 'inactive')
  on conflict (user_id) do nothing;

  select id, household_id, role
  into v_invite_id, v_household_id, v_role
  from public.household_invites
  where token = invite_token
    and status = 'pending'
    and expires_at > now()
    and lower(email) = v_email
  limit 1;

  if v_invite_id is null then
    raise exception 'Invite is invalid, expired, or for a different email';
  end if;

  insert into public.household_members (household_id, user_id, role, status)
  values (v_household_id, v_user_id, v_role, 'active')
  on conflict (household_id, user_id)
  do update set role = excluded.role, status = 'active';

  update public.profiles
  set household_id = v_household_id
  where id = v_user_id;

  update public.household_invites
  set status = 'accepted',
      accepted_at = now()
  where id = v_invite_id;

  return v_household_id;
end;
$$;
