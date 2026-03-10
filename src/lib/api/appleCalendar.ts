import { supabase } from '@/integrations/supabase/client';

export const APPLE_FEED_LAYERS = [
  'all',
  'family',
  'meals',
  'kids',
  'chores',
  'deliveries',
  'manual',
  'tasks',
  'workouts',
  'reminders',
] as const;
export type AppleFeedLayer = (typeof APPLE_FEED_LAYERS)[number];

export interface AppleCalendarFeedUrls {
  token: string;
  mode: 'one_way_read_only';
  feeds: Record<AppleFeedLayer, string>;
  supported_layers: string[];
}

async function invokeAppleCalendar(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('apple-calendar-feed', { body });
  if (!error) return (data || {}) as Record<string, unknown>;

  const invokeError = error as Error & { context?: Response };
  if (invokeError.context) {
    const response = invokeError.context;
    const payload = (await response.clone().json().catch(() => null)) as Record<string, unknown> | null;
    const message = typeof payload?.error === 'string' && payload.error.trim()
      ? payload.error
      : `Apple Calendar request failed (${response.status}).`;
    throw new Error(message);
  }

  throw new Error(invokeError.message || 'Apple Calendar request failed.');
}

function assertFeedResponse(raw: Record<string, unknown>): AppleCalendarFeedUrls {
  const token = typeof raw.token === 'string' ? raw.token : '';
  const mode = raw.mode === 'one_way_read_only' ? 'one_way_read_only' : null;
  const supported = Array.isArray(raw.supported_layers)
    ? raw.supported_layers.filter((value): value is string => typeof value === 'string')
    : [];
  const feedsRaw = (raw.feeds || {}) as Record<string, unknown>;

  if (!token || !mode) {
    throw new Error('Invalid Apple Calendar response.');
  }

  const feeds = Object.fromEntries(
    APPLE_FEED_LAYERS.map((layer) => [layer, typeof feedsRaw[layer] === 'string' ? feedsRaw[layer] : '']),
  ) as Record<AppleFeedLayer, string>;

  const missing = APPLE_FEED_LAYERS.filter((layer) => !feeds[layer]);
  if (missing.length > 0) {
    throw new Error(`Apple Calendar response missing feeds: ${missing.join(', ')}`);
  }

  return {
    token,
    mode,
    feeds,
    supported_layers: supported,
  };
}

export async function loadAppleCalendarFeedUrls(): Promise<AppleCalendarFeedUrls> {
  const raw = await invokeAppleCalendar({ action: 'get_urls' });
  return assertFeedResponse(raw);
}

export async function regenerateAppleCalendarFeedToken(): Promise<AppleCalendarFeedUrls> {
  const raw = await invokeAppleCalendar({ action: 'regenerate_token' });
  return assertFeedResponse(raw);
}
