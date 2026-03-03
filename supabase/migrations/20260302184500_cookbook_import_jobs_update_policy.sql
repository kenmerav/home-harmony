-- Allow users to cancel/update their own cookbook import jobs.

drop policy if exists "Users can update own cookbook import jobs" on public.cookbook_import_jobs;
create policy "Users can update own cookbook import jobs"
on public.cookbook_import_jobs
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
