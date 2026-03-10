alter table public.calendar_events
  add column if not exists event_reminder_enabled boolean not null default false,
  add column if not exists event_reminder_lead_minutes integer not null default 30;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_event_reminder_lead_minutes_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_event_reminder_lead_minutes_check
      check (event_reminder_lead_minutes between 5 and 240);
  end if;
end $$;

-- Preserve prior behavior: events that only had a non-commute reminder remain start-time reminders.
update public.calendar_events
set
  event_reminder_enabled = true,
  event_reminder_lead_minutes = coalesce(leave_reminder_lead_minutes, 30)
where source = 'manual'
  and leave_reminder_enabled = true
  and event_reminder_enabled = false
  and (
    coalesce(trim(travel_from_address), '') = ''
    or coalesce(trim(location_text), '') = ''
  );
