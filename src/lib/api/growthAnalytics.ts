import { supabase } from '@/integrations/supabase/client';

export interface LifecycleFlowSettings {
  day0Enabled: boolean;
  day2Enabled: boolean;
  day5Enabled: boolean;
  day10Enabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
}

export interface GrowthEventRow {
  id: string;
  eventType: string;
  occurredAt: string;
  dedupeKey: string;
  metadata: Record<string, unknown> | null;
}

export const DEFAULT_LIFECYCLE_SETTINGS: LifecycleFlowSettings = {
  day0Enabled: true,
  day2Enabled: true,
  day5Enabled: true,
  day10Enabled: true,
  smsEnabled: false,
  emailEnabled: true,
};

export async function trackGrowthEvent(
  eventType: string,
  metadata: Record<string, unknown> = {},
  dedupeKey?: string,
  occurredAt?: string,
): Promise<void> {
  const { error } = await supabase.rpc('track_growth_event', {
    p_event_type: eventType,
    p_occurred_at: occurredAt || new Date().toISOString(),
    p_dedupe_key: dedupeKey || null,
    p_metadata: metadata,
  });

  if (error) throw new Error(error.message);
}

export async function trackGrowthEventSafe(
  eventType: string,
  metadata: Record<string, unknown> = {},
  dedupeKey?: string,
  occurredAt?: string,
): Promise<boolean> {
  try {
    await trackGrowthEvent(eventType, metadata, dedupeKey, occurredAt);
    return true;
  } catch {
    return false;
  }
}

export async function fetchRecentGrowthEvents(limit = 100): Promise<GrowthEventRow[]> {
  const { data, error } = await supabase
    .from('growth_events')
    .select('id,event_type,occurred_at,dedupe_key,metadata')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    eventType: row.event_type,
    occurredAt: row.occurred_at,
    dedupeKey: row.dedupe_key,
    metadata: (row.metadata || null) as Record<string, unknown> | null,
  }));
}

export async function fetchGrowthEventCountsByType(days = 30): Promise<Record<string, number>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('growth_events')
    .select('event_type')
    .gte('occurred_at', since)
    .limit(5000);

  if (error) throw new Error(error.message);

  return (data || []).reduce<Record<string, number>>((acc, row) => {
    const key = row.event_type || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export async function loadLifecycleFlowSettings(): Promise<LifecycleFlowSettings> {
  const { data, error } = await supabase
    .from('lifecycle_flow_settings')
    .select('day0_enabled,day2_enabled,day5_enabled,day10_enabled,sms_enabled,email_enabled')
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) return DEFAULT_LIFECYCLE_SETTINGS;

  return {
    day0Enabled: data.day0_enabled,
    day2Enabled: data.day2_enabled,
    day5Enabled: data.day5_enabled,
    day10Enabled: data.day10_enabled,
    smsEnabled: data.sms_enabled,
    emailEnabled: data.email_enabled,
  };
}

export async function saveLifecycleFlowSettings(settings: LifecycleFlowSettings): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) throw new Error('You must be signed in.');

  const { error } = await supabase
    .from('lifecycle_flow_settings')
    .upsert(
      {
        user_id: userId,
        day0_enabled: settings.day0Enabled,
        day2_enabled: settings.day2Enabled,
        day5_enabled: settings.day5Enabled,
        day10_enabled: settings.day10Enabled,
        sms_enabled: settings.smsEnabled,
        email_enabled: settings.emailEnabled,
      },
      { onConflict: 'user_id' },
    );

  if (error) throw new Error(error.message);
}
