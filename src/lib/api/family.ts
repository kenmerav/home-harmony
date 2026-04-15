import { supabase } from '@/integrations/supabase/client';

export interface HouseholdMember {
  id: string;
  role: 'owner' | 'spouse' | 'kid';
  status: 'active' | 'invited' | 'removed';
  created_at: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export interface HouseholdInvite {
  id: string;
  email: string;
  role: 'spouse' | 'kid';
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
}

export interface HouseholdDashboard {
  household: { id: string; name: string } | null;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForOwnProfileReady(maxAttempts = 8): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id;
  if (!userId) return;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data?.id === userId) {
      return;
    }

    await delay(350 * (attempt + 1));
  }
}

export async function createOrGetHousehold(householdName?: string) {
  const { data, error } = await supabase.rpc('create_or_get_household', {
    household_name: householdName || null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getHouseholdDashboard(): Promise<HouseholdDashboard> {
  const { data, error } = await supabase.rpc('get_household_dashboard');
  if (error) throw new Error(error.message);
  return (data || { household: null, members: [], invites: [] }) as HouseholdDashboard;
}

export async function inviteHouseholdMember(email: string, role: 'spouse' | 'kid') {
  const { data, error } = await supabase.rpc('invite_household_member', {
    invite_email: email,
    invite_role: role,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function acceptHouseholdInvite(token: string) {
  await waitForOwnProfileReady();

  const attemptAccept = async () =>
    supabase.rpc('accept_household_invite', {
      invite_token: token,
    });

  let { data, error } = await attemptAccept();
  if (
    error &&
    /household_members_user_id_fkey|violates foreign key constraint|still finishing setup/i.test(
      error.message || '',
    )
  ) {
    await delay(1200);
    await waitForOwnProfileReady(4);
    ({ data, error } = await attemptAccept());
  }

  if (
    error &&
    /household_members_user_id_fkey|violates foreign key constraint|still finishing setup/i.test(
      error.message || '',
    )
  ) {
    await delay(1800);
    await waitForOwnProfileReady(6);
    ({ data, error } = await attemptAccept());
  }

  if (error) throw new Error(error.message);
  return data as string;
}

export async function revokeHouseholdInvite(inviteId: string) {
  const { data, error } = await supabase.rpc('revoke_household_invite', {
    invite_id: inviteId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function removeHouseholdMember(targetUserId: string) {
  const { data, error } = await supabase.rpc('remove_household_member', {
    target_user_id: targetUserId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
