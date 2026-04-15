import {
  addDays,
  addHours,
  addMinutes,
  addWeeks,
  differenceInCalendarWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { DbPlannedMeal, fetchMealsForWeek } from '@/lib/api/meals';
import { getDinnerReminderPrefs, getDinnerTimeForDay, getMenuRejuvenatePrefs } from '@/lib/mealPrefs';
import { getOrderReminderSettings } from '@/lib/groceryPrefs';
import { DayOfWeek } from '@/types';
import type { Workout, CardioSession } from '@/workouts/types/workout';
import { listTaskDatesInRange, loadTasks } from '@/lib/taskStore';
import { fetchManualCalendarEventsInRange, CalendarEvent, CalendarEventModule } from '@/lib/calendarStore';
import { supabase } from '@/integrations/supabase/client';
import { resolveSharedScopeUserId } from '@/lib/householdScope';

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';
const WORKOUTS_KEY = 'liftlog_workouts';
const CARDIO_KEY = 'liftlog_cardio_sessions';
const DERIVED_SYNC_SOURCES = ['task', 'chore', 'workout'] as const;

type WeekdayChore = {
  name: string;
  day?: DayOfWeek;
  days?: DayOfWeek[];
  isCompleted?: boolean;
};

type ChildChoreState = {
  name: string;
  weeklyChores: WeekdayChore[];
  extraChores: { name: string; dueAt: string; isCompleted: boolean; isFailed: boolean }[];
};

export const CALENDAR_MODULE_META: Record<
  CalendarEventModule,
  { label: string; badgeClass: string; dotClass: string }
> = {
  manual: {
    label: 'Family',
    badgeClass: 'border-violet-200 bg-violet-100/70 text-violet-800',
    dotClass: 'bg-violet-500',
  },
  meals: {
    label: 'Meals',
    badgeClass: 'border-emerald-200 bg-emerald-100/70 text-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  tasks: {
    label: 'Tasks',
    badgeClass: 'border-blue-200 bg-blue-100/70 text-blue-800',
    dotClass: 'bg-blue-500',
  },
  chores: {
    label: 'Chores',
    badgeClass: 'border-amber-200 bg-amber-100/70 text-amber-800',
    dotClass: 'bg-amber-500',
  },
  workouts: {
    label: 'Workouts',
    badgeClass: 'border-rose-200 bg-rose-100/70 text-rose-800',
    dotClass: 'bg-rose-500',
  },
  reminders: {
    label: 'Reminders',
    badgeClass: 'border-slate-200 bg-slate-100/80 text-slate-700',
    dotClass: 'bg-slate-500',
  },
};

type SyncCalendarEventSource = (typeof DERIVED_SYNC_SOURCES)[number];

type ExistingDerivedCalendarRow = {
  id: string;
  related_id: string | null;
  is_deleted: boolean;
};

type CalendarSyncError = { message?: string } | null;

type SupabaseCalendarSyncClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        gte: (column: string, value: string) => {
          lt: (column: string, value: string) => {
            in: (column: string, values: string[]) => Promise<{
              data: ExistingDerivedCalendarRow[] | null;
              error: CalendarSyncError;
            }>;
          };
        };
      };
    };
    insert: (values: Record<string, unknown>) => Promise<{ error: CalendarSyncError }>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: CalendarSyncError }>;
    };
  };
};

const supabaseCalendarSync = supabase as unknown as SupabaseCalendarSyncClient;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function guessUserTimeZone(): string {
  if (typeof Intl === 'undefined') return 'UTC';
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && zone.trim() ? zone : 'UTC';
}

function choresStateKey(userId?: string | null): string {
  return `${CHORES_STATE_KEY_PREFIX}:${resolveSharedScopeUserId(userId || 'scope') || 'anon'}`;
}

function dayToIndexMonday(day: DayOfWeek): number {
  switch (day) {
    case 'monday':
      return 0;
    case 'tuesday':
      return 1;
    case 'wednesday':
      return 2;
    case 'thursday':
      return 3;
    case 'friday':
      return 4;
    case 'saturday':
      return 5;
    case 'sunday':
      return 6;
    default:
      return 0;
  }
}

