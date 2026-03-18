do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid
    from cron.job
    where jobname = 'sms_dispatch_every_minute'
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
    'sms_dispatch_every_minute',
    '* * * * *',
    $job$
    select
      net.http_post(
        url := 'https://amhnbyimvgykklzrenky.supabase.co/functions/v1/sms-dispatch',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-scheduler-source', 'supabase-cron'
        ),
        body := '{}'::jsonb
      ) as request_id;
    $job$
  );
