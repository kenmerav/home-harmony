alter table public.sms_preferences
add column if not exists dinner_times_by_day jsonb not null default '{}'::jsonb;
