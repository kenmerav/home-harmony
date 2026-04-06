import { getProfileSettingsValue, loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';

export type PlannedMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'alcohol';

export interface PlannedFoodEntry {
  id: string;
  date: string; // yyyy-MM-dd
  mealType: PlannedMealType;
  personId?: string | null;
  personName?: string | null;
  name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sourceRecipeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlannedFoodEntryInput {
  date: string;
  mealType: PlannedMealType;
  personId?: string | null;
  personName?: string | null;
  name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sourceRecipeId?: string | null;
}

const STORAGE_KEY = 'homehub.mealBudgetPlanner.v1';
const MEAL_BUDGET_PLANNER_SETTINGS_PATH = ['appPreferences', 'mealBudgetPlanner', 'entries'];

let currentStorageScopeUserId: string | null = null;
let hydratedScopeKey: string | null = null;
let lastPersistedSnapshot: string | null = null;
let persistTimer: number | null = null;
let hydrationToken = 0;

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function scopedKey(userId?: string | null): string {
  return `${STORAGE_KEY}:${userId || 'anon'}`;
}

function plannerScopeKey(userId?: string | null): string {
  return userId || 'anon';
}

function dispatchPlannerUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('homehub:planned-food-updated'));
    window.dispatchEvent(new CustomEvent('homehub:meals-updated'));
  }
}

function toFinite(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeEntry(raw: unknown): PlannedFoodEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<PlannedFoodEntry>;
  if (!input.id || !input.date || !input.name || !input.mealType) return null;
  return {
    id: String(input.id),
    date: String(input.date),
    mealType: input.mealType as PlannedMealType,
    personId: typeof input.personId === 'string' && input.personId.trim() ? String(input.personId) : null,
    personName: typeof input.personName === 'string' && input.personName.trim() ? String(input.personName).trim() : null,
    name: String(input.name),
    servings: Math.max(0.1, toFinite(input.servings, 1)),
    calories: Math.max(0, Math.round(toFinite(input.calories, 0))),
    protein_g: Math.max(0, Math.round(toFinite(input.protein_g, 0))),
    carbs_g: Math.max(0, Math.round(toFinite(input.carbs_g, 0))),
    fat_g: Math.max(0, Math.round(toFinite(input.fat_g, 0))),
    sourceRecipeId: input.sourceRecipeId || null,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

function normalizeEntries(input: unknown): PlannedFoodEntry[] {
  return (Array.isArray(input) ? input : [])
    .map((entry) => normalizeEntry(entry))
    .filter((entry): entry is PlannedFoodEntry => Boolean(entry));
}

function readEntries(userId?: string | null): PlannedFoodEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return normalizeEntries(parsed);
  } catch {
    return [];
  }
}

function serializeEntries(entries: PlannedFoodEntry[]): string {
  return JSON.stringify(sortEntries(normalizeEntries(entries)));
}

async function loadRemoteEntries(userId: string): Promise<PlannedFoodEntry[] | null> {
  const document = await loadProfileSettingsDocument(userId);
  const storedEntries = getProfileSettingsValue(document, MEAL_BUDGET_PLANNER_SETTINGS_PATH);
  if (typeof storedEntries === 'undefined') return null;
  return sortEntries(normalizeEntries(storedEntries));
}

async function persistEntriesToAccount(userId: string, entries: PlannedFoodEntry[]): Promise<void> {
  const normalizedEntries = sortEntries(normalizeEntries(entries));
  await updateProfileSettingsValue(userId, MEAL_BUDGET_PLANNER_SETTINGS_PATH, normalizedEntries);
  if (currentStorageScopeUserId === userId) {
    lastPersistedSnapshot = serializeEntries(normalizedEntries);
  }
}

function scheduleEntriesPersist(entries: PlannedFoodEntry[]) {
  if (!currentStorageScopeUserId) return;
  if (hydratedScopeKey !== plannerScopeKey(currentStorageScopeUserId)) return;
  if (typeof window === 'undefined') return;

  const snapshot = serializeEntries(entries);
  if (snapshot === lastPersistedSnapshot) return;

  if (persistTimer !== null) {
    window.clearTimeout(persistTimer);
  }

  const scopedUserId = currentStorageScopeUserId;
  persistTimer = window.setTimeout(() => {
    persistTimer = null;
    const latestEntries = readEntries(scopedUserId);
    const latestSnapshot = serializeEntries(latestEntries);
    if (latestSnapshot === lastPersistedSnapshot) return;
    void persistEntriesToAccount(scopedUserId, latestEntries).catch((error) => {
      console.error('Failed to save planned meals:', error);
    });
  }, 500);
}

function writeEntries(entries: PlannedFoodEntry[], userId?: string | null, skipRemotePersist = false) {
  if (!canUseStorage()) return;
  const normalizedEntries = sortEntries(normalizeEntries(entries));
  window.localStorage.setItem(scopedKey(userId), JSON.stringify(normalizedEntries));
  if (!skipRemotePersist) {
    scheduleEntriesPersist(normalizedEntries);
  }
  dispatchPlannerUpdated();
}

function sortEntries(entries: PlannedFoodEntry[]): PlannedFoodEntry[] {
  return entries
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.mealType !== b.mealType) return a.mealType.localeCompare(b.mealType);
      if ((a.personId || '') !== (b.personId || '')) return (a.personId || '').localeCompare(b.personId || '');
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export function getPlannedFoodEntries(userId?: string | null): PlannedFoodEntry[] {
  return sortEntries(readEntries(userId));
}

