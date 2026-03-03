-- Free tools conversion analytics (cross-device)

create table if not exists public.free_tools_cta_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('impression', 'primary_click', 'lead_capture')),
  tool_slug text not null,
  variant text not null check (variant in ('a', 'b')),
  occurred_at timestamptz not null,
  dedupe_key text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create table if not exists public.free_tools_lead_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tool_slug text not null,
  variant text not null check (variant in ('a', 'b')),
  email text not null,
  captured_at timestamptz not null,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists idx_free_tools_cta_events_user_slug_time
  on public.free_tools_cta_events(user_id, tool_slug, occurred_at desc);

create index if not exists idx_free_tools_cta_events_user_event
  on public.free_tools_cta_events(user_id, event_type);

create index if not exists idx_free_tools_lead_captures_user_slug_time
  on public.free_tools_lead_captures(user_id, tool_slug, captured_at desc);

alter table public.free_tools_cta_events enable row level security;
alter table public.free_tools_lead_captures enable row level security;

drop policy if exists "Users can view own free tools CTA events" on public.free_tools_cta_events;
create policy "Users can view own free tools CTA events"
on public.free_tools_cta_events
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own free tools CTA events" on public.free_tools_cta_events;
create policy "Users can insert own free tools CTA events"
on public.free_tools_cta_events
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can delete own free tools CTA events" on public.free_tools_cta_events;
create policy "Users can delete own free tools CTA events"
on public.free_tools_cta_events
for delete
using (user_id = auth.uid());

drop policy if exists "Users can view own free tools lead captures" on public.free_tools_lead_captures;
create policy "Users can view own free tools lead captures"
on public.free_tools_lead_captures
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own free tools lead captures" on public.free_tools_lead_captures;
create policy "Users can insert own free tools lead captures"
on public.free_tools_lead_captures
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can delete own free tools lead captures" on public.free_tools_lead_captures;
create policy "Users can delete own free tools lead captures"
on public.free_tools_lead_captures
for delete
using (user_id = auth.uid());
