export type PlannedMealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert' | 'alcohol';

export interface PlannedFoodEntry {
  id: string;
  date: string; // yyyy-MM-dd
  mealType: PlannedMealType;
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
  name: string;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sourceRecipeId?: string | null;
}

const STORAGE_KEY = 'homehub.mealBudgetPlanner.v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function scopedKey(userId?: string | null): string {
  return `${STORAGE_KEY}:${userId || 'anon'}`;
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

function readEntries(userId?: string | null): PlannedFoodEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return (Array.isArray(parsed) ? parsed : [])
      .map((entry) => normalizeEntry(entry))
      .filter((entry): entry is PlannedFoodEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function writeEntries(entries: PlannedFoodEntry[], userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(scopedKey(userId), JSON.stringify(entries));
}

function sortEntries(entries: PlannedFoodEntry[]): PlannedFoodEntry[] {
  return entries
    .slice()
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.mealType !== b.mealType) return a.mealType.localeCompare(b.mealType);
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
