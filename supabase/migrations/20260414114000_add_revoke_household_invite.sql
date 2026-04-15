create or replace function public.revoke_household_invite(invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_invite_id uuid;
  v_can_manage boolean;
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

  select exists (
    select 1
    from public.household_members m
    where m.household_id = v_household_id
      and m.user_id = v_user_id
      and m.status = 'active'
      and m.role in ('owner', 'spouse')
  ) into v_can_manage;

  if not v_can_manage then
    raise exception 'Only active owner or spouse members can manage invites';
  end if;

  update public.household_invites
  set status = 'revoked'
  where id = invite_id
    and household_id = v_household_id
    and status = 'pending'
  returning id into v_invite_id;

  if v_invite_id is null then
    raise exception 'Pending invite not found';
  end if;

  return v_invite_id;
end;
$$;

grant execute on function public.revoke_household_invite(uuid) to authenticated;
