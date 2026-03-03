import { supabase } from '@/integrations/supabase/client';

export type CalendarEventModule = 'manual' | 'meals' | 'tasks' | 'chores' | 'workouts' | 'reminders';
export type CalendarEventSource = 'manual' | 'meal' | 'task' | 'chore' | 'workout' | 'reminder';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  source: CalendarEventSource;
  module: CalendarEventModule;
  relatedId?: string;
  readonly?: boolean;
}

export interface ManualCalendarEventInput {
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
}

export interface GoogleCalendarPrefs {
  enabled: boolean;
  selectedCalendarId: string;
  selectedCalendarLabel: string;
  connectionStatus: 'disconnected' | 'pending_oauth' | 'connected';
  connectedAt: string | null;
  lastSyncAt: string | null;
}

interface StoredManualEvent {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  createdAt: string;
  updatedAt: string;
}

type CalendarSyncError = { message?: string } | null;

type SupabaseCalendarSyncClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: CalendarSyncError }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: CalendarSyncError }>;
    };
  };
};

const supabaseCalendarSync = supabase as unknown as SupabaseCalendarSyncClient;

const MANUAL_EVENTS_KEY = 'homehub.calendar.manualEvents.v1';
const GOOGLE_PREFS_KEY = 'homehub.calendar.googlePrefs.v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function scopedKey(baseKey: string, userId?: string | null): string {
  return `${baseKey}:${userId || 'anon'}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeManualEvent(raw: unknown): StoredManualEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<StoredManualEvent>;
  if (!input.id || !input.title || !input.startsAt) return null;
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: !!input.allDay,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function remoteIdFromLocalId(localId: string): string | null {
  if (!localId.startsWith('manual-')) return null;
  const remoteId = localId.slice('manual-'.length);
  return remoteId || null;
}

const defaultGooglePrefs: GoogleCalendarPrefs = {
  enabled: false,
  selectedCalendarId: 'primary',
  selectedCalendarLabel: 'Primary calendar',
  connectionStatus: 'disconnected',
  connectedAt: null,
  lastSyncAt: null,
};

export function getManualCalendarEvents(userId?: string | null): CalendarEvent[] {
  const rows = readJson<unknown[]>(scopedKey(MANUAL_EVENTS_KEY, userId), [])
    .map((row) => normalizeManualEvent(row))
    .filter((row): row is StoredManualEvent => Boolean(row));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    source: 'manual',
    module: 'manual',
    readonly: false,
  }));
}

export function addManualCalendarEvent(input: ManualCalendarEventInput, userId?: string | null): CalendarEvent {
  const now = new Date().toISOString();
  const remoteId = crypto.randomUUID();
  const localId = `manual-${remoteId}`;
  const row: StoredManualEvent = {
    id: localId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay,
    createdAt: now,
    updatedAt: now,
  };

  const key = scopedKey(MANUAL_EVENTS_KEY, userId);
  const current = readJson<unknown[]>(key, [])
    .map((item) => normalizeManualEvent(item))
    .filter((item): item is StoredManualEvent => Boolean(item));
  writeJson(key, [row, ...current]);

  if (userId) {
    void supabaseCalendarSync
      .from('calendar_events')
      .insert({
        id: remoteId,
        title: row.title,
        description: row.description || null,
        starts_at: row.startsAt,
        ends_at: row.endsAt || null,
        all_day: row.allDay,
        module: 'manual',
        source: 'manual',
        is_deleted: false,
      })
      .then(({ error }: { error?: { message?: string } | null }) => {
        if (error) console.error('Failed to sync manual event to Supabase:', error.message || error);
      })
      .catch((error: unknown) => {
        console.error('Failed to sync manual event to Supabase:', error);
      });
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    allDay: row.allDay,
    source: 'manual',
    module: 'manual',
    readonly: false,
  };
}

export function deleteManualCalendarEvent(eventId: string, userId?: string | null) {
  const key = scopedKey(MANUAL_EVENTS_KEY, userId);
  const current = readJson<unknown[]>(key, [])
    .map((item) => normalizeManualEvent(item))
    .filter((item): item is StoredManualEvent => Boolean(item));
  writeJson(
    key,
    current.filter((item) => item.id !== eventId),
  );

  const remoteId = remoteIdFromLocalId(eventId);
  if (userId && remoteId) {
    void supabaseCalendarSync
      .from('calendar_events')
      .update({ is_deleted: true })
      .eq('id', remoteId)
      .then(({ error }: { error?: { message?: string } | null }) => {
        if (error) console.error('Failed to delete manual event in Supabase:', error.message || error);
      })
      .catch((error: unknown) => {
        console.error('Failed to delete manual event in Supabase:', error);
      });
  }
}

export function getGoogleCalendarPrefs(userId?: string | null): GoogleCalendarPrefs {
  const raw = readJson<Partial<GoogleCalendarPrefs>>(scopedKey(GOOGLE_PREFS_KEY, userId), {});
  return {
    enabled: !!raw.enabled,
    selectedCalendarId:
      typeof raw.selectedCalendarId === 'string' && raw.selectedCalendarId.trim()
        ? raw.selectedCalendarId
        : defaultGooglePrefs.selectedCalendarId,
    selectedCalendarLabel:
      typeof raw.selectedCalendarLabel === 'string' && raw.selectedCalendarLabel.trim()
        ? raw.selectedCalendarLabel
        : defaultGooglePrefs.selectedCalendarLabel,
    connectionStatus:
      raw.connectionStatus === 'connected' || raw.connectionStatus === 'pending_oauth'
        ? raw.connectionStatus
        : defaultGooglePrefs.connectionStatus,
    connectedAt: typeof raw.connectedAt === 'string' ? raw.connectedAt : null,
    lastSyncAt: typeof raw.lastSyncAt === 'string' ? raw.lastSyncAt : null,
  };
}

export function setGoogleCalendarPrefs(next: GoogleCalendarPrefs, userId?: string | null) {
  writeJson(scopedKey(GOOGLE_PREFS_KEY, userId), next);
}
