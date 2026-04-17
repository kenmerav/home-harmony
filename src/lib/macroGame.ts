import { addDays, format, startOfWeek, subDays } from 'date-fns';
import { mockMealLogs, mockProfiles } from '@/data/mockData';
import { getPlannedFoodEntriesForDate } from '@/lib/mealBudgetPlanner';
import { getProfileSettingsValue, loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { Macros, MealLog } from '@/types';
import { choresStateStorageKey } from '@/lib/choresStateStore';

export type AdultId = string;
export type HouseholdMemberType = 'adult' | 'child';
export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type BodyGoal = 'fat_loss' | 'maintenance' | 'muscle_gain' | 'recomp';
export type GoalPace = 'slow' | 'moderate' | 'aggressive';
export type BodyUnitSystem = 'imperial' | 'metric';
export type AdultScoreCategory = 'meals' | 'protein' | 'calories' | 'water' | 'alcohol' | 'consistency';

export interface AdultScoreSettings {
  meals: boolean;
  protein: boolean;
  calories: boolean;
  water: boolean;
  alcohol: boolean;
  consistency: boolean;
}

const STORAGE_KEY = 'homehub.macroGameState.v1';
const MACRO_GAME_PROFILES_SETTINGS_PATH = ['appPreferences', 'macroGame', 'profiles'];
const MACRO_GAME_ACTIVITY_SETTINGS_PATH = ['appPreferences', 'macroGame', 'activity'];

let currentStorageScopeUserId: string | null = null;
let hydratedProfilesScopeKey: string | null = null;
let lastPersistedProfilesSnapshot: string | null = null;
let profilePersistTimer: number | null = null;
let hydratedActivityScopeKey: string | null = null;
let lastPersistedActivitySnapshot: string | null = null;
let activityPersistTimer: number | null = null;
let profileHydrationToken = 0;
let activityHydrationToken = 0;
let hideBuiltInWifeDashboard = false;

interface StoredMealLog extends Omit<MealLog, 'createdAt'> {
  createdAt: string;
}

export interface MacroQuestionnaire {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goal: BodyGoal;
  pace: GoalPace;
}

export interface MacroPlan {
  questionnaire: MacroQuestionnaire;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  bodyUnitSystem: BodyUnitSystem;
  proteinOnlyMode: boolean;
  waterTargetOz: number;
  alcoholLimitDrinks: number;
  scorePointsFor: AdultScoreSettings;
}

export interface FemaleHealthSettings {
  cycleTrackingEnabled: boolean;
  pregnancyTrackingEnabled: boolean;
  lastPeriodStart: string;
  cycleLengthDays: number;
  pregnancyDueDate: string;
  notes: string;
}

interface PersonGameProfile {
  id: AdultId;
  name: string;
  macroPlan: MacroPlan;
  memberType: HouseholdMemberType;
  femaleHealth: FemaleHealthSettings;
  createdAt?: string;
}

interface DayTracker {
  waterOz: number;
  alcoholDrinks: number;
}

export interface DashboardTodoItem {
  id: string;
  personId: AdultId;
  text: string;
  isCompleted: boolean;
  createdAt: string;
  completedAt?: string;
}

interface StoredState {
  mealLogs: StoredMealLog[];
  profiles: Record<string, PersonGameProfile>;
  trackers: Record<string, Partial<Record<string, DayTracker>>>;
  todos: Record<string, DashboardTodoItem[]>;
}

function defaultFemaleHealthSettings(): FemaleHealthSettings {
  return {
    cycleTrackingEnabled: false,
    pregnancyTrackingEnabled: false,
    lastPeriodStart: '',
    cycleLengthDays: 28,
    pregnancyDueDate: '',
    notes: '',
  };
}

function normalizeFemaleHealthSettings(input: unknown): FemaleHealthSettings {
  const fallback = defaultFemaleHealthSettings();
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fallback;
  }

  const value = input as Partial<FemaleHealthSettings>;
  const cycleLengthDays = Number.isFinite(Number(value.cycleLengthDays))
    ? Math.max(20, Math.min(45, Math.round(Number(value.cycleLengthDays))))
    : fallback.cycleLengthDays;

  return {
    cycleTrackingEnabled: !!value.cycleTrackingEnabled,
    pregnancyTrackingEnabled: !!value.pregnancyTrackingEnabled,
    lastPeriodStart: typeof value.lastPeriodStart === 'string' ? value.lastPeriodStart.trim() : '',
    cycleLengthDays,
    pregnancyDueDate: typeof value.pregnancyDueDate === 'string' ? value.pregnancyDueDate.trim() : '',
    notes: typeof value.notes === 'string' ? value.notes.trim() : '',
  };
}

function sortDashboardTodos(items: DashboardTodoItem[]): DashboardTodoItem[] {
  return items.slice().sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
    return String(a.createdAt).localeCompare(String(b.createdAt));
  });
}

export interface DashboardProfile {
  id: string;
  name: string;
  memberType: HouseholdMemberType;
  createdAt?: string;
}

export interface DailyScore {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mealsLogged: number;
  waterOz: number;
  alcoholDrinks: number;
  proteinHit: boolean;
  calorieHit: boolean;
  waterHit: boolean;
  alcoholHit: boolean;
  goalHit: boolean;
  points: number;
  pointBreakdown: {
    meals: number;
    protein: number;
    calories: number;
    water: number;
    alcohol: number;
    consistency: number;
  };
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  type: 'adult' | 'kid';
  todayPoints: number;
  weekPoints: number;
  streak: number;
  headline: string;
}

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

const paceAdjustments: Record<GoalPace, number> = {
  slow: 250,
  moderate: 450,
  aggressive: 700,
};

const KID_DAILY_PROGRESS_POINTS = 40;
const KID_DAILY_PERFECT_BONUS = 10;
const KID_WEEKLY_CHORE_POINTS = 20;
const KID_EXTRA_CHORE_POINTS = 25;
const KID_EXTRA_CHORE_MISS_PENALTY = 15;
const KID_EXTRA_CHORE_DAILY_CAP = 25;
const KID_EXTRA_CHORE_WEEKLY_CAP = 75;
const KID_EXTRA_CHORE_MISS_DAILY_CAP = 15;
const KID_EXTRA_CHORE_MISS_WEEKLY_CAP = 45;

const defaultQuestionnaire = (id: AdultId, name?: string): MacroQuestionnaire => {
  const normalizedName = (name || '').toLowerCase();
  const femaleHint = id === 'wife' || normalizedName.includes('wife') || normalizedName.includes('mom');
  if (femaleHint) {
    return {
      sex: 'female',
      age: 34,
      heightCm: 165,
      weightKg: 68,
      activityLevel: 'moderate',
      goal: 'fat_loss',
      pace: 'moderate',
    };
  }
  return {
    sex: 'male',
    age: 35,
    heightCm: 180,
    weightKg: 84,
    activityLevel: 'moderate',
    goal: 'muscle_gain',
    pace: 'moderate',
  };
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function macroStateKey(userId?: string | null): string {
  return `${STORAGE_KEY}:${userId || 'anon'}`;
}

function macroScopeKey(userId?: string | null): string {
  return userId || 'anon';
}

function dispatchMacroStateUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('homehub:macro-state-updated'));
  }
}

function choresStateKey(userId?: string | null): string {
  return choresStateStorageKey(userId);
}

