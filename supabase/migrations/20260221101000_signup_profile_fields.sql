alter table public.profiles
add column if not exists full_name text,
add column if not exists household_name text,
add column if not exists timezone text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, household_name, timezone)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'household_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'timezone', '')), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    household_name = coalesce(excluded.household_name, public.profiles.household_name),
    timezone = coalesce(excluded.timezone, public.profiles.timezone);

  insert into public.subscriptions (user_id, status)
  values (new.id, 'inactive')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

update public.profiles p
set
  full_name = coalesce(
    p.full_name,
    nullif(trim(coalesce(u.raw_user_meta_data->>'full_name', '')), '')
  ),
  household_name = coalesce(
    p.household_name,
    nullif(trim(coalesce(u.raw_user_meta_data->>'household_name', '')), '')
  ),
  timezone = coalesce(
    p.timezone,
    nullif(trim(coalesce(u.raw_user_meta_data->>'timezone', '')), '')
  )
from auth.users u
where p.id = u.id;
