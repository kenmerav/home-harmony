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
import { DayOfWeek } from '@/types';
import type { Workout, CardioSession } from '@/workouts/types/workout';
import { CalendarDays, ExternalLink, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';
const WORKOUTS_KEY = 'liftlog_workouts';
const CARDIO_KEY = 'liftlog_cardio_sessions';

type CalendarViewMode = 'month' | 'week';

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

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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

function moduleDefaultFilters(): Record<CalendarEventModule, boolean> {
  return {
    manual: true,
    meals: true,
    tasks: true,
    chores: true,
    workouts: true,
    reminders: true,
  };
}

export default function CalendarPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState<Record<CalendarEventModule, boolean>>(moduleDefaultFilters);
  const [googlePrefs, setGooglePrefsState] = useState<GoogleCalendarPrefs>(() =>
    getGoogleCalendarPrefs(user?.id),
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftDate, setDraftDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [draftTime, setDraftTime] = useState('18:00');
  const [draftEndTime, setDraftEndTime] = useState('');
  const [draftAllDay, setDraftAllDay] = useState(false);

  useEffect(() => {
    setGooglePrefsState(getGoogleCalendarPrefs(user?.id));
  }, [user?.id]);

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
    setAddDialogOpen(true);
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

  const updateGooglePrefs = (updates: Partial<GoogleCalendarPrefs>) => {
    const next = { ...googlePrefs, ...updates };
    setGooglePrefsState(next);
    setGoogleCalendarPrefs(next, user?.id);
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
              onSelect={(day) => day && setSelectedDate(day)}
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
            </div>
          </SectionCard>

          <SectionCard title="Google Calendar" subtitle="Connection scaffold + quick add links">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Enable Google links</span>
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
                OAuth token sync comes next. For now, each event includes a one-click Google Calendar link.
              </p>
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
                    <div key={dayKey} className="rounded-lg border border-border p-3">
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
              <Input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <span className="text-sm">All-day event</span>
              <Switch checked={draftAllDay} onCheckedChange={setDraftAllDay} />
            </div>
            {!draftAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Start</label>
                  <Input type="time" value={draftTime} onChange={(e) => setDraftTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">End (optional)</label>
                  <Input type="time" value={draftEndTime} onChange={(e) => setDraftEndTime(e.target.value)} />
                </div>
              </div>
            )}
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
