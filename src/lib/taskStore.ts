import { mockHouseTasks } from '@/data/mockData';
import { HouseTask, TaskFrequency, DayOfWeek } from '@/types';

const TASKS_STORAGE_KEY_PREFIX = 'homehub.tasks.v1';
const VALID_FREQUENCIES: TaskFrequency[] = [
  'daily',
  'weekly',
  'monthly',
  'every_3_months',
  'every_6_months',
  'yearly',
  'once',
];
const DAY_NAMES: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function keyForUser(userId?: string | null): string {
  return `${TASKS_STORAGE_KEY_PREFIX}:${userId || 'anon'}`;
}

function parseIsoDateOnly(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

function dateOnly(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function normalizeTaskFrequency(value: unknown): TaskFrequency {
  const incoming = String(value || '').trim().toLowerCase();
  if (VALID_FREQUENCIES.includes(incoming as TaskFrequency)) {
    return incoming as TaskFrequency;
  }
  if (incoming === 'quarterly') return 'every_3_months';
  if (incoming === 'biannual' || incoming === 'semiannual') return 'every_6_months';
  return 'once';
}

function normalizeTaskDay(value: unknown): DayOfWeek | undefined {
  const incoming = String(value || '').trim().toLowerCase();
  return DAY_NAMES.includes(incoming as DayOfWeek) ? (incoming as DayOfWeek) : undefined;
}

function normalizeReminderTime(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : undefined;
}

function monthDiff(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function matchDayOfMonth(anchor: Date, target: Date): boolean {
  const anchorDay = anchor.getDate();
  const lastDayThisMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return target.getDate() === Math.min(anchorDay, lastDayThisMonth);
}

function formatDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function getAnchorDate(task: HouseTask): Date {
  const due = parseIsoDateOnly(task.dueDate);
  if (due) return due;
  return dateOnly(task.createdAt);
}

function normalizeTask(raw: unknown, index: number): HouseTask {
  const input = (raw || {}) as Partial<HouseTask> & { createdAt?: string | Date };
  const frequency = normalizeTaskFrequency(input.frequency);
  const reminderLead = Number.parseInt(String(input.reminderLeadMinutes ?? ''), 10);
  const assignedToId = typeof input.assignedToId === 'string' ? input.assignedToId.trim() : '';
  const assignedToName = typeof input.assignedToName === 'string' ? input.assignedToName.trim() : '';
  return {
    id: input.id || `task-${index}`,
    title: input.title || 'Untitled task',
    notes: input.notes,
    type: input.type === 'maintain' || input.type === 'notice' ? input.type : 'do',
    status:
      input.status === 'in_progress' || input.status === 'done'
        ? input.status
        : 'not_started',
    frequency,
    assignedToId: assignedToId || undefined,
    assignedToName: assignedToName || undefined,
    dueDate: typeof input.dueDate === 'string' ? input.dueDate : undefined,
    day: normalizeTaskDay(input.day),
    reminderEnabled: input.reminderEnabled === true,
    reminderTime: normalizeReminderTime(input.reminderTime),
    reminderLeadMinutes: Number.isFinite(reminderLead) ? Math.max(5, Math.min(240, reminderLead)) : undefined,
    createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
  };
}

export function loadTasks(userId?: string | null): HouseTask[] {
  if (!canUseStorage()) return mockHouseTasks;
  try {
    const raw = window.localStorage.getItem(keyForUser(userId));
    if (!raw) return mockHouseTasks;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return mockHouseTasks;
    return parsed.map((item, index) => normalizeTask(item, index));
  } catch {
    return mockHouseTasks;
  }
}

export function saveTasks(tasks: HouseTask[], userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(tasks));
}

export interface TaskCalendarEditInput {
  title: string;
  notes?: string;
  date?: string;
  time?: string;
  reminderEnabled?: boolean;
  assignedToId?: string;
  assignedToName?: string;
}

function baseRelatedTaskId(value: string): string {
  return String(value || '')
    .trim()
    .split('::')[0]
    .trim();
}

export function updateTaskFromCalendarRelatedId(
  relatedId: string,
  input: TaskCalendarEditInput,
  userId?: string | null,
): boolean {
  const normalizedRelatedId = baseRelatedTaskId(relatedId);
  if (!normalizedRelatedId) return false;

  const tasks = loadTasks(userId);
  const targetIndex = tasks.findIndex((task) => {
    const baseId = `task-${task.id}`;
    return normalizedRelatedId === baseId || normalizedRelatedId.startsWith(`${baseId}-`);
  });

  if (targetIndex < 0) return false;

  const current = tasks[targetIndex];
  const nextTitle = input.title?.trim();
  const nextNotes = input.notes?.trim();
  const nextReminderTime = normalizeReminderTime(input.time);
  const isDateOnly = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date);

  const updated: HouseTask = {
    ...current,
    title: nextTitle || current.title,
    notes: nextNotes || undefined,
    reminderTime: nextReminderTime || current.reminderTime,
    reminderEnabled:
      typeof input.reminderEnabled === 'boolean'
        ? input.reminderEnabled
        : nextReminderTime
        ? true
        : current.reminderEnabled,
    assignedToId:
      typeof input.assignedToId === 'string' && input.assignedToId.trim()
        ? input.assignedToId.trim()
        : input.assignedToId === ''
        ? undefined
        : current.assignedToId,
    assignedToName:
      typeof input.assignedToName === 'string' && input.assignedToName.trim()
        ? input.assignedToName.trim()
        : input.assignedToId === ''
        ? undefined
        : current.assignedToName,
    dueDate: current.frequency === 'once' && isDateOnly ? input.date : current.dueDate,
  };

  tasks[targetIndex] = updated;
  saveTasks(tasks, userId);
  return true;
}

export function deleteTaskFromCalendarRelatedId(relatedId: string, userId?: string | null): boolean {
  const normalizedRelatedId = baseRelatedTaskId(relatedId);
  if (!normalizedRelatedId) return false;

  const tasks = loadTasks(userId);
  const targetIndex = tasks.findIndex((task) => {
    const baseId = `task-${task.id}`;
    return normalizedRelatedId === baseId || normalizedRelatedId.startsWith(`${baseId}-`);
  });

  if (targetIndex < 0) return false;

  tasks.splice(targetIndex, 1);
  saveTasks(tasks, userId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('homehub:task-state-updated'));
  }

  return true;
}

