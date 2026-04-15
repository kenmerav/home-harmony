import { DayOfWeek } from '@/types';
import { resolveSharedScopeUserId } from '@/lib/householdScope';
import { loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';

const FAVORITES_KEY = 'homehub.favoriteRecipeIds';
const KID_FRIENDLY_KEY = 'homehub.kidFriendlyRecipeOverrides';
const MEAL_MULTIPLIER_KEY = 'homehub.mealMultipliers';
const PLAN_RULES_KEY = 'homehub.planRules';
const DINNER_REMINDER_KEY = 'homehub.dinnerReminderPrefs';
const MENU_REJUVENATE_KEY = 'homehub.menuRejuvenatePrefs';
const DINNER_REMINDER_LOG_KEY = 'homehub.dinnerReminderLog';

type IdMap = Record<string, boolean>;
type MultiplierMap = Record<string, number>;
type DinnerServingsByProfile = Record<string, Record<string, number>>;

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
  dinnerTimesByDay: Record<DayOfWeek, string>;
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
  dinnerTimesByDay: {
    monday: '18:00',
    tuesday: '18:00',
    wednesday: '18:00',
    thursday: '18:00',
    friday: '18:00',
    saturday: '18:00',
    sunday: '18:00',
  },
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

function scopedKey(baseKey: string, userId?: string | null): string {
  return `${baseKey}:${resolveSharedScopeUserId(userId || 'scope') || 'anon'}`;
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
  return new Set(Object.keys(getIdMap(scopedKey(FAVORITES_KEY))));
}

export function isFavorite(id: string): boolean {
  return !!getIdMap(scopedKey(FAVORITES_KEY))[id];
}

export function setFavorite(id: string, enabled: boolean) {
  setIdMap(scopedKey(FAVORITES_KEY), id, enabled);
  void persistMealPrefsToAccount();
}

export function getKidFriendlyOverrides(): Record<string, boolean> {
  return readJson<Record<string, boolean>>(scopedKey(KID_FRIENDLY_KEY), {});
}

export function setKidFriendly(id: string, enabled: boolean) {
  const next = getKidFriendlyOverrides();
  next[id] = enabled;
  writeJson(scopedKey(KID_FRIENDLY_KEY), next);
  void persistMealPrefsToAccount();
}

export function getMealMultipliers(): MultiplierMap {
  const raw = readJson<MultiplierMap>(scopedKey(MEAL_MULTIPLIER_KEY), {});
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
  writeJson(scopedKey(MEAL_MULTIPLIER_KEY), next);
  void persistMealPrefsToAccount();
}

function dinnerServingsStorageKey(userId?: string | null): string {
  return `homehub.mealPlannerDinnerServings.v1:${resolveSharedScopeUserId(userId || 'scope') || 'anon'}`;
}

export function getDinnerServingsByProfile(userId?: string | null): DinnerServingsByProfile {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(dinnerServingsStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.entries(parsed).reduce<DinnerServingsByProfile>((acc, [profileId, values]) => {
      if (!values || typeof values !== 'object' || Array.isArray(values)) return acc;
      const normalized = Object.entries(values).reduce<Record<string, number>>((dates, [date, amount]) => {
        const servings = Number(amount);
        if (!Number.isFinite(servings)) return dates;
        dates[date] = Math.min(6, Math.max(0, servings));
        return dates;
      }, {});
      if (Object.keys(normalized).length > 0) acc[profileId] = normalized;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function getDinnerServingsForProfileDate(profileId: string, date: string, userId?: string | null): number {
  const value = getDinnerServingsByProfile(userId)[profileId]?.[date];
  return Number.isFinite(value) ? Math.min(6, Math.max(0, value)) : 1;
}

export function setDinnerServingsByProfile(values: DinnerServingsByProfile, userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(dinnerServingsStorageKey(userId), JSON.stringify(values));
  void persistMealPrefsToAccount(userId);
}

export function getPlanRules(): PlanRules {
  const raw = readJson<Partial<PlanRules>>(scopedKey(PLAN_RULES_KEY), {});
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
  writeJson(scopedKey(PLAN_RULES_KEY), {
    ...rules,
    dayLocks: sanitizeDayLocks(rules.dayLocks),
  });
  void persistMealPrefsToAccount();
}

export function getDinnerReminderPrefs(): DinnerReminderPrefs {
  const raw = readJson<Partial<DinnerReminderPrefs>>(scopedKey(DINNER_REMINDER_KEY), {});
  const preferredDinnerTime =
    typeof raw.preferredDinnerTime === 'string' && /^\d{2}:\d{2}$/.test(raw.preferredDinnerTime)
      ? raw.preferredDinnerTime
      : defaultDinnerReminderPrefs.preferredDinnerTime;

  const dinnerTimesByDay = ALL_DAYS.reduce<Record<DayOfWeek, string>>((acc, day) => {
    const rawDayValue = raw.dinnerTimesByDay?.[day];
    acc[day] =
      typeof rawDayValue === 'string' && /^\d{2}:\d{2}$/.test(rawDayValue)
        ? rawDayValue
        : preferredDinnerTime;
    return acc;
  }, {} as Record<DayOfWeek, string>);

  return {
    enabled: !!raw.enabled,
    preferredDinnerTime,
    dinnerTimesByDay,
  };
}

export function setDinnerReminderPrefs(prefs: DinnerReminderPrefs) {
  const preferredDinnerTime =
    typeof prefs.preferredDinnerTime === 'string' && /^\d{2}:\d{2}$/.test(prefs.preferredDinnerTime)
      ? prefs.preferredDinnerTime
      : defaultDinnerReminderPrefs.preferredDinnerTime;
  const dinnerTimesByDay = ALL_DAYS.reduce<Record<DayOfWeek, string>>((acc, day) => {
    const rawDayValue = prefs.dinnerTimesByDay?.[day];
    acc[day] =
      typeof rawDayValue === 'string' && /^\d{2}:\d{2}$/.test(rawDayValue)
        ? rawDayValue
        : preferredDinnerTime;
    return acc;
  }, {} as Record<DayOfWeek, string>);

  writeJson(scopedKey(DINNER_REMINDER_KEY), {
    enabled: !!prefs.enabled,
    preferredDinnerTime,
    dinnerTimesByDay,
  });
  void persistMealPrefsToAccount();
}

export function getDinnerTimeForDay(day: DayOfWeek, prefs = getDinnerReminderPrefs()): string {
  return prefs.dinnerTimesByDay?.[day] || prefs.preferredDinnerTime || defaultDinnerReminderPrefs.preferredDinnerTime;
}

export function getMenuRejuvenatePrefs(): MenuRejuvenatePrefs {
  const raw = readJson<Partial<MenuRejuvenatePrefs>>(scopedKey(MENU_REJUVENATE_KEY), {});
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
  writeJson(scopedKey(MENU_REJUVENATE_KEY), {
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
  void persistMealPrefsToAccount();
}

export function markMenuRejuvenatedForWeek(weekOf: string) {
  const current = getMenuRejuvenatePrefs();
  setMenuRejuvenatePrefs({ ...current, lastRanForWeekOf: weekOf });
}

export function hasShownDinnerReminder(dateKey: string, mealId: string): boolean {
  const log = readJson<Record<string, string>>(scopedKey(DINNER_REMINDER_LOG_KEY), {});
  return log[dateKey] === mealId;
}

export function markDinnerReminderShown(dateKey: string, mealId: string) {
  const log = readJson<Record<string, string>>(scopedKey(DINNER_REMINDER_LOG_KEY), {});
  log[dateKey] = mealId;
  writeJson(scopedKey(DINNER_REMINDER_LOG_KEY), log);
  void persistMealPrefsToAccount();
}

interface SharedMealPrefsSnapshot {
  favorites?: Record<string, boolean>;
  kidFriendlyOverrides?: Record<string, boolean>;
  mealMultipliers?: Record<string, number>;
  planRules?: PlanRules;
  dinnerReminderPrefs?: DinnerReminderPrefs;
  menuRejuvenatePrefs?: MenuRejuvenatePrefs;
  dinnerReminderLog?: Record<string, string>;
  dinnerServingsByProfile?: DinnerServingsByProfile;
}

function buildMealPrefsSnapshot(): SharedMealPrefsSnapshot {
  return {
    favorites: getIdMap(scopedKey(FAVORITES_KEY)),
    kidFriendlyOverrides: getKidFriendlyOverrides(),
    mealMultipliers: getMealMultipliers(),
    planRules: getPlanRules(),
    dinnerReminderPrefs: getDinnerReminderPrefs(),
    menuRejuvenatePrefs: getMenuRejuvenatePrefs(),
    dinnerReminderLog: readJson<Record<string, string>>(scopedKey(DINNER_REMINDER_LOG_KEY), {}),
    dinnerServingsByProfile: getDinnerServingsByProfile(),
  };
}

async function persistMealPrefsToAccount(userId?: string | null): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId || 'scope');
  if (!scopedUserId) return;
  await updateProfileSettingsValue(scopedUserId, ['shared_preferences', 'meals'], buildMealPrefsSnapshot());
}

export async function hydrateMealPrefsFromAccount(userId?: string | null): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId || 'scope');
  if (!scopedUserId || !canUseStorage()) return;

  const document = await loadProfileSettingsDocument(scopedUserId);
  const shared = document?.shared_preferences;
  if (!shared || typeof shared !== 'object' || Array.isArray(shared)) return;

  const snapshot = (shared as Record<string, unknown>).meals;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return;

  const typed = snapshot as SharedMealPrefsSnapshot;
  if (typed.favorites) writeJson(scopedKey(FAVORITES_KEY), typed.favorites);
  if (typed.kidFriendlyOverrides) writeJson(scopedKey(KID_FRIENDLY_KEY), typed.kidFriendlyOverrides);
  if (typed.mealMultipliers) writeJson(scopedKey(MEAL_MULTIPLIER_KEY), typed.mealMultipliers);
  if (typed.planRules) writeJson(scopedKey(PLAN_RULES_KEY), { ...typed.planRules, dayLocks: sanitizeDayLocks(typed.planRules.dayLocks) });
  if (typed.dinnerReminderPrefs) writeJson(scopedKey(DINNER_REMINDER_KEY), typed.dinnerReminderPrefs);
  if (typed.menuRejuvenatePrefs) writeJson(scopedKey(MENU_REJUVENATE_KEY), typed.menuRejuvenatePrefs);
  if (typed.dinnerReminderLog) writeJson(scopedKey(DINNER_REMINDER_LOG_KEY), typed.dinnerReminderLog);
  if (typed.dinnerServingsByProfile) {
    window.localStorage.setItem(dinnerServingsStorageKey(scopedUserId), JSON.stringify(typed.dinnerServingsByProfile));
  }
}
