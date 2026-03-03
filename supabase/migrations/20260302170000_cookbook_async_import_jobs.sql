-- Async cookbook import queue so uploads can process in the background.

create table if not exists public.cookbook_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  page_count int,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  progress_current int not null default 0,
  progress_total int not null default 0,
  recipes_found int not null default 0,
  recipes_saved int not null default 0,
  error_message text,
  pdf_text text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cookbook_import_jobs_user_created
  on public.cookbook_import_jobs(user_id, created_at desc);
create index if not exists idx_cookbook_import_jobs_status
  on public.cookbook_import_jobs(status, created_at asc);

alter table public.cookbook_import_jobs enable row level security;

drop policy if exists "Users can view own cookbook import jobs" on public.cookbook_import_jobs;
create policy "Users can view own cookbook import jobs"
on public.cookbook_import_jobs
for select
using (user_id = auth.uid());

drop policy if exists "Users can insert own cookbook import jobs" on public.cookbook_import_jobs;
create policy "Users can insert own cookbook import jobs"
on public.cookbook_import_jobs
for insert
with check (user_id = auth.uid());

drop trigger if exists update_cookbook_import_jobs_updated_at on public.cookbook_import_jobs;
create trigger update_cookbook_import_jobs_updated_at
before update on public.cookbook_import_jobs
for each row execute function public.update_timestamp();
