-- SMS delivery is no longer used. Remove every matching cron entry so older
-- deployments cannot continue calling the dispatcher and filling pg_net logs.
do $$
declare
  sms_job record;
begin
  for sms_job in
    select jobid
    from cron.job
    where jobname ilike '%sms%'
       or command ilike '%sms-dispatch%'
  loop
    perform cron.unschedule(sms_job.jobid);
  end loop;
end
$$;