function normalizeDay(raw: unknown): DayOfWeek | null {
  if (typeof raw !== 'string') return null;
  const value = raw.toLowerCase() as DayOfWeek;
  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.includes(value) ? value : null;
}

function inRange(date: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return !isBefore(date, rangeStart) && !isAfter(date, rangeEnd);
}

function calendarLayerForDerivedEvent(event: CalendarEvent): string {
  if (event.source === 'task') return 'kids';
  if (event.source === 'chore') return 'chores';
  if (event.source === 'workout') return 'family';
  return 'family';
}

function buildDerivedRelatedKey(event: CalendarEvent): string | null {
  const baseKey = typeof event.relatedId === 'string' && event.relatedId.trim()
    ? event.relatedId.trim()
    : typeof event.id === 'string' && event.id.trim()
      ? event.id.trim()
      : null;

  if (!baseKey) return null;
  if (event.source !== 'task') return baseKey;

  const parts = [baseKey];
  if (event.assigneeId) {
    parts.push(`assignee-id=${encodeURIComponent(event.assigneeId)}`);
  }
  if (event.assigneeName) {
    parts.push(`assignee-name=${encodeURIComponent(event.assigneeName)}`);
  }
  return parts.join('::');
}

export async function syncDerivedCalendarEvents(
  userId: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
  events: CalendarEvent[],
): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId);
  if (!scopedUserId || scopedUserId === 'demo-user') return;

  const desiredEvents = events
    .filter((event) => DERIVED_SYNC_SOURCES.includes(event.source as SyncCalendarEventSource))
    .map((event) => ({ ...event, relatedKey: buildDerivedRelatedKey(event) }))
    .filter((event) => typeof event.relatedKey === 'string' && event.relatedKey.trim().length > 0);

  const desiredByRelated = new Map<string, (typeof desiredEvents)[number]>();
  desiredEvents.forEach((event) => {
    desiredByRelated.set(event.relatedKey, event);
  });

  const windowStart = addDays(rangeStart, -1).toISOString();
  const windowEnd = addDays(rangeEnd, 1).toISOString();

  const { data: existingRows, error: existingError } = await supabaseCalendarSync
    .from('calendar_events')
    .select('id,related_id,is_deleted')
    .eq('owner_id', scopedUserId)
    .gte('starts_at', windowStart)
    .lt('starts_at', windowEnd)
    .in('source', [...DERIVED_SYNC_SOURCES]);

  if (existingError) {
    console.error('Failed loading derived calendar rows for sync:', existingError.message || existingError);
    return;
  }

  const existingByRelated = new Map<string, ExistingDerivedCalendarRow>();
  (existingRows || []).forEach((row) => {
    if (typeof row.related_id === 'string' && row.related_id.trim()) {
      existingByRelated.set(row.related_id, row);
    }
  });

  const timezoneName = guessUserTimeZone();
  const ops: Promise<{ error: CalendarSyncError }>[] = [];

  desiredByRelated.forEach((event, relatedKey) => {
    const existing = existingByRelated.get(relatedKey);
    const payload = {
      title: event.title,
      description: event.description || null,
      starts_at: event.startsAt,
      ends_at: event.endsAt || null,
      all_day: !!event.allDay,
      module: event.module,
      source: event.source,
      related_id: relatedKey,
      calendar_layer: calendarLayerForDerivedEvent(event),
      event_reminder_enabled: !!event.eventReminderEnabled,
      event_reminder_lead_minutes:
        typeof event.eventReminderLeadMinutes === 'number' && Number.isFinite(event.eventReminderLeadMinutes)
          ? event.eventReminderLeadMinutes
          : null,
      timezone_name: timezoneName,
      location_text: event.location || null,
      recurrence_rule: null,
      is_deleted: false,
      deleted_at: null,
    };

    if (existing) {
      ops.push(
        supabaseCalendarSync
          .from('calendar_events')
          .update(payload)
          .eq('id', existing.id),
      );
    } else {
      ops.push(
        supabaseCalendarSync
          .from('calendar_events')
          .insert({
            owner_id: scopedUserId,
            ...payload,
          }),
      );
    }
  });

  const desiredRelatedIds = new Set(desiredByRelated.keys());
  (existingRows || []).forEach((row) => {
    if (!row.related_id || desiredRelatedIds.has(row.related_id) || row.is_deleted) return;
    ops.push(
      supabaseCalendarSync
        .from('calendar_events')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', row.id),
    );
  });

  if (!ops.length) return;
  const results = await Promise.all(ops);
  const errors = results.map((result) => result.error).filter((error) => !!error);
  if (errors.length > 0) {
    console.error(
      'One or more derived calendar sync operations failed:',
      errors.map((error) => error?.message || 'unknown'),
    );
  }
}

