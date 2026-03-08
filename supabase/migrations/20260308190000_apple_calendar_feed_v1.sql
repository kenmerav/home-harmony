create table if not exists public.calendar_feed_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  feed_token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(feed_token) >= 32)
);

create index if not exists idx_calendar_feed_tokens_token on public.calendar_feed_tokens(feed_token);

alter table public.calendar_feed_tokens enable row level security;

drop policy if exists "Users can view own calendar feed token" on public.calendar_feed_tokens;
create policy "Users can view own calendar feed token"
on public.calendar_feed_tokens
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own calendar feed token" on public.calendar_feed_tokens;
create policy "Users can insert own calendar feed token"
on public.calendar_feed_tokens
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own calendar feed token" on public.calendar_feed_tokens;
create policy "Users can update own calendar feed token"
on public.calendar_feed_tokens
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

alter table public.calendar_events
  add column if not exists calendar_layer text not null default 'family',
  add column if not exists timezone_name text not null default 'UTC',
  add column if not exists recurrence_rule text,
  add column if not exists deleted_at timestamptz;

update public.calendar_events
set calendar_layer = case
  when module = 'meals' then 'meals'
  when module = 'chores' then 'chores'
  when module = 'tasks' then 'kids'
  when module = 'workouts' then 'kids'
  when source = 'reminder' then 'deliveries'
  else 'family'
end
where calendar_layer is null
   or trim(calendar_layer) = ''
   or calendar_layer = 'family';

update public.calendar_events
set deleted_at = coalesce(deleted_at, updated_at, now())
where is_deleted = true
  and deleted_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_calendar_layer_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_calendar_layer_check
      check (
        calendar_layer in (
          'family',
          'meals',
          'kids',
          'chores',
          'deliveries',
          'manual',
          'tasks',
          'workouts',
          'reminders'
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_timezone_name_not_blank'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_timezone_name_not_blank
      check (trim(timezone_name) <> '');
  end if;
end $$;

create index if not exists idx_calendar_events_owner_layer_starts
  on public.calendar_events(owner_id, calendar_layer, starts_at)
  where is_deleted = false;

drop trigger if exists update_calendar_feed_tokens_updated_at on public.calendar_feed_tokens;
create trigger update_calendar_feed_tokens_updated_at
before update on public.calendar_feed_tokens
for each row execute function public.update_timestamp();
