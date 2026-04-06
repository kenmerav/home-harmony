import { GroceryCategory } from '@/types';
import {
  getProfileSettingsValue,
  loadProfileSettingsDocument,
  updateProfileSettingsValue,
} from '@/lib/profileSettingsStore';

const GROCERY_LIST_STATE_KEY = 'homehub.groceryListState.v1';
const GROCERY_LIST_STATE_PATH = ['appPreferences', 'groceryList'];
const VALID_CATEGORIES: GroceryCategory[] = ['produce', 'meat', 'dairy', 'pantry', 'other'];

export interface GroceryListManualItem {
  id: string;
  name: string;
  quantity: string;
  category: GroceryCategory;
  createdAt: string;
}

export interface GroceryWeekState {
  checkedKeys: string[];
  manualItems: GroceryListManualItem[];
  orderedAt: string | null;
}

export interface StoredGroceryListState {
  recurringItems: GroceryListManualItem[];
  weekStates: Record<string, GroceryWeekState>;
}

export function defaultGroceryWeekState(): GroceryWeekState {
  return {
    checkedKeys: [],
    manualItems: [],
    orderedAt: null,
  };
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function scopedKey(userId?: string | null): string {
  return `${GROCERY_LIST_STATE_KEY}:${userId || 'anon'}`;
}

function normalizeCategory(value: unknown): GroceryCategory {
  return VALID_CATEGORIES.includes(value as GroceryCategory) ? (value as GroceryCategory) : 'other';
}

function normalizeManualItem(value: unknown): GroceryListManualItem | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Partial<GroceryListManualItem>;
  const name = typeof record.name === 'string' ? record.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) return null;
  return {
    id:
      typeof record.id === 'string' && record.id.trim()
        ? record.id
        : crypto.randomUUID(),
    name,
    quantity:
      typeof record.quantity === 'string' && record.quantity.trim()
        ? record.quantity.trim().replace(/\s+/g, ' ')
        : '1x',
    category: normalizeCategory(record.category),
    createdAt:
      typeof record.createdAt === 'string' && record.createdAt.trim()
        ? record.createdAt
        : new Date().toISOString(),
  };
}

function normalizeWeekState(value: unknown): GroceryWeekState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return defaultGroceryWeekState();
  }
  const record = value as Partial<GroceryWeekState>;
  return {
    checkedKeys: Array.isArray(record.checkedKeys)
      ? [...new Set(record.checkedKeys.filter((item): item is string => typeof item === 'string' && item.trim()).map((item) => item.trim()))]
      : [],
    manualItems: Array.isArray(record.manualItems)
      ? record.manualItems
          .map((item) => normalizeManualItem(item))
          .filter((item): item is GroceryListManualItem => Boolean(item))
      : [],
    orderedAt:
      typeof record.orderedAt === 'string' && record.orderedAt.trim()
        ? record.orderedAt
        : null,
  };
}

function pruneWeekStates(weekStates: Record<string, GroceryWeekState>): Record<string, GroceryWeekState> {
  const sortedKeys = Object.keys(weekStates)
    .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 12);

  return sortedKeys.reduce<Record<string, GroceryWeekState>>((next, key) => {
    const weekState = normalizeWeekState(weekStates[key]);
    if (weekState.checkedKeys.length === 0 && weekState.manualItems.length === 0 && !weekState.orderedAt) {
      return next;
    }
    next[key] = weekState;
    return next;
  }, {});
}

export function normalizeStoredGroceryListState(value: unknown): StoredGroceryListState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      recurringItems: [],
      weekStates: {},
    };
  }
  const record = value as Partial<StoredGroceryListState>;
  const recurringItems = Array.isArray(record.recurringItems)
    ? record.recurringItems
        .map((item) => normalizeManualItem(item))
        .filter((item): item is GroceryListManualItem => Boolean(item))
    : [];

  const weekStatesInput =
    record.weekStates && typeof record.weekStates === 'object' && !Array.isArray(record.weekStates)
      ? (record.weekStates as Record<string, unknown>)
      : {};

  const weekStates = pruneWeekStates(
    Object.entries(weekStatesInput).reduce<Record<string, GroceryWeekState>>((next, [weekKey, weekState]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey)) return next;
      next[weekKey] = normalizeWeekState(weekState);
      return next;
    }, {}),
  );

  return {
    recurringItems,
    weekStates,
  };
}

export function loadLocalGroceryListState(userId?: string | null): StoredGroceryListState {
  if (!canUseStorage()) {
    return normalizeStoredGroceryListState(null);
  }

  try {
    const raw = window.localStorage.getItem(scopedKey(userId));
    if (!raw) return normalizeStoredGroceryListState(null);
    return normalizeStoredGroceryListState(JSON.parse(raw));
  } catch {
    return normalizeStoredGroceryListState(null);
  }
}

export function saveLocalGroceryListState(
  state: StoredGroceryListState,
  userId?: string | null,
): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(scopedKey(userId), JSON.stringify(normalizeStoredGroceryListState(state)));
}

export async function loadAccountGroceryListState(
  userId?: string | null,
): Promise<StoredGroceryListState | null> {
  if (!userId) return null;
  const document = await loadProfileSettingsDocument(userId);
  const value = getProfileSettingsValue(document, GROCERY_LIST_STATE_PATH);
  if (typeof value === 'undefined') return null;
  return normalizeStoredGroceryListState(value);
}

export async function saveAccountGroceryListState(
  userId: string,
  state: StoredGroceryListState,
): Promise<void> {
  await updateProfileSettingsValue(
    userId,
    GROCERY_LIST_STATE_PATH,
    normalizeStoredGroceryListState(state),
  );
}

export function hasMeaningfulGroceryListState(state: StoredGroceryListState): boolean {
  return (
    state.recurringItems.length > 0 ||
    Object.values(state.weekStates).some(
      (weekState) => weekState.checkedKeys.length > 0 || weekState.manualItems.length > 0 || Boolean(weekState.orderedAt),
    )
  );
}
