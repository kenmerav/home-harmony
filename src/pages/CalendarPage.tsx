import { useCallback, useEffect, useMemo, useState } from 'react';
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
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { DbPlannedMeal, fetchMealsForWeek } from '@/lib/api/meals';
import { getOrderReminderSettings } from '@/lib/groceryPrefs';
import { getDinnerReminderPrefs, getMenuRejuvenatePrefs } from '@/lib/mealPrefs';
import { estimateCookMinutes } from '@/lib/recipeTime';
import { loadTasks } from '@/lib/taskStore';
import { estimateCommuteEta } from '@/lib/api/commute';
import {
  defaultSmsPreferences,
  loadSmsPreferences,
  saveSmsPreferences,
  sendSmsTestMessage,
  SMS_REMINDER_MODULES,
  SmsPreferences,
  SmsReminderModule,
} from '@/lib/api/sms';
import {
  addManualCalendarEvent,
  CalendarEvent,
  CalendarEventModule,
  deleteManualCalendarEvent,
  getGoogleCalendarPrefs,
  getManualCalendarEvents,
  GoogleCalendarPrefs,
  setGoogleCalendarPrefs,
} from '@/lib/calendarStore';
import {
  CalendarFilterPreset,
  createCalendarFilterPreset,
  filtersEqual,
  loadStoredCalendarFilterPresets,
  loadStoredCalendarFilters,
  normalizeCalendarFilterName,
  saveStoredCalendarFilterPresets,
  saveStoredCalendarFilters,
} from '@/lib/calendarFilters';
import { DayOfWeek } from '@/types';
import type { Workout, CardioSession } from '@/workouts/types/workout';
import { CalendarDays, ExternalLink, Phone, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useSearchParams } from 'react-router-dom';

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';
const WORKOUTS_KEY = 'liftlog_workouts';
const CARDIO_KEY = 'liftlog_cardio_sessions';

type CalendarViewMode = 'month' | 'week';
type CalendarSetupMode = 'google' | 'apple';

type WeekdayChore = {
  name: string;
  day: DayOfWeek;
  isCompleted?: boolean;
};

type ChildChoreState = {
  name: string;
  weeklyChores: WeekdayChore[];
  extraChores: { name: string; dueAt: string; isCompleted: boolean; isFailed: boolean }[];
};

const dayToIndexMonday = (day: DayOfWeek): number => {
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
};

const moduleMeta: Record<CalendarEventModule, { label: string; badgeClass: string }> = {
  manual: { label: 'Manual', badgeClass: 'border-violet-200 bg-violet-100/70 text-violet-800' },
  meals: { label: 'Meals', badgeClass: 'border-emerald-200 bg-emerald-100/70 text-emerald-800' },
  tasks: { label: 'Tasks', badgeClass: 'border-blue-200 bg-blue-100/70 text-blue-800' },
  chores: { label: 'Chores', badgeClass: 'border-amber-200 bg-amber-100/70 text-amber-800' },
  workouts: { label: 'Workouts', badgeClass: 'border-rose-200 bg-rose-100/70 text-rose-800' },
  reminders: { label: 'Reminders', badgeClass: 'border-slate-200 bg-slate-100/80 text-slate-700' },
};

