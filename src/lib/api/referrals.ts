import { supabase } from '@/integrations/supabase/client';

export interface ReferralStats {
  clicked: number;
  signedUp: number;
  subscribed: number;
}

export async function getOrCreateReferralCode(): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_referral_code');
  if (error) throw new Error(error.message);
  return data as string;
}

export async function claimReferral(code: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('claim_referral', { ref_code: code });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function getReferralStats(): Promise<ReferralStats> {
  const { data, error } = await supabase.rpc('get_referral_stats');
  if (error) throw new Error(error.message);
  const parsed = (data || {}) as Partial<ReferralStats>;
  return {
    clicked: Number(parsed.clicked || 0),
    signedUp: Number(parsed.signedUp || 0),
    subscribed: Number(parsed.subscribed || 0),
  };
}

export async function listRecentReferrals(limit = 10): Promise<Array<{ id: string; status: string; created_at: string; referred_email: string | null }>> {
  const { data, error } = await supabase
    .from('referral_events')
    .select('id,status,created_at,referred_email')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as Array<{ id: string; status: string; created_at: string; referred_email: string | null }>;
}