export function addPlannedFoodEntry(input: PlannedFoodEntryInput, userId?: string | null): PlannedFoodEntry {
  const entries = readEntries(userId);
  const now = new Date().toISOString();
  const next: PlannedFoodEntry = {
    id: crypto.randomUUID(),
    date: input.date,
    mealType: input.mealType,
    personId: input.personId || null,
    personName: input.personName?.trim() || null,
    name: input.name.trim(),
    servings: Math.max(0.1, input.servings),
    calories: Math.max(0, Math.round(input.calories)),
    protein_g: Math.max(0, Math.round(input.protein_g)),
    carbs_g: Math.max(0, Math.round(input.carbs_g)),
    fat_g: Math.max(0, Math.round(input.fat_g)),
    sourceRecipeId: input.sourceRecipeId || null,
    createdAt: now,
    updatedAt: now,
  };
  const updated = sortEntries([next, ...entries]);
  writeEntries(updated, userId);
  return next;
}

export function deletePlannedFoodEntry(entryId: string, userId?: string | null) {
  const entries = readEntries(userId);
  writeEntries(entries.filter((entry) => entry.id !== entryId), userId);
}

export function deletePlannedFoodEntriesByDateAndMealType(
  date: string,
  mealType: PlannedMealType,
  personId?: string | null,
  userId?: string | null,
): number {
  const entries = readEntries(userId);
  const normalizedPersonId = personId?.trim() || null;
  const next = entries.filter(
    (entry) =>
      !(
        entry.date === date &&
        entry.mealType === mealType &&
        (normalizedPersonId === null ? (entry.personId || null) === null : (entry.personId || null) === normalizedPersonId)
      ),
  );
  if (next.length === entries.length) return 0;
  writeEntries(sortEntries(next), userId);
  return entries.length - next.length;
}

export function updatePlannedFoodEntry(
  entryId: string,
  updates: Partial<Omit<PlannedFoodEntry, 'id' | 'createdAt'>>,
  userId?: string | null,
) {
  const entries = readEntries(userId);
  const next = sortEntries(
    entries.map((entry) =>
      entry.id !== entryId
        ? entry
        : {
            ...entry,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
    ),
  );
  writeEntries(next, userId);
}

export function listCommonPlannedFoods(userId?: string | null, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const entry of readEntries(userId)) {
    const name = entry.name.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(1, limit))
    .map(([name]) => name);
}

export async function hydrateMealBudgetPlannerFromAccount(userId?: string | null): Promise<void> {
  if (!userId || !canUseStorage()) return;

  const scopeKey = plannerScopeKey(userId);
  const currentToken = ++hydrationToken;
  const localEntries = readEntries(userId);
  const localSnapshot = serializeEntries(localEntries);

  try {
    const remoteEntries = await loadRemoteEntries(userId);
    if (hydrationToken !== currentToken || currentStorageScopeUserId !== userId) return;

    const currentEntries = readEntries(userId);
    const currentSnapshot = serializeEntries(currentEntries);
    const localChangedDuringLoad = currentSnapshot !== localSnapshot;

    let nextEntries = currentEntries;
    let nextSnapshot = currentSnapshot;

    if (localChangedDuringLoad) {
      await persistEntriesToAccount(userId, currentEntries);
    } else if (remoteEntries) {
      const merged = new Map<string, PlannedFoodEntry>();
      currentEntries.forEach((entry) => merged.set(entry.id, entry));
      remoteEntries.forEach((entry) => merged.set(entry.id, entry));
      nextEntries = sortEntries(Array.from(merged.values()));
      nextSnapshot = serializeEntries(nextEntries);
      if (nextSnapshot !== currentSnapshot) {
        writeEntries(nextEntries, userId, true);
      }
      if (nextSnapshot !== serializeEntries(remoteEntries)) {
        await persistEntriesToAccount(userId, nextEntries);
      } else {
        lastPersistedSnapshot = nextSnapshot;
      }
    } else {
      await persistEntriesToAccount(userId, currentEntries);
    }

    if (hydrationToken !== currentToken || currentStorageScopeUserId !== userId) return;

    hydratedScopeKey = scopeKey;
    lastPersistedSnapshot = nextSnapshot;
    dispatchPlannerUpdated();
  } catch (error) {
    console.error('Failed to hydrate planned meals:', error);
    if (hydrationToken !== currentToken || currentStorageScopeUserId !== userId) return;
    hydratedScopeKey = scopeKey;
    lastPersistedSnapshot = null;
    dispatchPlannerUpdated();
  }
}

export function setMealBudgetPlannerStorageScope(userId?: string | null) {
  currentStorageScopeUserId = userId || null;
  hydratedScopeKey = null;

  if (typeof window !== 'undefined' && persistTimer !== null) {
    window.clearTimeout(persistTimer);
    persistTimer = null;
  }

  if (!currentStorageScopeUserId) {
    lastPersistedSnapshot = serializeEntries(readEntries(null));
    hydratedScopeKey = plannerScopeKey(null);
    dispatchPlannerUpdated();
    return;
  }

  lastPersistedSnapshot = null;
  dispatchPlannerUpdated();
  void hydrateMealBudgetPlannerFromAccount(currentStorageScopeUserId);
}