function withTime(baseDate: Date, hhmm: string): Date {
  const [hourRaw, minuteRaw] = hhmm.split(':');
  const date = new Date(baseDate);
  date.setHours(Number.parseInt(hourRaw, 10) || 0, Number.parseInt(minuteRaw, 10) || 0, 0, 0);
  return date;
}

function weeklyDatesInRange(rangeStart: Date, rangeEnd: Date, day: DayOfWeek): Date[] {
  const dates: Date[] = [];
  let cursor = startOfWeek(rangeStart, { weekStartsOn: 1 });
  while (!isAfter(cursor, rangeEnd)) {
    const candidate = addDays(cursor, dayToIndexMonday(day));
    if (inRange(candidate, rangeStart, rangeEnd)) dates.push(candidate);
    cursor = addWeeks(cursor, 1);
  }
  return dates;
}

function normalizeChoreDays(chore: WeekdayChore): DayOfWeek[] {
  const list = Array.isArray(chore.days)
    ? chore.days
        .map((day) => normalizeDay(day))
        .filter((day): day is DayOfWeek => !!day)
    : [];
  if (list.length > 0) return [...new Set(list)];
  if (chore.day) return [chore.day];
  return [];
}

function loadChoreState(userId?: string | null): ChildChoreState[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(choresStateKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { children?: unknown[] };
    const children = Array.isArray(parsed.children) ? parsed.children : [];
    return children
      .map((entry) => {
        const row = (entry || {}) as {
          name?: string;
          weeklyChores?: { name?: string; day?: string; days?: string[]; isCompleted?: boolean }[];
          extraChores?: { name?: string; dueAt?: string; isCompleted?: boolean; isFailed?: boolean }[];
        };
        const weekly = Array.isArray(row.weeklyChores)
          ? row.weeklyChores
              .map((chore) => ({
                name: String(chore?.name || 'Weekly chore'),
                day: normalizeDay(chore?.day) || undefined,
                days: Array.isArray(chore?.days)
                  ? chore.days
                      .map((day) => normalizeDay(day))
                      .filter((day): day is DayOfWeek => !!day)
                  : undefined,
                isCompleted: !!chore?.isCompleted,
              }))
              .filter((chore) => !!chore.name)
          : [];
        const extra = Array.isArray(row.extraChores)
          ? row.extraChores.map((chore) => ({
              name: String(chore?.name || 'Extra chore'),
              dueAt: String(chore?.dueAt || ''),
              isCompleted: !!chore?.isCompleted,
              isFailed: !!chore?.isFailed,
            }))
          : [];
        return {
          name: String(row.name || 'Child'),
          weeklyChores: weekly,
          extraChores: extra,
        };
      })
      .filter((child) => child.weeklyChores.length > 0 || child.extraChores.length > 0);
  } catch {
    return [];
  }
}

function loadWorkouts(): Workout[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(WORKOUTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Workout[]) : [];
  } catch {
    return [];
  }
}

function loadCardio(): CardioSession[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CARDIO_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CardioSession[]) : [];
  } catch {
    return [];
  }
}

