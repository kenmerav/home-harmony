import { supabase } from '@/integrations/supabase/client';
import { estimateCookMinutes } from '@/lib/recipeTime';
import { getDinnerReminderPrefs } from '@/lib/mealPrefs';

export type CalendarEventModule = 'manual' | 'meals' | 'tasks' | 'chores' | 'workouts' | 'reminders';
export type CalendarEventSource = 'manual' | 'meal' | 'task' | 'chore' | 'workout' | 'reminder';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  calendarLayer?: string;
  location?: string;
  arriveByAt?: string | null;
  eventReminderEnabled?: boolean;
  eventReminderLeadMinutes?: number | null;
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
  module?: CalendarEventModule;
  calendarLayer?: string;
  location?: string;
  arriveByAt?: string | null;
  eventReminderEnabled?: boolean;
  eventReminderLeadMinutes?: number | null;
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
  module: CalendarEventModule;
  calendarLayer?: string;
  location?: string;
  arriveByAt?: string | null;
  eventReminderEnabled?: boolean;
  eventReminderLeadMinutes?: number | null;
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

interface RemoteManualEventRow {
  id: string;
  title: string;
  description?: string | null;
  module?: string | null;
  calendar_layer?: string | null;
  location_text?: string | null;
  arrive_by?: string | null;
  event_reminder_enabled?: boolean | null;
  event_reminder_lead_minutes?: number | null;
  travel_from_address?: string | null;
  travel_mode?: string | null;
  travel_duration_minutes?: number | null;
  traffic_duration_minutes?: number | null;
  leave_by?: string | null;
  leave_reminder_enabled?: boolean | null;
  leave_reminder_lead_minutes?: number | null;
  starts_at: string;
  ends_at?: string | null;
  all_day: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

type CalendarSyncError = { message?: string } | null;

type SupabaseCalendarSyncClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: CalendarSyncError }>;
    upsert: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ error: CalendarSyncError }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: CalendarSyncError }>;
    };
  };
};

const supabaseCalendarSync = supabase as unknown as SupabaseCalendarSyncClient;

const MANUAL_EVENTS_KEY = 'homehub.calendar.manualEvents.v1';
const GOOGLE_PREFS_KEY = 'homehub.calendar.googlePrefs.v1';
const MANUAL_EVENT_BACKFILL_DONE = new Set<string>();

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

function localNoonIsoForDateToken(dateToken: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToken)) return null;
  const localNoon = new Date(`${dateToken}T12:00:00`);
  if (!Number.isFinite(localNoon.getTime())) return null;
  return localNoon.toISOString();
}

function normalizeAllDayStartsAt(startsAt: string, allDay: boolean): string {
  if (!allDay || typeof startsAt !== 'string') return startsAt;
  const trimmed = startsAt.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return localNoonIsoForDateToken(trimmed) || startsAt;
  }
  const utcMidnight = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/i.exec(trimmed);
  if (utcMidnight?.[1]) {
    return localNoonIsoForDateToken(utcMidnight[1]) || startsAt;
  }
  return startsAt;
}

function normalizeStoredCalendarLayer(
  value: string | null | undefined,
  module: CalendarEventModule,
): string {
  const trimmed = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  if (!trimmed || trimmed.toLowerCase() === 'manual') {
    return module === 'manual' ? 'family' : module;
  }
  return trimmed;
}

