import { supabase } from '@/integrations/supabase/client';
import { estimateCookMinutes } from '@/lib/recipeTime';
import { getDinnerReminderPrefs } from '@/lib/mealPrefs';

export type CalendarEventModule = 'manual' | 'meals' | 'tasks' | 'chores' | 'workouts' | 'reminders';
export type CalendarEventSource = 'manual' | 'meal' | 'task' | 'chore' | 'workout' | 'reminder';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  travelFromAddress?: string;
  travelMode?: 'driving';
  travelDurationMinutes?: number | null;
  trafficDurationMinutes?: number | null;
  recommendedLeaveAt?: string | null;
  leaveReminderEnabled?: boolean;
  leaveReminderLeadMinutes?: number | null;
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
  location?: string;
  travelFromAddress?: string;
  travelMode?: 'driving';
  travelDurationMinutes?: number | null;
  trafficDurationMinutes?: number | null;
  recommendedLeaveAt?: string | null;
  leaveReminderEnabled?: boolean;
  leaveReminderLeadMinutes?: number | null;
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

export interface MealCalendarSyncItem {
  id: string;
  day: string;
  week_of: string;
  is_skipped: boolean;
  recipes?: {
    name?: string | null;
    instructions?: string | null;
  } | null;
}

interface StoredManualEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  travelFromAddress?: string;
  travelMode?: 'driving';
  travelDurationMinutes?: number | null;
  trafficDurationMinutes?: number | null;
  recommendedLeaveAt?: string | null;
  leaveReminderEnabled?: boolean;
  leaveReminderLeadMinutes?: number | null;
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
    location: typeof input.location === 'string' ? input.location : undefined,
    travelFromAddress: typeof input.travelFromAddress === 'string' ? input.travelFromAddress : undefined,
    travelMode: input.travelMode === 'driving' ? 'driving' : 'driving',
    travelDurationMinutes:
      typeof input.travelDurationMinutes === 'number' && Number.isFinite(input.travelDurationMinutes)
        ? Math.max(1, Math.round(input.travelDurationMinutes))
        : null,
    trafficDurationMinutes:
      typeof input.trafficDurationMinutes === 'number' && Number.isFinite(input.trafficDurationMinutes)
        ? Math.max(1, Math.round(input.trafficDurationMinutes))
        : null,
    recommendedLeaveAt:
      typeof input.recommendedLeaveAt === 'string' && input.recommendedLeaveAt.trim()
        ? input.recommendedLeaveAt
        : null,
    leaveReminderEnabled: !!input.leaveReminderEnabled,
    leaveReminderLeadMinutes:
      typeof input.leaveReminderLeadMinutes === 'number' && Number.isFinite(input.leaveReminderLeadMinutes)
        ? Math.max(5, Math.min(120, Math.round(input.leaveReminderLeadMinutes)))
        : 10,
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

const dayToIndexMonday: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

function normalizeTime(value: string | null | undefined): string {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return '18:00';
  return value;
}

function guessUserTimeZone(): string {
  if (typeof Intl === 'undefined') return 'UTC';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && zone.trim() ? zone : 'UTC';
}

function mealStartDate(weekOf: string, day: string, hhmm: string): Date | null {
  const dayIndex = dayToIndexMonday[String(day || '').toLowerCase()];
  if (typeof dayIndex !== 'number') return null;
  const weekStart = new Date(`${weekOf}T00:00:00`);
  if (!Number.isFinite(weekStart.getTime())) return null;

  const [hourRaw, minuteRaw] = hhmm.split(':');
  const startsAt = new Date(weekStart);
  startsAt.setDate(startsAt.getDate() + dayIndex);
  startsAt.setHours(Number.parseInt(hourRaw, 10) || 0, Number.parseInt(minuteRaw, 10) || 0, 0, 0);
  return startsAt;
}

function notifyCalendarChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('homehub:calendar-events-updated'));
}

