create or replace function public.remove_household_member(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_actor_role text;
  v_target_role text;
  v_removed_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select household_id into v_household_id
  from public.profiles
  where id = v_user_id;

  if v_household_id is null then
    raise exception 'No household found';
  end if;

  select role into v_actor_role
  from public.household_members
  where household_id = v_household_id
    and user_id = v_user_id
    and status = 'active';

  if v_actor_role not in ('owner', 'spouse') then
    raise exception 'Only active owner or spouse members can remove members';
  end if;

  if target_user_id = v_user_id then
    raise exception 'You cannot remove yourself from the household here';
  end if;

  select role into v_target_role
  from public.household_members
  where household_id = v_household_id
    and user_id = target_user_id
    and status = 'active';

  if v_target_role is null then
    raise exception 'Active household member not found';
  end if;

  if v_target_role = 'owner' then
    raise exception 'Owner cannot be removed';
  end if;

  update public.household_members
  set status = 'removed'
  where household_id = v_household_id
    and user_id = target_user_id
    and status = 'active'
  returning user_id into v_removed_user_id;

  if v_removed_user_id is null then
    raise exception 'Could not remove household member';
  end if;

  update public.profiles
  set household_id = null
  where id = v_removed_user_id
    and household_id = v_household_id;

  return v_removed_user_id;
end;
$$;

grant execute on function public.remove_household_member(uuid) to authenticated;
