import { mockHouseTasks } from '@/data/mockData';
import { HouseTask, TaskFrequency, DayOfWeek } from '@/types';
import { getProfileSettingsValue, loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { normalizeAdultScopeIdForRead, normalizeAdultScopeIdForWrite, resolveSharedScopeUserId } from '@/lib/householdScope';

const TASKS_STORAGE_KEY_PREFIX = 'homehub.tasks.v1';
const TASKS_SETTINGS_PATH = ['appPreferences', 'tasks'];
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

let currentStorageScopeUserId: string | null = null;
let hydratedScopeKey: string | null = null;
let lastPersistedSnapshot: string | null = null;
let persistTimer: number | null = null;
let hydrationToken = 0;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function keyForUser(userId?: string | null): string {
  return `${TASKS_STORAGE_KEY_PREFIX}:${resolveSharedScopeUserId(userId) || 'anon'}`;
}

function taskScopeKey(userId?: string | null): string {
  return resolveSharedScopeUserId(userId) || 'anon';
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

function dispatchTaskStateUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('homehub:task-state-updated'));
  }
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

function normalizeTask(raw: unknown, index: number, options?: { forWrite?: boolean }): HouseTask {
  const input = (raw || {}) as Partial<HouseTask> & { createdAt?: string | Date };
  const forWrite = options?.forWrite === true;
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
    assignedToId: (
      forWrite
        ? normalizeAdultScopeIdForWrite(assignedToId || null)
        : normalizeAdultScopeIdForRead(assignedToId || null)
    ) || undefined,
    assignedToName: assignedToName || undefined,
    dueDate: typeof input.dueDate === 'string' ? input.dueDate : undefined,
    day: normalizeTaskDay(input.day),
    reminderEnabled: input.reminderEnabled === true,
    reminderTime: normalizeReminderTime(input.reminderTime),
    reminderLeadMinutes: Number.isFinite(reminderLead) ? Math.max(5, Math.min(240, reminderLead)) : undefined,
    createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
  };
}

function normalizeTasks(input: unknown): HouseTask[] {
  return (Array.isArray(input) ? input : []).map((item, index) => normalizeTask(item, index));
}

function serializeTasks(tasks: HouseTask[]): string {
  return JSON.stringify(
    normalizeTasks(tasks)
      .map((task, index) => normalizeTask(task, index, { forWrite: true }))
      .map((task) => ({
        ...task,
        createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : new Date(task.createdAt).toISOString(),
      })),
  );
}

function readTasks(userId?: string | null): HouseTask[] {
  if (!canUseStorage()) return userId ? [] : mockHouseTasks;
  try {
    const raw = window.localStorage.getItem(keyForUser(userId));
    if (!raw) return userId ? [] : mockHouseTasks;
    return normalizeTasks(JSON.parse(raw));
  } catch {
    return userId ? [] : mockHouseTasks;
  }
}

async function loadRemoteTasks(userId: string): Promise<HouseTask[] | null> {
  const document = await loadProfileSettingsDocument(userId);
  const storedTasks = getProfileSettingsValue(document, TASKS_SETTINGS_PATH);
  if (typeof storedTasks === 'undefined') return null;
  return normalizeTasks(storedTasks);
}

async function persistTasksToAccount(userId: string, tasks: HouseTask[]): Promise<void> {
  const normalizedTasks = normalizeTasks(tasks);
  await updateProfileSettingsValue(
    userId,
    TASKS_SETTINGS_PATH,
    normalizedTasks.map((task) => ({
      ...task,
      createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : new Date(task.createdAt).toISOString(),
    })),
  );
  if (currentStorageScopeUserId === userId) {
    lastPersistedSnapshot = serializeTasks(normalizedTasks);
  }
}

function scheduleTaskPersist(tasks: HouseTask[]) {
  if (!currentStorageScopeUserId) return;
  if (hydratedScopeKey !== taskScopeKey(currentStorageScopeUserId)) return;
  if (typeof window === 'undefined') return;

  const snapshot = serializeTasks(tasks);
  if (snapshot === lastPersistedSnapshot) return;

  if (persistTimer !== null) {
    window.clearTimeout(persistTimer);
  }

  const scopedUserId = currentStorageScopeUserId;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    const latestTasks = readTasks(scopedUserId);
    const latestSnapshot = serializeTasks(latestTasks);
    if (latestSnapshot === lastPersistedSnapshot) return;
    void persistTasksToAccount(scopedUserId, latestTasks).catch((error) => {
      console.error('Failed to save tasks:', error);
    });
  }, 500);
}

function writeTasks(tasks: HouseTask[], userId?: string | null, skipRemotePersist = false) {
  if (!canUseStorage()) return;
  const normalizedTasks = normalizeTasks(tasks);
  window.localStorage.setItem(keyForUser(userId), serializeTasks(normalizedTasks));
  if (!skipRemotePersist) {
    scheduleTaskPersist(normalizedTasks);
  }
  dispatchTaskStateUpdated();
}

export function loadTasks(userId?: string | null): HouseTask[] {
  return readTasks(userId);
}

export function saveTasks(tasks: HouseTask[], userId?: string | null) {
  writeTasks(tasks, userId);
}

export async function hydrateTasksFromAccount(userId?: string | null): Promise<void> {
  if (!userId || !canUseStorage()) return;

  const scopeKey = taskScopeKey(userId);
  const currentToken = ++hydrationToken;
  const localTasks = readTasks(userId);
  const localSnapshot = serializeTasks(localTasks);

  try {
    const remoteTasks = await loadRemoteTasks(userId);
    if (hydrationToken !== currentToken || currentStorageScopeUserId !== userId) return;

    const currentTasks = readTasks(userId);
    const currentSnapshot = serializeTasks(currentTasks);
    const localChangedDuringLoad = currentSnapshot !== localSnapshot;

    if (localChangedDuringLoad) {
      await persistTasksToAccount(userId, currentTasks);
      hydratedScopeKey = scopeKey;
      lastPersistedSnapshot = currentSnapshot;
      dispatchTaskStateUpdated();
      return;
    }

    if (remoteTasks) {
      const remoteSnapshot = serializeTasks(remoteTasks);
      if (remoteSnapshot !== currentSnapshot) {
        writeTasks(remoteTasks, userId, true);
      }
      hydratedScopeKey = scopeKey;
      lastPersistedSnapshot = remoteSnapshot;
      dispatchTaskStateUpdated();
      return;
    }

    await persistTasksToAccount(userId, currentTasks);
    hydratedScopeKey = scopeKey;
    lastPersistedSnapshot = currentSnapshot;
    dispatchTaskStateUpdated();
  } catch (error) {
    console.error('Failed to hydrate tasks:', error);
    if (hydrationToken !== currentToken || currentStorageScopeUserId !== userId) return;
    hydratedScopeKey = scopeKey;
    lastPersistedSnapshot = null;
    dispatchTaskStateUpdated();
  }
}

export function setTaskStorageScope(userId?: string | null) {
  currentStorageScopeUserId = userId || null;
  hydratedScopeKey = null;

  if (typeof window !== 'undefined' && persistTimer !== null) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }

  if (!currentStorageScopeUserId) {
    lastPersistedSnapshot = serializeTasks(readTasks(null));
    hydratedScopeKey = taskScopeKey(null);
    dispatchTaskStateUpdated();
    return;
  }

  lastPersistedSnapshot = null;
  dispatchTaskStateUpdated();
  void hydrateTasksFromAccount(currentStorageScopeUserId);
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
