import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { listTaskDatesInRange, loadTasks, updateTaskFromCalendarRelatedId } from '@/lib/taskStore';
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
  updateManualCalendarEvent,
} from '@/lib/calendarStore';
import { syncDerivedCalendarEvents } from '@/lib/calendarFeed';
import {
  CalendarFilterPreset,
  CalendarFilterPresetColor,
  createCalendarFilterPreset,
  DEFAULT_CALENDAR_FILTER_PRESET_COLOR,
  loadStoredCalendarFilterPresets,
  loadStoredCalendarFilters,
  normalizeCalendarFilterName,
  saveStoredCalendarFilterPresets,
  saveStoredCalendarFilters,
} from '@/lib/calendarFilters';
import {
  loadCommonDepartureAddresses,
  loadDepartureAddressProfile,
  normalizeAddressForCompare,
} from '@/lib/departureAddresses';
import { DayOfWeek } from '@/types';
import type { Workout, CardioSession } from '@/workouts/types/workout';
import { CalendarDays, ExternalLink, Pencil, Phone, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useSearchParams } from 'react-router-dom';

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';
const WORKOUTS_KEY = 'liftlog_workouts';
const CARDIO_KEY = 'liftlog_cardio_sessions';

type CalendarViewMode = 'month' | 'week';
type CalendarSetupMode = 'google' | 'apple';
type DepartureSource = 'home' | 'work' | 'other' | `saved:${string}`;

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
const FILTER_COLOR_SWATCHES = [
  '#5A8F72',
  '#8A78E8',
  '#4D86E5',
  '#54B888',
  '#C98A2E',
  '#D35F82',
  '#E76F51',
  '#2A9D8F',
  '#7D8FA8',
  '#7C5A45',
];