const smsModuleLabel: Record<SmsReminderModule, string> = {
  meals: 'Meal schedule',
  manual: 'Manual calendar events',
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function parsePhoneList(input: string): string[] {
  return [...new Set(
    input
      .split(/[\n,;]+/g)
      .map((item) => item.trim())
      .filter((item) => item.length > 0),
  )];
}

function formatPhoneList(input: string[]): string {
  return input.join(', ');
}

function choresStateKey(userId?: string | null): string {
  return `${CHORES_STATE_KEY_PREFIX}:${userId || 'anon'}`;
}

function inRange(date: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return !isBefore(date, rangeStart) && !isAfter(date, rangeEnd);
}

function withTime(baseDate: Date, hhmm: string): Date {
  const [hourRaw, minuteRaw] = hhmm.split(':');
  const date = new Date(baseDate);
  date.setHours(Number.parseInt(hourRaw, 10) || 0, Number.parseInt(minuteRaw, 10) || 0, 0, 0);
  return date;
}

function toGoogleDateToken(input: Date): string {
  return input.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function buildGoogleEventUrl(event: CalendarEvent): string {
  const start = parseISO(event.startsAt);
  const end = event.endsAt ? parseISO(event.endsAt) : addHours(start, 1);
  const dates = event.allDay
    ? `${format(start, 'yyyyMMdd')}/${format(addDays(start, 1), 'yyyyMMdd')}`
    : `${toGoogleDateToken(start)}/${toGoogleDateToken(end)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: event.description || '',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsDateToken(date: Date, allDay: boolean): string {
  if (allDay) return format(date, 'yyyyMMdd');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function normalizeDay(raw: unknown): DayOfWeek | null {
  if (typeof raw !== 'string') return null;
  const value = raw.toLowerCase() as DayOfWeek;
  const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return days.includes(value) ? value : null;
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
          weeklyChores?: { name?: string; day?: string; isCompleted?: boolean }[];
          extraChores?: { name?: string; dueAt?: string; isCompleted?: boolean; isFailed?: boolean }[];
        };
        const weekly = Array.isArray(row.weeklyChores)
          ? row.weeklyChores
              .map((chore) => ({
                name: String(chore?.name || 'Weekly chore'),
                day: normalizeDay(chore?.day) || 'monday',
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

function eventTimeLabel(event: CalendarEvent): string {
  const start = parseISO(event.startsAt);
  if (event.allDay) return 'All day';
  const startLabel = format(start, 'h:mm a');
  if (!event.endsAt) return startLabel;
  const end = parseISO(event.endsAt);
  return `${startLabel} - ${format(end, 'h:mm a')}`;
}

function parseCalendarSetupMode(value: string | null): CalendarSetupMode | null {
  if (value === 'google') return 'google';
  if (value === 'apple') return 'apple';
  return null;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Record<CalendarEventModule, boolean>>(() =>
    loadStoredCalendarFilters(user?.id),
  );
  const [filterPresets, setFilterPresets] = useState<CalendarFilterPreset[]>(() =>
    loadStoredCalendarFilterPresets(user?.id),
  );
  const [activeFilterPresetId, setActiveFilterPresetId] = useState<string | null>(null);
  const [smsPrefs, setSmsPrefs] = useState<SmsPreferences>(() =>
    defaultSmsPreferences(
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York',
    ),
  );
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const canUseRemoteSms = Boolean(user?.id && user.id !== 'demo-user');
  const [googlePrefs, setGooglePrefsState] = useState<GoogleCalendarPrefs>(() =>
    getGoogleCalendarPrefs(user?.id),
  );
  const setupModeFromQuery = parseCalendarSetupMode(searchParams.get('setup'));
  const [calendarSetupMode, setCalendarSetupMode] = useState<CalendarSetupMode>(
    setupModeFromQuery || 'google',
  );
  const [calendarSetupOpen, setCalendarSetupOpen] = useState(Boolean(setupModeFromQuery));
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftHomeAddress, setDraftHomeAddress] = useState('');
  const [draftTravelMinutes, setDraftTravelMinutes] = useState<number | null>(null);
  const [draftTrafficMinutes, setDraftTrafficMinutes] = useState<number | null>(null);
  const [draftLeaveByIso, setDraftLeaveByIso] = useState<string | null>(null);
  const [draftLeaveReminderEnabled, setDraftLeaveReminderEnabled] = useState(false);
  const [draftTravelLoading, setDraftTravelLoading] = useState(false);
  const [draftTravelError, setDraftTravelError] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [draftTime, setDraftTime] = useState('18:00');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [draftAllDay, setDraftAllDay] = useState(false);

  useEffect(() => {
    setGooglePrefsState(getGoogleCalendarPrefs(user?.id));
  }, [user?.id]);

  useEffect(() => {
    setFilters(loadStoredCalendarFilters(user?.id));
    setFilterPresets(loadStoredCalendarFilterPresets(user?.id));
  }, [user?.id]);

  useEffect(() => {
    saveStoredCalendarFilters(filters, user?.id);
  }, [filters, user?.id]);

  useEffect(() => {
    saveStoredCalendarFilterPresets(filterPresets, user?.id);
  }, [filterPresets, user?.id]);

  useEffect(() => {
    const activeMatch = filterPresets.find((preset) => filtersEqual(preset.modules, filters));
    setActiveFilterPresetId(activeMatch?.id || null);
  }, [filterPresets, filters]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!canUseRemoteSms) {
        setSmsPrefs(
          defaultSmsPreferences(
            typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York',
          ),
        );
        return;
      }
      setSmsLoading(true);
      try {
        const loaded = await loadSmsPreferences();
        if (mounted) setSmsPrefs(loaded);
      } catch (error) {
        if (mounted) {
          toast({
            title: 'Could not load reminder texts',
            description: error instanceof Error ? error.message : 'Please try again.',
            variant: 'destructive',
          });
        }
      } finally {
        if (mounted) setSmsLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [canUseRemoteSms, toast]);

  useEffect(() => {
    if (!setupModeFromQuery) return;
    setCalendarSetupMode(setupModeFromQuery);
    setCalendarSetupOpen(true);
  }, [setupModeFromQuery]);

  const refreshEvents = useCallback(async () => {
    const rangeStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const rangeEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    setIsLoading(true);
    try {
      const nextEvents: CalendarEvent[] = [];

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

      const dinnerPrefs = getDinnerReminderPrefs();
      const meals = mealsByWeek.flat();
      meals.forEach((meal) => {
        if (meal.is_skipped || !meal.recipes) return;
        const day = normalizeDay(meal.day);
        if (!day) return;

        const weekStart = parseISO(`${meal.week_of}T00:00:00`);
        const mealDate = addDays(weekStart, dayToIndexMonday(day));
        if (!inRange(mealDate, rangeStart, rangeEnd)) return;

        const mealStart = withTime(mealDate, dinnerPrefs.preferredDinnerTime || '18:00');
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

        if (dinnerPrefs.enabled) {
          const cookMinutes = estimateCookMinutes(meal.recipes.instructions) ?? 45;
          const prepStart = addMinutes(mealStart, -Math.max(15, cookMinutes));
          nextEvents.push({
            id: `prep-${meal.id}`,
            title: `Start prep: ${meal.recipes.name}`,
            description: `Estimated cook time ${cookMinutes} minutes`,
            startsAt: prepStart.toISOString(),
            endsAt: mealStart.toISOString(),
            allDay: false,
            source: 'reminder',
            module: 'reminders',
            relatedId: meal.id,
            readonly: true,
          });
        }
      });

      const taskRows = loadTasks(user?.id);
      taskRows.forEach((task) => {
        if (task.status === 'done') return;
        if (task.frequency === 'once') {
          if (!task.dueDate) return;
          const due = parseISO(`${task.dueDate}T09:00:00`);
          if (!inRange(due, rangeStart, rangeEnd)) return;
          nextEvents.push({
            id: `task-${task.id}`,
            title: task.title,
            description: task.notes,
            startsAt: due.toISOString(),
            allDay: true,
            source: 'task',
            module: 'tasks',
            relatedId: task.id,
            readonly: true,
          });
          return;
        }

        if (task.frequency === 'daily') {
          let dayCursor = new Date(rangeStart);
          while (!isAfter(dayCursor, rangeEnd)) {
            nextEvents.push({
              id: `task-${task.id}-${format(dayCursor, 'yyyy-MM-dd')}`,
              title: task.title,
              description: task.notes,
              startsAt: withTime(dayCursor, '09:00').toISOString(),
              endsAt: withTime(dayCursor, '09:30').toISOString(),
              allDay: false,
              source: 'task',
              module: 'tasks',
              relatedId: task.id,
              readonly: true,
            });
            dayCursor = addDays(dayCursor, 1);
          }
          return;
        }

        if (task.day) {
          weeklyDatesInRange(rangeStart, rangeEnd, task.day).forEach((date) => {
            nextEvents.push({
              id: `task-${task.id}-${format(date, 'yyyy-MM-dd')}`,
              title: task.title,
              description: task.notes,
              startsAt: withTime(date, '09:00').toISOString(),
              endsAt: withTime(date, '09:30').toISOString(),
              allDay: false,
              source: 'task',
              module: 'tasks',
              relatedId: task.id,
              readonly: true,
            });
          });
        }
      });

      const choreState = loadChoreState(user?.id);
      choreState.forEach((child) => {
        child.weeklyChores
          .filter((chore) => !chore.isCompleted)
          .forEach((chore) => {
            weeklyDatesInRange(rangeStart, rangeEnd, chore.day).forEach((date) => {
              nextEvents.push({
                id: `chore-${child.name}-${chore.name}-${format(date, 'yyyy-MM-dd')}`,
                title: `${child.name}: ${chore.name}`,
                startsAt: withTime(date, '16:30').toISOString(),
                endsAt: withTime(date, '17:00').toISOString(),
                allDay: false,
                source: 'chore',
                module: 'chores',
                readonly: true,
              });
            });
          });

        child.extraChores
          .filter((extra) => !extra.isCompleted && !extra.isFailed && !!extra.dueAt)
          .forEach((extra) => {
            const due = new Date(extra.dueAt);
            if (!inRange(due, rangeStart, rangeEnd)) return;
            nextEvents.push({
              id: `extra-${child.name}-${extra.name}-${extra.dueAt}`,
              title: `${child.name}: ${extra.name} due`,
              startsAt: due.toISOString(),
              endsAt: addMinutes(due, 30).toISOString(),
              allDay: false,
              source: 'chore',
              module: 'chores',
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

        nextEvents.push({
          id: `workout-${workout.id}`,
          title: `Workout (${workout.exercises.length} exercises)`,
          description: workout.notes,
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
          allDay: false,
          source: 'workout',
          module: 'workouts',
          relatedId: workout.id,
          readonly: true,
        });
      });

      loadCardio().forEach((session) => {
        if (!session.date) return;
        const start = parseISO(`${session.date}T07:30:00`);
        if (!inRange(start, rangeStart, rangeEnd)) return;
        nextEvents.push({
          id: `cardio-${session.id}`,
          title: `Cardio: ${session.type}`,
          description: `${session.duration} min • ${session.distance} ${session.distance >= 1 ? 'distance units' : 'unit'}`,
          startsAt: start.toISOString(),
          endsAt: addMinutes(start, Math.max(15, session.duration)).toISOString(),
          allDay: false,
          source: 'workout',
          module: 'workouts',
          relatedId: session.id,
          readonly: true,
        });
      });

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

      nextEvents.push(...getManualCalendarEvents(user?.id));

      nextEvents.sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1));
      setEvents(nextEvents);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, user?.id]);

  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handler = () => {
      void refreshEvents();
    };
    window.addEventListener('homehub:calendar-events-updated', handler);
    return () => window.removeEventListener('homehub:calendar-events-updated', handler);
  }, [refreshEvents]);

  const filteredEvents = useMemo(
    () => events.filter((event) => filters[event.module]),
    [events, filters],
  );

  const selectedDayEvents = useMemo(
    () =>
      filteredEvents.filter((event) => {
        const eventDate = parseISO(event.startsAt);
        return isSameDay(eventDate, selectedDate);
      }),
    [filteredEvents, selectedDate],
  );

  const selectedWeekDays = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx));
  }, [selectedDate]);

  const eventsByWeekDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    selectedWeekDays.forEach((day) => map.set(format(day, 'yyyy-MM-dd'), []));
    filteredEvents.forEach((event) => {
      const key = format(parseISO(event.startsAt), 'yyyy-MM-dd');
      if (map.has(key)) {
        map.get(key)?.push(event);
      }
    });
    map.forEach((value) => value.sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1)));
    return map;
  }, [filteredEvents, selectedWeekDays]);

  const upcomingEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => {
          const start = parseISO(event.startsAt);
          return !isBefore(start, new Date());
        })
        .slice(0, 8),
    [filteredEvents],
  );

  const eventDates = useMemo(() => filteredEvents.map((event) => parseISO(event.startsAt)), [filteredEvents]);

  const openAddDialog = () => {
    setDraftDate(format(selectedDate, 'yyyy-MM-dd'));
    setDraftTime('18:00');
    setDraftEndTime('');
    setDraftAllDay(false);
    setDraftTitle('');
    setDraftDescription('');
    setDraftLocation('');
    setDraftHomeAddress((smsPrefs.home_address || '').trim());
    setDraftTravelMinutes(null);
    setDraftTrafficMinutes(null);
    setDraftLeaveByIso(null);
    setDraftLeaveReminderEnabled(false);
    setDraftTravelError(null);
    setAddDialogOpen(true);
  };

  const openDayDetail = (day: Date) => {
    setSelectedDate(day);
    setDayDetailOpen(true);
  };

  const estimateTravelForDraft = async () => {
    if (draftAllDay) {
      setDraftTravelError('Travel estimate is available for timed events only.');
      return;
    }
    const origin = draftHomeAddress.trim() || smsPrefs.home_address.trim();
    const destination = draftLocation.trim();
    if (!origin || !destination) {
      setDraftTravelError('Add both home address and event location to estimate travel time.');
      return;
    }

    const departureIso = withTime(parseISO(`${draftDate}T00:00:00`), draftTime || '18:00').toISOString();
    setDraftTravelLoading(true);
    setDraftTravelError(null);
    try {
      const estimate = await estimateCommuteEta({
        origin,
        destination,
        departureTimeIso: departureIso,
      });
      const leaveAt = addMinutes(parseISO(departureIso), -Math.max(1, estimate.trafficDurationMinutes));
      setDraftTravelMinutes(estimate.durationMinutes);
      setDraftTrafficMinutes(estimate.trafficDurationMinutes);
      setDraftLeaveByIso(leaveAt.toISOString());
      toast({
        title: 'Travel time updated',
        description: `Leave by ${format(leaveAt, 'h:mm a')} (${estimate.trafficDurationMinutes} min with traffic).`,
      });
    } catch (error) {
      setDraftTravelError(error instanceof Error ? error.message : 'Could not estimate drive time.');
    } finally {
      setDraftTravelLoading(false);
    }
  };

  const saveHomeAddressFromDraft = async () => {
    const nextAddress = draftHomeAddress.trim();
    if (!nextAddress) {
      toast({ title: 'Enter your home address first', variant: 'destructive' });
      return;
    }
    if (!canUseRemoteSms) {
      setSmsPrefs((prev) => ({ ...prev, home_address: nextAddress }));
      toast({ title: 'Home address saved for this session' });
      return;
    }
    setSmsSaving(true);
    try {
      const saved = await saveSmsPreferences({ ...smsPrefs, home_address: nextAddress });
      setSmsPrefs(saved);
      setDraftHomeAddress(saved.home_address || nextAddress);
      toast({ title: 'Home address saved' });
    } catch (error) {
      toast({
        title: 'Could not save home address',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSmsSaving(false);
    }
  };

  const createManualEvent = () => {
    if (!draftTitle.trim()) {
      toast({ title: 'Add a title first', variant: 'destructive' });
      return;
    }
    const day = parseISO(`${draftDate}T00:00:00`);
    const startsAt = draftAllDay ? day.toISOString() : withTime(day, draftTime || '18:00').toISOString();
    const endsAt = draftAllDay
      ? addDays(day, 1).toISOString()
      : draftEndTime
      ? withTime(day, draftEndTime).toISOString()
      : undefined;

    if (!draftAllDay && endsAt && isBefore(parseISO(endsAt), parseISO(startsAt))) {
      toast({
        title: 'End time must be after start time',
        variant: 'destructive',
      });
      return;
    }

    addManualCalendarEvent(
      {
        title: draftTitle,
        description: draftDescription,
        location: draftLocation.trim() || undefined,
        travelFromAddress: (draftHomeAddress.trim() || smsPrefs.home_address.trim()) || undefined,
        travelMode: 'driving',
        travelDurationMinutes: draftTravelMinutes,
        trafficDurationMinutes: draftTrafficMinutes,
        recommendedLeaveAt: draftLeaveByIso,
        leaveReminderEnabled: draftLeaveReminderEnabled,
        leaveReminderLeadMinutes: 10,
        startsAt,
        endsAt,
        allDay: draftAllDay,
      },
      user?.id,
    );
    setAddDialogOpen(false);
    toast({ title: 'Event added to calendar' });
    void refreshEvents();
  };

  const exportCurrentMonthIcs = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const monthEvents = filteredEvents.filter((event) => {
      const date = parseISO(event.startsAt);
      return inRange(date, start, end);
    });

    if (monthEvents.length === 0) {
      toast({ title: 'No events to export', description: 'Try changing filters or month.' });
      return;
    }

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Home Harmony//Calendar//EN',
      'CALSCALE:GREGORIAN',
    ];

    monthEvents.forEach((event) => {
      const eventStart = parseISO(event.startsAt);
      const eventEnd = event.endsAt ? parseISO(event.endsAt) : addHours(eventStart, 1);
      const dtStamp = toIcsDateToken(new Date(), false);
      const dtStart = toIcsDateToken(eventStart, event.allDay);
      const dtEnd = toIcsDateToken(event.allDay ? addDays(eventStart, 1) : eventEnd, event.allDay);

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:${escapeIcsText(event.id)}@homeharmony`);
      lines.push(`DTSTAMP:${dtStamp}`);
      lines.push(event.allDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`);
      lines.push(event.allDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`);
      lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
      if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
      if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
      lines.push(`CATEGORIES:${escapeIcsText(moduleMeta[event.module].label)}`);
      lines.push('END:VEVENT');
    });

    lines.push('END:VCALENDAR');
    const blob = new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `home-harmony-${format(currentMonth, 'yyyy-MM')}.ics`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({ title: 'Calendar export ready', description: `Exported ${monthEvents.length} events.` });
  };

  const removeManualEvent = (eventId: string) => {
    deleteManualCalendarEvent(eventId, user?.id);
    toast({ title: 'Event removed' });
    void refreshEvents();
  };

  const setFilter = (module: CalendarEventModule, enabled: boolean) => {
    setFilters((prev) => ({ ...prev, [module]: enabled }));
  };

  const smsModulesForPreset = (preset: CalendarFilterPreset): SmsReminderModule[] => {
    const modules: SmsReminderModule[] = [];
    if (preset.modules.meals) modules.push('meals');
    if (preset.modules.manual) modules.push('manual');
    return modules;
  };

  const applyPresetRecipientsToSms = async (preset: CalendarFilterPreset) => {
    const recipients = preset.reminderRecipients;
    if (!recipients.length) return;
    const smsModules = smsModulesForPreset(preset);
    if (smsModules.length === 0) {
      toast({
        title: 'No SMS-enabled modules in this filter',
        description: 'Only Meals and Manual calendar events currently support reminder text routing.',
      });
      return;
    }

    const nextPrefs: SmsPreferences = {
      ...smsPrefs,
      include_modules: [...new Set([...smsPrefs.include_modules, ...smsModules])],
      module_recipients: {
        ...smsPrefs.module_recipients,
        meals: smsModules.includes('meals') ? recipients : smsPrefs.module_recipients.meals,
        manual: smsModules.includes('manual') ? recipients : smsPrefs.module_recipients.manual,
      },
    };
    setSmsPrefs(nextPrefs);

    if (!canUseRemoteSms) {
      toast({ title: 'Filter recipients saved locally for this session' });
      return;
    }

    try {
      const saved = await saveSmsPreferences(nextPrefs);
      setSmsPrefs(saved);
      toast({ title: 'Filter reminder recipients updated' });
    } catch (error) {
      toast({
        title: 'Could not save filter reminder recipients',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const addFilterPreset = () => {
    const existing = new Set(filterPresets.map((preset) => normalizeCalendarFilterName(preset.name).toLowerCase()));
    let nextIndex = filterPresets.length + 1;
    let suggestedName = `Filter ${nextIndex}`;
    while (existing.has(suggestedName.toLowerCase())) {
      nextIndex += 1;
      suggestedName = `Filter ${nextIndex}`;
    }

    const nextPreset = createCalendarFilterPreset(
      suggestedName,
      filters,
      filterPresets.length,
      [],
    );
    setFilterPresets((prev) => [...prev, nextPreset]);
    setActiveFilterPresetId(nextPreset.id);
    toast({ title: `Filter "${nextPreset.name}" saved` });
  };

  const renameFilterPreset = (presetId: string, name: string) => {
    setFilterPresets((prev) =>
      prev.map((preset) => (preset.id === presetId ? { ...preset, name } : preset)),
    );
  };

  const commitFilterPresetName = (presetId: string) => {
    setFilterPresets((prev) =>
      prev.map((preset) =>
        preset.id === presetId ? { ...preset, name: normalizeCalendarFilterName(preset.name) } : preset,
      ),
    );
  };

  const applyFilterPreset = (presetId: string) => {
    const preset = filterPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setFilters(preset.modules);
    setActiveFilterPresetId(preset.id);
    void applyPresetRecipientsToSms(preset);
  };

  const updatePresetFromCurrent = (presetId: string) => {
    setFilterPresets((prev) =>
      prev.map((preset) => (preset.id === presetId ? { ...preset, modules: { ...filters } } : preset)),
    );
    toast({ title: 'Filter updated from current toggles' });
  };

  const deleteFilterPreset = (presetId: string) => {
    setFilterPresets((prev) => prev.filter((preset) => preset.id !== presetId));
    setActiveFilterPresetId((prev) => (prev === presetId ? null : prev));
    toast({ title: 'Filter removed' });
  };

  const updateFilterPresetRecipients = (presetId: string, input: string) => {
    const recipients = parsePhoneList(input);
    setFilterPresets((prev) =>
      prev.map((preset) =>
        preset.id === presetId ? { ...preset, reminderRecipients: recipients } : preset,
      ),
    );
  };

  const updateSmsPref = <K extends keyof SmsPreferences>(key: K, value: SmsPreferences[K]) => {
    setSmsPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSmsModule = (moduleName: SmsReminderModule, checked: boolean) => {
    setSmsPrefs((prev) => {
      const next = checked
        ? [...new Set([...prev.include_modules, moduleName])]
        : prev.include_modules.filter((name) => name !== moduleName);
      return {
        ...prev,
        include_modules: next,
      };
    });
  };

  const updateModuleRecipientsInput = (moduleName: SmsReminderModule, input: string) => {
    const nextList = parsePhoneList(input);
    setSmsPrefs((prev) => ({
      ...prev,
      module_recipients: {
        ...prev.module_recipients,
        [moduleName]: nextList,
      },
    }));
  };

  const saveSmsSettings = async () => {
    if (!canUseRemoteSms) {
      toast({
        title: 'Sign in required',
        description: 'Create an account to enable SMS reminder texts.',
        variant: 'destructive',
      });
      return;
    }
    setSmsSaving(true);
    try {
      const saved = await saveSmsPreferences(smsPrefs);
      setSmsPrefs(saved);
      toast({ title: 'Reminder text filters saved' });
    } catch (error) {
      toast({
        title: 'Could not save reminder text filters',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSmsSaving(false);
    }
  };

  const sendSmsTest = async () => {
    if (!canUseRemoteSms) {
      toast({
        title: 'Sign in required',
        description: 'Create an account to send test reminder texts.',
        variant: 'destructive',
      });
      return;
    }
    setSmsTesting(true);
    try {
      await sendSmsTestMessage();
      toast({ title: 'Test SMS sent' });
    } catch (error) {
      toast({
        title: 'Could not send test SMS',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSmsTesting(false);
    }
  };

  const updateGooglePrefs = (updates: Partial<GoogleCalendarPrefs>) => {
    const next = { ...googlePrefs, ...updates };
    setGooglePrefsState(next);
    setGoogleCalendarPrefs(next, user?.id);
  };

  const closeCalendarSetupDialog = () => {
    setCalendarSetupOpen(false);
    if (!searchParams.get('setup') && !searchParams.get('source')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('setup');
    next.delete('source');
    setSearchParams(next, { replace: true });
  };

  const startGoogleSetup = () => {
    updateGooglePrefs({
      enabled: true,
      connectionStatus: googlePrefs.connectionStatus === 'connected' ? 'connected' : 'pending_oauth',
      connectedAt: googlePrefs.connectedAt || new Date().toISOString(),
    });
    toast({
      title: 'Google quick-add enabled',
      description: 'Your event cards now include one-click add-to-Google links.',
    });
  };

  return (
    <AppLayout>
      <PageHeader
        title="Calendar"
        subtitle={`Unified schedule for ${format(currentMonth, 'MMMM yyyy')}`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/calendar">Open Planner</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void refreshEvents()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCurrentMonthIcs}>
              Export .ics
            </Button>
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-6">
          <SectionCard title="Calendar View" subtitle="Pick a day to view details">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(day) => day && openDayDetail(day)}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              modifiers={{ hasEvent: eventDates }}
              modifiersClassNames={{ hasEvent: 'bg-primary/10 font-semibold text-foreground' }}
              className="rounded-md border"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Highlighted dates have at least one item from your enabled filters.
            </p>
          </SectionCard>

          <SectionCard title="Filters" subtitle="Show only what matters">
            <div className="space-y-3">
              {(Object.keys(moduleMeta) as CalendarEventModule[]).map((module) => (
                <div key={module} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('border', moduleMeta[module].badgeClass)}>
                      {moduleMeta[module].label}
                    </Badge>
                  </div>
                  <Switch
                    checked={filters[module]}
                    onCheckedChange={(checked) => setFilter(module, checked)}
                    aria-label={`Toggle ${moduleMeta[module].label} events`}
                  />
                </div>
              ))}

              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" onClick={addFilterPreset}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Filter
                </Button>
              </div>

              <div className="pt-3 border-t border-border space-y-3">
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Saved filters</p>
                {filterPresets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No saved filters yet. Use Add Filter above to save the current toggles.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {filterPresets.map((preset) => {
                      const isActive = activeFilterPresetId === preset.id;
                      return (
                        <div
                          key={preset.id}
                          className={cn(
                            'rounded-lg border border-border p-2 space-y-2',
                            isActive && 'border-primary/50 bg-primary/5',
                          )}
                        >
                          <Input
                            value={preset.name}
                            onChange={(event) => renameFilterPreset(preset.id, event.target.value)}
                            onBlur={() => commitFilterPresetName(preset.id)}
                            aria-label={`Filter name for ${preset.name}`}
                          />
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">
                              Reminder recipients for this filter
                            </label>
                            <Input
                              value={formatPhoneList(preset.reminderRecipients || [])}
                              onChange={(event) =>
                                updateFilterPresetRecipients(preset.id, event.target.value)
                              }
                              placeholder="+16155551234, +16155550999"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={isActive ? 'default' : 'outline'}
                              onClick={() => applyFilterPreset(preset.id)}
                            >
                              Apply
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => updatePresetFromCurrent(preset.id)}
                            >
                              Update
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteFilterPreset(preset.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Reminder text filters"
            subtitle="Choose which calendar filters send SMS and who should receive them"
          >
            {!canUseRemoteSms ? (
              <p className="text-sm text-muted-foreground">
                Sign in to enable reminder texts and assign family phone numbers by filter.
              </p>
            ) : smsLoading ? (
              <p className="text-sm text-muted-foreground">Loading reminder text settings...</p>
            ) : (
              <div className="space-y-4">
                <label className="w-full rounded-xl border border-border px-4 py-3 flex items-center justify-between">
                  <span className="text-sm">Enable SMS updates</span>
                  <Switch
                    checked={smsPrefs.enabled}
                    onCheckedChange={(checked) => updateSmsPref('enabled', Boolean(checked))}
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Fallback number</p>
                    <Input
                      placeholder="+15551234567"
                      value={smsPrefs.phone_e164}
                      onChange={(e) => updateSmsPref('phone_e164', e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Used when a filter has no custom recipients.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Timezone</p>
                    <Input
                      placeholder="America/New_York"
                      value={smsPrefs.timezone}
                      onChange={(e) => updateSmsPref('timezone', e.target.value)}
                    />
                  </div>
                </div>

                <label className="w-full rounded-xl border border-border px-4 py-3 flex items-center justify-between">
                  <span className="text-sm">Event reminder texts</span>
                  <Switch
                    checked={smsPrefs.event_reminders_enabled}
                    onCheckedChange={(checked) => updateSmsPref('event_reminders_enabled', Boolean(checked))}
                  />
                </label>

                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">Reminder offsets</p>
                  <div className="flex flex-wrap gap-2">
                    {[60, 30].map((offset) => {
                      const active = smsPrefs.reminder_offsets_minutes.includes(offset);
                      return (
                        <Button
                          key={offset}
                          type="button"
                          variant={active ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            const nextOffsets = active
                              ? smsPrefs.reminder_offsets_minutes.filter((value) => value !== offset)
                              : [...smsPrefs.reminder_offsets_minutes, offset];
                            updateSmsPref(
                              'reminder_offsets_minutes',
                              [...new Set(nextOffsets)].sort((a, b) => b - a),
                            );
                          }}
                        >
                          {offset} min before
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  {SMS_REMINDER_MODULES.map((moduleName) => {
                    const enabled = smsPrefs.include_modules.includes(moduleName);
                    const value = formatPhoneList(smsPrefs.module_recipients[moduleName] || []);
                    return (
                      <div key={moduleName} className="rounded-lg border border-border p-3 space-y-2">
                        <label className="flex items-center justify-between">
                          <span className="text-sm font-medium">{smsModuleLabel[moduleName]}</span>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(checked) => toggleSmsModule(moduleName, Boolean(checked))}
                          />
                        </label>
                        <div>
                          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">
                            Recipients for this filter
                          </p>
                          <Input
                            placeholder="+16155551234, +16155550999"
                            value={value}
                            onChange={(e) => updateModuleRecipientsInput(moduleName, e.target.value)}
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add one or more numbers, separated by commas. Example: mom + dad.
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void saveSmsSettings()} disabled={smsSaving}>
                    {smsSaving ? 'Saving...' : 'Save reminder text filters'}
                  </Button>
                  <Button variant="outline" onClick={() => void sendSmsTest()} disabled={smsTesting}>
                    <Phone className="mr-2 h-4 w-4" />
                    {smsTesting ? 'Sending test...' : 'Send test SMS'}
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Calendar integrations" subtitle="Plan in Home Harmony, see it anywhere">
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Google Calendar</span>
                  <Switch
                    checked={googlePrefs.enabled}
                    onCheckedChange={(checked) => updateGooglePrefs({ enabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Status</span>
                  <Badge variant="outline">
                    {googlePrefs.connectionStatus === 'connected' ? 'Connected' : 'OAuth setup pending'}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Target calendar label</label>
                  <Input
                    value={googlePrefs.selectedCalendarLabel}
                    onChange={(e) => updateGooglePrefs({ selectedCalendarLabel: e.target.value || 'Primary calendar' })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Use quick add links on each event. Full OAuth push sync can be connected next.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Apple Calendar</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/calendar/connect-apple">Connect feed</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  One-way subscribed feeds: edit events in Home Harmony, and Apple Calendar reflects updates automatically.
                </p>
                <Button variant="ghost" size="sm" onClick={exportCurrentMonthIcs}>
                  Export .ics snapshot
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setCalendarSetupOpen(true)}
              >
                Guided calendar setup
              </Button>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Schedule" subtitle={`${filteredEvents.length} events in this view`}>
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as CalendarViewMode)}>
              <TabsList className="mb-4">
                <TabsTrigger value="month">Selected Day</TabsTrigger>
                <TabsTrigger value="week">Week View</TabsTrigger>
              </TabsList>

              <TabsContent value="month" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {format(selectedDate, 'EEEE, MMMM d')}
                </p>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Loading events...</p>
                ) : selectedDayEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events for this date.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        googleEnabled={googlePrefs.enabled}
                        onDelete={event.module === 'manual' ? removeManualEvent : undefined}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="week" className="space-y-4">
                {selectedWeekDays.map((day) => {
                  const dayKey = format(day, 'yyyy-MM-dd');
                  const dayEvents = eventsByWeekDay.get(dayKey) || [];
                  return (
                    <div
                      key={dayKey}
                      className="rounded-lg border border-border p-3 cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => openDayDetail(day)}
                    >
                      <p className="mb-2 text-sm font-medium">{format(day, 'EEEE, MMM d')}</p>
                      {dayEvents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No scheduled items</p>
                      ) : (
                        <div className="space-y-2">
                          {dayEvents.map((event) => (
                            <EventRow
                              key={event.id}
                              event={event}
                              googleEnabled={googlePrefs.enabled}
                              onDelete={event.module === 'manual' ? removeManualEvent : undefined}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </TabsContent>
            </Tabs>
          </SectionCard>

          <SectionCard title="Upcoming" subtitle="Next 8 events">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming events found.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    googleEnabled={googlePrefs.enabled}
                    compact
                    onDelete={event.module === 'manual' ? removeManualEvent : undefined}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <Dialog open={calendarSetupOpen} onOpenChange={(open) => (open ? setCalendarSetupOpen(true) : closeCalendarSetupDialog())}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Connect your calendar</DialogTitle>
            <DialogDescription>
              Pick your current calendar and finish setup in under 2 minutes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={calendarSetupMode === 'google' ? 'default' : 'outline'}
                onClick={() => setCalendarSetupMode('google')}
              >
                Google Calendar
              </Button>
              <Button
                type="button"
                variant={calendarSetupMode === 'apple' ? 'default' : 'outline'}
                onClick={() => setCalendarSetupMode('apple')}
              >
                Apple Calendar
              </Button>
            </div>

            {calendarSetupMode === 'google' ? (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Google setup</p>
                <ol className="list-decimal pl-4 text-sm text-muted-foreground space-y-1">
                  <li>Enable Google quick-add links.</li>
                  <li>Open an event and tap the external link icon.</li>
                  <li>Save to your preferred Google calendar.</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={startGoogleSetup}>
                    Enable Google quick-add
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <a href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer">
                      Open Google Calendar
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Apple setup</p>
                <ol className="list-decimal pl-4 text-sm text-muted-foreground space-y-1">
                  <li>Open Connect Apple to get your private subscribed feed links.</li>
                  <li>Use Settings &gt; Calendar &gt; Accounts &gt; Add Account &gt; Other &gt; Add Subscribed Calendar.</li>
                  <li>Paste your feed URL and save.</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" asChild>
                    <Link to="/calendar/connect-apple">Open Apple feed setup</Link>
                  </Button>
                  <Button type="button" variant="outline" onClick={exportCurrentMonthIcs}>
                    Download .ics snapshot
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={closeCalendarSetupDialog}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dayDetailOpen} onOpenChange={setDayDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">{format(selectedDate, 'EEEE, MMMM d')}</DialogTitle>
            <DialogDescription>
              {selectedDayEvents.length} item{selectedDayEvents.length === 1 ? '' : 's'} based on your current filters.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {selectedDayEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events scheduled for this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedDayEvents.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    googleEnabled={googlePrefs.enabled}
                    onDelete={event.module === 'manual' ? removeManualEvent : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Add calendar event</DialogTitle>
            <DialogDescription>Create a personal event on your schedule.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Event title" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={draftDate}
                onChange={(e) => {
                  setDraftDate(e.target.value);
                  setDraftTravelMinutes(null);
                  setDraftTrafficMinutes(null);
                  setDraftLeaveByIso(null);
                }}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">All-day event</span>
              <Switch checked={draftAllDay} onCheckedChange={setDraftAllDay} />
            </div>
            {!draftAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Start</label>
                  <Input
                    type="time"
                    value={draftTime}
                    onChange={(e) => {
                      setDraftTime(e.target.value);
                      setDraftTravelMinutes(null);
                      setDraftTrafficMinutes(null);
                      setDraftLeaveByIso(null);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">End (optional)</label>
                  <Input type="time" value={draftEndTime} onChange={(e) => setDraftEndTime(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-sm font-medium">Location</label>
              <Input
                placeholder="123 Main St, Phoenix, AZ"
                value={draftLocation}
                onChange={(e) => {
                  setDraftLocation(e.target.value);
                  setDraftTravelMinutes(null);
                  setDraftTrafficMinutes(null);
                  setDraftLeaveByIso(null);
                }}
              />
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Home address (for travel time)</label>
                <Input
                  placeholder="Set your home address"
                  value={draftHomeAddress}
                  onChange={(e) => {
                    setDraftHomeAddress(e.target.value);
                    setDraftTravelMinutes(null);
                    setDraftTrafficMinutes(null);
                    setDraftLeaveByIso(null);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void saveHomeAddressFromDraft()} disabled={smsSaving}>
                  {smsSaving ? 'Saving...' : 'Save as home address'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void estimateTravelForDraft()}
                  disabled={draftTravelLoading || draftAllDay}
                >
                  {draftTravelLoading ? 'Estimating...' : 'Estimate travel (live traffic)'}
                </Button>
              </div>
              {draftAllDay && <p className="text-xs text-muted-foreground">Set a start time to estimate commute.</p>}
              {draftTravelError && <p className="text-xs text-destructive">{draftTravelError}</p>}
              {draftLeaveByIso && (
                <p className="text-xs text-muted-foreground">
                  Estimated drive: {draftTrafficMinutes || draftTravelMinutes} min
                  {draftTrafficMinutes && draftTravelMinutes && draftTrafficMinutes > draftTravelMinutes
                    ? ` (${draftTrafficMinutes - draftTravelMinutes} min traffic delay)`
                    : ''}
                  . Leave by {format(parseISO(draftLeaveByIso), 'h:mm a')}.
                </p>
              )}
              {draftLeaveByIso && (
                <label className="w-full rounded-md border border-border px-3 py-2 flex items-center justify-between">
                  <span className="text-sm">Text me 10 min before I need to leave</span>
                  <Switch checked={draftLeaveReminderEnabled} onCheckedChange={setDraftLeaveReminderEnabled} />
                </label>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Optional details"
                className="min-h-[96px]"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createManualEvent}>
              <CalendarDays className="w-4 h-4 mr-2" />
              Add event
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function EventRow({
  event,
  googleEnabled,
  compact,
  onDelete,
}: {
  event: CalendarEvent;
  googleEnabled: boolean;
  compact?: boolean;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className={cn('rounded-lg border border-border p-3', compact && 'py-2')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{event.title}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{eventTimeLabel(event)}</span>
            <Badge variant="outline" className={cn('border', moduleMeta[event.module].badgeClass)}>
              {moduleMeta[event.module].label}
            </Badge>
          </div>
          {event.description && !compact && (
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{event.description}</p>
          )}
          {!compact && event.location && (
            <p className="mt-1 text-xs text-muted-foreground">Location: {event.location}</p>
          )}
          {!compact && event.recommendedLeaveAt && (
            <p className="mt-1 text-xs text-muted-foreground">
              Leave by {format(parseISO(event.recommendedLeaveAt), 'h:mm a')}
              {event.trafficDurationMinutes
                ? ` (${event.trafficDurationMinutes} min with traffic)`
                : event.travelDurationMinutes
                ? ` (${event.travelDurationMinutes} min)`
                : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {googleEnabled && (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <a
                href={buildGoogleEventUrl(event)}
                target="_blank"
                rel="noreferrer"
                aria-label={`Open ${event.title} in Google Calendar`}
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDelete(event.id)}
              aria-label={`Delete ${event.title}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