function collectDerivedEventsForRange(
  rangeStart: Date,
  rangeEnd: Date,
  userId?: string | null,
): CalendarEvent[] {
  const derivedEvents: CalendarEvent[] = [];

  const taskRows = loadTasks(userId);
  taskRows.forEach((task) => {
    if (task.status === 'done') return;
    const occurrences = listTaskDatesInRange(task, rangeStart, rangeEnd);
    if (occurrences.length === 0) return;
    const reminderTime = task.reminderTime || '09:00';

    occurrences.forEach((date) => {
      const start = withTime(date, reminderTime);
      const eventId = task.frequency === 'once' ? `task-${task.id}` : `task-${task.id}-${format(date, 'yyyy-MM-dd')}`;
      derivedEvents.push({
        id: eventId,
        title: task.title,
        description: task.notes,
        assigneeId: task.assignedToId,
        assigneeName: task.assignedToName,
        eventReminderEnabled: !!task.reminderEnabled,
        eventReminderLeadMinutes: task.reminderEnabled ? 0 : null,
        startsAt: start.toISOString(),
        endsAt: task.frequency === 'once' ? undefined : addMinutes(start, 30).toISOString(),
        allDay: task.frequency === 'once',
        source: 'task',
        module: 'tasks',
        relatedId: eventId,
        readonly: true,
      });
    });
  });

  const choreState = loadChoreState(userId);
  choreState.forEach((child) => {
    child.weeklyChores
      .filter((chore) => !chore.isCompleted)
      .forEach((chore) => {
        normalizeChoreDays(chore).forEach((day) => {
          weeklyDatesInRange(rangeStart, rangeEnd, day).forEach((date) => {
            const relatedId = `chore-${child.name}-${chore.name}-${day}-${format(date, 'yyyy-MM-dd')}`;
            derivedEvents.push({
              id: relatedId,
              title: `${child.name}: ${chore.name}`,
              startsAt: withTime(date, '16:30').toISOString(),
              endsAt: withTime(date, '17:00').toISOString(),
              allDay: false,
              source: 'chore',
              module: 'chores',
              relatedId,
              readonly: true,
            });
          });
        });
      });

    child.extraChores
      .filter((extra) => !extra.isCompleted && !extra.isFailed && !!extra.dueAt)
      .forEach((extra) => {
        const due = new Date(extra.dueAt);
        if (!inRange(due, rangeStart, rangeEnd)) return;
        const relatedId = `extra-${child.name}-${extra.name}-${extra.dueAt}`;
        derivedEvents.push({
          id: relatedId,
          title: `${child.name}: ${extra.name} due`,
          startsAt: due.toISOString(),
          endsAt: addMinutes(due, 30).toISOString(),
          allDay: false,
          source: 'chore',
          module: 'chores',
          relatedId,
          readonly: true,
        });
      });
  });

  loadWorkouts().forEach((workout) => {
    if (!workout.date) return;
    const fallbackStart = parseISO(`${workout.date}T07:00:00`);
    const start = Number.isFinite(workout.startTime) ? new Date(workout.startTime) : fallbackStart;
    if (!inRange(start, rangeStart, rangeEnd)) return;
    const end = Number.isFinite(workout.endTime) ? new Date(workout.endTime) : addHours(start, 1);
    const relatedId = `workout-${workout.id}`;

    derivedEvents.push({
      id: relatedId,
      title: `Workout (${workout.exercises.length} exercises)`,
      description: workout.notes,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      allDay: false,
      source: 'workout',
      module: 'workouts',
      relatedId,
      readonly: true,
    });
  });

  loadCardio().forEach((session) => {
    if (!session.date) return;
    const start = parseISO(`${session.date}T07:30:00`);
    if (!inRange(start, rangeStart, rangeEnd)) return;
    const relatedId = `cardio-${session.id}`;
    derivedEvents.push({
      id: relatedId,
      title: `Cardio: ${session.type}`,
      description: `${session.duration} min • ${session.distance}`,
      startsAt: start.toISOString(),
      endsAt: addMinutes(start, Math.max(15, session.duration)).toISOString(),
      allDay: false,
      source: 'workout',
      module: 'workouts',
      relatedId,
      readonly: true,
    });
  });

  return derivedEvents;
}

