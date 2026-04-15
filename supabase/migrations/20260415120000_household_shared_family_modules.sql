create or replace function public.users_share_active_household(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = target_user_id
    or exists (
    select 1
    from public.household_members viewer
    join public.household_members target
      on target.household_id = viewer.household_id
    where viewer.user_id = auth.uid()
      and viewer.status = 'active'
      and target.user_id = target_user_id
      and target.status = 'active'
  );
$$;

create or replace function public.get_profile_onboarding_settings(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_user_id is null then
    return '{}'::jsonb;
  end if;

  if auth.uid() <> target_user_id and not public.users_share_active_household(target_user_id) then
    raise exception 'Not authorized for profile settings';
  end if;

  select coalesce(onboarding_settings, '{}'::jsonb)
  into v_settings
  from public.profiles
  where id = target_user_id;

  return coalesce(v_settings, '{}'::jsonb);
end;
$$;

create or replace function public.set_profile_onboarding_settings(target_user_id uuid, next_settings jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if target_user_id is null then
    raise exception 'Target user is required';
  end if;

  if auth.uid() <> target_user_id and not public.users_share_active_household(target_user_id) then
    raise exception 'Not authorized for profile settings';
  end if;

  update public.profiles
  set onboarding_settings = coalesce(next_settings, '{}'::jsonb)
  where id = target_user_id;
end;
$$;

grant execute on function public.users_share_active_household(uuid) to authenticated;
grant execute on function public.get_profile_onboarding_settings(uuid) to authenticated;
grant execute on function public.set_profile_onboarding_settings(uuid, jsonb) to authenticated;

drop policy if exists "Users can view own recipes" on public.recipes;
create policy "Household members can view household recipes"
on public.recipes
for select
using (public.users_share_active_household(owner_id));

drop policy if exists "Users can insert own recipes" on public.recipes;
create policy "Household members can insert household recipes"
on public.recipes
for insert
with check (public.users_share_active_household(owner_id));

drop policy if exists "Users can update own recipes" on public.recipes;
create policy "Household members can update household recipes"
on public.recipes
for update
using (public.users_share_active_household(owner_id))
with check (public.users_share_active_household(owner_id));

drop policy if exists "Users can delete own recipes" on public.recipes;
create policy "Household members can delete household recipes"
on public.recipes
for delete
using (public.users_share_active_household(owner_id));

drop policy if exists "Users can view own planned meals" on public.planned_meals;
create policy "Household members can view household planned meals"
on public.planned_meals
for select
using (public.users_share_active_household(owner_id));

drop policy if exists "Users can insert own planned meals" on public.planned_meals;
create policy "Household members can insert household planned meals"
on public.planned_meals
for insert
with check (
  public.users_share_active_household(owner_id)
  and (
    recipe_id is null
    or exists (
      select 1
      from public.recipes r
      where r.id = planned_meals.recipe_id
        and public.users_share_active_household(r.owner_id)
    )
  )
);

drop policy if exists "Users can update own planned meals" on public.planned_meals;
create policy "Household members can update household planned meals"
on public.planned_meals
for update
using (public.users_share_active_household(owner_id))
with check (
  public.users_share_active_household(owner_id)
  and (
    recipe_id is null
    or exists (
      select 1
      from public.recipes r
      where r.id = planned_meals.recipe_id
        and public.users_share_active_household(r.owner_id)
    )
  )
);

drop policy if exists "Users can delete own planned meals" on public.planned_meals;
create policy "Household members can delete household planned meals"
on public.planned_meals
for delete
using (public.users_share_active_household(owner_id));

drop policy if exists "Users can view own calendar events" on public.calendar_events;
create policy "Household members can view household calendar events"
on public.calendar_events
for select
using (public.users_share_active_household(owner_id));

drop policy if exists "Users can insert own calendar events" on public.calendar_events;
create policy "Household members can insert household calendar events"
on public.calendar_events
for insert
with check (public.users_share_active_household(owner_id));

drop policy if exists "Users can update own calendar events" on public.calendar_events;
create policy "Household members can update household calendar events"
on public.calendar_events
for update
using (public.users_share_active_household(owner_id))
with check (public.users_share_active_household(owner_id));

drop policy if exists "Users can delete own calendar events" on public.calendar_events;
create policy "Household members can delete household calendar events"
on public.calendar_events
for delete
using (public.users_share_active_household(owner_id));
