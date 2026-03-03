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
import { getDinnerReminderPrefs, getMenuRejuvenatePrefs } from '@/lib/mealPrefs';
import { getOrderReminderSettings } from '@/lib/groceryPrefs';
import { estimateCookMinutes } from '@/lib/recipeTime';
import { DayOfWeek } from '@/types';
import type { Workout, CardioSession } from '@/workouts/types/workout';
import { loadTasks } from '@/lib/taskStore';
import { getManualCalendarEvents, CalendarEvent, CalendarEventModule } from '@/lib/calendarStore';
import { mockChildren } from '@/data/mockData';

const CHORES_STATE_KEY = 'homehub.choresEconomyState.v2';
const WORKOUTS_KEY = 'liftlog_workouts';
const CARDIO_KEY = 'liftlog_cardio_sessions';

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

export const CALENDAR_MODULE_META: Record<
  CalendarEventModule,
  { label: string; badgeClass: string; dotClass: string }
> = {
  manual: {
    label: 'Manual',
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

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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

function loadChoreState(): ChildChoreState[] {
  if (!canUseStorage()) {
    return mockChildren.map((child) => ({ name: child.name, weeklyChores: child.weeklyChores, extraChores: [] }));
  }

  try {
    const raw = window.localStorage.getItem(CHORES_STATE_KEY);
    if (!raw) {
      return mockChildren.map((child) => ({ name: child.name, weeklyChores: child.weeklyChores, extraChores: [] }));
    }
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
    return mockChildren.map((child) => ({ name: child.name, weeklyChores: child.weeklyChores, extraChores: [] }));
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

export async function fetchCalendarEventsForMonth(month: Date, userId?: string | null): Promise<CalendarEvent[]> {
  const rangeStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const rangeEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
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

  const taskRows = loadTasks(userId);
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

  const choreState = loadChoreState();
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
      description: `${session.duration} min • ${session.distance}`,
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

  nextEvents.push(...getManualCalendarEvents(userId));
  nextEvents.sort((a, b) => (a.startsAt > b.startsAt ? 1 : -1));
  return nextEvents;
}
