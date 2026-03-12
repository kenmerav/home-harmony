alter table public.sms_preferences
  add column if not exists grocery_reminder_enabled boolean not null default true,
  add column if not exists grocery_reminder_day text not null default 'saturday',
  add column if not exists grocery_reminder_time time not null default '20:00';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sms_preferences_grocery_reminder_day_check'
  ) then
    alter table public.sms_preferences
      add constraint sms_preferences_grocery_reminder_day_check
      check (
        grocery_reminder_day in (
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday'
        )
      );
  end if;
end $$;
