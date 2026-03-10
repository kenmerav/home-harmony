-- Persist workout tracker state per authenticated user for cross-device login sync.

create table if not exists public.workout_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_state enable row level security;

drop policy if exists "Users can view own workout_state" on public.workout_state;
create policy "Users can view own workout_state"
on public.workout_state
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own workout_state" on public.workout_state;
create policy "Users can insert own workout_state"
on public.workout_state
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can update own workout_state" on public.workout_state;
create policy "Users can update own workout_state"
on public.workout_state
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can delete own workout_state" on public.workout_state;
create policy "Users can delete own workout_state"
on public.workout_state
for delete
using (user_id = auth.uid());

drop trigger if exists update_workout_state_updated_at on public.workout_state;
create trigger update_workout_state_updated_at
before update on public.workout_state
for each row execute function public.update_timestamp();
