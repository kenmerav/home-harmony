const FAVORITES_KEY = 'homehub.favoriteRecipeIds';
const KID_FRIENDLY_KEY = 'homehub.kidFriendlyRecipeOverrides';
const MEAL_MULTIPLIER_KEY = 'homehub.mealMultipliers';
const PLAN_RULES_KEY = 'homehub.planRules';

type IdMap = Record<string, boolean>;
type MultiplierMap = Record<string, number>;

export interface PlanRules {
  preferFavorites: boolean;
  preferKidFriendly: boolean;
  maxCookMinutes: number | null;
}

const defaultRules: PlanRules = {
  preferFavorites: true,
  preferKidFriendly: false,
  maxCookMinutes: null,
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function getIdMap(key: string): IdMap {
  return readJson<IdMap>(key, {});
}

function setIdMap(key: string, id: string, enabled: boolean) {
  const next = getIdMap(key);
  if (enabled) next[id] = true;
  else delete next[id];
  writeJson(key, next);
}

export function getFavoriteIds(): Set<string> {
  return new Set(Object.keys(getIdMap(FAVORITES_KEY)));
}

export function isFavorite(id: string): boolean {
  return !!getIdMap(FAVORITES_KEY)[id];
}

export function setFavorite(id: string, enabled: boolean) {
  setIdMap(FAVORITES_KEY, id, enabled);
}

export function getKidFriendlyOverrides(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(KID_FRIENDLY_KEY, {});
}

export function setKidFriendly(id: string, enabled: boolean) {
  const next = getKidFriendlyOverrides();
  next[id] = enabled;
  writeJson(KID_FRIENDLY_KEY, next);
}

export function getMealMultipliers(): MultiplierMap {
  const raw = readJson<MultiplierMap>(MEAL_MULTIPLIER_KEY, {});
  const clean: MultiplierMap = {};
  for (const [k, v] of Object.entries(raw)) {
    clean[k] = v === 2 ? 2 : 1;
  }
  return clean;
}

export function getMealMultiplier(mealId: string): number {
  return getMealMultipliers()[mealId] === 2 ? 2 : 1;
}

export function setMealMultiplier(mealId: string, multiplier: number) {
  const next = getMealMultipliers();
  if (multiplier <= 1) delete next[mealId];
  else next[mealId] = 2;
  writeJson(MEAL_MULTIPLIER_KEY, next);
}

export function getPlanRules(): PlanRules {
  const raw = readJson<Partial<PlanRules>>(PLAN_RULES_KEY, {});
  return {
    preferFavorites: raw.preferFavorites ?? defaultRules.preferFavorites,
    preferKidFriendly: raw.preferKidFriendly ?? defaultRules.preferKidFriendly,
    maxCookMinutes:
      typeof raw.maxCookMinutes === 'number' && raw.maxCookMinutes > 0
        ? Math.round(raw.maxCookMinutes)
        : null,
  };
}

export function setPlanRules(rules: PlanRules) {
  writeJson(PLAN_RULES_KEY, rules);
}
