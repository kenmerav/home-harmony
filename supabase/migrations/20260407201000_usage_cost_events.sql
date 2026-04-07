create table if not exists public.usage_cost_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  category text not null check (category in ('sms', 'ai', 'email')),
  provider text not null,
  meter text not null,
  estimated_cost_usd numeric(12,6) not null default 0,
  quantity integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_usage_cost_events_created_at
  on public.usage_cost_events(created_at desc);

create index if not exists idx_usage_cost_events_user_created_at
  on public.usage_cost_events(user_id, created_at desc);

create index if not exists idx_usage_cost_events_category_created_at
  on public.usage_cost_events(category, created_at desc);

alter table public.usage_cost_events enable row level security;

drop policy if exists "Users can view own usage cost events" on public.usage_cost_events;
create policy "Users can view own usage cost events"
on public.usage_cost_events
for select
using (user_id = auth.uid());
