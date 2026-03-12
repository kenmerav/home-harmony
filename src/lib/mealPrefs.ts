import { DayOfWeek } from '@/types';

const FAVORITES_KEY = 'homehub.favoriteRecipeIds';
const KID_FRIENDLY_KEY = 'homehub.kidFriendlyRecipeOverrides';
const MEAL_MULTIPLIER_KEY = 'homehub.mealMultipliers';
const PLAN_RULES_KEY = 'homehub.planRules';
const DINNER_REMINDER_KEY = 'homehub.dinnerReminderPrefs';
const MENU_REJUVENATE_KEY = 'homehub.menuRejuvenatePrefs';
const DINNER_REMINDER_LOG_KEY = 'homehub.dinnerReminderLog';

type IdMap = Record<string, boolean>;
type MultiplierMap = Record<string, number>;

export interface PlanRules {
  preferFavorites: boolean;
  preferKidFriendly: boolean;
  favoritesOnly: boolean;
  kidFriendlyOnly: boolean;
  maxCookMinutes: number | null;
  dayLocks: Partial<Record<DayOfWeek, string>>;
}

export interface DinnerReminderPrefs {
  enabled: boolean;
  preferredDinnerTime: string;
}

export interface MenuRejuvenatePrefs {
  enabled: boolean;
  day: DayOfWeek;
  time: string;
  lastRanForWeekOf: string | null;
}

const defaultRules: PlanRules = {
  preferFavorites: true,
  preferKidFriendly: false,
  favoritesOnly: false,
  kidFriendlyOnly: false,
  maxCookMinutes: null,
  dayLocks: {},
};

const defaultDinnerReminderPrefs: DinnerReminderPrefs = {
  enabled: false,
  preferredDinnerTime: '18:00',
};

const defaultMenuRejuvenatePrefs: MenuRejuvenatePrefs = {
  enabled: false,
  day: 'friday',
  time: '15:00',
  lastRanForWeekOf: null,
};

const ALL_DAYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

function sanitizeDayLocks(input: unknown): Partial<Record<DayOfWeek, string>> {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const clean: Partial<Record<DayOfWeek, string>> = {};

  for (const day of ALL_DAYS) {
    const value = raw[day];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) clean[day] = trimmed;
  }

  return clean;
}

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
    favoritesOnly: !!raw.favoritesOnly,
    kidFriendlyOnly: !!raw.kidFriendlyOnly,
    maxCookMinutes:
      typeof raw.maxCookMinutes === 'number' && raw.maxCookMinutes > 0
        ? Math.round(raw.maxCookMinutes)
        : null,
    dayLocks: sanitizeDayLocks(raw.dayLocks),
  };
}

export function setPlanRules(rules: PlanRules) {
  writeJson(PLAN_RULES_KEY, {
    ...rules,
    dayLocks: sanitizeDayLocks(rules.dayLocks),
  });
}

export function getDinnerReminderPrefs(): DinnerReminderPrefs {
  const raw = readJson<Partial<DinnerReminderPrefs>>(DINNER_REMINDER_KEY, {});
  return {
    enabled: !!raw.enabled,
    preferredDinnerTime:
      typeof raw.preferredDinnerTime === 'string' && /^\d{2}:\d{2}$/.test(raw.preferredDinnerTime)
        ? raw.preferredDinnerTime
        : defaultDinnerReminderPrefs.preferredDinnerTime,
  };
}

export function setDinnerReminderPrefs(prefs: DinnerReminderPrefs) {
  writeJson(DINNER_REMINDER_KEY, {
    enabled: !!prefs.enabled,
    preferredDinnerTime:
      typeof prefs.preferredDinnerTime === 'string' && /^\d{2}:\d{2}$/.test(prefs.preferredDinnerTime)
        ? prefs.preferredDinnerTime
        : defaultDinnerReminderPrefs.preferredDinnerTime,
  });
}

export function getMenuRejuvenatePrefs(): MenuRejuvenatePrefs {
  const raw = readJson<Partial<MenuRejuvenatePrefs>>(MENU_REJUVENATE_KEY, {});
  return {
    enabled: !!raw.enabled,
    day: (raw.day || defaultMenuRejuvenatePrefs.day) as DayOfWeek,
    time:
      typeof raw.time === 'string' && /^\d{2}:\d{2}$/.test(raw.time)
        ? raw.time
        : defaultMenuRejuvenatePrefs.time,
    lastRanForWeekOf:
      typeof raw.lastRanForWeekOf === 'string' && raw.lastRanForWeekOf
        ? raw.lastRanForWeekOf
        : null,
  };
}

export function setMenuRejuvenatePrefs(prefs: MenuRejuvenatePrefs) {
  writeJson(MENU_REJUVENATE_KEY, {
    enabled: !!prefs.enabled,
    day: prefs.day,
    time:
      typeof prefs.time === 'string' && /^\d{2}:\d{2}$/.test(prefs.time)
        ? prefs.time
        : defaultMenuRejuvenatePrefs.time,
    lastRanForWeekOf:
      typeof prefs.lastRanForWeekOf === 'string' && prefs.lastRanForWeekOf
        ? prefs.lastRanForWeekOf
        : null,
  });
}

export function markMenuRejuvenatedForWeek(weekOf: string) {
  const current = getMenuRejuvenatePrefs();
  setMenuRejuvenatePrefs({ ...current, lastRanForWeekOf: weekOf });
}

export function hasShownDinnerReminder(dateKey: string, mealId: string): boolean {
  const log = readJson<Record<string, string>>(DINNER_REMINDER_LOG_KEY, {});
  return log[dateKey] === mealId;
}

export function markDinnerReminderShown(dateKey: string, mealId: string) {
  const log = readJson<Record<string, string>>(DINNER_REMINDER_LOG_KEY, {});
  log[dateKey] = mealId;
  writeJson(DINNER_REMINDER_LOG_KEY, log);
}
