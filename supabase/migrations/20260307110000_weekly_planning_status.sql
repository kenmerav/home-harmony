create table if not exists public.weekly_planning_status (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_of date not null,
  groceries_ordered boolean not null default false,
  groceries_ordered_at timestamptz,
  meals_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_of)
);

create index if not exists idx_weekly_planning_status_user_week
  on public.weekly_planning_status(user_id, week_of);

alter table public.weekly_planning_status enable row level security;

drop policy if exists "Users can view own weekly planning status" on public.weekly_planning_status;
create policy "Users can view own weekly planning status"
on public.weekly_planning_status
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own weekly planning status" on public.weekly_planning_status;
create policy "Users can insert own weekly planning status"
on public.weekly_planning_status
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own weekly planning status" on public.weekly_planning_status;
create policy "Users can update own weekly planning status"
on public.weekly_planning_status
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own weekly planning status" on public.weekly_planning_status;
create policy "Users can delete own weekly planning status"
on public.weekly_planning_status
for delete
using (user_id = auth.uid());

drop trigger if exists update_weekly_planning_status_updated_at on public.weekly_planning_status;
create trigger update_weekly_planning_status_updated_at
before update on public.weekly_planning_status
for each row execute function public.update_timestamp();
