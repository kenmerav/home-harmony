create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  user_name text,
  kind text not null check (kind in ('feature_request', 'bug_report', 'general_feedback')),
  page_path text not null,
  page_url text,
  page_title text,
  subject text,
  details text not null,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_submissions_created_at
  on public.feedback_submissions(created_at desc);

create index if not exists idx_feedback_submissions_user_created_at
  on public.feedback_submissions(user_id, created_at desc);

create index if not exists idx_feedback_submissions_kind_created_at
  on public.feedback_submissions(kind, created_at desc);

alter table public.feedback_submissions enable row level security;

drop policy if exists "Users can insert own feedback submissions" on public.feedback_submissions;
create policy "Users can insert own feedback submissions"
on public.feedback_submissions
for insert
with check (user_id = auth.uid());

drop policy if exists "Users can view own feedback submissions" on public.feedback_submissions;
create policy "Users can view own feedback submissions"
on public.feedback_submissions
for select
using (user_id = auth.uid());
