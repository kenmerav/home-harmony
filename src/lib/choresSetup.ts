import { DayOfWeek } from '@/types';

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';

interface RewardChore {
  id: string;
  name: string;
  isCompleted: boolean;
  reward: number;
  rewardUnit?: 'money' | 'points';
  completionDates?: string[];
}

interface RewardWeeklyChore extends RewardChore {
  day: DayOfWeek;
}

interface ClaimedExtraChore {
  id: string;
  sourceId: string;
  name: string;
  reward: number;
  penalty: number;
  dueAt: string;
  isCompleted: boolean;
  isFailed: boolean;
  createdAt: string;
  completedAt?: string;
  failedAt?: string;
}

interface ChildEconomy {
  id: string;
  name: string;
  age?: number | null;
  dailyChores: RewardChore[];
  weeklyChores: RewardWeeklyChore[];
  extraChores: ClaimedExtraChore[];
  piggyBank: number;
  pointsBank: number;
  lifetimeEarned: number;
  lifetimePointsEarned: number;
  lifetimePenalties: number;
  cashedOut: number;
}

interface ChoresState {
  children: ChildEconomy[];
  availableExtraChores: unknown[];
  lastDailyResetDate?: string;
  lastWeeklyResetDate?: string;
}

export interface KidChoreSeedInput {
  name: string;
  age: number | null;
}

export interface ChoreChildProfileInput {
  id: string;
  name: string;
  age?: number | null;
}

