alter table public.calendar_events
  drop constraint if exists calendar_events_event_reminder_lead_minutes_check;

alter table public.calendar_events
  add constraint calendar_events_event_reminder_lead_minutes_check
  check (event_reminder_lead_minutes between 0 and 240);
