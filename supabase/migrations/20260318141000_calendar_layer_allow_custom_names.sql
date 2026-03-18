alter table public.calendar_events
  drop constraint if exists calendar_events_calendar_layer_check;

alter table public.calendar_events
  add constraint calendar_events_calendar_layer_not_blank
  check (trim(calendar_layer) <> '');
