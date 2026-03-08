alter table public.sms_preferences
  add column if not exists module_recipients jsonb not null default '{}'::jsonb;

comment on column public.sms_preferences.module_recipients is
  'Map of reminder module -> array of E.164 phone numbers for SMS recipients.';
