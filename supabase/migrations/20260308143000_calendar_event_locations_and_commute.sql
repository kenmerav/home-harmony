alter table public.sms_preferences
  add column if not exists home_address text;

alter table public.calendar_events
  add column if not exists location_text text,
  add column if not exists travel_from_address text,
  add column if not exists travel_mode text not null default 'driving',
  add column if not exists travel_duration_minutes integer,
  add column if not exists traffic_duration_minutes integer,
  add column if not exists leave_by timestamptz,
  add column if not exists leave_reminder_enabled boolean not null default false,
  add column if not exists leave_reminder_lead_minutes integer not null default 10;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'calendar_events_leave_reminder_lead_minutes_check'
  ) then
    alter table public.calendar_events
      add constraint calendar_events_leave_reminder_lead_minutes_check
      check (leave_reminder_lead_minutes between 5 and 120);
  end if;
end $$;
