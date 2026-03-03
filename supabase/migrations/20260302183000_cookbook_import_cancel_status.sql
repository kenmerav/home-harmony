-- Allow cookbook imports to be canceled by the user.

alter table public.cookbook_import_jobs
  drop constraint if exists cookbook_import_jobs_status_check;

alter table public.cookbook_import_jobs
  add constraint cookbook_import_jobs_status_check
  check (status in ('queued', 'processing', 'completed', 'failed', 'canceled'));