export interface ChoreChildSummary {
  id: string;
  name: string;
  age: number | null;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function choresStateKey(userId?: string | null): string {
  return `${CHORES_STATE_KEY_PREFIX}:${userId || 'anon'}`;
}

function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function weekResetDateKey(date = new Date()): string {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return dateKey(weekStart);
}

function sanitizeAge(age: number | null): number | null {
  if (typeof age !== 'number' || !Number.isFinite(age)) return null;
  const rounded = Math.round(age);
  if (rounded < 0 || rounded > 21) return null;
  return rounded;
}

function buildTemplate(age: number | null): { daily: string[]; weekly: Array<{ name: string; day: DayOfWeek }> } {
  if (age !== null && age <= 5) {
    return {
      daily: ['Put toys away', 'Place laundry in hamper'],
      weekly: [{ name: 'Help fold towels', day: 'saturday' }],
    };
  }
  if (age !== null && age <= 9) {
    return {
      daily: ['Make bed', 'Tidy room', 'Pack backpack'],
      weekly: [{ name: 'Set table', day: 'thursday' }],
    };
  }
  if (age !== null && age <= 13) {
    return {
      daily: ['Make bed', 'Empty dishwasher', 'Tidy room'],
      weekly: [{ name: 'Take out trash', day: 'wednesday' }],
    };
  }
  return {
    daily: ['Make bed', 'Unload dishwasher', 'Tidy room'],
    weekly: [{ name: 'Laundry fold + put away', day: 'sunday' }],
  };
}

function parseExistingState(userId?: string | null): ChoresState {
  if (!canUseStorage()) return { children: [], availableExtraChores: [] };
  try {
    const raw = window.localStorage.getItem(choresStateKey(userId));
    if (!raw) return { children: [], availableExtraChores: [] };
    const parsed = JSON.parse(raw) as Partial<ChoresState>;
    return {
      children: Array.isArray(parsed.children) ? (parsed.children as ChildEconomy[]) : [],
      availableExtraChores: Array.isArray(parsed.availableExtraChores) ? parsed.availableExtraChores : [],
      lastDailyResetDate: parsed.lastDailyResetDate,
      lastWeeklyResetDate: parsed.lastWeeklyResetDate,
    };
  } catch {
    return { children: [], availableExtraChores: [] };
  }
}

function saveState(state: ChoresState, userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    choresStateKey(userId),
    JSON.stringify({
      children: state.children,
      availableExtraChores: state.availableExtraChores,
      lastDailyResetDate: state.lastDailyResetDate || dateKey(),
      lastWeeklyResetDate: state.lastWeeklyResetDate || weekResetDateKey(),
    }),
  );
  window.dispatchEvent(new CustomEvent('homehub:chores-state-updated'));
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildChildEconomy(input: ChoreChildProfileInput): ChildEconomy {
  const age = sanitizeAge(input.age ?? null);
  const template = buildTemplate(age);
  return {
    id: input.id,
    name: input.name.trim(),
    age,
    dailyChores: template.daily.map((name, choreIndex) => ({
      id: `daily-${input.id}-${choreIndex}`,
      name,
      isCompleted: false,
      reward: 1,
      rewardUnit: 'money',
      completionDates: [],
    })),
    weeklyChores: template.weekly.map((weekly, choreIndex) => ({
      id: `weekly-${input.id}-${choreIndex}`,
      name: weekly.name,
      day: weekly.day,
      isCompleted: false,
      reward: 2,
      rewardUnit: 'money',
      completionDates: [],
    })),
    extraChores: [],
    piggyBank: 0,
    pointsBank: 0,
    lifetimeEarned: 0,
    lifetimePointsEarned: 0,
    lifetimePenalties: 0,
    cashedOut: 0,
  };
}

export function listChoreChildren(userId?: string | null): ChoreChildSummary[] {
  return parseExistingState(userId).children.map((child) => ({
    id: child.id,
    name: child.name,
    age: sanitizeAge(child.age ?? null),
  }));
}

export function upsertChildInChores(input: ChoreChildProfileInput, userId?: string | null): ChoreChildSummary {
  if (!canUseStorage()) {
    return { id: input.id, name: input.name.trim(), age: sanitizeAge(input.age ?? null) };
  }

  const name = input.name.trim();
  const age = sanitizeAge(input.age ?? null);
  const state = parseExistingState(userId);
  const normalizedName = normalizeNameKey(name);
  const existingIndex = state.children.findIndex(
    (child) => child.id === input.id || normalizeNameKey(child.name) === normalizedName,
  );

  if (existingIndex >= 0) {
    const existing = state.children[existingIndex];
    state.children[existingIndex] = {
      ...existing,
      id: input.id,
      name,
      age,
    };
  } else {
    state.children.push(buildChildEconomy({ id: input.id, name, age }));
  }

  saveState(state, userId);
  return { id: input.id, name, age };
}

export function removeChildFromChores(childId: string, userId?: string | null) {
  if (!canUseStorage()) return;
  const state = parseExistingState(userId);
  const nextChildren = state.children.filter((child) => child.id !== childId);
  if (nextChildren.length === state.children.length) return;
  saveState({ ...state, children: nextChildren }, userId);
}

export function seedChoresForKidsIfEmpty(kids: KidChoreSeedInput[], userId?: string | null): boolean {
  if (!canUseStorage()) return false;
  const incoming = Array.isArray(kids) ? kids : [];
  const cleaned = incoming
    .map((kid) => ({
      name: kid.name.trim(),
      age: sanitizeAge(kid.age),
    }))
    .filter((kid) => kid.name.length > 0);

  if (cleaned.length === 0) return false;

  const existing = parseExistingState(userId);
  if (existing.children.length > 0) return false;

  const seededChildren: ChildEconomy[] = cleaned.map((kid, index) => {
    const template = buildTemplate(kid.age);
    const childId = `child-seeded-${Date.now()}-${index}`;
    return {
      id: childId,
      name: kid.name,
      age: kid.age,
      dailyChores: template.daily.map((name, choreIndex) => ({
        id: `daily-seeded-${index}-${choreIndex}`,
        name,
        isCompleted: false,
        reward: 1,
        rewardUnit: 'money',
        completionDates: [],
      })),
      weeklyChores: template.weekly.map((weekly, choreIndex) => ({
        id: `weekly-seeded-${index}-${choreIndex}`,
        name: weekly.name,
        day: weekly.day,
        isCompleted: false,
        reward: 2,
        rewardUnit: 'money',
        completionDates: [],
      })),
      extraChores: [],
      piggyBank: 0,
      pointsBank: 0,
      lifetimeEarned: 0,
      lifetimePointsEarned: 0,
      lifetimePenalties: 0,
      cashedOut: 0,
    };
  });

  window.localStorage.setItem(
    choresStateKey(userId),
    JSON.stringify({
      children: seededChildren,
      availableExtraChores: existing.availableExtraChores,
      lastDailyResetDate: dateKey(),
      lastWeeklyResetDate: weekResetDateKey(),
    }),
  );
  window.dispatchEvent(new CustomEvent('homehub:chores-state-updated'));
  return true;
}
