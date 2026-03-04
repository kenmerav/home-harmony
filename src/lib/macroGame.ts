import { format, subDays } from 'date-fns';
import { mockMealLogs, mockProfiles } from '@/data/mockData';
import { Macros, MealLog } from '@/types';

export type AdultId = string;
export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type BodyGoal = 'fat_loss' | 'maintenance' | 'muscle_gain' | 'recomp';
export type GoalPace = 'slow' | 'moderate' | 'aggressive';
export type BodyUnitSystem = 'imperial' | 'metric';

const STORAGE_KEY = 'homehub.macroGameState.v1';
const CHORES_STATE_KEY = 'homehub.choresEconomyState.v2';

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
      me: { id: 'me', name: meProfile?.name || 'Me', macroPlan: mePlan, createdAt: new Date().toISOString() },
      wife: { id: 'wife', name: wifeProfile?.name || 'Wife', macroPlan: wifePlan, createdAt: new Date().toISOString() },
    },
    trackers: {},
  };
}

function readState(): StoredState {
  if (!canUseStorage()) return initialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = initialState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    const seed = initialState();
    const parsedProfiles =
      parsed.profiles && typeof parsed.profiles === 'object'
        ? (parsed.profiles as Record<string, Partial<PersonGameProfile>>)
        : {};
    const mergedProfiles: Record<string, PersonGameProfile> = {};

    Object.entries(parsedProfiles).forEach(([id, incoming]) => {
      if (!id) return;
      const fallbackName = id === 'me' ? 'Me' : id === 'wife' ? 'Wife' : toDashboardName(id);
      const basePlan = defaultPlan(id, incoming?.name || fallbackName);
      const incomingMacroPlan = incoming?.macroPlan || {};
      const incomingQuestionnaire = incomingMacroPlan.questionnaire || {};

      mergedProfiles[id] = {
        id,
        name: incoming?.name?.trim() || fallbackName,
        createdAt: incoming?.createdAt || new Date().toISOString(),
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
        mergedProfiles[id] = seed.profiles[id];
      }
    });

    return {
      mealLogs: Array.isArray(parsed.mealLogs) ? (parsed.mealLogs as StoredMealLog[]) : seed.mealLogs,
      profiles: mergedProfiles,
      trackers:
        parsed.trackers && typeof parsed.trackers === 'object'
          ? (parsed.trackers as StoredState['trackers'])
          : {},
    };
  } catch {
    return initialState();
  }
}

function writeState(state: StoredState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('homehub:macro-state-updated'));
  }
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
  const profiles = Object.values(getProfiles());
  return profiles
    .slice()
    .sort((a, b) => {
      if (a.id === 'me') return -1;
      if (b.id === 'me') return 1;
      if (a.id === 'wife') return -1;
      if (b.id === 'wife') return 1;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    })
    .map((profile) => ({ id: profile.id, name: profile.name, createdAt: profile.createdAt }));
}

export function addDashboardProfile(name: string): DashboardProfile {
  const state = readState();
  const finalName = sanitizeDashboardName(name);
  let id = createDashboardId(finalName);
  while (state.profiles[id]) {
    id = createDashboardId(finalName);
  }
  const profile: PersonGameProfile = {
    id,
    name: finalName,
    createdAt: new Date().toISOString(),
    macroPlan: defaultPlan(id, finalName),
  };
  state.profiles[id] = profile;
  writeState(state);
  return { id: profile.id, name: profile.name, createdAt: profile.createdAt };
}

export function renameDashboardProfile(personId: AdultId, name: string): DashboardProfile {
  const state = readState();
  const profile = ensureProfile(state, personId);
  profile.name = sanitizeDashboardName(name);
  state.profiles[personId] = profile;
  writeState(state);
  return { id: profile.id, name: profile.name, createdAt: profile.createdAt };
}

function ensureProfile(state: StoredState, personId: AdultId): PersonGameProfile {
  const existing = state.profiles[personId];
  if (existing) return existing;
  const fallbackName = personId === 'me' ? 'Me' : personId === 'wife' ? 'Wife' : toDashboardName(personId);
  const created: PersonGameProfile = {
    id: personId,
    name: fallbackName,
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

function getKidEntries(): LeaderboardEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CHORES_STATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      children?: Array<{
        id: string;
        name: string;
        dailyChores?: Array<{ isCompleted?: boolean }>;
        extraChores?: Array<{ isCompleted?: boolean }>;
        lifetimeEarned?: number;
        lifetimePenalties?: number;
        piggyBank?: number;
      }>;
    };
    const children = Array.isArray(parsed.children) ? parsed.children : [];
    return children.map((child) => {
      const completedDaily = (child.dailyChores || []).filter((chore) => !!chore.isCompleted).length;
      const completedExtras = (child.extraChores || []).filter((chore) => !!chore.isCompleted).length;
      const lifetimeEarned = child.lifetimeEarned || 0;
      const lifetimePenalties = child.lifetimePenalties || 0;
      const bank = child.piggyBank || 0;
      const todayPoints = completedDaily * 6 + completedExtras * 12;
      const weekPoints = Math.max(
        0,
        Math.round(todayPoints * 3 + lifetimeEarned * 2 - lifetimePenalties + bank * 5),
      );
      return {
        id: child.id,
        name: child.name,
        type: 'kid' as const,
        todayPoints,
        weekPoints,
        streak: completedDaily > 0 ? 1 : 0,
        headline: `${completedDaily} daily chores done today`,
      };
    });
  } catch {
    return [];
  }
}

export function getFamilyLeaderboard(date = new Date()): LeaderboardEntry[] {
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

  return [...adults, ...getKidEntries()].sort((a, b) => b.weekPoints - a.weekPoints);
}