export function taskOccursOnDate(task: HouseTask, targetDate: Date): boolean {
  const target = dateOnly(targetDate);
  const anchor = getAnchorDate(task);
  if (target < anchor) return false;

  if (task.frequency === 'once') {
    const due = parseIsoDateOnly(task.dueDate);
    return !!due && formatDateOnly(due) === formatDateOnly(target);
  }

  if (task.frequency === 'daily') return true;

  if (task.frequency === 'weekly') {
    const targetDay = DAY_NAMES[target.getDay()];
    const weeklyDay = task.day || DAY_NAMES[anchor.getDay()];
    return weeklyDay === targetDay;
  }

  if (task.frequency === 'monthly') {
    return matchDayOfMonth(anchor, target);
  }

  if (task.frequency === 'every_3_months' || task.frequency === 'every_6_months') {
    const interval = task.frequency === 'every_3_months' ? 3 : 6;
    const diff = monthDiff(anchor, target);
    if (diff < 0 || diff % interval !== 0) return false;
    return matchDayOfMonth(anchor, target);
  }

  if (task.frequency === 'yearly') {
    return (
      target.getMonth() === anchor.getMonth() &&
      matchDayOfMonth(anchor, target)
    );
  }

  return false;
}

export function listTaskDatesInRange(task: HouseTask, rangeStart: Date, rangeEnd: Date): Date[] {
  const start = dateOnly(rangeStart);
  const end = dateOnly(rangeEnd);
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (taskOccursOnDate(task, cursor)) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function taskFrequencyLabel(task: HouseTask): string {
  switch (task.frequency) {
    case 'once':
      return task.dueDate ? `One-time (${task.dueDate})` : 'One-time';
    case 'daily':
      return 'Daily';
    case 'weekly':
      return task.day ? `Weekly (${task.day})` : 'Weekly';
    case 'monthly':
      return 'Monthly';
    case 'every_3_months':
      return 'Every 3 months';
    case 'every_6_months':
      return 'Every 6 months';
    case 'yearly':
      return 'Yearly';
    default:
      return 'Recurring';
  }
}