function normalizeManualEvent(raw: unknown): StoredManualEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<StoredManualEvent>;
  if (!input.id || !input.title || !input.startsAt) return null;
  const moduleValue = String(input.module || '').toLowerCase();
  const module: CalendarEventModule =
    moduleValue === 'meals'
    || moduleValue === 'tasks'
    || moduleValue === 'chores'
    || moduleValue === 'workouts'
    || moduleValue === 'reminders'
    || moduleValue === 'manual'
      ? (moduleValue as CalendarEventModule)
      : 'manual';
  const calendarLayer = normalizeStoredCalendarLayer(input.calendarLayer, module);
  const hasCommuteRouting = Boolean(
    typeof input.travelFromAddress === 'string'
      && input.travelFromAddress.trim()
      && typeof input.location === 'string'
      && input.location.trim(),
  );
  const legacyLeaveReminderEnabled = !!input.leaveReminderEnabled;
  const normalizedEventReminderEnabled =
    typeof input.eventReminderEnabled === 'boolean'
      ? input.eventReminderEnabled
      : legacyLeaveReminderEnabled && !hasCommuteRouting;
  const normalizedEventReminderLeadMinutes =
    typeof input.eventReminderLeadMinutes === 'number' && Number.isFinite(input.eventReminderLeadMinutes)
      ? Math.max(0, Math.min(240, Math.round(input.eventReminderLeadMinutes)))
      : typeof input.leaveReminderLeadMinutes === 'number' && Number.isFinite(input.leaveReminderLeadMinutes)
      ? Math.max(0, Math.min(240, Math.round(input.leaveReminderLeadMinutes)))
      : 0;
  const normalizedLeaveReminderEnabled =
    typeof input.leaveReminderEnabled === 'boolean'
      ? input.leaveReminderEnabled && hasCommuteRouting
      : false;
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    module,
    calendarLayer,
    location: typeof input.location === 'string' ? input.location : undefined,
    arriveByAt:
      typeof input.arriveByAt === 'string' && input.arriveByAt.trim()
        ? input.arriveByAt
        : null,
    eventReminderEnabled: normalizedEventReminderEnabled,
    eventReminderLeadMinutes: normalizedEventReminderLeadMinutes,
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
    leaveReminderEnabled: normalizedLeaveReminderEnabled,
    leaveReminderLeadMinutes:
      typeof input.leaveReminderLeadMinutes === 'number' && Number.isFinite(input.leaveReminderLeadMinutes)
        ? Math.max(5, Math.min(120, Math.round(input.leaveReminderLeadMinutes)))
        : 10,
    startsAt: normalizeAllDayStartsAt(input.startsAt, !!input.allDay),
    endsAt: input.endsAt,
    allDay: !!input.allDay,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function isMissingArriveByColumn(error: CalendarSyncError): boolean {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('arrive_by') && (message.includes('column') || message.includes('schema cache'));
}

function buildManualEventRemotePayload(
  row: StoredManualEvent,
  timezoneName: string,
  userId?: string | null,
): Record<string, unknown> {
  return {
    ...(userId ? { owner_id: userId } : {}),
    title: row.title,
    description: row.description || null,
    location_text: row.location || null,
    arrive_by: row.arriveByAt || null,
    event_reminder_enabled: !!row.eventReminderEnabled,
    event_reminder_lead_minutes: row.eventReminderLeadMinutes ?? 0,
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
    module: row.module,
    source: 'manual',
    calendar_layer: row.calendarLayer || 'family',
    timezone_name: timezoneName,
    recurrence_rule: null,
    is_deleted: false,
    deleted_at: null,
  };
}

async function insertManualEventRemote(remoteId: string, row: StoredManualEvent, timezoneName: string) {
  const payload = {
    id: remoteId,
    ...buildManualEventRemotePayload(row, timezoneName),
  };
  let result = await supabaseCalendarSync.from('calendar_events').insert(payload);
  if (isMissingArriveByColumn(result.error)) {
    const { arrive_by: _arriveBy, ...legacyPayload } = payload;
    result = await supabaseCalendarSync.from('calendar_events').insert(legacyPayload);
  }
  return result;
}

