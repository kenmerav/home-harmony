create table if not exists public.onboarding_email_sends (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  template_key text not null check (
    template_key in (
      'plan_meals',
      'review_grocery',
      'invite_household',
      'set_reminders',
      'calendar_setup',
      'power_up'
    )
  ),
  sent_at timestamptz not null default now(),
  trigger_reason text,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists idx_onboarding_email_sends_user_template
  on public.onboarding_email_sends(user_id, template_key);

create index if not exists idx_onboarding_email_sends_sent_at
  on public.onboarding_email_sends(sent_at desc);

create index if not exists idx_onboarding_email_sends_user_sent_at
  on public.onboarding_email_sends(user_id, sent_at desc);

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'onboarding_email_drip_hourly'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
exception
  when undefined_table then
    null;
end;
$$;

select
  cron.schedule(
    'onboarding_email_drip_hourly',
    '15 * * * *',
    $job$
    select
      net.http_post(
        url := 'https://amhnbyimvgykklzrenky.supabase.co/functions/v1/onboarding-email-drip',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-scheduler-source', 'supabase-cron'
        ),
        body := '{}'::jsonb
      ) as request_id;
    $job$
  );