function toStoredMealLog(log: MealLog): StoredMealLog {
  return {
    ...log,
    createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : new Date(log.createdAt).toISOString(),
  };
}

function fromStoredMealLog(log: StoredMealLog): MealLog {
  return {
    ...log,
    createdAt: new Date(log.createdAt),
  };
}

function defaultPlan(id: AdultId, name?: string): MacroPlan {
  const questionnaire = defaultQuestionnaire(id, name);
  const recommendation = calculateMacroRecommendation(questionnaire);
  const isFemalePreset = questionnaire.sex === 'female';
  return {
    questionnaire,
    ...recommendation,
    bodyUnitSystem: 'imperial',
    proteinOnlyMode: false,
    waterTargetOz: isFemalePreset ? 80 : 100,
    alcoholLimitDrinks: isFemalePreset ? 1 : 2,
    scorePointsFor: {
      meals: true,
      protein: true,
      calories: true,
      water: true,
      alcohol: true,
      consistency: true,
    },
  };
}

function normalizeHouseholdMemberType(value: unknown): HouseholdMemberType {
  return value === 'child' ? 'child' : 'adult';
}

function sanitizeDashboardName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  return trimmed || 'Dashboard';
}

function toDashboardName(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function createDashboardId(name: string): string {
  const slug = sanitizeDashboardName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${slug || 'dashboard'}-${suffix}`;
}

function initialState(): StoredState {
  const meProfile = mockProfiles.find((p) => p.id === 'me');
  const mePlan = defaultPlan('me');
  if (meProfile?.dailyTargets) {
    mePlan.calories = meProfile.dailyTargets.calories;
    mePlan.protein_g = meProfile.dailyTargets.protein_g;
    mePlan.carbs_g = meProfile.dailyTargets.carbs_g;
    mePlan.fat_g = meProfile.dailyTargets.fat_g;
  }

  return {
    mealLogs: mockMealLogs.map(toStoredMealLog),
    profiles: {
      me: {
        id: 'me',
        name: meProfile?.name || 'Me',
        memberType: 'adult',
        macroPlan: mePlan,
        femaleHealth: defaultFemaleHealthSettings(),
        createdAt: new Date().toISOString(),
      },
    },
    trackers: {},
    todos: {},
  };
}

function normalizeProfiles(
  input: unknown,
  seedProfiles: Record<string, PersonGameProfile>,
): Record<string, PersonGameProfile> {
  const parsedProfiles =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, Partial<PersonGameProfile>>)
      : {};
  const mergedProfiles: Record<string, PersonGameProfile> = {};

  Object.entries(parsedProfiles).forEach(([id, incoming]) => {
    if (!id) return;
    const fallbackName = id === 'me' ? 'Me' : id === 'wife' ? 'Wife' : toDashboardName(id);
    const fallbackProfile = seedProfiles[id];
    const basePlan = defaultPlan(id, incoming?.name || fallbackName);
    const incomingMacroPlan = incoming?.macroPlan || {};
    const incomingQuestionnaire = incomingMacroPlan.questionnaire || {};

    mergedProfiles[id] = {
      id,
      name: incoming?.name?.trim() || fallbackProfile?.name || fallbackName,
      memberType:
        id === 'me' || id === 'wife'
          ? 'adult'
          : normalizeHouseholdMemberType(incoming?.memberType ?? fallbackProfile?.memberType),
      createdAt: incoming?.createdAt || fallbackProfile?.createdAt || new Date().toISOString(),
      femaleHealth: normalizeFemaleHealthSettings(incoming?.femaleHealth ?? fallbackProfile?.femaleHealth),
      macroPlan: {
        ...basePlan,
        ...incomingMacroPlan,
        questionnaire: {
          ...basePlan.questionnaire,
          ...incomingQuestionnaire,
        },
        bodyUnitSystem: incomingMacroPlan.bodyUnitSystem || basePlan.bodyUnitSystem,
        scorePointsFor: {
          ...basePlan.scorePointsFor,
          ...(incomingMacroPlan.scorePointsFor || {}),
        },
      },
    };
  });

  ['me'].forEach((id) => {
    if (!mergedProfiles[id]) {
      mergedProfiles[id] = seedProfiles[id];
    }
  });

  return mergedProfiles;
}

function normalizeStoredMealLogs(input: unknown): StoredMealLog[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID();
      const recipeName =
        typeof item.recipeName === 'string' && item.recipeName.trim()
          ? item.recipeName.trim()
          : 'Meal';
      const person = typeof item.person === 'string' && item.person.trim() ? item.person.trim() : 'me';
      const date = typeof item.date === 'string' && item.date.trim() ? item.date.trim() : dayKey();
      const servingsValue = Number(item.servings);
      const macros =
        item.macros && typeof item.macros === 'object' && !Array.isArray(item.macros)
          ? (item.macros as Record<string, unknown>)
          : {};
      const createdAtRaw =
        typeof item.createdAt === 'string' && item.createdAt.trim()
          ? item.createdAt
          : new Date().toISOString();

      return {
        id,
        recipeId: typeof item.recipeId === 'string' && item.recipeId.trim() ? item.recipeId.trim() : undefined,
        recipeName,
        date,
        person,
        mealType:
          item.mealType === 'breakfast' ||
          item.mealType === 'lunch' ||
          item.mealType === 'dinner' ||
          item.mealType === 'snack' ||
          item.mealType === 'dessert' ||
          item.mealType === 'alcohol'
            ? item.mealType
            : undefined,
        servings: Number.isFinite(servingsValue) && servingsValue > 0 ? servingsValue : 1,
        macros: {
          calories: Number.isFinite(Number(macros.calories)) ? Math.max(0, Number(macros.calories)) : 0,
          protein_g: Number.isFinite(Number(macros.protein_g)) ? Math.max(0, Number(macros.protein_g)) : 0,
          carbs_g: Number.isFinite(Number(macros.carbs_g)) ? Math.max(0, Number(macros.carbs_g)) : 0,
          fat_g: Number.isFinite(Number(macros.fat_g)) ? Math.max(0, Number(macros.fat_g)) : 0,
          fiber_g: Number.isFinite(Number(macros.fiber_g)) ? Math.max(0, Number(macros.fiber_g)) : undefined,
        },
        isQuickAdd: !!item.isQuickAdd,
        createdAt: createdAtRaw,
      };
    })
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function normalizeTrackers(
  input: unknown,
): Record<string, Partial<Record<string, DayTracker>>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return Object.entries(input as Record<string, unknown>).reduce<Record<string, Partial<Record<string, DayTracker>>>>(
    (dates, [dateKey, trackerValue]) => {
      if (!isDateKey(dateKey) || !trackerValue || typeof trackerValue !== 'object' || Array.isArray(trackerValue)) {
        return dates;
      }

      const normalizedPeople = Object.entries(trackerValue as Record<string, unknown>).reduce<
        Partial<Record<string, DayTracker>>
      >((people, [personId, dayTracker]) => {
        if (!dayTracker || typeof dayTracker !== 'object' || Array.isArray(dayTracker) || !personId.trim()) {
          return people;
        }
        const trackerRecord = dayTracker as Record<string, unknown>;
        people[personId] = {
          waterOz: Number.isFinite(Number(trackerRecord.waterOz)) ? Math.max(0, Number(trackerRecord.waterOz)) : 0,
          alcoholDrinks:
            Number.isFinite(Number(trackerRecord.alcoholDrinks))
              ? Math.max(0, Number(trackerRecord.alcoholDrinks))
              : 0,
        };
        return people;
      }, {});

      if (Object.keys(normalizedPeople).length > 0) {
        dates[dateKey] = normalizedPeople;
      }
      return dates;
    },
    {},
  );
}

function normalizeTodos(input: unknown): Record<string, DashboardTodoItem[]> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return Object.entries(input as Record<string, unknown>).reduce<Record<string, DashboardTodoItem[]>>(
    (people, [personId, todos]) => {
      if (!personId.trim() || !Array.isArray(todos)) return people;
      const normalized = todos
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => {
          const text = typeof item.text === 'string' ? item.text.trim().replace(/\s+/g, ' ') : '';
          if (!text) return null;
          return {
            id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
            personId,
            text,
            isCompleted: !!item.isCompleted,
            createdAt:
              typeof item.createdAt === 'string' && item.createdAt.trim()
                ? item.createdAt
                : new Date().toISOString(),
            completedAt:
              typeof item.completedAt === 'string' && item.completedAt.trim()
                ? item.completedAt
                : undefined,
          } as DashboardTodoItem;
        })
        .filter((item): item is DashboardTodoItem => Boolean(item));
      if (normalized.length > 0) {
        people[personId] = sortDashboardTodos(normalized);
      }
      return people;
    },
    {},
  );
}

function normalizeStoredState(input: Partial<StoredState> | null | undefined): StoredState {
  const seed = initialState();
  return {
    mealLogs: normalizeStoredMealLogs(input?.mealLogs),
    profiles: normalizeProfiles(input?.profiles, seed.profiles),
    trackers: normalizeTrackers(input?.trackers),
    todos: normalizeTodos(input?.todos),
  };
}

function readScopedStateRaw(userId?: string | null): string | null {
  if (!canUseStorage()) return null;

  const scopedRaw = window.localStorage.getItem(macroStateKey(userId));
  if (scopedRaw) return scopedRaw;

  if (userId) {
    const anonRaw = window.localStorage.getItem(macroStateKey(null));
    const anonMigratedTo = window.localStorage.getItem(`${STORAGE_KEY}:anon-migrated-to`);
    if (anonRaw && (!anonMigratedTo || anonMigratedTo === userId)) {
      window.localStorage.setItem(macroStateKey(userId), anonRaw);
      window.localStorage.setItem(`${STORAGE_KEY}:anon-migrated-to`, userId);
      return anonRaw;
    }
  }

  const legacyRaw = window.localStorage.getItem(STORAGE_KEY);
  if (!legacyRaw) return null;

  window.localStorage.setItem(macroStateKey(userId), legacyRaw);
  window.localStorage.removeItem(STORAGE_KEY);
  return legacyRaw;
}

function serializeProfiles(profiles: Record<string, PersonGameProfile>): string {
  return JSON.stringify(normalizeProfiles(profiles, initialState().profiles));
}

function serializeActivity(state: Pick<StoredState, 'mealLogs' | 'trackers' | 'todos'>): string {
  return JSON.stringify({
    mealLogs: normalizeStoredMealLogs(state.mealLogs),
    trackers: normalizeTrackers(state.trackers),
    todos: normalizeTodos(state.todos),
  });
}

function mergeProfilesPreferRemote(
  localProfiles: Record<string, PersonGameProfile>,
  remoteProfiles: Record<string, PersonGameProfile>,
): Record<string, PersonGameProfile> {
  const seedProfiles = initialState().profiles;
  const merged = normalizeProfiles(localProfiles, seedProfiles);
  Object.values(normalizeProfiles(remoteProfiles, seedProfiles)).forEach((profile) => {
    merged[profile.id] = profile;
  });
  return normalizeProfiles(merged, seedProfiles);
}

function mergeActivityPreferRemote(
  localState: Pick<StoredState, 'mealLogs' | 'trackers' | 'todos'>,
  remoteState: Pick<StoredState, 'mealLogs' | 'trackers' | 'todos'>,
): Pick<StoredState, 'mealLogs' | 'trackers' | 'todos'> {
  const mergedLogs = new Map<string, StoredMealLog>();
  normalizeStoredMealLogs(localState.mealLogs).forEach((log) => {
    mergedLogs.set(log.id, log);
  });
  normalizeStoredMealLogs(remoteState.mealLogs).forEach((log) => {
    mergedLogs.set(log.id, log);
  });

  const mergedTrackers = normalizeTrackers(localState.trackers);
  Object.entries(normalizeTrackers(remoteState.trackers)).forEach(([date, personTrackers]) => {
    mergedTrackers[date] = {
      ...(mergedTrackers[date] || {}),
      ...personTrackers,
    };
  });

  const mergedTodos = normalizeTodos(localState.todos);
  Object.entries(normalizeTodos(remoteState.todos)).forEach(([personId, todos]) => {
    const next = new Map<string, DashboardTodoItem>();
    (mergedTodos[personId] || []).forEach((item) => next.set(item.id, item));
    todos.forEach((item) => next.set(item.id, item));
    mergedTodos[personId] = sortDashboardTodos(Array.from(next.values()));
  });

  return {
    mealLogs: Array.from(mergedLogs.values()).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
    trackers: mergedTrackers,
    todos: mergedTodos,
  };
}

async function loadRemoteProfiles(userId: string): Promise<Record<string, PersonGameProfile> | null> {
  const document = await loadProfileSettingsDocument(userId);
  const storedProfiles = getProfileSettingsValue(document, MACRO_GAME_PROFILES_SETTINGS_PATH);
  if (typeof storedProfiles === 'undefined') return null;
  return normalizeProfiles(storedProfiles, initialState().profiles);
}

async function loadRemoteActivity(
  userId: string,
): Promise<Pick<StoredState, 'mealLogs' | 'trackers' | 'todos'> | null> {
  const document = await loadProfileSettingsDocument(userId);
  const storedActivity = getProfileSettingsValue(document, MACRO_GAME_ACTIVITY_SETTINGS_PATH);
  if (typeof storedActivity === 'undefined') return null;
  const normalized = normalizeStoredState(storedActivity as Partial<StoredState>);
  return {
    mealLogs: normalized.mealLogs,
    trackers: normalized.trackers,
    todos: normalized.todos,
  };
}

async function persistProfilesToAccount(
  userId: string,
  profiles: Record<string, PersonGameProfile>,
): Promise<void> {
  const normalizedProfiles = normalizeProfiles(profiles, initialState().profiles);
  await updateProfileSettingsValue(userId, MACRO_GAME_PROFILES_SETTINGS_PATH, normalizedProfiles);
  if (currentStorageScopeUserId === userId) {
    lastPersistedProfilesSnapshot = serializeProfiles(normalizedProfiles);
  }
}

async function persistActivityToAccount(
  userId: string,
  state: Pick<StoredState, 'mealLogs' | 'trackers' | 'todos'>,
): Promise<void> {
  const normalized = normalizeStoredState({
    profiles: initialState().profiles,
    mealLogs: state.mealLogs,
    trackers: state.trackers,
    todos: state.todos,
  });
  await updateProfileSettingsValue(userId, MACRO_GAME_ACTIVITY_SETTINGS_PATH, {
    mealLogs: normalized.mealLogs,
    trackers: normalized.trackers,
    todos: normalized.todos,
  });
  if (currentStorageScopeUserId === userId) {
    lastPersistedActivitySnapshot = serializeActivity(normalized);
  }
}

function scheduleProfilesPersist(state: StoredState) {
  if (!currentStorageScopeUserId) return;
  if (hydratedProfilesScopeKey !== macroScopeKey(currentStorageScopeUserId)) return;

  const snapshot = serializeProfiles(state.profiles);
  if (snapshot === lastPersistedProfilesSnapshot) return;
  if (typeof window === 'undefined') return;

  if (profilePersistTimer !== null) {
    window.clearTimeout(profilePersistTimer);
  }

  const scopedUserId = currentStorageScopeUserId;
  profilePersistTimer = window.setTimeout(() => {
    profilePersistTimer = null;
    const latestState = readState(scopedUserId);
    const latestSnapshot = serializeProfiles(latestState.profiles);
    if (latestSnapshot === lastPersistedProfilesSnapshot) return;
    void persistProfilesToAccount(scopedUserId, latestState.profiles).catch((error) => {
      console.error('Failed to save dashboard profiles:', error);
    });
  }, 500);
}

function scheduleActivityPersist(state: StoredState) {
  if (!currentStorageScopeUserId) return;
  if (hydratedActivityScopeKey !== macroScopeKey(currentStorageScopeUserId)) return;

  const snapshot = serializeActivity(state);
  if (snapshot === lastPersistedActivitySnapshot) return;
  if (typeof window === 'undefined') return;

  if (activityPersistTimer !== null) {
    window.clearTimeout(activityPersistTimer);
  }

  const scopedUserId = currentStorageScopeUserId;
  activityPersistTimer = window.setTimeout(() => {
    activityPersistTimer = null;
    const latestState = readState(scopedUserId);
    const latestSnapshot = serializeActivity(latestState);
    if (latestSnapshot === lastPersistedActivitySnapshot) return;
    void persistActivityToAccount(scopedUserId, latestState).catch((error) => {
      console.error('Failed to save nutrition activity:', error);
    });
  }, 500);
}

function readState(userId: string | null = currentStorageScopeUserId): StoredState {
  if (!canUseStorage()) return initialState();
  try {
    const raw = readScopedStateRaw(userId);
    if (!raw) {
      const seed = initialState();
      writeState(seed, { userId, skipRemotePersist: true });
      return seed;
    }
    return normalizeStoredState(JSON.parse(raw) as Partial<StoredState>);
  } catch {
    const seed = initialState();
    writeState(seed, { userId, skipRemotePersist: true });
    return seed;
  }
}

function writeState(
  state: StoredState,
  options?: { userId?: string | null; skipRemotePersist?: boolean },
) {
  if (!canUseStorage()) return;
  const scopedUserId = options?.userId ?? currentStorageScopeUserId;
  window.localStorage.setItem(macroStateKey(scopedUserId), JSON.stringify(normalizeStoredState(state)));
  if (!options?.skipRemotePersist) {
    scheduleProfilesPersist(state);
    scheduleActivityPersist(state);
  }
  dispatchMacroStateUpdated();
}

export async function hydrateMacroGameProfilesFromAccount(userId?: string | null): Promise<void> {
  if (!userId) return;

  const scopeKey = macroScopeKey(userId);
  const hydrationToken = ++profileHydrationToken;
  const localState = readState(userId);
  const localSnapshot = serializeProfiles(localState.profiles);

  try {
    const remoteProfiles = await loadRemoteProfiles(userId);
    if (profileHydrationToken !== hydrationToken || currentStorageScopeUserId !== userId) return;

    const currentState = readState(userId);
    const currentSnapshot = serializeProfiles(currentState.profiles);
    const localChangedDuringLoad = currentSnapshot !== localSnapshot;

    let nextProfiles = currentState.profiles;
    let nextSnapshot = currentSnapshot;

    if (localChangedDuringLoad) {
      await persistProfilesToAccount(userId, currentState.profiles);
    } else if (remoteProfiles) {
      nextProfiles = mergeProfilesPreferRemote(currentState.profiles, remoteProfiles);
      nextSnapshot = serializeProfiles(nextProfiles);
      if (nextSnapshot !== currentSnapshot) {
        writeState({ ...currentState, profiles: nextProfiles }, { userId, skipRemotePersist: true });
      }
      if (nextSnapshot !== serializeProfiles(remoteProfiles)) {
        await persistProfilesToAccount(userId, nextProfiles);
      } else {
        lastPersistedProfilesSnapshot = nextSnapshot;
      }
    } else {
      await persistProfilesToAccount(userId, currentState.profiles);
    }

    if (profileHydrationToken !== hydrationToken || currentStorageScopeUserId !== userId) return;

    hydratedProfilesScopeKey = scopeKey;
    lastPersistedProfilesSnapshot = nextSnapshot;
    dispatchMacroStateUpdated();
  } catch (error) {
    console.error('Failed to hydrate dashboard profiles:', error);
    if (profileHydrationToken !== hydrationToken || currentStorageScopeUserId !== userId) return;
    hydratedProfilesScopeKey = scopeKey;
    lastPersistedProfilesSnapshot = null;
    dispatchMacroStateUpdated();
  }
}

export async function hydrateMacroGameActivityFromAccount(userId?: string | null): Promise<void> {
  if (!userId) return;

  const scopeKey = macroScopeKey(userId);
  const hydrationToken = ++activityHydrationToken;
  const localState = readState(userId);
  const localSnapshot = serializeActivity(localState);

  try {
    const remoteActivity = await loadRemoteActivity(userId);
    if (activityHydrationToken !== hydrationToken || currentStorageScopeUserId !== userId) return;

    const currentState = readState(userId);
    const currentSnapshot = serializeActivity(currentState);
    const localChangedDuringLoad = currentSnapshot !== localSnapshot;

    let nextActivity: Pick<StoredState, 'mealLogs' | 'trackers' | 'todos'> = {
      mealLogs: currentState.mealLogs,
      trackers: currentState.trackers,
      todos: currentState.todos,
    };
    let nextSnapshot = currentSnapshot;

    if (localChangedDuringLoad) {
      await persistActivityToAccount(userId, nextActivity);
    } else if (remoteActivity) {
      nextActivity = mergeActivityPreferRemote(currentState, remoteActivity);
      nextSnapshot = serializeActivity(nextActivity);
      if (nextSnapshot !== currentSnapshot) {
        writeState({ ...currentState, ...nextActivity }, { userId, skipRemotePersist: true });
      }
      if (nextSnapshot !== serializeActivity(remoteActivity)) {
        await persistActivityToAccount(userId, nextActivity);
      } else {
        lastPersistedActivitySnapshot = nextSnapshot;
      }
    } else {
      await persistActivityToAccount(userId, nextActivity);
    }

    if (activityHydrationToken !== hydrationToken || currentStorageScopeUserId !== userId) return;

    hydratedActivityScopeKey = scopeKey;
    lastPersistedActivitySnapshot = nextSnapshot;
    dispatchMacroStateUpdated();
  } catch (error) {
    console.error('Failed to hydrate nutrition activity:', error);
    if (activityHydrationToken !== hydrationToken || currentStorageScopeUserId !== userId) return;
    hydratedActivityScopeKey = scopeKey;
    lastPersistedActivitySnapshot = null;
    dispatchMacroStateUpdated();
  }
}

export function setMacroGameStorageScope(userId?: string | null) {
  currentStorageScopeUserId = userId || null;
  hydratedProfilesScopeKey = null;
  hydratedActivityScopeKey = null;

  if (typeof window !== 'undefined' && profilePersistTimer !== null) {
    window.clearTimeout(profilePersistTimer);
    profilePersistTimer = null;
  }
  if (typeof window !== 'undefined' && activityPersistTimer !== null) {
    window.clearTimeout(activityPersistTimer);
    activityPersistTimer = null;
  }

  const state = readState(currentStorageScopeUserId);
  if (!currentStorageScopeUserId) {
    hydratedProfilesScopeKey = macroScopeKey(null);
    hydratedActivityScopeKey = macroScopeKey(null);
    lastPersistedProfilesSnapshot = serializeProfiles(state.profiles);
    lastPersistedActivitySnapshot = serializeActivity(state);
    dispatchMacroStateUpdated();
    return;
  }

  lastPersistedProfilesSnapshot = null;
  lastPersistedActivitySnapshot = null;
  dispatchMacroStateUpdated();
  void hydrateMacroGameProfilesFromAccount(currentStorageScopeUserId);
  void hydrateMacroGameActivityFromAccount(currentStorageScopeUserId);
}

function dayKey(date = new Date()) {
  return format(date, 'yyyy-MM-dd');
}

function trackerForDate(state: StoredState, date: string, personId: AdultId): DayTracker {
  return state.trackers[date]?.[personId] || { waterOz: 0, alcoholDrinks: 0 };
}

function getCalorieHit(goal: BodyGoal, calories: number, target: number): boolean {
  if (goal === 'fat_loss') return calories <= target;
  if (goal === 'muscle_gain') return calories >= target;
  const lower = target * 0.9;
  const upper = target * 1.1;
  return calories >= lower && calories <= upper;
}

export function calculateMacroRecommendation(input: MacroQuestionnaire): Pick<MacroPlan, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'> {
  const s = input.sex === 'male' ? 5 : -161;
  const bmr = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + s;
  const tdee = bmr * activityMultipliers[input.activityLevel];

  let calories = tdee;
  const adjustment = paceAdjustments[input.pace];
  if (input.goal === 'fat_loss') calories -= adjustment;
  if (input.goal === 'muscle_gain') calories += adjustment;
  if (input.goal === 'recomp') calories -= 100;
  calories = Math.max(1200, Math.round(calories));

  const proteinPerKg =
    input.goal === 'fat_loss' ? 2.2 : input.goal === 'muscle_gain' ? 2.0 : input.goal === 'recomp' ? 2.1 : 1.8;
  const fatPerKg = input.goal === 'fat_loss' ? 0.75 : 0.85;
  const protein_g = Math.max(90, Math.round(input.weightKg * proteinPerKg));
  const fat_g = Math.max(35, Math.round(input.weightKg * fatPerKg));

  const remainingCalories = calories - protein_g * 4 - fat_g * 9;
  const carbs_g = Math.max(50, Math.round(remainingCalories / 4));

  return { calories, protein_g, carbs_g, fat_g };
}

export function getProfiles(userId?: string | null): Record<AdultId, PersonGameProfile> {
  return readState(userId ?? currentStorageScopeUserId).profiles;
}

function toSortedDashboardProfiles(
  profiles: PersonGameProfile[],
  options?: { includeChildren?: boolean },
): DashboardProfile[] {
  const includeChildren = !!options?.includeChildren;
  return profiles
    .filter((profile) => includeChildren || profile.memberType === 'adult')
    .filter((profile) => !(hideBuiltInWifeDashboard && profile.id === 'wife'))
    .slice()
    .sort((a, b) => {
      if (a.id === 'me') return -1;
      if (b.id === 'me') return 1;
      if (a.id === 'wife') return -1;
      if (b.id === 'wife') return 1;
      if (includeChildren && a.memberType !== b.memberType) return a.memberType === 'adult' ? -1 : 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    })
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      memberType: profile.memberType,
      createdAt: profile.createdAt,
    }));
}

export function listDashboardProfiles(userId?: string | null): DashboardProfile[] {
  return toSortedDashboardProfiles(Object.values(getProfiles(userId)));
}

export function setHideBuiltInWifeDashboard(hide: boolean) {
  if (hideBuiltInWifeDashboard === hide) return;
  hideBuiltInWifeDashboard = hide;
  dispatchMacroStateUpdated();
}

export function listHouseholdProfiles(userId?: string | null): DashboardProfile[] {
  return toSortedDashboardProfiles(Object.values(getProfiles(userId)), { includeChildren: true });
}

export async function loadHouseholdProfilesFromAccount(userId?: string | null): Promise<DashboardProfile[]> {
  if (!userId) return listHouseholdProfiles();

  try {
    const remoteProfiles = await loadRemoteProfiles(userId);
    if (remoteProfiles) {
      return toSortedDashboardProfiles(Object.values(remoteProfiles), { includeChildren: true });
    }
  } catch (error) {
    console.error('Failed to load shared household profiles:', error);
  }

  return listHouseholdProfiles(userId);
}

export function addHouseholdProfile(name: string, memberType: HouseholdMemberType = 'adult'): DashboardProfile {
  const state = readState();
  const finalName = sanitizeDashboardName(name);
  let id = createDashboardId(finalName);
  while (state.profiles[id]) {
    id = createDashboardId(finalName);
  }
  const profile: PersonGameProfile = {
    id,
    name: finalName,
    memberType,
    createdAt: new Date().toISOString(),
    femaleHealth: defaultFemaleHealthSettings(),
    macroPlan: defaultPlan(id, finalName),
  };
  state.profiles[id] = profile;
  writeState(state);
  return {
    id: profile.id,
    name: profile.name,
    memberType: profile.memberType,
    createdAt: profile.createdAt,
  };
}

export function addDashboardProfile(name: string): DashboardProfile {
  return addHouseholdProfile(name, 'adult');
}

export function renameDashboardProfile(personId: AdultId, name: string): DashboardProfile {
  const state = readState();
  const profile = ensureProfile(state, personId);
  profile.name = sanitizeDashboardName(name);
  state.profiles[personId] = profile;
  writeState(state);
  return { id: profile.id, name: profile.name, memberType: profile.memberType, createdAt: profile.createdAt };
}

export function setHouseholdProfileType(personId: AdultId, memberType: HouseholdMemberType): DashboardProfile {
  const state = readState();
  const profile = ensureProfile(state, personId);
  profile.memberType = personId === 'me' ? 'adult' : memberType;
  state.profiles[personId] = profile;
  writeState(state);
  return { id: profile.id, name: profile.name, memberType: profile.memberType, createdAt: profile.createdAt };
}

export function removeHouseholdProfile(personId: AdultId): DashboardProfile | null {
  if (personId === 'me') return null;

  const state = readState();
  const profile = state.profiles[personId];
  if (!profile) return null;

  delete state.profiles[personId];
  state.mealLogs = state.mealLogs.filter((log) => log.person !== personId);
  delete state.todos[personId];

  Object.keys(state.trackers).forEach((date) => {
    const dayTrackers = state.trackers[date];
    if (!dayTrackers || !(personId in dayTrackers)) return;

    delete dayTrackers[personId];
    if (Object.keys(dayTrackers).length === 0) {
      delete state.trackers[date];
    }
  });

  writeState(state);
  return { id: profile.id, name: profile.name, memberType: profile.memberType, createdAt: profile.createdAt };
}

export async function purgeLegacyWifeDashboardFromAccount(userId?: string | null): Promise<boolean> {
  if (!userId) return false;

  const state = readState(userId);
  const remoteProfiles = await loadRemoteProfiles(userId);
  const remoteActivity = await loadRemoteActivity(userId);
  const mergedProfiles = remoteProfiles ? mergeProfilesPreferRemote(state.profiles, remoteProfiles) : state.profiles;
  const mergedActivity = remoteActivity ? mergeActivityPreferRemote(state, remoteActivity) : state;

  if (!mergedProfiles.wife) return false;

  const nextState: StoredState = {
    ...state,
    profiles: { ...mergedProfiles },
    mealLogs: mergedActivity.mealLogs.filter((log) => log.person !== 'wife'),
    trackers: Object.entries(mergedActivity.trackers).reduce<Record<string, Partial<Record<string, DayTracker>>>>((acc, [date, trackers]) => {
      if (!trackers || typeof trackers !== 'object') return acc;
      const nextTrackers = { ...trackers };
      delete nextTrackers.wife;
      if (Object.keys(nextTrackers).length > 0) {
        acc[date] = nextTrackers;
      }
      return acc;
    }, {}),
    todos: Object.entries(mergedActivity.todos).reduce<Record<string, DashboardTodoItem[]>>((acc, [personId, todos]) => {
      if (personId !== 'wife') {
        acc[personId] = todos;
      }
      return acc;
    }, {}),
  };

  delete nextState.profiles.wife;

  writeState(nextState, { userId, skipRemotePersist: true });
  await persistProfilesToAccount(userId, nextState.profiles);
  await persistActivityToAccount(userId, nextState);
  dispatchMacroStateUpdated();
  return true;
}

function ensureProfile(state: StoredState, personId: AdultId): PersonGameProfile {
  const existing = state.profiles[personId];
  if (existing) return existing;
  const fallbackName = personId === 'me' ? 'Me' : personId === 'wife' ? 'Wife' : toDashboardName(personId);
  const created: PersonGameProfile = {
    id: personId,
    name: fallbackName,
    memberType: 'adult',
    createdAt: new Date().toISOString(),
    femaleHealth: defaultFemaleHealthSettings(),
    macroPlan: defaultPlan(personId, fallbackName),
  };
  state.profiles[personId] = created;
  return created;
}

export function updateMacroPlan(personId: AdultId, updates: Partial<MacroPlan>) {
  const state = readState();
  const currentProfile = ensureProfile(state, personId);
  const current = currentProfile.macroPlan;
  state.profiles[personId] = {
    ...currentProfile,
    macroPlan: {
      ...current,
      ...updates,
      questionnaire: updates.questionnaire || current.questionnaire,
      bodyUnitSystem: updates.bodyUnitSystem || current.bodyUnitSystem || 'imperial',
    },
  };
  writeState(state);
}

export function getFemaleHealthSettings(personId: AdultId): FemaleHealthSettings {
  const profile = getProfiles()[personId];
  return normalizeFemaleHealthSettings(profile?.femaleHealth);
}

export function updateFemaleHealthSettings(personId: AdultId, updates: Partial<FemaleHealthSettings>) {
  const state = readState();
  const currentProfile = ensureProfile(state, personId);
  state.profiles[personId] = {
    ...currentProfile,
    femaleHealth: normalizeFemaleHealthSettings({
      ...currentProfile.femaleHealth,
      ...updates,
    }),
  };
  writeState(state);
}

export function getMealLogs(): MealLog[] {
  return readState().mealLogs.map(fromStoredMealLog);
}

export function getActualMealLogsForDate(personId: AdultId, date = dayKey(), userId?: string | null): MealLog[] {
  const scopedUserId = userId ?? currentStorageScopeUserId;
  const state = readState(scopedUserId);
  const equivalentPersonIds = resolveEquivalentMealLogPersonIds(state, personId, scopedUserId);
  return state.mealLogs
    .map(fromStoredMealLog)
    .filter((log) => equivalentPersonIds.has(log.person) && log.date === date)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

export function addMealLog(log: MealLog) {
  const state = readState();
  state.mealLogs.push(toStoredMealLog(log));
  writeState(state);
}

export function updateMealLog(
  logId: string,
  updates: Partial<Pick<MealLog, 'recipeName' | 'mealType' | 'servings' | 'macros'>>,
  userId?: string | null,
) {
  const scopedUserId = userId ?? currentStorageScopeUserId;
  const state = readState(scopedUserId);
  let changed = false;
  state.mealLogs = state.mealLogs.map((storedLog) => {
    if (storedLog.id !== logId) return storedLog;
    changed = true;
    const nextLog = fromStoredMealLog(storedLog);
    return toStoredMealLog({
      ...nextLog,
      recipeName: typeof updates.recipeName === 'string' ? updates.recipeName : nextLog.recipeName,
      mealType: typeof updates.mealType === 'undefined' ? nextLog.mealType : updates.mealType,
      servings: typeof updates.servings === 'number' ? updates.servings : nextLog.servings,
      macros: updates.macros ? { ...nextLog.macros, ...updates.macros } : nextLog.macros,
    });
  });
  if (changed) writeState(state, { userId: scopedUserId });
}

export function deleteMealLog(logId: string, userId?: string | null) {
  const scopedUserId = userId ?? currentStorageScopeUserId;
  const state = readState(scopedUserId);
  const nextLogs = state.mealLogs.filter((storedLog) => storedLog.id !== logId);
  if (nextLogs.length === state.mealLogs.length) return;
  state.mealLogs = nextLogs;
  writeState(state, { userId: scopedUserId });
}

export function addWater(personId: AdultId, ounces: number, date = dayKey()) {
  const state = readState();
  ensureProfile(state, personId);
  const current = trackerForDate(state, date, personId);
  state.trackers[date] = state.trackers[date] || {};
  state.trackers[date][personId] = {
    ...current,
    waterOz: Math.max(0, current.waterOz + ounces),
  };
  writeState(state);
}

export function addAlcohol(personId: AdultId, drinks: number, date = dayKey()) {
  const state = readState();
  ensureProfile(state, personId);
  const current = trackerForDate(state, date, personId);
  state.trackers[date] = state.trackers[date] || {};
  state.trackers[date][personId] = {
    ...current,
    alcoholDrinks: Math.max(0, current.alcoholDrinks + drinks),
  };
  writeState(state);
}

export function getDashboardTodos(personId: AdultId): DashboardTodoItem[] {
  const state = readState();
  ensureProfile(state, personId);
  return sortDashboardTodos(state.todos[personId] || []);
}

export function addDashboardTodo(personId: AdultId, text: string): DashboardTodoItem | null {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  const state = readState();
  ensureProfile(state, personId);
  const todo: DashboardTodoItem = {
    id: crypto.randomUUID(),
    personId,
    text: trimmed,
    isCompleted: false,
    createdAt: new Date().toISOString(),
  };
  state.todos[personId] = sortDashboardTodos([...(state.todos[personId] || []), todo]);
  writeState(state);
  return todo;
}

export function toggleDashboardTodo(personId: AdultId, todoId: string): DashboardTodoItem | null {
  const state = readState();
  ensureProfile(state, personId);
  const current = state.todos[personId] || [];
  let updated: DashboardTodoItem | null = null;
  state.todos[personId] = sortDashboardTodos(current.map((item) => {
    if (item.id !== todoId) return item;
    updated = {
      ...item,
      isCompleted: !item.isCompleted,
      completedAt: item.isCompleted ? undefined : new Date().toISOString(),
    };
    return updated;
  }));
  writeState(state);
  return updated;
}

export function deleteDashboardTodo(personId: AdultId, todoId: string): void {
  const state = readState();
  ensureProfile(state, personId);
  const next = (state.todos[personId] || []).filter((item) => item.id !== todoId);
  if (next.length === 0) {
    delete state.todos[personId];
  } else {
    state.todos[personId] = next;
  }
  writeState(state);
}

function sumMacros(logs: MealLog[]): Macros {
  return {
    calories: logs.reduce((sum, log) => sum + log.macros.calories, 0),
    protein_g: logs.reduce((sum, log) => sum + log.macros.protein_g, 0),
    carbs_g: logs.reduce((sum, log) => sum + log.macros.carbs_g, 0),
    fat_g: logs.reduce((sum, log) => sum + log.macros.fat_g, 0),
  };
}

function normalizeMealLookup(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isMeProfileLike(
  state: StoredState,
  personId: AdultId,
  userId?: string | null,
): boolean {
  if (personId === 'me') return true;
  if (userId && personId === userId) return true;
  const profile = state.profiles[personId];
  return Boolean(profile && profile.memberType === 'adult' && profile.name.trim().toLowerCase() === 'me');
}

function resolveEquivalentMealLogPersonIds(
  state: StoredState,
  personId: AdultId,
  userId?: string | null,
): Set<string> {
  const ids = new Set<string>([personId]);
  if (!isMeProfileLike(state, personId, userId)) {
    return ids;
  }

  ids.add('me');
  if (userId) ids.add(userId);
  Object.values(state.profiles).forEach((profile) => {
    if (profile.memberType === 'adult' && profile.name.trim().toLowerCase() === 'me') {
      ids.add(profile.id);
    }
  });
  return ids;
}

function buildMealIdentityWithinScope(log: Pick<MealLog, 'date' | 'mealType' | 'recipeName'>): string {
  return `${log.date}::${log.mealType || 'uncategorized'}::${normalizeMealLookup(log.recipeName)}`;
}

export function getEffectiveMealLogsForDate(personId: AdultId, date = dayKey(), userId?: string | null): MealLog[] {
  const scopedUserId = userId ?? currentStorageScopeUserId;
  const state = readState(scopedUserId);
  const equivalentPersonIds = resolveEquivalentMealLogPersonIds(state, personId, scopedUserId);
  const includeUnassignedPlannerEntries = isMeProfileLike(state, personId, scopedUserId);
  const actualLogs = state.mealLogs
    .map(fromStoredMealLog)
    .filter((log) => equivalentPersonIds.has(log.person) && log.date === date);
  const existingKeys = new Set(actualLogs.map((log) => buildMealIdentityWithinScope(log)));
  const supplementalPlannerLogs = getPlannedFoodEntriesForDate(date, scopedUserId)
    .filter((entry) => {
      if (entry.mealType === 'dinner') return false;
      if (entry.personId && equivalentPersonIds.has(entry.personId)) return true;
      return includeUnassignedPlannerEntries && !entry.personId;
    })
    .map<MealLog>((entry) => ({
      id: `planner-log:${entry.id}`,
      recipeId: entry.sourceRecipeId || undefined,
      recipeName: entry.name,
      date: entry.date,
      person: personId,
      mealType: entry.mealType,
      servings: entry.servings,
      macros: {
        calories: entry.calories,
        protein_g: entry.protein_g,
        carbs_g: entry.carbs_g,
        fat_g: entry.fat_g,
      },
      isQuickAdd: true,
      createdAt: new Date(entry.createdAt),
    }))
    .filter((log) => !existingKeys.has(buildMealIdentityWithinScope(log)));

  return [...actualLogs, ...supplementalPlannerLogs].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

export function getDailyScore(personId: AdultId, date = dayKey(), userId?: string | null): DailyScore {
  const scopedUserId = userId ?? currentStorageScopeUserId;
  const state = readState(scopedUserId);
  const profile = ensureProfile(state, personId);
  const logs = getEffectiveMealLogsForDate(personId, date, scopedUserId);
  const totals = sumMacros(logs);
  const trackers = trackerForDate(state, date, personId);
  const plan = profile.macroPlan;

  const proteinHit = totals.protein_g >= plan.protein_g;
  const calorieHit = getCalorieHit(plan.questionnaire.goal, totals.calories, plan.calories);
  const waterHit = trackers.waterOz >= plan.waterTargetOz;
  const alcoholHit = trackers.alcoholDrinks <= plan.alcoholLimitDrinks;
  const goalHit = plan.proteinOnlyMode ? proteinHit : proteinHit && calorieHit;

  const scoring = {
    ...defaultPlan(personId, profile.name).scorePointsFor,
    ...(plan.scorePointsFor || {}),
  };
  const pointsMeals = scoring.meals ? Math.min(20, logs.length * 5) : 0;
  const pointsProtein = scoring.protein && proteinHit ? 30 : 0;
  const pointsCalories = scoring.calories && calorieHit ? 25 : 0;
  const pointsWater = scoring.water && waterHit ? 15 : 0;
  const pointsAlcohol = scoring.alcohol && alcoholHit ? 10 : 0;
  const pointsConsistency = scoring.consistency && goalHit && waterHit ? 10 : 0;
  const points =
    pointsMeals + pointsProtein + pointsCalories + pointsWater + pointsAlcohol + pointsConsistency;

  return {
    date,
    calories: totals.calories,
    protein_g: totals.protein_g,
    carbs_g: totals.carbs_g,
    fat_g: totals.fat_g,
    mealsLogged: logs.length,
    waterOz: trackers.waterOz,
    alcoholDrinks: trackers.alcoholDrinks,
    proteinHit,
    calorieHit,
    waterHit,
    alcoholHit,
    goalHit,
    points,
    pointBreakdown: {
      meals: pointsMeals,
      protein: pointsProtein,
      calories: pointsCalories,
      water: pointsWater,
      alcohol: pointsAlcohol,
      consistency: pointsConsistency,
    },
  };
}

export function isDailyLogFullyLogged(personId: AdultId, date = dayKey(), userId?: string | null): boolean {
  const score = getDailyScore(personId, date, userId);
  const profile = getProfiles(userId)[personId];
  const calorieTarget = profile?.macroPlan.calories || 0;
  return score.mealsLogged >= 3 || (calorieTarget > 0 && score.calories >= calorieTarget * 0.8);
}

export function getCurrentStreak(personId: AdultId, date = new Date(), userId?: string | null): number {
  let streak = 0;
  for (let i = 0; i < 60; i += 1) {
    const d = format(subDays(date, i), 'yyyy-MM-dd');
    const score = getDailyScore(personId, d, userId);
    if (!score.goalHit) break;
    streak += 1;
  }
  return streak;
}

export function getWeekPoints(personId: AdultId, date = new Date(), userId?: string | null): number {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  let points = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = format(addDays(weekStart, i), 'yyyy-MM-dd');
    points += getDailyScore(personId, d, userId).points;
  }
  return points;
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function uniqueDateKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isDateKey).map((item) => item.trim()))];
}

function timestampToDateKey(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (isDateKey(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, 'yyyy-MM-dd');
}

function getKidDailyPoints(completed: number, total: number): number {
  if (total <= 0) return 0;
  const safeCompleted = Math.max(0, Math.min(completed, total));
  const progressPoints = Math.round((safeCompleted / total) * KID_DAILY_PROGRESS_POINTS);
  const perfectBonus = safeCompleted === total ? KID_DAILY_PERFECT_BONUS : 0;
  return progressPoints + perfectBonus;
}

function choreWasCompletedOnDate(
  chore: { isCompleted?: boolean; completionDates?: unknown },
  dateKey: string,
  fallbackDateKey: string,
): boolean {
  const completionDates = uniqueDateKeys(chore.completionDates);
  if (completionDates.length > 0) {
    return completionDates.includes(dateKey);
  }
  return Boolean(chore.isCompleted) && fallbackDateKey === dateKey;
}

function extraMatchesDate(
  extra: { isCompleted?: boolean; isFailed?: boolean; completedAt?: unknown; failedAt?: unknown },
  kind: 'completed' | 'failed',
  dateKey: string,
  fallbackDateKey: string,
): boolean {
  const resolvedDate =
    kind === 'completed'
      ? timestampToDateKey(extra.completedAt)
      : timestampToDateKey(extra.failedAt);
  if (resolvedDate) {
    return resolvedDate === dateKey;
  }
  if (kind === 'completed') {
    return Boolean(extra.isCompleted) && fallbackDateKey === dateKey;
  }
  return Boolean(extra.isFailed) && fallbackDateKey === dateKey;
}

function getKidEntries(date = new Date(), userId?: string | null): LeaderboardEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(choresStateKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      children?: Array<{
        id: string;
        name: string;
        dailyChores?: Array<{ isCompleted?: boolean; completionDates?: unknown }>;
        weeklyChores?: Array<{ isCompleted?: boolean; completionDates?: unknown }>;
        extraChores?: Array<{
          isCompleted?: boolean;
          isFailed?: boolean;
          completedAt?: unknown;
          failedAt?: unknown;
        }>;
      }>;
    };
    const todayKey = format(date, 'yyyy-MM-dd');
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekKeys = Array.from({ length: 7 }, (_, index) => format(addDays(weekStart, index), 'yyyy-MM-dd'));
    const children = Array.isArray(parsed.children) ? parsed.children : [];
    return children.map((child) => {
      const dailyChores = Array.isArray(child.dailyChores) ? child.dailyChores : [];
      const weeklyChores = Array.isArray(child.weeklyChores) ? child.weeklyChores : [];
      const extraChores = Array.isArray(child.extraChores) ? child.extraChores : [];
      const totalDaily = dailyChores.length;
      const completedDailyToday = dailyChores.filter((chore) => choreWasCompletedOnDate(chore, todayKey, todayKey)).length;
      const weekDailyPoints = weekKeys.reduce((sum, dateKey) => {
        const completedForDay = dailyChores.filter((chore) => choreWasCompletedOnDate(chore, dateKey, todayKey)).length;
        return sum + getKidDailyPoints(completedForDay, totalDaily);
      }, 0);
      const completedWeeklyToday = weeklyChores.filter((chore) => choreWasCompletedOnDate(chore, todayKey, todayKey)).length;
      const completedWeeklyWeek = weeklyChores.filter((chore) =>
        weekKeys.some((dateKey) => choreWasCompletedOnDate(chore, dateKey, todayKey)),
      ).length;
      const completedExtrasToday = extraChores.filter((extra) =>
        extraMatchesDate(extra, 'completed', todayKey, todayKey),
      ).length;
      const completedExtrasWeek = extraChores.filter((extra) =>
        weekKeys.some((dateKey) => extraMatchesDate(extra, 'completed', dateKey, todayKey)),
      ).length;
      const failedExtrasToday = extraChores.filter((extra) =>
        extraMatchesDate(extra, 'failed', todayKey, todayKey),
      ).length;
      const failedExtrasWeek = extraChores.filter((extra) =>
        weekKeys.some((dateKey) => extraMatchesDate(extra, 'failed', dateKey, todayKey)),
      ).length;
      const todayPoints = Math.max(
        0,
        getKidDailyPoints(completedDailyToday, totalDaily) +
          completedWeeklyToday * KID_WEEKLY_CHORE_POINTS +
          Math.min(KID_EXTRA_CHORE_DAILY_CAP, completedExtrasToday * KID_EXTRA_CHORE_POINTS) -
          Math.min(KID_EXTRA_CHORE_MISS_DAILY_CAP, failedExtrasToday * KID_EXTRA_CHORE_MISS_PENALTY),
      );
      const weekPoints = Math.max(
        0,
        weekDailyPoints +
          completedWeeklyWeek * KID_WEEKLY_CHORE_POINTS +
          Math.min(KID_EXTRA_CHORE_WEEKLY_CAP, completedExtrasWeek * KID_EXTRA_CHORE_POINTS) -
          Math.min(KID_EXTRA_CHORE_MISS_WEEKLY_CAP, failedExtrasWeek * KID_EXTRA_CHORE_MISS_PENALTY),
      );
      let streak = 0;
      for (let index = 0; index < 60; index += 1) {
        const streakDateKey = format(subDays(date, index), 'yyyy-MM-dd');
        const completedForDay = dailyChores.filter((chore) =>
          choreWasCompletedOnDate(chore, streakDateKey, todayKey),
        ).length;
        if (totalDaily === 0 || completedForDay !== totalDaily) break;
        streak += 1;
      }
      return {
        id: child.id,
        name: child.name,
        type: 'kid' as const,
        todayPoints,
        weekPoints,
        streak,
        headline: `${completedDailyToday}/${totalDaily || 0} daily today • ${completedWeeklyWeek} weekly • ${completedExtrasWeek} extras`,
      };
    });
  } catch {
    return [];
  }
}

export function getFamilyLeaderboard(date = new Date(), userId?: string | null): LeaderboardEntry[] {
  const profiles = listDashboardProfiles(userId);
  const adults: LeaderboardEntry[] = profiles.map(({ id, name }) => {
    const today = getDailyScore(id, format(date, 'yyyy-MM-dd'), userId);
    const streak = getCurrentStreak(id, date, userId);
    const weekPoints = getWeekPoints(id, date, userId);
    const headline =
      today.goalHit && today.waterHit
        ? 'Goals hit today'
        : `${today.protein_g}g protein, ${today.calories} cal`;
    return {
      id,
      name,
      type: 'adult',
      todayPoints: today.points,
      weekPoints,
      streak,
      headline,
    };
  });

  return [...adults, ...getKidEntries(date, userId)].sort((a, b) => b.weekPoints - a.weekPoints);
}