async function upsertManualEventRemote(remoteId: string, row: StoredManualEvent, timezoneName: string, userId: string) {
  const payload = {
    id: remoteId,
    ...buildManualEventRemotePayload(row, timezoneName, userId),
  };
  let result = await supabaseCalendarSync.from('calendar_events').upsert(payload, { onConflict: 'id' });
  if (isMissingArriveByColumn(result.error)) {
    const { arrive_by: _arriveBy, ...legacyPayload } = payload;
    result = await supabaseCalendarSync.from('calendar_events').upsert(legacyPayload, { onConflict: 'id' });
  }
  return result;
}

function remoteIdFromLocalId(localId: string): string | null {
  if (!localId.startsWith('manual-')) return null;
  const remoteId = localId.slice('manual-'.length);
  return remoteId || null;
}

function manualEventFromRemoteRow(row: RemoteManualEventRow): CalendarEvent | null {
  const moduleValue = String(row.module || 'manual').toLowerCase();
  const module: CalendarEventModule =
    moduleValue === 'meals'
    || moduleValue === 'tasks'
    || moduleValue === 'chores'
    || moduleValue === 'workouts'
    || moduleValue === 'reminders'
    || moduleValue === 'manual'
      ? (moduleValue as CalendarEventModule)
      : 'manual';

  if (!row.id || !row.title || !row.starts_at) return null;

  return {
    id: `manual-${row.id}`,
    title: row.title,
    description: row.description || undefined,
    calendarLayer: normalizeStoredCalendarLayer(row.calendar_layer, module),
    location: row.location_text || undefined,
    arriveByAt: row.arrive_by || null,
    eventReminderEnabled: !!row.event_reminder_enabled,
    eventReminderLeadMinutes:
      typeof row.event_reminder_lead_minutes === 'number' && Number.isFinite(row.event_reminder_lead_minutes)
        ? row.event_reminder_lead_minutes
        : 0,
    travelFromAddress: row.travel_from_address || undefined,
    travelMode: row.travel_mode === 'driving' ? 'driving' : 'driving',
    travelDurationMinutes:
      typeof row.travel_duration_minutes === 'number' && Number.isFinite(row.travel_duration_minutes)
        ? row.travel_duration_minutes
        : null,
    trafficDurationMinutes:
      typeof row.traffic_duration_minutes === 'number' && Number.isFinite(row.traffic_duration_minutes)
        ? row.traffic_duration_minutes
        : null,
    recommendedLeaveAt: row.leave_by || null,
    leaveReminderEnabled: !!row.leave_reminder_enabled,
    leaveReminderLeadMinutes:
      typeof row.leave_reminder_lead_minutes === 'number' && Number.isFinite(row.leave_reminder_lead_minutes)
        ? row.leave_reminder_lead_minutes
        : 10,
    startsAt: normalizeAllDayStartsAt(row.starts_at, !!row.all_day),
    endsAt: row.ends_at || undefined,
    allDay: !!row.all_day,
    source: 'manual',
    module,
    readonly: false,
  };
}

async function fetchRemoteManualEventsInRange(
  rangeStart: Date,
  rangeEnd: Date,
  userId?: string | null,
): Promise<CalendarEvent[]> {
  if (!userId || userId === 'demo-user') return [];

  const selectColumns =
    'id,title,description,module,calendar_layer,location_text,arrive_by,event_reminder_enabled,event_reminder_lead_minutes,travel_from_address,travel_mode,travel_duration_minutes,traffic_duration_minutes,leave_by,leave_reminder_enabled,leave_reminder_lead_minutes,starts_at,ends_at,all_day,created_at,updated_at';

  let query = supabase
    .from('calendar_events')
    .select(selectColumns)
    .eq('owner_id', userId)
    .eq('source', 'manual')
    .eq('is_deleted', false)
    .gte('starts_at', rangeStart.toISOString())
    .lt('starts_at', rangeEnd.toISOString())
    .order('starts_at', { ascending: true });

  let { data, error } = await query;

  if (isMissingArriveByColumn(error as CalendarSyncError)) {
    const legacyColumns =
      'id,title,description,module,calendar_layer,location_text,event_reminder_enabled,event_reminder_lead_minutes,travel_from_address,travel_mode,travel_duration_minutes,traffic_duration_minutes,leave_by,leave_reminder_enabled,leave_reminder_lead_minutes,starts_at,ends_at,all_day,created_at,updated_at';
    const legacyResult = await supabase
      .from('calendar_events')
      .select(legacyColumns)
      .eq('owner_id', userId)
      .eq('source', 'manual')
      .eq('is_deleted', false)
      .gte('starts_at', rangeStart.toISOString())
      .lt('starts_at', rangeEnd.toISOString())
      .order('starts_at', { ascending: true });
    data = legacyResult.data;
    error = legacyResult.error;
  }

  if (error) {
    console.error('Failed loading remote manual calendar rows:', error.message || error);
    return [];
  }

  return ((data || []) as RemoteManualEventRow[])
    .map((row) => manualEventFromRemoteRow(row))
    .filter((row): row is CalendarEvent => Boolean(row));
}

