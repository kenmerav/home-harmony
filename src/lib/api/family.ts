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
  const { data, error } = await supabase.rpc('accept_household_invite', {
    invite_token: token,
  });
  if (error) throw new Error(error.message);
  return data as string;
}