function normalizeHexColor(input: string, fallback = DEFAULT_CALENDAR_FILTER_PRESET_COLOR): string {
  const compact = input.trim();
  if (!compact) return fallback;
  const withHash = compact.startsWith('#') ? compact : `#${compact}`;
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const [r, g, b] = withHash.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) return withHash.toUpperCase();
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const normalized = normalizeHexColor(hex, '');
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return null;
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function filterBadgeStyle(color: string): CSSProperties {
  const [r, g, b] = hexToRgb(color) || [90, 143, 114];
  return {
    borderColor: `rgba(${r}, ${g}, ${b}, 0.48)`,
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.16)`,
    color: `rgb(${Math.round(r * 0.72)}, ${Math.round(g * 0.72)}, ${Math.round(b * 0.72)})`,
  };
}

const smsModuleLabel: Record<SmsReminderModule, string> = {
  meals: 'Meal schedule',
  manual: 'Manual calendar events',
  tasks: 'Tasks',
  chores: 'Chores',
  workouts: 'Workouts',
  reminders: 'Reminders',
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeAddressKey(value?: string | null): string {
  return normalizeAddressForCompare(value);
}

function isSameOrContainedAddress(candidateKey: string, referenceKey: string): boolean {
  if (!candidateKey || !referenceKey) return false;
  return candidateKey === referenceKey
    || candidateKey.includes(referenceKey)
    || referenceKey.includes(candidateKey);
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

function normalizeCalendarLayerName(value: string | null | undefined): string {
  const compact = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return compact || 'family';
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
  const [filterPresetDialogOpen, setFilterPresetDialogOpen] = useState(false);
  const [editingFilterPresetId, setEditingFilterPresetId] = useState<string | null>(null);
  const [filterPresetDraftName, setFilterPresetDraftName] = useState('');
  const [filterPresetDraftRecipients, setFilterPresetDraftRecipients] = useState('');
  const [filterPresetDraftColor, setFilterPresetDraftColor] = useState<CalendarFilterPresetColor>(
    DEFAULT_CALENDAR_FILTER_PRESET_COLOR,
  );
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
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventSource, setEditingEventSource] = useState<CalendarEvent | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftLocation, setDraftLocation] = useState('');
  const [draftDepartureSource, setDraftDepartureSource] = useState<DepartureSource>('home');
  const [draftHomeAddress, setDraftHomeAddress] = useState('');
  const [draftTravelMinutes, setDraftTravelMinutes] = useState<number | null>(null);
  const [draftTrafficMinutes, setDraftTrafficMinutes] = useState<number | null>(null);
  const [draftLeaveByIso, setDraftLeaveByIso] = useState<string | null>(null);
  const [draftEventReminderEnabled, setDraftEventReminderEnabled] = useState(false);
  const [draftEventReminderLeadMinutes, setDraftEventReminderLeadMinutes] = useState('30');
  const [draftLeaveReminderEnabled, setDraftLeaveReminderEnabled] = useState(false);
  const [draftLeaveReminderLeadMinutes, setDraftLeaveReminderLeadMinutes] = useState('10');
  const [draftTravelLoading, setDraftTravelLoading] = useState(false);
  const [draftTravelError, setDraftTravelError] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [draftTime, setDraftTime] = useState('18:00');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [draftAllDay, setDraftAllDay] = useState(false);
  const [draftCalendarLayer, setDraftCalendarLayer] = useState('family');
  const [departureAddressProfile, setDepartureAddressProfile] = useState(() =>
    loadDepartureAddressProfile(user?.id),
  );
  const [commonDepartureAddresses, setCommonDepartureAddresses] = useState<string[]>(() =>
    loadCommonDepartureAddresses(user?.id),
  );

  useEffect(() => {
    setGooglePrefsState(getGoogleCalendarPrefs(user?.id));
  }, [user?.id]);

  useEffect(() => {
    setDepartureAddressProfile(loadDepartureAddressProfile(user?.id));
    setCommonDepartureAddresses(loadCommonDepartureAddresses(user?.id));
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
    const rangeStart = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const rangeEnd = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
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
        const occurrences = listTaskDatesInRange(task, rangeStart, rangeEnd);
        if (occurrences.length === 0) return;
        const reminderTime = task.reminderTime || '09:00';

        occurrences.forEach((date) => {
          const start = withTime(date, reminderTime);
          const eventId = task.frequency === 'once' ? `task-${task.id}` : `task-${task.id}-${format(date, 'yyyy-MM-dd')}`;
          nextEvents.push({
            id: eventId,
            title: task.title,
            description: task.notes,
            startsAt: start.toISOString(),
            endsAt: task.frequency === 'once' ? undefined : addMinutes(start, 30).toISOString(),
            allDay: task.frequency === 'once',
            source: 'task',
            module: 'tasks',
            relatedId: task.id,
            readonly: true,
          });
        });
      });

      const choreState = loadChoreState(user?.id);
      choreState.forEach((child) => {
        child.weeklyChores
          .filter((chore) => !chore.isCompleted)
          .forEach((chore) => {
            normalizeChoreDays(chore).forEach((day) => {
              weeklyDatesInRange(rangeStart, rangeEnd, day).forEach((date) => {
                nextEvents.push({
                  id: `chore-${child.name}-${chore.name}-${day}-${format(date, 'yyyy-MM-dd')}`,
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
      void syncDerivedCalendarEvents(user?.id, rangeStart, rangeEnd, nextEvents);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      setDepartureAddressProfile(loadDepartureAddressProfile(user?.id));
      setCommonDepartureAddresses(loadCommonDepartureAddresses(user?.id));
    };
    window.addEventListener('homehub:departure-addresses-updated', handler);
    return () => window.removeEventListener('homehub:departure-addresses-updated', handler);
  }, [user?.id]);

  const customManualLayerSet = useMemo(
    () => new Set(filterPresets.map((preset) => normalizeCalendarLayerName(preset.name))),
    [filterPresets],
  );

  const enabledManualLayerSet = useMemo(
    () => new Set(filterPresets.filter((preset) => preset.enabled).map((preset) => normalizeCalendarLayerName(preset.name))),
    [filterPresets],
  );

  const manualLayerOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [{ value: 'family', label: 'Family' }];
    const seen = new Set<string>(['family']);
    filterPresets.forEach((preset) => {
      const label = normalizeCalendarFilterName(preset.name);
      const value = normalizeCalendarLayerName(label);
      if (seen.has(value)) return;
      seen.add(value);
      options.push({ value, label });
    });
    return options;
  }, [filterPresets]);

  const filteredEvents = useMemo(
    () =>
      events.filter((event) => {
        if (!filters[event.module]) return false;
        if (event.module !== 'manual') return true;

        const layer = normalizeCalendarLayerName(event.calendarLayer);
        if (!customManualLayerSet.has(layer)) return true;
        return enabledManualLayerSet.has(layer);
      }),
    [events, filters, customManualLayerSet, enabledManualLayerSet],
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
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
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

  const savedDepartureAddresses = useMemo(() => {
    const unique = new Map<string, string>();
    const addAddress = (value?: string | null) => {
      const next = (value || '').trim();
      const key = normalizeAddressKey(next);
      if (key && !unique.has(key)) unique.set(key, next.replace(/\s+/g, ' '));
    };
    addAddress(smsPrefs.home_address || departureAddressProfile.homeAddress);
    addAddress(smsPrefs.work_address || departureAddressProfile.workAddress);
    commonDepartureAddresses.forEach((address) => addAddress(address));
    return Array.from(unique.values());
  }, [
    commonDepartureAddresses,
    departureAddressProfile.homeAddress,
    departureAddressProfile.workAddress,
    smsPrefs.home_address,
    smsPrefs.work_address,
  ]);

  const resetDraftTravelEstimate = useCallback(() => {
    setDraftTravelMinutes(null);
    setDraftTrafficMinutes(null);
    setDraftLeaveByIso(null);
    setDraftTravelError(null);
  }, []);

  const addressForSource = useCallback(
    (source: DepartureSource): string => {
      if (source === 'work') return (smsPrefs.work_address || departureAddressProfile.workAddress || '').trim();
      if (source === 'home') return (smsPrefs.home_address || departureAddressProfile.homeAddress || '').trim();
      if (source.startsWith('saved:')) return decodeURIComponent(source.slice('saved:'.length)).trim();
      return '';
    },
    [
      departureAddressProfile.homeAddress,
      departureAddressProfile.workAddress,
      smsPrefs.home_address,
      smsPrefs.work_address,
    ],
  );

  const departureOptions = useMemo(() => {
    const homeAddress = (smsPrefs.home_address || departureAddressProfile.homeAddress || '').trim();
    const workAddress = (smsPrefs.work_address || departureAddressProfile.workAddress || '').trim();
    const homeKey = normalizeAddressKey(homeAddress);
    const workKey = normalizeAddressKey(workAddress);
    const options: Array<{ value: DepartureSource; label: string }> = [
      { value: 'home', label: 'Home' },
      { value: 'work', label: 'Work' },
    ];

    savedDepartureAddresses.forEach((address) => {
      const addressKey = normalizeAddressKey(address);
      if (
        !addressKey
        || isSameOrContainedAddress(addressKey, homeKey)
        || isSameOrContainedAddress(addressKey, workKey)
      ) {
        return;
      }
      options.push({
        value: `saved:${encodeURIComponent(address)}` as DepartureSource,
        label: address,
      });
    });

    options.push({ value: 'other', label: 'Other' });
    return options;
  }, [
    departureAddressProfile.homeAddress,
    departureAddressProfile.workAddress,
    savedDepartureAddresses,
    smsPrefs.home_address,
    smsPrefs.work_address,
  ]);

  const applyDepartureSource = useCallback(
    (source: DepartureSource, preserveOther = true) => {
      setDraftDepartureSource(source);
      setDraftHomeAddress((prev) => {
        if (source === 'other') return preserveOther ? prev : '';
        return addressForSource(source);
      });
      resetDraftTravelEstimate();
    },
    [addressForSource, resetDraftTravelEstimate],
  );

  const openAddDialog = () => {
    setEditingEventId(null);
    setEditingEventSource(null);
    setDraftDate(format(selectedDate, 'yyyy-MM-dd'));
    setDraftTime('18:00');
    setDraftEndTime('');
    setDraftAllDay(false);
    const firstEnabledPreset = filterPresets.find((preset) => preset.enabled);
    const fallbackPreset = filterPresets[0];
    setDraftCalendarLayer(
      normalizeCalendarLayerName(firstEnabledPreset?.name || fallbackPreset?.name || 'family'),
    );
    setDraftTitle('');
    setDraftDescription('');
    setDraftLocation('');
    const defaultDepartureSource: DepartureSource =
      smsPrefs.default_departure_source === 'work'
        ? 'work'
        : smsPrefs.default_departure_source === 'custom'
        ? 'other'
        : 'home';
    applyDepartureSource(defaultDepartureSource, false);
    setDraftHomeAddress(defaultDepartureSource === 'other' ? '' : addressForSource(defaultDepartureSource));
    setDraftEventReminderEnabled(false);
    setDraftEventReminderLeadMinutes('30');
    setDraftLeaveReminderEnabled(false);
    setDraftLeaveReminderLeadMinutes('10');
    setAddDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingEventSource(event);
    setEditingEventId(event.source === 'manual' ? event.id : null);
    const start = parseISO(event.startsAt);
    const end = event.endsAt ? parseISO(event.endsAt) : null;
    setDraftTitle(event.title);
    setDraftDescription(event.description || '');
    setDraftLocation(event.location || '');
    setDraftDate(format(start, 'yyyy-MM-dd'));
    setDraftAllDay(!!event.allDay);
    setDraftTime(event.allDay ? '18:00' : format(start, 'HH:mm'));
    setDraftEndTime(event.allDay || !end ? '' : format(end, 'HH:mm'));
    setDraftCalendarLayer(normalizeCalendarLayerName(event.calendarLayer || 'family'));

    const homeAddress = (smsPrefs.home_address || '').trim();
    const workAddress = (smsPrefs.work_address || '').trim();
    const currentFrom = (event.travelFromAddress || '').trim();
    const source: DepartureSource =
      currentFrom && homeAddress && currentFrom === homeAddress
        ? 'home'
        : currentFrom && workAddress && currentFrom === workAddress
        ? 'work'
        : currentFrom
        ? (`saved:${encodeURIComponent(currentFrom)}` as DepartureSource)
        : 'other';
    setDraftDepartureSource(source);
    setDraftHomeAddress(currentFrom || addressForSource(source));
    setDraftTravelMinutes(event.travelDurationMinutes ?? null);
    setDraftTrafficMinutes(event.trafficDurationMinutes ?? null);
    setDraftLeaveByIso(event.recommendedLeaveAt || null);
    setDraftEventReminderEnabled(!!event.eventReminderEnabled);
    setDraftEventReminderLeadMinutes(String(event.eventReminderLeadMinutes || 30));
    setDraftLeaveReminderEnabled(!!event.leaveReminderEnabled);
    setDraftLeaveReminderLeadMinutes(String(event.leaveReminderLeadMinutes || 10));
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
    const selectedOrigin =
      draftDepartureSource === 'other'
        ? draftHomeAddress.trim()
        : addressForSource(draftDepartureSource);
    const origin = selectedOrigin || draftHomeAddress.trim();
    const destination = draftLocation.trim();
    if (!origin || !destination) {
      setDraftTravelError('Add both leaving-from address and event location to estimate travel time.');
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

  const createManualEvent = () => {
    if (!draftTitle.trim()) {
      toast({ title: 'Add a title first', variant: 'destructive' });
      return;
    }
    if (!draftCalendarLayer.trim()) {
      toast({ title: 'Choose a filter first', variant: 'destructive' });
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

    const payload = {
      title: draftTitle,
      description: draftDescription,
      module: editingEventSource?.source === 'manual' ? editingEventSource.module : 'manual',
      calendarLayer: normalizeCalendarLayerName(draftCalendarLayer),
      location: draftLocation.trim() || undefined,
      eventReminderEnabled: draftEventReminderEnabled,
      eventReminderLeadMinutes: Math.max(
        5,
        Math.min(240, Number.parseInt(draftEventReminderLeadMinutes || '30', 10) || 30),
      ),
      travelFromAddress:
        (
          draftDepartureSource === 'other'
            ? draftHomeAddress.trim()
            : addressForSource(draftDepartureSource)
        ) || undefined,
      travelMode: 'driving' as const,
      travelDurationMinutes: draftTravelMinutes,
      trafficDurationMinutes: draftTrafficMinutes,
      recommendedLeaveAt: draftLeaveByIso,
      leaveReminderEnabled: draftLeaveReminderEnabled,
      leaveReminderLeadMinutes: Math.max(
        5,
        Math.min(120, Number.parseInt(draftLeaveReminderLeadMinutes || '10', 10) || 10),
      ),
      startsAt,
      endsAt,
      allDay: draftAllDay,
    };
    const editingSource = editingEventSource;
    if (editingSource?.source === 'task') {
      const relatedId = editingSource.relatedId || editingSource.id;
      const updatedTask = updateTaskFromCalendarRelatedId(
        relatedId,
        {
          title: draftTitle,
          notes: draftDescription,
          date: draftDate,
          time: draftAllDay ? undefined : draftTime || '09:00',
        },
        user?.id,
      );
      if (!updatedTask) {
        toast({ title: 'Could not update task event', variant: 'destructive' });
        return;
      }
      setAddDialogOpen(false);
      setEditingEventId(null);
      setEditingEventSource(null);
      toast({ title: 'Task event updated' });
      void refreshEvents();
      return;
    }

    if (editingSource && editingSource.source !== 'manual') {
      toast({
        title: 'Edit this in its source module',
        description: 'For now, chores, workouts, meals, and reminders are edited from their own pages.',
      });
      return;
    }

    if (editingEventId) {
      const updated = updateManualCalendarEvent(editingEventId, payload, user?.id);
      if (!updated) {
        toast({ title: 'Could not update event', variant: 'destructive' });
        return;
      }
    } else {
      addManualCalendarEvent(payload, user?.id);
    }
    setAddDialogOpen(false);
    setEditingEventId(null);
    setEditingEventSource(null);
    toast({ title: editingEventId ? 'Event updated' : 'Event added to calendar' });
    void refreshEvents();
  };

  const exportCurrentMonthIcs = () => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
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
    return (Object.entries(preset.modules) as Array<[CalendarEventModule, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([moduleName]) => moduleName)
      .filter((moduleName): moduleName is SmsReminderModule =>
        SMS_REMINDER_MODULES.includes(moduleName as SmsReminderModule),
      );
  };

  const applyPresetRecipientsToSms = async (preset: CalendarFilterPreset) => {
    const recipients = preset.reminderRecipients;
    if (!recipients.length) return;
    const smsModules = smsModulesForPreset(preset);
    if (smsModules.length === 0) {
      toast({
        title: 'No SMS-enabled modules in this filter',
        description: 'Enable at least one visible module in this filter to route reminder texts.',
      });
      return;
    }

    const nextModuleRecipients = { ...smsPrefs.module_recipients };
    SMS_REMINDER_MODULES.forEach((moduleName) => {
      if (smsModules.includes(moduleName)) {
        nextModuleRecipients[moduleName] = recipients;
      }
    });

    const nextPrefs: SmsPreferences = {
      ...smsPrefs,
      include_modules: [...new Set([...smsPrefs.include_modules, ...smsModules])],
      module_recipients: nextModuleRecipients,
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

  const nextFilterNameSuggestion = () => {
    const existing = new Set(filterPresets.map((preset) => normalizeCalendarFilterName(preset.name).toLowerCase()));
    let nextIndex = filterPresets.length + 1;
    let suggestedName = `Filter ${nextIndex}`;
    while (existing.has(suggestedName.toLowerCase())) {
      nextIndex += 1;
      suggestedName = `Filter ${nextIndex}`;
    }
    return suggestedName;
  };

  const openAddFilterPresetDialog = () => {
    setEditingFilterPresetId(null);
    setFilterPresetDraftName(nextFilterNameSuggestion());
    setFilterPresetDraftRecipients('');
    setFilterPresetDraftColor(DEFAULT_CALENDAR_FILTER_PRESET_COLOR);
    setFilterPresetDialogOpen(true);
  };

  const openEditFilterPresetDialog = (presetId: string) => {
    const preset = filterPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setEditingFilterPresetId(presetId);
    setFilterPresetDraftName(preset.name);
    setFilterPresetDraftRecipients(formatPhoneList(preset.reminderRecipients || []));
    setFilterPresetDraftColor(normalizeHexColor(preset.color || DEFAULT_CALENDAR_FILTER_PRESET_COLOR));
    setFilterPresetDialogOpen(true);
  };

  const saveFilterPresetDialog = () => {
    const normalizedName = normalizeCalendarFilterName(filterPresetDraftName || nextFilterNameSuggestion());
    const recipients = parsePhoneList(filterPresetDraftRecipients);
    const color = normalizeHexColor(filterPresetDraftColor);

    if (editingFilterPresetId) {
      setFilterPresets((prev) =>
        prev.map((preset) =>
          preset.id === editingFilterPresetId
            ? { ...preset, name: normalizedName, reminderRecipients: recipients, color }
            : preset,
        ),
      );
      const editedPreset = filterPresets.find((preset) => preset.id === editingFilterPresetId);
      if (editedPreset?.enabled) {
        void applyPresetRecipientsToSms({
          ...editedPreset,
          name: normalizedName,
          reminderRecipients: recipients,
          color,
        });
      }
      toast({ title: 'Filter updated' });
      setFilterPresetDialogOpen(false);
      return;
    }

    const nextPreset = createCalendarFilterPreset(
      normalizedName,
      filters,
      filterPresets.length,
      recipients,
      color,
    );
    nextPreset.enabled = true;
    setFilterPresets((prev) => [...prev, nextPreset]);
    toast({ title: `Filter "${nextPreset.name}" saved` });
    setFilterPresetDialogOpen(false);
    void applyPresetRecipientsToSms(nextPreset);
  };

  const enableFilterPreset = (presetId: string) => {
    const preset = filterPresets.find((item) => item.id === presetId);
    if (!preset) return;
    setFilterPresets((prev) =>
      prev.map((item) => (item.id === presetId ? { ...item, enabled: true } : item)),
    );
    void applyPresetRecipientsToSms(preset);
  };

  const deleteFilterPreset = (presetId: string) => {
    setFilterPresets((prev) => prev.filter((preset) => preset.id !== presetId));
    toast({ title: 'Filter removed' });
  };

  const toggleFilterPreset = (presetId: string, enabled: boolean) => {
    if (enabled) {
      enableFilterPreset(presetId);
      return;
    }
    setFilterPresets((prev) =>
      prev.map((item) => (item.id === presetId ? { ...item, enabled: false } : item)),
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

              {filterPresets.map((preset) => {
                const isActive = !!preset.enabled;
                return (
                  <div key={preset.id} className="flex items-center justify-between">
                    <button type="button" onClick={() => openEditFilterPresetDialog(preset.id)} aria-label={`Edit ${preset.name} filter`}>
                      <Badge
                        variant="outline"
                        className="border cursor-pointer"
                        style={filterBadgeStyle(preset.color || DEFAULT_CALENDAR_FILTER_PRESET_COLOR)}
                      >
                        {preset.name}
                      </Badge>
                    </button>
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => toggleFilterPreset(preset.id, checked)}
                      aria-label={`Toggle ${preset.name} filter`}
                    />
                  </div>
                );
              })}

              <div className="flex justify-end pt-1">
                <Button type="button" variant="outline" size="sm" onClick={openAddFilterPresetDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Filter
                </Button>
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

          <SectionCard title="Calendar integrations" subtitle="Plan in Home Harmony, then display in your calendar app">
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Google Calendar</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/calendar/connect-apple?platform=google">Connect Google</Link>
                  </Button>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Status</span>
                  <Badge variant="outline">{googlePrefs.enabled ? 'Quick-add enabled' : 'Ready to connect'}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Subscribe once with your private URL. Google Calendar will mirror Home Harmony updates.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Apple Calendar</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/calendar/connect-apple?platform=apple">Connect Apple</Link>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  One-way subscribed feeds: edit events in Home Harmony, and Apple Calendar reflects updates automatically.
                </p>
              </div>

              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Google quick-add links (optional)</span>
                  <Switch
                    checked={googlePrefs.enabled}
                    onCheckedChange={(checked) => updateGooglePrefs({ enabled: checked })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Target calendar label</label>
                  <Input
                    value={googlePrefs.selectedCalendarLabel}
                    onChange={(e) => updateGooglePrefs({ selectedCalendarLabel: e.target.value || 'Primary calendar' })}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Optional helper links on each event. Feed subscription is the recommended sync path.
                </p>
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
                        onEdit={event.source === 'reminder' ? undefined : openEditDialog}
                        onDelete={event.source === 'manual' ? removeManualEvent : undefined}
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
                              onEdit={event.source === 'reminder' ? undefined : openEditDialog}
                              onDelete={event.source === 'manual' ? removeManualEvent : undefined}
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
                  onEdit={event.source === 'reminder' ? undefined : openEditDialog}
                  onDelete={event.source === 'manual' ? removeManualEvent : undefined}
                />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <Dialog open={calendarSetupOpen} onOpenChange={(open) => (open ? setCalendarSetupOpen(true) : closeCalendarSetupDialog())}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
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
                  <li>Open Connect Google and copy your private All events feed URL.</li>
                  <li>In Google Calendar web, go to Other calendars &gt; + &gt; From URL.</li>
                  <li>Paste the feed URL and click Add calendar.</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" asChild>
                    <Link to="/calendar/connect-apple?platform=google">Open Google setup</Link>
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <a href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer">
                      Open Google Add by URL
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-sm font-medium">Apple setup</p>
                <ol className="list-decimal pl-4 text-sm text-muted-foreground space-y-1">
                  <li>Open Connect Apple and copy your private All events feed URL.</li>
                  <li>Use Settings &gt; Calendar &gt; Accounts &gt; Add Account &gt; Other &gt; Add Subscribed Calendar.</li>
                  <li>Paste your feed URL and save.</li>
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" asChild>
                    <Link to="/calendar/connect-apple?platform=apple">Open Apple setup</Link>
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

      <Dialog open={filterPresetDialogOpen} onOpenChange={setFilterPresetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editingFilterPresetId ? 'Edit filter' : 'Add filter'}</DialogTitle>
            <DialogDescription>
              {editingFilterPresetId
                ? 'Update filter name and who should get reminder texts when this filter is applied.'
                : 'Create a filter from your current toggle selections.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Filter name</label>
              <Input
                value={filterPresetDraftName}
                onChange={(event) => setFilterPresetDraftName(event.target.value)}
                placeholder="Family plan"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reminder recipients (optional)</label>
              <Input
                value={filterPresetDraftRecipients}
                onChange={(event) => setFilterPresetDraftRecipients(event.target.value)}
                placeholder="+16155551234, +16155550999"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Color</label>
              <div className="flex items-center gap-3">
                <Input
                  type="color"
                  value={normalizeHexColor(filterPresetDraftColor)}
                  onChange={(event) => setFilterPresetDraftColor(normalizeHexColor(event.target.value))}
                  className="h-10 w-14 p-1"
                  aria-label="Choose filter color"
                />
                <Input
                  value={filterPresetDraftColor}
                  onChange={(event) => setFilterPresetDraftColor(event.target.value)}
                  onBlur={() => setFilterPresetDraftColor(normalizeHexColor(filterPresetDraftColor))}
                  placeholder="#5A8F72"
                  className="w-32"
                />
                <Badge variant="outline" className="border" style={filterBadgeStyle(filterPresetDraftColor)}>
                  Preview
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {FILTER_COLOR_SWATCHES.map((color) => {
                  const isSelected = normalizeHexColor(filterPresetDraftColor) === normalizeHexColor(color);
                  return (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        'h-6 w-6 rounded-full border-2 transition',
                        isSelected ? 'ring-2 ring-primary/50' : 'border-border',
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setFilterPresetDraftColor(color)}
                      aria-label={`Use color ${color}`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            {editingFilterPresetId ? (
              <Button
                variant="ghost"
                onClick={() => {
                  deleteFilterPreset(editingFilterPresetId);
                  setFilterPresetDialogOpen(false);
                }}
              >
                Delete
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setFilterPresetDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveFilterPresetDialog()}>
              {editingFilterPresetId ? 'Save changes' : 'Add filter'}
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
                    onEdit={event.source === 'reminder' ? undefined : openEditDialog}
                    onDelete={event.source === 'manual' ? removeManualEvent : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open);
          if (!open) {
            setEditingEventId(null);
            setEditingEventSource(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingEventSource ? 'Edit calendar event' : 'Add calendar event'}
            </DialogTitle>
            <DialogDescription>
              {editingEventSource ? 'Update this calendar item.' : 'Create a personal event on your schedule.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Title</label>
              <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Event title" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Assign filter</label>
              <Select value={draftCalendarLayer} onValueChange={setDraftCalendarLayer}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose filter" />
                </SelectTrigger>
                <SelectContent>
                  {manualLayerOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input
                type="date"
                value={draftDate}
                onChange={(e) => {
                  setDraftDate(e.target.value);
                  resetDraftTravelEstimate();
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
                      resetDraftTravelEstimate();
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">End (optional)</label>
                  <Input type="time" value={draftEndTime} onChange={(e) => setDraftEndTime(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Scheduled reminder</span>
                <Switch checked={draftEventReminderEnabled} onCheckedChange={setDraftEventReminderEnabled} />
              </div>
              {draftEventReminderEnabled ? (
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Reminder timing</label>
                  <Select value={draftEventReminderLeadMinutes} onValueChange={setDraftEventReminderLeadMinutes}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Choose minutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 minutes before</SelectItem>
                      <SelectItem value="15">15 minutes before</SelectItem>
                      <SelectItem value="30">30 minutes before</SelectItem>
                      <SelectItem value="45">45 minutes before</SelectItem>
                      <SelectItem value="60">1 hour before</SelectItem>
                      <SelectItem value="90">1.5 hours before</SelectItem>
                      <SelectItem value="120">2 hours before</SelectItem>
                      <SelectItem value="180">3 hours before</SelectItem>
                      <SelectItem value="240">4 hours before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Sends before event start time.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Location</label>
              <Input
                placeholder="123 Main St, Phoenix, AZ"
                value={draftLocation}
                onChange={(e) => {
                  setDraftLocation(e.target.value);
                  resetDraftTravelEstimate();
                }}
              />
            </div>
            <div className="space-y-2 rounded-lg border border-border p-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">Leaving from</label>
                <Select
                  value={draftDepartureSource}
                  onValueChange={(value) => applyDepartureSource(value as DepartureSource, true)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose location" />
                  </SelectTrigger>
                  <SelectContent>
                    {departureOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {draftDepartureSource === 'other' ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium">Other address</label>
                  <Input
                    placeholder="Enter departure address"
                    value={draftHomeAddress}
                    onChange={(e) => {
                      setDraftHomeAddress(e.target.value);
                      resetDraftTravelEstimate();
                    }}
                  />
                </div>
              ) : null}
              {draftDepartureSource !== 'other' && !addressForSource(draftDepartureSource) ? (
                <p className="text-xs text-muted-foreground">
                  Set this address in Settings to enable commute estimates.
                </p>
              ) : null}
              {draftDepartureSource !== 'other' && addressForSource(draftDepartureSource) ? (
                <p className="text-xs text-muted-foreground">
                  Using: {addressForSource(draftDepartureSource)}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void estimateTravelForDraft()}
                  disabled={draftTravelLoading || draftAllDay}
                >
                  {draftTravelLoading ? 'Estimating...' : 'Estimate route time'}
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
              <div className="space-y-2">
                <label className="w-full rounded-md border border-border px-3 py-2 flex items-center justify-between">
                  <span className="text-sm">
                    Leave-by reminder
                  </span>
                  <Switch checked={draftLeaveReminderEnabled} onCheckedChange={setDraftLeaveReminderEnabled} />
                </label>
                {draftLeaveReminderEnabled && (
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Reminder timing</label>
                    <Select value={draftLeaveReminderLeadMinutes} onValueChange={setDraftLeaveReminderLeadMinutes}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Choose minutes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 minutes before leave time</SelectItem>
                        <SelectItem value="10">10 minutes before leave time</SelectItem>
                        <SelectItem value="15">15 minutes before leave time</SelectItem>
                        <SelectItem value="30">30 minutes before leave time</SelectItem>
                        <SelectItem value="45">45 minutes before leave time</SelectItem>
                        <SelectItem value="60">1 hour before leave time</SelectItem>
                      </SelectContent>
                    </Select>
                    {!draftLeaveByIso ? (
                      <p className="text-xs text-muted-foreground">
                        Estimate route time first so Home Harmony can calculate leave-by.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes (optional)</label>
              <Input
                value={draftDescription}
                onChange={(e) => setDraftDescription(e.target.value)}
                placeholder="Add a short note"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createManualEvent}>
              <CalendarDays className="w-4 h-4 mr-2" />
              {editingEventSource ? 'Save event' : 'Add event'}
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
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  googleEnabled: boolean;
  compact?: boolean;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
}) {
  const canEdit = Boolean(onEdit);
  const handleRowEdit = () => {
    if (!onEdit) return;
    onEdit(event);
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border p-3',
        compact && 'py-2',
        canEdit && 'cursor-pointer transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      role={canEdit ? 'button' : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={canEdit ? handleRowEdit : undefined}
      onKeyDown={
        canEdit
          ? (eventKey) => {
              if (eventKey.key === 'Enter' || eventKey.key === ' ') {
                eventKey.preventDefault();
                handleRowEdit();
              }
            }
          : undefined
      }
      aria-label={canEdit ? `Edit ${event.title}` : undefined}
    >
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
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onEdit(event);
              }}
              aria-label={`Edit ${event.title}`}
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          {googleEnabled && (
            <Button asChild variant="ghost" size="icon" className="h-8 w-8">
              <a
                href={buildGoogleEventUrl(event)}
                target="_blank"
                rel="noreferrer"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
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
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onDelete(event.id);
              }}
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
