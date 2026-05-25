alter table public.sms_preferences
  add column if not exists daily_chore_digest_enabled boolean not null default false,
  add column if not exists daily_chore_digest_time time not null default '08:00';

comment on column public.sms_preferences.daily_chore_digest_enabled is
  'When true, send a daily SMS listing incomplete kids daily chores.';

comment on column public.sms_preferences.daily_chore_digest_time is
  'Local time for the incomplete daily chores SMS.';