export async function syncScheduledMealsToCalendar(meals: MealCalendarSyncItem[]): Promise<void> {
  if (!Array.isArray(meals) || meals.length === 0) return;

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData.user?.id;
  if (!userId) return;

  const raw = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (column: string, values: string[]) => Promise<{
          data: { id: string; related_id: string | null; is_deleted: boolean }[] | null;
          error: { message?: string } | null;
        }>;
      };
      insert: (values: Record<string, unknown>) => Promise<{ error: { message?: string } | null }>;
      update: (values: Record<string, unknown>) => {
        eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
      };
    };
  };

  const prefs = getDinnerReminderPrefs();
  const dinnerTime = normalizeTime(prefs.preferredDinnerTime);
  const prepEnabled = !!prefs.enabled;

  const weekKeys = Array.from(new Set(meals.map((meal) => String(meal.week_of || '')).filter(Boolean)));
  const existingRows: { id: string; related_id: string | null; is_deleted: boolean }[] = [];
  const rawAny = supabase as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          gte: (column: string, value: string) => {
            lt: (column: string, value: string) => {
              in: (column: string, values: string[]) => Promise<{
                data: { id: string; related_id: string | null; is_deleted: boolean }[] | null;
                error: { message?: string } | null;
              }>;
            };
          };
        };
      };
    };
  };

  for (const weekOf of weekKeys) {
    const weekStart = new Date(`${weekOf}T00:00:00`);
    if (!Number.isFinite(weekStart.getTime())) continue;
    const rangeStart = new Date(weekStart.getTime() - 18 * 60 * 60_000);
    const rangeEnd = new Date(weekStart.getTime() + (7 * 24 + 18) * 60 * 60_000);

    const { data, error } = await rawAny
      .from('calendar_events')
      .select('id,related_id,is_deleted')
      .eq('owner_id', userId)
      .gte('starts_at', rangeStart.toISOString())
      .lt('starts_at', rangeEnd.toISOString())
      .in('source', ['meal', 'reminder']);

    if (error) {
      console.error('Failed loading existing meal calendar rows:', error.message || error);
      return;
    }
    if (Array.isArray(data)) existingRows.push(...data);
  }

  const existingByRelated = new Map(
    (existingRows || [])
      .filter((row) => typeof row.related_id === 'string' && row.related_id)
      .map((row) => [String(row.related_id), row]),
  );

  const ops: Promise<{ error: { message?: string } | null }>[] = [];
  const upsertByRelatedId = (relatedId: string, payload: Record<string, unknown>) => {
    const existing = existingByRelated.get(relatedId);
    if (existing) {
      ops.push(
        raw
          .from('calendar_events')
          .update({ ...payload, is_deleted: false, deleted_at: null })
          .eq('id', existing.id),
      );
      return;
    }
    ops.push(
      raw.from('calendar_events').insert({
        owner_id: userId,
        related_id: relatedId,
        is_deleted: false,
        deleted_at: null,
        ...payload,
      }),
    );
  };

  const markDeleted = (relatedId: string) => {
    const existing = existingByRelated.get(relatedId);
    if (!existing || existing.is_deleted) return;
    ops.push(
      raw
        .from('calendar_events')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', existing.id),
    );
  };

  const timezoneName = guessUserTimeZone();

  const desiredRelatedIds = new Set<string>();

  for (const meal of meals) {
    const mealRelatedId = `meal:${meal.id}`;
    const prepRelatedId = `meal-prep:${meal.id}`;
    const title = String(meal.recipes?.name || '').trim();
    const hasMeal = !meal.is_skipped && !!title;
    const startsAt = hasMeal ? mealStartDate(meal.week_of, meal.day, dinnerTime) : null;

    if (hasMeal && startsAt) {
      desiredRelatedIds.add(mealRelatedId);
      const endsAt = new Date(startsAt.getTime() + 60 * 60_000);
      upsertByRelatedId(mealRelatedId, {
        title,
        description: 'Planned dinner',
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        all_day: false,
        module: 'meals',
        source: 'meal',
        calendar_layer: 'meals',
        timezone_name: timezoneName,
        recurrence_rule: null,
      });

      if (prepEnabled) {
        desiredRelatedIds.add(prepRelatedId);
        const cookMinutes = Math.max(15, estimateCookMinutes(meal.recipes?.instructions || '') ?? 45);
        const prepStart = new Date(startsAt.getTime() - cookMinutes * 60_000);
        upsertByRelatedId(prepRelatedId, {
          title: `Start prep: ${title}`,
          description: `Estimated cook time ${cookMinutes} minutes`,
          starts_at: prepStart.toISOString(),
          ends_at: startsAt.toISOString(),
          all_day: false,
          module: 'reminders',
          source: 'reminder',
          calendar_layer: 'deliveries',
          timezone_name: timezoneName,
          recurrence_rule: null,
        });
      } else {
        markDeleted(prepRelatedId);
      }
    } else {
      markDeleted(mealRelatedId);
      markDeleted(prepRelatedId);
    }
  }

  for (const existingRelatedId of existingByRelated.keys()) {
    if (!existingRelatedId.startsWith('meal:') && !existingRelatedId.startsWith('meal-prep:')) continue;
    if (desiredRelatedIds.has(existingRelatedId)) continue;
    markDeleted(existingRelatedId);
  }

  if (!ops.length) return;

  const results = await Promise.all(ops);
  const errors = results.map((result) => result.error).filter((error) => !!error);
  if (errors.length > 0) {
    console.error('One or more meal calendar sync operations failed:', errors.map((error) => error?.message || 'unknown'));
    return;
  }

  notifyCalendarChange();
}

