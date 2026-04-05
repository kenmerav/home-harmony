create or replace function public.invite_household_member(invite_email text, invite_role text default 'kid')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_role text;
  v_email text;
  v_token text;
  v_can_invite boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_email := lower(trim(coalesce(invite_email, '')));
  if v_email = '' then
    raise exception 'Email is required';
  end if;

  v_role := lower(trim(coalesce(invite_role, 'kid')));
  if v_role not in ('spouse', 'kid') then
    raise exception 'Invite role must be spouse or kid';
  end if;

  select household_id into v_household_id
  from public.profiles
  where id = v_user_id;

  if v_household_id is null then
    v_household_id := public.create_or_get_household();
  end if;

  select exists (
    select 1
    from public.household_members m
    where m.household_id = v_household_id
      and m.user_id = v_user_id
      and m.status = 'active'
      and m.role in ('owner', 'spouse')
  ) into v_can_invite;

  if not v_can_invite then
    raise exception 'Only active owner or spouse members can invite';
  end if;

  update public.household_invites
  set status = 'expired'
  where household_id = v_household_id
    and lower(email) = v_email
    and status = 'pending';

  -- Avoid dependency on pgcrypto's gen_random_bytes() so invites work on
  -- databases where that helper is unavailable.
  v_token :=
    md5(coalesce(v_household_id::text, '') || v_email || clock_timestamp()::text || random()::text)
    || md5(coalesce(v_user_id::text, '') || v_role || clock_timestamp()::text || random()::text);

  insert into public.household_invites (
    household_id,
    email,
    role,
    token,
    invited_by,
    status,
    expires_at
  )
  values (
    v_household_id,
    v_email,
    v_role,
    v_token,
    v_user_id,
    'pending',
    now() + interval '7 days'
  );

  return v_token;
end;
$$;