export async function syncDerivedCalendarSnapshot(
  userId: string | null | undefined,
  anchorDate: Date = new Date(),
): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId);
  if (!scopedUserId || scopedUserId === 'demo-user') return;
  const snapshotStart = addDays(anchorDate, -14);
  const snapshotEnd = addDays(anchorDate, 180);
  const derivedEvents = collectDerivedEventsForRange(snapshotStart, snapshotEnd, scopedUserId);
  await syncDerivedCalendarEvents(scopedUserId, snapshotStart, snapshotEnd, derivedEvents);
}

export async function fetchCalendarEventsForMonth(month: Date, userId?: string | null): Promise<CalendarEvent[]> {
  const scopedUserId = resolveSharedScopeUserId(userId);
  const rangeStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const rangeEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
  const nextEvents: CalendarEvent[] = [];
  const dinnerPrefs = getDinnerReminderPrefs();

  const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekOffsets: number[] = [];
  let cursor = startOfWeek(rangeStart, { weekStartsOn: 1 });
  while (!isAfter(cursor, rangeEnd)) {
    weekOffsets.push(
      differenceInCalendarWeeks(cursor, currentWeekStart, {
        weekStartsOn: 1,
      }),
    );
    cursor = addWeeks(cursor, 1);
  }

  const mealsByWeek = await Promise.all(
    weekOffsets.map(async (offset) => {
      try {
        return await fetchMealsForWeek(offset);
      } catch {
        return [] as DbPlannedMeal[];
      }
    }),
  );

  const meals = mealsByWeek.flat();
  meals.forEach((meal) => {
    if (meal.is_skipped || !meal.recipes) return;
    const day = normalizeDay(meal.day);
    if (!day) return;

    const weekStart = parseISO(`${meal.week_of}T00:00:00`);
    const mealDate = addDays(weekStart, dayToIndexMonday(day));
    if (!inRange(mealDate, rangeStart, rangeEnd)) return;

    const mealStart = withTime(mealDate, getDinnerTimeForDay(day, dinnerPrefs));
    nextEvents.push({
      id: `meal-${meal.id}`,
      title: meal.recipes.name,
      description: 'Planned dinner',
      startsAt: mealStart.toISOString(),
      endsAt: addHours(mealStart, 1).toISOString(),
      allDay: false,
      source: 'meal',
      module: 'meals',
      relatedId: meal.id,
      readonly: true,
    });

  });

  nextEvents.push(...collectDerivedEventsForRange(rangeStart, rangeEnd, scopedUserId));

  const groceryReminder = getOrderReminderSettings();
  if (groceryReminder.enabled) {
    weeklyDatesInRange(rangeStart, rangeEnd, groceryReminder.day).forEach((date) => {
      const time = withTime(date, groceryReminder.time);
      nextEvents.push({
        id: `reminder-grocery-${format(date, 'yyyy-MM-dd')}`,
        title: 'Place grocery order',
        description: 'Grocery reminder from your schedule settings',
        startsAt: time.toISOString(),
        endsAt: addMinutes(time, 20).toISOString(),
        allDay: false,
        source: 'reminder',
        module: 'reminders',
        readonly: true,
      });
    });
  }

  const menuRejuvenate = getMenuRejuvenatePrefs();
  if (menuRejuvenate.enabled) {
    weeklyDatesInRange(rangeStart, rangeEnd, menuRejuvenate.day).forEach((date) => {
      const time = withTime(date, menuRejuvenate.time);
      nextEvents.push({
        id: `reminder-menu-${format(date, 'yyyy-MM-dd')}`,
        title: 'Regenerate next week menu',
        description: 'Meal plan refresh reminder',
        startsAt: time.toISOString(),
        endsAt: addMinutes(time, 20).toISOString(),
        allDay: false,
        source: 'reminder',
        module: 'reminders',
        readonly: true,
      });
    });
  }

  nextEvents.push(...await fetchManualCalendarEventsInRange(rangeStart, addDays(rangeEnd, 1), scopedUserId));
  nextEvents.sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1));
  void syncDerivedCalendarEvents(scopedUserId, rangeStart, rangeEnd, nextEvents);
  return nextEvents;
}
