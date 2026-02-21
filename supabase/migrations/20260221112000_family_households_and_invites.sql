create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'spouse', 'kid')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  role text not null check (role in ('spouse', 'kid')),
  token text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists household_id uuid references public.households(id) on delete set null;

create index if not exists idx_household_members_household_id on public.household_members(household_id);
create index if not exists idx_household_members_user_id on public.household_members(user_id);
create index if not exists idx_household_invites_household_id on public.household_invites(household_id);
create index if not exists idx_household_invites_email on public.household_invites(lower(email));
create index if not exists idx_profiles_household_id on public.profiles(household_id);

drop trigger if exists update_households_updated_at on public.households;
create trigger update_households_updated_at
before update on public.households
for each row execute function public.update_timestamp();

drop trigger if exists update_household_members_updated_at on public.household_members;
create trigger update_household_members_updated_at
before update on public.household_members
for each row execute function public.update_timestamp();

drop trigger if exists update_household_invites_updated_at on public.household_invites;
create trigger update_household_invites_updated_at
before update on public.household_invites
for each row execute function public.update_timestamp();

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;

drop policy if exists "Members can view household" on public.households;
create policy "Members can view household"
on public.households
for select
using (
  exists (
    select 1
    from public.household_members m
    where m.household_id = households.id
      and m.user_id = auth.uid()
      and m.status = 'active'
  )
);

drop policy if exists "Owner can update household" on public.households;
create policy "Owner can update household"
on public.households
for update
using (
  exists (
    select 1
    from public.household_members m
    where m.household_id = households.id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = 'owner'
  )
);

drop policy if exists "Members can view household members" on public.household_members;
create policy "Members can view household members"
on public.household_members
for select
using (
  exists (
    select 1
    from public.household_members self
    where self.household_id = household_members.household_id
      and self.user_id = auth.uid()
      and self.status = 'active'
  )
);

drop policy if exists "Members can view own invites" on public.household_invites;
create policy "Members can view own invites"
on public.household_invites
for select
using (
  (
    lower(email) = lower(coalesce(auth.jwt()->>'email', ''))
    and status = 'pending'
  )
  or exists (
    select 1
    from public.household_members m
    where m.household_id = household_invites.household_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role in ('owner', 'spouse')
  )
);

create or replace function public.create_or_get_household(household_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_profile_name text;
  v_name text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select household_id, full_name
  into v_household_id, v_profile_name
  from public.profiles
  where id = v_user_id;

  if v_household_id is not null then
    return v_household_id;
  end if;

  v_name := nullif(trim(coalesce(household_name, '')), '');
  if v_name is null then
    v_name := nullif(trim(coalesce(v_profile_name, '')), '');
  end if;
  if v_name is null then
    v_name := 'Home Harmony Household';
  else
    v_name := v_name || ' Household';
  end if;

  insert into public.households (name, created_by)
  values (v_name, v_user_id)
  returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role, status)
  values (v_household_id, v_user_id, 'owner', 'active')
  on conflict (household_id, user_id) do update
    set role = excluded.role, status = 'active';

  update public.profiles
  set household_id = v_household_id
  where id = v_user_id;

  return v_household_id;
end;
$$;

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

  v_token := encode(gen_random_bytes(24), 'hex');

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
    now() + interval '14 days'
  );

  return v_token;
end;
$$;

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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_email = '' then
    raise exception 'Authenticated email is required';
  end if;

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

create or replace function public.get_household_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_household jsonb;
  v_members jsonb;
  v_invites jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select household_id into v_household_id
  from public.profiles
  where id = v_user_id;

  if v_household_id is null then
    return jsonb_build_object(
      'household', null,
      'members', '[]'::jsonb,
      'invites', '[]'::jsonb
    );
  end if;

  if not exists (
    select 1
    from public.household_members m
    where m.household_id = v_household_id
      and m.user_id = v_user_id
      and m.status = 'active'
  ) then
    raise exception 'Not authorized for household';
  end if;

  select to_jsonb(h)
  into v_household
  from public.households h
  where h.id = v_household_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'role', m.role,
        'status', m.status,
        'created_at', m.created_at,
        'user_id', m.user_id,
        'full_name', p.full_name,
        'email', p.email
      )
      order by m.created_at asc
    ),
    '[]'::jsonb
  )
  into v_members
  from public.household_members m
  left join public.profiles p on p.id = m.user_id
  where m.household_id = v_household_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'email', i.email,
        'role', i.role,
        'status', i.status,
        'expires_at', i.expires_at,
        'created_at', i.created_at
      )
      order by i.created_at desc
    ),
    '[]'::jsonb
  )
  into v_invites
  from public.household_invites i
  where i.household_id = v_household_id
    and i.status = 'pending';

  return jsonb_build_object(
    'household', v_household,
    'members', v_members,
    'invites', v_invites
  );
end;
$$;

grant execute on function public.create_or_get_household(text) to authenticated;
grant execute on function public.invite_household_member(text, text) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
grant execute on function public.get_household_dashboard() to authenticated;
