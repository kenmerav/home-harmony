alter table public.sms_preferences
  add column if not exists work_address text,
  add column if not exists default_departure_source text not null default 'home';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sms_preferences_default_departure_source_check'
  ) then
    alter table public.sms_preferences
      add constraint sms_preferences_default_departure_source_check
      check (default_departure_source in ('home', 'work', 'custom'));
  end if;
end $$;
