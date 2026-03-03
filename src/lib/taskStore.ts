import { mockHouseTasks } from '@/data/mockData';
import { HouseTask } from '@/types';

const TASKS_STORAGE_KEY_PREFIX = 'homehub.tasks.v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function keyForUser(userId?: string | null): string {
  return `${TASKS_STORAGE_KEY_PREFIX}:${userId || 'anon'}`;
}

function normalizeTask(raw: unknown, index: number): HouseTask {
  const input = (raw || {}) as Partial<HouseTask> & { createdAt?: string | Date };
  return {
    id: input.id || `task-${index}`,
    title: input.title || 'Untitled task',
    notes: input.notes,
    type: input.type === 'maintain' || input.type === 'notice' ? input.type : 'do',
    status:
      input.status === 'in_progress' || input.status === 'done'
        ? input.status
        : 'not_started',
    frequency: input.frequency === 'daily' || input.frequency === 'weekly' ? input.frequency : 'once',
    dueDate: typeof input.dueDate === 'string' ? input.dueDate : undefined,
    day: input.day,
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
