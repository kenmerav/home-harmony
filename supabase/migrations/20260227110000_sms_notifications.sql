-- SMS notification preferences + delivery logging for Twilio updates

create table if not exists public.sms_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  phone_e164 text,
  timezone text not null default 'America/New_York',
  morning_digest_enabled boolean not null default true,
  morning_digest_time time not null default '07:00',
  night_before_enabled boolean not null default true,
  night_before_time time not null default '20:00',
  event_reminders_enabled boolean not null default true,
  reminder_offsets_minutes int[] not null default '{60,30}',
  preferred_dinner_time time not null default '18:00',
  include_modules text[] not null default '{"meals","manual"}',
  quiet_hours_start time,
  quiet_hours_end time,
  last_opt_in_at timestamptz,
  last_opt_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    phone_e164 is null
    or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  )
);

create table if not exists public.sms_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  dedupe_key text not null unique,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_sid text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  module text not null default 'manual',
  source text not null default 'manual',
  related_id text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sms_log_user_created on public.sms_notification_log(user_id, created_at desc);
create index if not exists idx_sms_log_scheduled_for on public.sms_notification_log(scheduled_for);
create index if not exists idx_calendar_events_owner_starts on public.calendar_events(owner_id, starts_at);
create index if not exists idx_calendar_events_owner_deleted on public.calendar_events(owner_id, is_deleted);

alter table public.sms_preferences enable row level security;
alter table public.sms_notification_log enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists "Users can view own sms preferences" on public.sms_preferences;
create policy "Users can view own sms preferences"
on public.sms_preferences
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own sms preferences" on public.sms_preferences;
create policy "Users can insert own sms preferences"
on public.sms_preferences
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own sms preferences" on public.sms_preferences;
create policy "Users can update own sms preferences"
on public.sms_preferences
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can view own sms log" on public.sms_notification_log;
create policy "Users can view own sms log"
on public.sms_notification_log
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own sms log" on public.sms_notification_log;
create policy "Users can insert own sms log"
on public.sms_notification_log
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can view own calendar events" on public.calendar_events;
create policy "Users can view own calendar events"
on public.calendar_events
for select
using (owner_id = auth.uid());

drop policy if exists "Users can insert own calendar events" on public.calendar_events;
create policy "Users can insert own calendar events"
on public.calendar_events
for insert
with check (owner_id = auth.uid());

drop policy if exists "Users can update own calendar events" on public.calendar_events;
create policy "Users can update own calendar events"
on public.calendar_events
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Users can delete own calendar events" on public.calendar_events;
create policy "Users can delete own calendar events"
on public.calendar_events
for delete
using (owner_id = auth.uid());

drop trigger if exists update_sms_preferences_updated_at on public.sms_preferences;
create trigger update_sms_preferences_updated_at
before update on public.sms_preferences
for each row execute function public.update_timestamp();

drop trigger if exists update_calendar_events_updated_at on public.calendar_events;
create trigger update_calendar_events_updated_at
before update on public.calendar_events
for each row execute function public.update_timestamp();
