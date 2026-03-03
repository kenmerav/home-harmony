-- Growth instrumentation + referrals foundation

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_events (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid references auth.users(id) on delete set null,
  referred_email text,
  status text not null default 'signed_up' check (status in ('clicked', 'signed_up', 'subscribed')),
  source text,
  created_at timestamptz not null default now(),
  unique (referrer_user_id, referred_user_id)
);

create table if not exists public.growth_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null,
  dedupe_key text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table if not exists public.lifecycle_flow_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day0_enabled boolean not null default true,
  day2_enabled boolean not null default true,
  day5_enabled boolean not null default true,
  day10_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  email_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_referral_codes_code on public.referral_codes(code);
create index if not exists idx_referral_events_referrer_created on public.referral_events(referrer_user_id, created_at desc);
create index if not exists idx_growth_events_user_event_time on public.growth_events(user_id, event_type, occurred_at desc);

alter table public.referral_codes enable row level security;
alter table public.referral_events enable row level security;
alter table public.growth_events enable row level security;
alter table public.lifecycle_flow_settings enable row level security;

-- Referral codes

drop policy if exists "Users can view own referral code" on public.referral_codes;
create policy "Users can view own referral code"
on public.referral_codes
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own referral code" on public.referral_codes;
create policy "Users can insert own referral code"
on public.referral_codes
for insert
with check (user_id = auth.uid());

-- Referral events

drop policy if exists "Users can view own referral events" on public.referral_events;
create policy "Users can view own referral events"
on public.referral_events
for select
using (referrer_user_id = auth.uid() or referred_user_id = auth.uid());

drop policy if exists "Users can insert own referral events" on public.referral_events;
create policy "Users can insert own referral events"
on public.referral_events
for insert
with check (referrer_user_id = auth.uid() or referred_user_id = auth.uid());

-- Growth events

drop policy if exists "Users can view own growth events" on public.growth_events;
create policy "Users can view own growth events"
on public.growth_events
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own growth events" on public.growth_events;
create policy "Users can insert own growth events"
on public.growth_events
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can delete own growth events" on public.growth_events;
create policy "Users can delete own growth events"
on public.growth_events
for delete
using (user_id = auth.uid());

-- Lifecycle settings

drop policy if exists "Users can view own lifecycle settings" on public.lifecycle_flow_settings;
create policy "Users can view own lifecycle settings"
on public.lifecycle_flow_settings
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own lifecycle settings" on public.lifecycle_flow_settings;
create policy "Users can insert own lifecycle settings"
on public.lifecycle_flow_settings
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own lifecycle settings" on public.lifecycle_flow_settings;
create policy "Users can update own lifecycle settings"
on public.lifecycle_flow_settings
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.get_or_create_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select code into v_code
  from public.referral_codes
  where user_id = v_user_id;

  if v_code is not null then
    return v_code;
  end if;

  loop
    v_code := lower(substr(md5(gen_random_uuid()::text), 1, 10));
    begin
      insert into public.referral_codes (user_id, code)
      values (v_user_id, v_code);
      exit;
    exception when unique_violation then
      -- retry
      null;
    end;
  end loop;

  return v_code;
end;
$$;

create or replace function public.claim_referral(ref_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_referrer uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(ref_code), '') = '' then
    return false;
  end if;

  select lower(email) into v_email
  from public.profiles
  where id = v_user_id;

  select user_id into v_referrer
  from public.referral_codes
  where code = lower(trim(ref_code));

  if v_referrer is null or v_referrer = v_user_id then
    return false;
  end if;

  insert into public.referral_events (referrer_user_id, referred_user_id, referred_email, status, source)
  values (v_referrer, v_user_id, v_email, 'signed_up', 'ref_link')
  on conflict (referrer_user_id, referred_user_id)
  do update set
    referred_email = excluded.referred_email,
    status = excluded.status,
    source = excluded.source;

  return true;
end;
$$;

create or replace function public.get_referral_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_signed_up integer := 0;
  v_subscribed integer := 0;
  v_clicked integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select count(*)::int into v_signed_up
  from public.referral_events
  where referrer_user_id = v_user_id
    and status in ('signed_up', 'subscribed');

  select count(*)::int into v_subscribed
  from public.referral_events
  where referrer_user_id = v_user_id
    and status = 'subscribed';

  select count(*)::int into v_clicked
  from public.referral_events
  where referrer_user_id = v_user_id;

  return jsonb_build_object(
    'signedUp', v_signed_up,
    'subscribed', v_subscribed,
    'clicked', v_clicked
  );
end;
$$;

create or replace function public.track_growth_event(
  p_event_type text,
  p_occurred_at timestamptz default now(),
  p_dedupe_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_key text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  v_key := coalesce(nullif(trim(p_dedupe_key), ''), lower(trim(p_event_type)) || '|' || p_occurred_at::text);

  insert into public.growth_events (user_id, event_type, occurred_at, dedupe_key, metadata)
  values (v_user_id, lower(trim(p_event_type)), p_occurred_at, v_key, coalesce(p_metadata, '{}'::jsonb))
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- Keep lifecycle settings timestamp updated

drop trigger if exists update_lifecycle_flow_settings_updated_at on public.lifecycle_flow_settings;
create trigger update_lifecycle_flow_settings_updated_at
before update on public.lifecycle_flow_settings
for each row execute function public.update_timestamp();
