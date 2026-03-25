import { format, subDays } from 'date-fns';
import { mockMealLogs, mockProfiles } from '@/data/mockData';
import { getProfileSettingsValue, loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { Macros, MealLog } from '@/types';

export type AdultId = string;
export type HouseholdMemberType = 'adult' | 'child';
export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type BodyGoal = 'fat_loss' | 'maintenance' | 'muscle_gain' | 'recomp';
export type GoalPace = 'slow' | 'moderate' | 'aggressive';
export type BodyUnitSystem = 'imperial' | 'metric';

const STORAGE_KEY = 'homehub.macroGameState.v1';
const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';
const MACRO_GAME_PROFILES_SETTINGS_PATH = ['appPreferences', 'macroGame', 'profiles'];

let currentStorageScopeUserId: string | null = null;
let hydratedProfilesScopeKey: string | null = null;
let lastPersistedProfilesSnapshot: string | null = null;
let profilePersistTimer: number | null = null;
let profileHydrationToken = 0;

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
}

interface PersonGameProfile {
  id: AdultId;
  name: string;
  macroPlan: MacroPlan;
  memberType: HouseholdMemberType;
  createdAt?: string;
}

interface DayTracker {
  waterOz: number;
  alcoholDrinks: number;
}

interface StoredState {
  mealLogs: StoredMealLog[];
  profiles: Record<string, PersonGameProfile>;
  trackers: Record<string, Partial<Record<string, DayTracker>>>;
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
  return `${CHORES_STATE_KEY_PREFIX}:${userId || 'anon'}`;
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
  const wifeProfile = mockProfiles.find((p) => p.id === 'wife');
  const mePlan = defaultPlan('me');
  const wifePlan = defaultPlan('wife');
  if (meProfile?.dailyTargets) {
    mePlan.calories = meProfile.dailyTargets.calories;
    mePlan.protein_g = meProfile.dailyTargets.protein_g;
    mePlan.carbs_g = meProfile.dailyTargets.carbs_g;
    mePlan.fat_g = meProfile.dailyTargets.fat_g;
  }
  if (wifeProfile?.dailyTargets) {
    wifePlan.calories = wifeProfile.dailyTargets.calories;
    wifePlan.protein_g = wifeProfile.dailyTargets.protein_g;
    wifePlan.carbs_g = wifeProfile.dailyTargets.carbs_g;
    wifePlan.fat_g = wifeProfile.dailyTargets.fat_g;
  }

  return {
    mealLogs: mockMealLogs.map(toStoredMealLog),
    profiles: {
      me: {
        id: 'me',
        name: meProfile?.name || 'Me',
        memberType: 'adult',
        macroPlan: mePlan,
        createdAt: new Date().toISOString(),
      },
      wife: {
        id: 'wife',
        name: wifeProfile?.name || 'Wife',
        memberType: 'adult',
        macroPlan: wifePlan,
        createdAt: new Date().toISOString(),
      },
    },
    trackers: {},
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
      macroPlan: {
        ...basePlan,
        ...incomingMacroPlan,
        questionnaire: {
          ...basePlan.questionnaire,
          ...incomingQuestionnaire,
        },
        bodyUnitSystem: incomingMacroPlan.bodyUnitSystem || basePlan.bodyUnitSystem,
      },
    };
  });

  ['me', 'wife'].forEach((id) => {
    if (!mergedProfiles[id]) {
      mergedProfiles[id] = seedProfiles[id];
    }
  });

  return mergedProfiles;
}

function normalizeStoredState(input: Partial<StoredState> | null | undefined): StoredState {
  const seed = initialState();
  return {
    mealLogs: Array.isArray(input?.mealLogs) ? (input?.mealLogs as StoredMealLog[]) : seed.mealLogs,
    profiles: normalizeProfiles(input?.profiles, seed.profiles),
    trackers:
      input?.trackers && typeof input.trackers === 'object'
        ? (input.trackers as StoredState['trackers'])
        : {},
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

async function loadRemoteProfiles(userId: string): Promise<Record<string, PersonGameProfile> | null> {
  const document = await loadProfileSettingsDocument(userId);
  const storedProfiles = getProfileSettingsValue(document, MACRO_GAME_PROFILES_SETTINGS_PATH);
  if (typeof storedProfiles === 'undefined') return null;
  return normalizeProfiles(storedProfiles, initialState().profiles);
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

export function setMacroGameStorageScope(userId?: string | null) {
  currentStorageScopeUserId = userId || null;
  hydratedProfilesScopeKey = null;

  if (typeof window !== 'undefined' && profilePersistTimer !== null) {
    window.clearTimeout(profilePersistTimer);
    profilePersistTimer = null;
  }

  const state = readState(currentStorageScopeUserId);
  if (!currentStorageScopeUserId) {
    hydratedProfilesScopeKey = macroScopeKey(null);
    lastPersistedProfilesSnapshot = serializeProfiles(state.profiles);
    dispatchMacroStateUpdated();
    return;
  }

  lastPersistedProfilesSnapshot = null;
  dispatchMacroStateUpdated();
  void hydrateMacroGameProfilesFromAccount(currentStorageScopeUserId);
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

export function getProfiles(): Record<AdultId, PersonGameProfile> {
  return readState().profiles;
}

export function listDashboardProfiles(): DashboardProfile[] {
  const profiles = Object.values(getProfiles()).filter((profile) => profile.memberType === 'adult');
  return profiles
    .slice()
    .sort((a, b) => {
      if (a.id === 'me') return -1;
      if (b.id === 'me') return 1;
      if (a.id === 'wife') return -1;
      if (b.id === 'wife') return 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    })
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      memberType: profile.memberType,
      createdAt: profile.createdAt,
    }));
}

export function listHouseholdProfiles(): DashboardProfile[] {
  const profiles = Object.values(getProfiles());
  return profiles
    .slice()
    .sort((a, b) => {
      if (a.id === 'me') return -1;
      if (b.id === 'me') return 1;
      if (a.id === 'wife') return -1;
      if (b.id === 'wife') return 1;
      if (a.memberType !== b.memberType) return a.memberType === 'adult' ? -1 : 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    })
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      memberType: profile.memberType,
      createdAt: profile.createdAt,
    }));
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
  profile.memberType = personId === 'me' || personId === 'wife' ? 'adult' : memberType;
  state.profiles[personId] = profile;
  writeState(state);
  return { id: profile.id, name: profile.name, memberType: profile.memberType, createdAt: profile.createdAt };
}