export function getManualCalendarEvents(userId?: string | null): CalendarEvent[] {
  const rows = readJson<unknown[]>(scopedKey(MANUAL_EVENTS_KEY, userId), [])
    .map((row) => normalizeManualEvent(row))
    .filter((row): row is StoredManualEvent => Boolean(row));

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    location: row.location,
    travelFromAddress: row.travelFromAddress,
    travelMode: row.travelMode,
    travelDurationMinutes: row.travelDurationMinutes,
    trafficDurationMinutes: row.trafficDurationMinutes,
    recommendedLeaveAt: row.recommendedLeaveAt,
    leaveReminderEnabled: row.leaveReminderEnabled,
    leaveReminderLeadMinutes: row.leaveReminderLeadMinutes,
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
    location: input.location?.trim() || undefined,
    travelFromAddress: input.travelFromAddress?.trim() || undefined,
    travelMode: input.travelMode || 'driving',
    travelDurationMinutes:
      typeof input.travelDurationMinutes === 'number' && Number.isFinite(input.travelDurationMinutes)
        ? Math.max(1, Math.round(input.travelDurationMinutes))
        : null,
    trafficDurationMinutes:
      typeof input.trafficDurationMinutes === 'number' && Number.isFinite(input.trafficDurationMinutes)
        ? Math.max(1, Math.round(input.trafficDurationMinutes))
        : null,
    recommendedLeaveAt: input.recommendedLeaveAt || null,
    leaveReminderEnabled: !!input.leaveReminderEnabled,
    leaveReminderLeadMinutes:
      typeof input.leaveReminderLeadMinutes === 'number' && Number.isFinite(input.leaveReminderLeadMinutes)
        ? Math.max(5, Math.min(120, Math.round(input.leaveReminderLeadMinutes)))
        : 10,
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
    const timezoneName = guessUserTimeZone();
    void supabaseCalendarSync
      .from('calendar_events')
      .insert({
        id: remoteId,
        title: row.title,
        description: row.description || null,
        location_text: row.location || null,
        travel_from_address: row.travelFromAddress || null,
        travel_mode: row.travelMode || 'driving',
        travel_duration_minutes: row.travelDurationMinutes,
        traffic_duration_minutes: row.trafficDurationMinutes,
        leave_by: row.recommendedLeaveAt || null,
        leave_reminder_enabled: !!row.leaveReminderEnabled,
        leave_reminder_lead_minutes: row.leaveReminderLeadMinutes || 10,
        starts_at: row.startsAt,
        ends_at: row.endsAt || null,
        all_day: row.allDay,
        module: 'manual',
        source: 'manual',
        calendar_layer: 'family',
        timezone_name: timezoneName,
        recurrence_rule: null,
        is_deleted: false,
        deleted_at: null,
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
    location: row.location,
    travelFromAddress: row.travelFromAddress,
    travelMode: row.travelMode,
    travelDurationMinutes: row.travelDurationMinutes,
    trafficDurationMinutes: row.trafficDurationMinutes,
    recommendedLeaveAt: row.recommendedLeaveAt,
    leaveReminderEnabled: row.leaveReminderEnabled,
    leaveReminderLeadMinutes: row.leaveReminderLeadMinutes,
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
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
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
