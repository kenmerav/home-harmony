do $$
declare
  target_user_id uuid;
  target_phone text;
  target_timezone text;
begin
  select u.id
    into target_user_id
  from auth.users u
  where lower(u.email) = lower('kroberts035@gmail.com')
  limit 1;

  if target_user_id is null then
    return;
  end if;

  select
    coalesce(
      nullif(sp.phone_e164, ''),
      case
        when p.phone ~ '^\+[1-9][0-9]{7,14}$' then p.phone
        when regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') ~ '^[0-9]{10}$'
          then '+1' || regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
        when regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') ~ '^1[0-9]{10}$'
          then '+' || regexp_replace(coalesce(p.phone, ''), '\D', '', 'g')
        else null
      end
    ),
    coalesce(nullif(sp.timezone, ''), nullif(p.timezone, ''), 'America/Phoenix')
    into target_phone, target_timezone
  from public.profiles p
  left join public.sms_preferences sp on sp.user_id = p.id
  where p.id = target_user_id;

  insert into public.sms_preferences (
    user_id,
    enabled,
    phone_e164,
    timezone,
    daily_chore_digest_enabled,
    daily_chore_digest_time
  )
  values (
    target_user_id,
    true,
    target_phone,
    target_timezone,
    true,
    '08:00'
  )
  on conflict (user_id) do update
  set
    enabled = true,
    phone_e164 = coalesce(public.sms_preferences.phone_e164, excluded.phone_e164),
    timezone = coalesce(nullif(public.sms_preferences.timezone, ''), excluded.timezone),
    daily_chore_digest_enabled = true,
    daily_chore_digest_time = '08:00',
    updated_at = now();
end $$;