export function removeHouseholdProfile(personId: AdultId): DashboardProfile | null {
  if (personId === 'me' || personId === 'wife') return null;

  const state = readState();
  const profile = state.profiles[personId];
  if (!profile) return null;

  delete state.profiles[personId];
  state.mealLogs = state.mealLogs.filter((log) => log.person !== personId);

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

function ensureProfile(state: StoredState, personId: AdultId): PersonGameProfile {
  const existing = state.profiles[personId];
  if (existing) return existing;
  const fallbackName = personId === 'me' ? 'Me' : personId === 'wife' ? 'Wife' : toDashboardName(personId);
  const created: PersonGameProfile = {
    id: personId,
    name: fallbackName,
    memberType: 'adult',
    createdAt: new Date().toISOString(),
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

export function getMealLogs(): MealLog[] {
  return readState().mealLogs.map(fromStoredMealLog);
}

export function addMealLog(log: MealLog) {
  const state = readState();
  state.mealLogs.push(toStoredMealLog(log));
  writeState(state);
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

function sumMacros(logs: MealLog[]): Macros {
  return {
    calories: logs.reduce((sum, log) => sum + log.macros.calories, 0),
    protein_g: logs.reduce((sum, log) => sum + log.macros.protein_g, 0),
    carbs_g: logs.reduce((sum, log) => sum + log.macros.carbs_g, 0),
    fat_g: logs.reduce((sum, log) => sum + log.macros.fat_g, 0),
  };
}

export function getDailyScore(personId: AdultId, date = dayKey()): DailyScore {
  const state = readState();
  const profile = ensureProfile(state, personId);
  const logs = state.mealLogs
    .map(fromStoredMealLog)
    .filter((log) => log.person === personId && log.date === date);
  const totals = sumMacros(logs);
  const trackers = trackerForDate(state, date, personId);
  const plan = profile.macroPlan;

  const proteinHit = totals.protein_g >= plan.protein_g;
  const calorieHit = getCalorieHit(plan.questionnaire.goal, totals.calories, plan.calories);
  const waterHit = trackers.waterOz >= plan.waterTargetOz;
  const alcoholHit = trackers.alcoholDrinks <= plan.alcoholLimitDrinks;
  const goalHit = plan.proteinOnlyMode ? proteinHit : proteinHit && calorieHit;

  const pointsMeals = Math.min(20, logs.length * 5);
  const pointsProtein = proteinHit ? 30 : 0;
  const pointsCalories = calorieHit ? 25 : 0;
  const pointsWater = waterHit ? 15 : 0;
  const pointsAlcohol = alcoholHit ? 10 : 0;
  const pointsConsistency = goalHit && waterHit ? 10 : 0;
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

export function getCurrentStreak(personId: AdultId, date = new Date()): number {
  let streak = 0;
  for (let i = 0; i < 60; i += 1) {
    const d = format(subDays(date, i), 'yyyy-MM-dd');
    const score = getDailyScore(personId, d);
    if (!score.goalHit) break;
    streak += 1;
  }
  return streak;
}

export function getWeekPoints(personId: AdultId, date = new Date()): number {
  let points = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = format(subDays(date, i), 'yyyy-MM-dd');
    points += getDailyScore(personId, d).points;
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
    const weekKeys = Array.from({ length: 7 }, (_, index) => format(subDays(date, index), 'yyyy-MM-dd'));
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
  const profiles = listDashboardProfiles();
  const adults: LeaderboardEntry[] = profiles.map(({ id, name }) => {
    const today = getDailyScore(id, format(date, 'yyyy-MM-dd'));
    const streak = getCurrentStreak(id, date);
    const weekPoints = getWeekPoints(id, date);
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
