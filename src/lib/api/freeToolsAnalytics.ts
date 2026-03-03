import { supabase } from '@/integrations/supabase/client';
import { CtaVariantId, FreeToolsCtaEvent, FreeToolsLeadCapture } from '@/lib/freeToolsConversion';

const SYNC_BATCH_LIMIT = 250;

function normalizeVariant(value: string): CtaVariantId {
  return value === 'b' ? 'b' : 'a';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function eventDedupeKey(event: FreeToolsCtaEvent): string {
  return `${event.slug}|${event.variant}|${event.type}|${event.at}`;
}

function captureDedupeKey(capture: FreeToolsLeadCapture): string {
  return `${capture.slug}|${capture.variant}|${normalizeEmail(capture.email)}|${capture.capturedAt}`;
}

export interface FreeToolsCloudSyncResult {
  eventsAttempted: number;
  capturesAttempted: number;
}

export interface FreeToolsCloudData {
  events: FreeToolsCtaEvent[];
  captures: FreeToolsLeadCapture[];
}

export async function syncFreeToolsTrackingToSupabase(
  userId: string,
  events: FreeToolsCtaEvent[],
  captures: FreeToolsLeadCapture[],
): Promise<FreeToolsCloudSyncResult> {
  if (!userId) throw new Error('User is required to sync free tools analytics.');

  const eventRows = events.slice(-SYNC_BATCH_LIMIT).map((event) => ({
    user_id: userId,
    event_type: event.type,
    tool_slug: event.slug,
    variant: normalizeVariant(event.variant),
    occurred_at: event.at,
    dedupe_key: eventDedupeKey(event),
    metadata: null,
  }));

  const captureRows = captures.slice(-SYNC_BATCH_LIMIT).map((capture) => ({
    user_id: userId,
    tool_slug: capture.slug,
    variant: normalizeVariant(capture.variant),
    email: normalizeEmail(capture.email),
    captured_at: capture.capturedAt,
    dedupe_key: captureDedupeKey(capture),
  }));

  if (eventRows.length) {
    const { error } = await supabase
      .from('free_tools_cta_events')
      .upsert(eventRows, { onConflict: 'user_id,dedupe_key' });
    if (error) throw new Error(error.message);
  }

  if (captureRows.length) {
    const { error } = await supabase
      .from('free_tools_lead_captures')
      .upsert(captureRows, { onConflict: 'user_id,dedupe_key' });
    if (error) throw new Error(error.message);
  }

  return {
    eventsAttempted: eventRows.length,
    capturesAttempted: captureRows.length,
  };
}

export async function fetchFreeToolsTrackingFromSupabase(userId: string): Promise<FreeToolsCloudData> {
  if (!userId) throw new Error('User is required to load free tools analytics.');

  const [{ data: eventRows, error: eventError }, { data: captureRows, error: captureError }] = await Promise.all([
    supabase
      .from('free_tools_cta_events')
      .select('event_type, tool_slug, variant, occurred_at')
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .limit(5000),
    supabase
      .from('free_tools_lead_captures')
      .select('tool_slug, variant, email, captured_at')
      .eq('user_id', userId)
      .order('captured_at', { ascending: false })
      .limit(5000),
  ]);

  if (eventError) throw new Error(eventError.message);
  if (captureError) throw new Error(captureError.message);

  return {
    events: (eventRows || []).map((row) => ({
      type: row.event_type as FreeToolsCtaEvent['type'],
      slug: row.tool_slug,
      variant: normalizeVariant(row.variant),
      at: row.occurred_at,
    })),
    captures: (captureRows || []).map((row) => ({
      slug: row.tool_slug,
      variant: normalizeVariant(row.variant),
      email: row.email,
      capturedAt: row.captured_at,
    })),
  };
}

export async function clearFreeToolsTrackingInSupabase(userId: string): Promise<void> {
  if (!userId) throw new Error('User is required to clear free tools analytics.');

  const [{ error: eventError }, { error: captureError }] = await Promise.all([
    supabase.from('free_tools_cta_events').delete().eq('user_id', userId),
    supabase.from('free_tools_lead_captures').delete().eq('user_id', userId),
  ]);

  if (eventError) throw new Error(eventError.message);
  if (captureError) throw new Error(captureError.message);
}