export async function fetchManualCalendarEventsInRange(
  rangeStart: Date,
  rangeEnd: Date,
  userId?: string | null,
): Promise<CalendarEvent[]> {
  const localEvents = getManualCalendarEvents(userId).filter((event) => {
    const startsAt = new Date(event.startsAt);
    return Number.isFinite(startsAt.getTime()) && startsAt >= rangeStart && startsAt < rangeEnd;
  });
  const remoteEvents = await fetchRemoteManualEventsInRange(rangeStart, rangeEnd, userId);

  const merged = new Map<string, CalendarEvent>();
  remoteEvents.forEach((event) => {
    merged.set(event.id, event);
  });
  localEvents.forEach((event) => {
    merged.set(event.id, event);
  });

  return Array.from(merged.values()).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
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

  if (userId && rows.length > 0 && !MANUAL_EVENT_BACKFILL_DONE.has(userId)) {
    MANUAL_EVENT_BACKFILL_DONE.add(userId);
    const timezoneName = guessUserTimeZone();
    for (const row of rows) {
      const remoteId = remoteIdFromLocalId(row.id);
      if (!remoteId) continue;
      void upsertManualEventRemote(remoteId, row, timezoneName, userId)
        .then(({ error }: { error?: { message?: string } | null }) => {
          if (error) console.error('Failed to backfill manual event to Supabase:', error.message || error);
        })
        .catch((error: unknown) => {
          console.error('Failed to backfill manual event to Supabase:', error);
        });
    }
  }

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    calendarLayer: row.calendarLayer || 'family',
    location: row.location,
    arriveByAt: row.arriveByAt,
    eventReminderEnabled: row.eventReminderEnabled,
    eventReminderLeadMinutes: row.eventReminderLeadMinutes,
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
    module: row.module,
    readonly: false,
  }));
}

export function addManualCalendarEvent(input: ManualCalendarEventInput, userId?: string | null): CalendarEvent {
  const now = new Date().toISOString();
  const remoteId = crypto.randomUUID();
  const localId = `manual-${remoteId}`;
  const normalizedLocation = input.location?.trim() || undefined;
  const normalizedTravelFromAddress = input.travelFromAddress?.trim() || undefined;
  const hasCommuteRouting = Boolean(normalizedLocation && normalizedTravelFromAddress);
  const row: StoredManualEvent = {
    id: localId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    module: input.module || 'manual',
    calendarLayer: normalizeStoredCalendarLayer(input.calendarLayer, input.module || 'manual'),
    location: normalizedLocation,
    arriveByAt: input.arriveByAt || null,
    eventReminderEnabled: !!input.eventReminderEnabled,
    eventReminderLeadMinutes:
      typeof input.eventReminderLeadMinutes === 'number' && Number.isFinite(input.eventReminderLeadMinutes)
        ? Math.max(0, Math.min(240, Math.round(input.eventReminderLeadMinutes)))
        : 0,
    travelFromAddress: normalizedTravelFromAddress,
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
    leaveReminderEnabled: !!input.leaveReminderEnabled && hasCommuteRouting,
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
    void insertManualEventRemote(remoteId, row, timezoneName)
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
    calendarLayer: row.calendarLayer || 'family',
    location: row.location,
    arriveByAt: row.arriveByAt,
    eventReminderEnabled: row.eventReminderEnabled,
    eventReminderLeadMinutes: row.eventReminderLeadMinutes,
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
    module: row.module,
    readonly: false,
  };
}

export function updateManualCalendarEvent(
  eventId: string,
  input: ManualCalendarEventInput,
  userId?: string | null,
): CalendarEvent | null {
  const key = scopedKey(MANUAL_EVENTS_KEY, userId);
  const current = readJson<unknown[]>(key, [])
    .map((item) => normalizeManualEvent(item))
    .filter((item): item is StoredManualEvent => Boolean(item));
  const index = current.findIndex((item) => item.id === eventId);
  if (index < 0) return null;

  const existing = current[index];
  const normalizedLocation = input.location?.trim() || undefined;
  const normalizedTravelFromAddress = input.travelFromAddress?.trim() || undefined;
  const hasCommuteRouting = Boolean(normalizedLocation && normalizedTravelFromAddress);
  const updated: StoredManualEvent = {
    ...existing,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    module: input.module || 'manual',
    calendarLayer: normalizeStoredCalendarLayer(input.calendarLayer, input.module || 'manual'),
    location: normalizedLocation,
    arriveByAt: input.arriveByAt || null,
    eventReminderEnabled: !!input.eventReminderEnabled,
    eventReminderLeadMinutes:
      typeof input.eventReminderLeadMinutes === 'number' && Number.isFinite(input.eventReminderLeadMinutes)
        ? Math.max(0, Math.min(240, Math.round(input.eventReminderLeadMinutes)))
        : 0,
    travelFromAddress: normalizedTravelFromAddress,
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
    leaveReminderEnabled: !!input.leaveReminderEnabled && hasCommuteRouting,
    leaveReminderLeadMinutes:
      typeof input.leaveReminderLeadMinutes === 'number' && Number.isFinite(input.leaveReminderLeadMinutes)
        ? Math.max(5, Math.min(120, Math.round(input.leaveReminderLeadMinutes)))
        : 10,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay,
    updatedAt: new Date().toISOString(),
  };

  current[index] = updated;
  writeJson(key, current);

  const remoteId = remoteIdFromLocalId(eventId);
  if (userId && remoteId) {
    const timezoneName = guessUserTimeZone();
    void upsertManualEventRemote(remoteId, updated, timezoneName, userId)
      .then(({ error }: { error?: { message?: string } | null }) => {
        if (error) console.error('Failed to update manual event in Supabase:', error.message || error);
      })
      .catch((error: unknown) => {
        console.error('Failed to update manual event in Supabase:', error);
      });
  }

  return {
    id: updated.id,
    title: updated.title,
    description: updated.description,
    calendarLayer: updated.calendarLayer || 'family',
    location: updated.location,
    arriveByAt: updated.arriveByAt,
    eventReminderEnabled: updated.eventReminderEnabled,
    eventReminderLeadMinutes: updated.eventReminderLeadMinutes,
    travelFromAddress: updated.travelFromAddress,
    travelMode: updated.travelMode,
    travelDurationMinutes: updated.travelDurationMinutes,
    trafficDurationMinutes: updated.trafficDurationMinutes,
    recommendedLeaveAt: updated.recommendedLeaveAt,
    leaveReminderEnabled: updated.leaveReminderEnabled,
    leaveReminderLeadMinutes: updated.leaveReminderLeadMinutes,
    startsAt: updated.startsAt,
    endsAt: updated.endsAt,
    allDay: updated.allDay,
    source: 'manual',
    module: updated.module,
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
