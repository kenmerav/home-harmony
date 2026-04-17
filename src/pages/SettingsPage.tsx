import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { OptionList } from '@/components/onboarding/OptionList';
import { MacroGoalDialog } from '@/components/nutrition/MacroGoalDialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { BILLING_ENABLED, getSubscriptionAccessEndDate, hasSubscriptionAccess } from '@/lib/billing';
import { loadOnboardingResult, saveOnboardingResult, type StoredOnboardingResult } from '@/lib/onboardingStore';
import {
  getProfileSettingsValue,
  loadProfileSettingsDocument,
  updateProfileSettingsValue,
} from '@/lib/profileSettingsStore';
import { BodyUnitSystem, getProfiles, listDashboardProfiles, updateMacroPlan } from '@/lib/macroGame';
import {
  defaultSmsPreferences,
  loadSmsPreferences,
  saveSmsPreferences,
  sendSmsTestMessage,
  VISIBLE_SMS_REMINDER_MODULES,
  type SmsPreferences,
  type SmsReminderModule,
} from '@/lib/api/sms';
import {
  loadCommonDepartureAddresses,
  loadDepartureAddressProfile,
  normalizeAddressForCompare,
  saveCommonDepartureAddresses,
  saveDepartureAddressProfile,
} from '@/lib/departureAddresses';
import {
  amountForBillingInterval,
  formatUsd,
  HOME_HARMONY_PRICING,
  inferBillingIntervalFromPriceId,
} from '@/lib/pricing';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PRIMARY_GOAL_OPTIONS = [
  'Meals & groceries',
  'Chores & routines',
  'Family calendar & tasks',
  'Fitness & workouts',
  'All of the above',
] as const;

const HOUSEHOLD_OPTIONS = ['Just me', 'Me + partner', 'Family', 'Roommates'] as const;
const KID_COUNT_OPTIONS = ['1', '2', '3', '4', '5+'] as const;
const ROLE_OPTIONS = ['Primary planner', 'Shared planner', 'I need structure', 'I just want reminders'] as const;
const INTENSITY_OPTIONS = ['Light touch', 'Balanced', 'Highly organized'] as const;
const MEAL_OPTIONS = [
  'Plan weeknights only',
  'Plan the whole week',
  'Just generate grocery lists',
  'No meal planning',
] as const;
const GROCERY_MODE_OPTIONS = ['Pickup', 'Delivery', 'In-store', 'Mix'] as const;
const GROCERY_STORE_OPTIONS = [
  "Fry's",
  'Safeway',
  'Whole Foods',
  'Sprouts',
  "Trader Joe's",
  'Kroger',
  'Target',
  'Walmart',
  'Costco',
  'Instacart',
  'Amazon',
  'Other',
] as const;
const CHORE_OPTIONS = ['Rotating schedule', 'Fixed responsibilities', "I'll set it up later"] as const;
const REMINDER_STYLE_OPTIONS = ['Minimal', 'Normal', 'Persistent (keep nudging me)'] as const;
const WORKOUT_FREQ_OPTIONS = ['0-2', '3-5', '6+'] as const;
const WORKOUT_LOCATION_OPTIONS = ['Home', 'Gym', 'Both'] as const;
const NUTRITION_TRACKING_OPTIONS = ['Track full macros', 'Track protein only', 'Track calories only', 'Skip nutrition tracking'] as const;
const HYDRATION_OPTIONS = ['Daily water goal', 'Casual water tracking', 'Not now'] as const;
const STEP_GOAL_OPTIONS = ['5,000', '8,000', '10,000', '12,000+', 'No step goal'] as const;
const SLEEP_GOAL_OPTIONS = ['7 hours', '8 hours', '9+ hours', 'No sleep target'] as const;
const ALCOHOL_GOAL_OPTIONS = ['Not tracking', 'Limit to weekends', 'Limit drinks per week', 'Reduce as much as possible'] as const;
const SMS_MODULE_LABELS: Record<SmsReminderModule, string> = {
  meals: 'Meal schedule',
  manual: 'Family calendar events',
  tasks: 'Tasks',
  chores: 'Chores',
  workouts: 'Workouts',
  reminders: 'Reminders',
};

type PrimaryGoal = (typeof PRIMARY_GOAL_OPTIONS)[number];
type HouseholdType = (typeof HOUSEHOLD_OPTIONS)[number];
type KidCount = (typeof KID_COUNT_OPTIONS)[number];
type RoleType = (typeof ROLE_OPTIONS)[number];
type RoutineIntensity = (typeof INTENSITY_OPTIONS)[number];
type MealPreference = (typeof MEAL_OPTIONS)[number];
type GroceryMode = (typeof GROCERY_MODE_OPTIONS)[number];
type GroceryStore = (typeof GROCERY_STORE_OPTIONS)[number];
type ChoreStyle = (typeof CHORE_OPTIONS)[number];
type ReminderStyle = (typeof REMINDER_STYLE_OPTIONS)[number];
type WorkoutFrequency = (typeof WORKOUT_FREQ_OPTIONS)[number];
type WorkoutLocation = (typeof WORKOUT_LOCATION_OPTIONS)[number];
type NutritionTracking = (typeof NUTRITION_TRACKING_OPTIONS)[number];
type HydrationTracking = (typeof HYDRATION_OPTIONS)[number];
type StepGoal = (typeof STEP_GOAL_OPTIONS)[number];
type SleepGoal = (typeof SLEEP_GOAL_OPTIONS)[number];
type AlcoholGoal = (typeof ALCOHOL_GOAL_OPTIONS)[number];
type PlanModule = 'meals' | 'groceries' | 'chores' | 'tasks' | 'workouts';
type ReminderProfile = 'minimal' | 'normal' | 'persistent';

interface OnboardingAnswers {
  primaryGoals: PrimaryGoal[];
  householdType: HouseholdType | null;
  kidCount: KidCount | null;
  role: RoleType | null;
  routineIntensity: RoutineIntensity | null;
  mealPreference: MealPreference | null;
  groceryMode: GroceryMode | null;
  groceryStore: GroceryStore | null;
  choreStyle: ChoreStyle | null;
  reminderStyle: ReminderStyle | null;
  workoutFrequency: WorkoutFrequency | null;
  workoutLocation: WorkoutLocation | null;
  nutritionTracking: NutritionTracking | null;
  hydrationTracking: HydrationTracking | null;
  stepGoal: StepGoal | null;
  sleepGoal: SleepGoal | null;
  alcoholGoal: AlcoholGoal | null;
  reminderToggles: {
    tasks: boolean;
    groceries: boolean;
    meals: boolean;
    chores: boolean;
    workouts: boolean;
  };
}

interface PersonalizedPlan {
  enabledModules: PlanModule[];
  defaultSchedules: {
    intensity: 'light' | 'balanced' | 'high';
    planningCadence: string;
    reminderMoments: string[];
    defaultWorkoutDays: number;
  };
  suggestedLists: string[];
  reminderProfile: ReminderProfile;
}

const EMPTY_ANSWERS: OnboardingAnswers = {
  primaryGoals: [],
  householdType: null,
  kidCount: null,
  role: null,
  routineIntensity: null,
  mealPreference: null,
  groceryMode: null,
  groceryStore: null,
  choreStyle: null,
  reminderStyle: null,
  workoutFrequency: null,
  workoutLocation: null,
  nutritionTracking: null,
  hydrationTracking: null,
  stepGoal: null,
  sleepGoal: null,
  alcoholGoal: null,
  reminderToggles: {
    tasks: false,
    groceries: false,
    meals: false,
    chores: false,
    workouts: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function coerceSingleOption<T extends readonly string[]>(
  value: unknown,
  options: T,
): T[number] | null {
  return typeof value === 'string' && options.includes(value as T[number]) ? (value as T[number]) : null;
}

function coerceMultiOption<T extends readonly string[]>(
  value: unknown,
  options: T,
): T[number][] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T[number] => typeof item === 'string' && options.includes(item as T[number]));
}

function mapKidCountToSetting(value: number | null): KidCount | null {
  if (value === null || value <= 0) return null;
  if (value >= 5) return '5+';
  const normalized = String(value);
  return KID_COUNT_OPTIONS.includes(normalized as KidCount) ? (normalized as KidCount) : null;
}

function mapStepGoalToSetting(value: unknown): StepGoal | null {
  if (value === 'No target right now') return 'No step goal';
  return coerceSingleOption(value, STEP_GOAL_OPTIONS);
}

function mapSleepGoalToSetting(value: unknown): SleepGoal | null {
  if (value === '9 hours') return '9+ hours';
  return coerceSingleOption(value, SLEEP_GOAL_OPTIONS);
}

function mapAlcoholGoalToSetting(value: unknown): AlcoholGoal | null {
  switch (value) {
    case 'Not tracking':
      return 'Not tracking';
    case 'Limit to weekends':
      return 'Limit to weekends';
    case 'Max 3 drinks/week':
      return 'Limit drinks per week';
    default:
      return null;
  }
}

function mapHydrationTrackingToSetting(value: unknown): HydrationTracking | null {
  if (value === 'No target right now') return 'Not now';
  if (!['64 oz', '80 oz', '100 oz+'].includes(String(value || ''))) return null;
  return 'Daily water goal';
}

function mapNutritionTrackingToSetting(value: unknown): NutritionTracking | null {
  const trackingFocus = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  if (trackingFocus.includes('Macro tracking')) return 'Track full macros';
  if (trackingFocus.includes('Protein-only tracking')) return 'Track protein only';
  if (trackingFocus.includes('Calorie tracking')) return 'Track calories only';
  if (trackingFocus.includes('Not right now')) return 'Skip nutrition tracking';
  return null;
}

function mergeAnswers(...sources: Array<Partial<OnboardingAnswers> | null | undefined>): OnboardingAnswers {
  return sources.reduce<OnboardingAnswers>(
    (acc, source) => {
      if (!source) return acc;
      return {
        ...acc,
        ...source,
        reminderToggles: {
          ...acc.reminderToggles,
          ...(source.reminderToggles || {}),
        },
      };
    },
    {
      ...EMPTY_ANSWERS,
      reminderToggles: { ...EMPTY_ANSWERS.reminderToggles },
    },
  );
}

function mapStoredOnboardingToSettingsAnswers(value: unknown): Partial<OnboardingAnswers> {
  if (!isRecord(value)) return {};

  const adultsCount = toInteger(value.adultsCount);
  const kidsCount = toInteger(value.kidsCount);
  const groceryMode = coerceSingleOption(value.groceryShoppingMode, GROCERY_MODE_OPTIONS);
  const groceryStores = coerceMultiOption(value.groceryStorePreferences, GROCERY_STORE_OPTIONS);
  const nutritionTracking = mapNutritionTrackingToSetting(value.healthTrackingFocus);
  const hydrationTracking = mapHydrationTrackingToSetting(value.waterTarget);
  const stepGoal = mapStepGoalToSetting(value.stepTarget);
  const sleepGoal = mapSleepGoalToSetting(value.sleepDurationTarget);
  const alcoholGoal = mapAlcoholGoalToSetting(value.alcoholTarget);

  let householdType: HouseholdType | null = null;
  if (kidsCount !== null && kidsCount > 0) {
    householdType = 'Family';
  } else if (adultsCount === 1) {
    householdType = 'Just me';
  }

  const next: Partial<OnboardingAnswers> = {};
  if (householdType) next.householdType = householdType;
  if (householdType === 'Family') {
    const kidCount = mapKidCountToSetting(kidsCount);
    if (kidCount) next.kidCount = kidCount;
  }
  if (groceryMode) next.groceryMode = groceryMode;
  if (groceryStores[0]) next.groceryStore = groceryStores[0];
  if (nutritionTracking) next.nutritionTracking = nutritionTracking;
  if (hydrationTracking) next.hydrationTracking = hydrationTracking;
  if (stepGoal) next.stepGoal = stepGoal;
  if (sleepGoal) next.sleepGoal = sleepGoal;
  if (alcoholGoal) next.alcoholGoal = alcoholGoal;
  return next;
}

function mapLegacySettingsAnswers(value: unknown): Partial<OnboardingAnswers> {
  if (!isRecord(value)) return {};

  const reminderToggles = isRecord(value.reminderToggles)
    ? {
        tasks: Boolean(value.reminderToggles.tasks),
        groceries: Boolean(value.reminderToggles.groceries),
        meals: Boolean(value.reminderToggles.meals),
        chores: Boolean(value.reminderToggles.chores),
        workouts: Boolean(value.reminderToggles.workouts),
      }
    : undefined;

  const next: Partial<OnboardingAnswers> = {};
  const primaryGoals = coerceMultiOption(value.primaryGoals, PRIMARY_GOAL_OPTIONS);
  const householdType = coerceSingleOption(value.householdType, HOUSEHOLD_OPTIONS);
  const kidCount = coerceSingleOption(value.kidCount, KID_COUNT_OPTIONS);
  const role = coerceSingleOption(value.role, ROLE_OPTIONS);
  const routineIntensity = coerceSingleOption(value.routineIntensity, INTENSITY_OPTIONS);
  const mealPreference = coerceSingleOption(value.mealPreference, MEAL_OPTIONS);
  const groceryMode = coerceSingleOption(value.groceryMode, GROCERY_MODE_OPTIONS);
  const groceryStore = coerceSingleOption(value.groceryStore, GROCERY_STORE_OPTIONS);
  const choreStyle = coerceSingleOption(value.choreStyle, CHORE_OPTIONS);
  const reminderStyle = coerceSingleOption(value.reminderStyle, REMINDER_STYLE_OPTIONS);
  const workoutFrequency = coerceSingleOption(value.workoutFrequency, WORKOUT_FREQ_OPTIONS);
  const workoutLocation = coerceSingleOption(value.workoutLocation, WORKOUT_LOCATION_OPTIONS);
  const nutritionTracking = coerceSingleOption(value.nutritionTracking, NUTRITION_TRACKING_OPTIONS);
  const hydrationTracking = coerceSingleOption(value.hydrationTracking, HYDRATION_OPTIONS);
  const stepGoal = coerceSingleOption(value.stepGoal, STEP_GOAL_OPTIONS);
  const sleepGoal = coerceSingleOption(value.sleepGoal, SLEEP_GOAL_OPTIONS);
  const alcoholGoal = coerceSingleOption(value.alcoholGoal, ALCOHOL_GOAL_OPTIONS);

  if (primaryGoals.length > 0) next.primaryGoals = primaryGoals;
  if (householdType) next.householdType = householdType;
  if (kidCount) next.kidCount = kidCount;
  if (role) next.role = role;
  if (routineIntensity) next.routineIntensity = routineIntensity;
  if (mealPreference) next.mealPreference = mealPreference;
  if (groceryMode) next.groceryMode = groceryMode;
  if (groceryStore) next.groceryStore = groceryStore;
  if (choreStyle) next.choreStyle = choreStyle;
  if (reminderStyle) next.reminderStyle = reminderStyle;
  if (workoutFrequency) next.workoutFrequency = workoutFrequency;
  if (workoutLocation) next.workoutLocation = workoutLocation;
  if (nutritionTracking) next.nutritionTracking = nutritionTracking;
  if (hydrationTracking) next.hydrationTracking = hydrationTracking;
  if (stepGoal) next.stepGoal = stepGoal;
  if (sleepGoal) next.sleepGoal = sleepGoal;
  if (alcoholGoal) next.alcoholGoal = alcoholGoal;
  if (reminderToggles) next.reminderToggles = reminderToggles;
  return next;
}

function applySettingsAnswersToStoredOnboarding(
  baseValue: unknown,
  answers: OnboardingAnswers,
): Record<string, unknown> {
  const next = isRecord(baseValue) ? { ...baseValue } : {};

  if (answers.householdType === 'Just me') {
    next.adultsCount = 1;
    next.kidsCount = 0;
  } else if (answers.householdType === 'Family' && answers.kidCount) {
    next.kidsCount = answers.kidCount === '5+' ? 5 : Number.parseInt(answers.kidCount, 10);
    if (typeof next.adultsCount !== 'number') {
      next.adultsCount = 2;
    }
  }

  if (answers.groceryMode) {
    next.groceryShoppingMode = answers.groceryMode;
  }
  if (answers.groceryStore) {
    next.groceryStorePreferences = [answers.groceryStore];
  }

  if (answers.nutritionTracking) {
    const baseTrackingFocus = Array.isArray(next.healthTrackingFocus)
      ? next.healthTrackingFocus.filter((item): item is string => typeof item === 'string')
      : [];
    const strippedTrackingFocus = baseTrackingFocus.filter(
      (item) => !['Macro tracking', 'Protein-only tracking', 'Calorie tracking', 'Not right now'].includes(item),
    );
    const mappedTracking =
      answers.nutritionTracking === 'Track full macros'
        ? 'Macro tracking'
        : answers.nutritionTracking === 'Track protein only'
        ? 'Protein-only tracking'
        : answers.nutritionTracking === 'Track calories only'
        ? 'Calorie tracking'
        : 'Not right now';
    next.healthTrackingFocus = [...strippedTrackingFocus, mappedTracking];
  }

  if (answers.stepGoal) {
    next.stepTarget = answers.stepGoal === 'No step goal' ? 'No target right now' : answers.stepGoal;
  }

  if (answers.sleepGoal) {
    next.sleepDurationTarget = answers.sleepGoal === '9+ hours' ? '9 hours' : answers.sleepGoal;
  }

  if (answers.alcoholGoal) {
    next.alcoholTarget =
      answers.alcoholGoal === 'Limit drinks per week'
        ? 'Max 3 drinks/week'
        : answers.alcoholGoal;
  }

  return next;
}

function hasFitnessGoal(answers: OnboardingAnswers): boolean {
  return answers.primaryGoals.includes('Fitness & workouts') || answers.primaryGoals.includes('All of the above');
}

function buildEnabledModules(answers: OnboardingAnswers): PlanModule[] {
  const modules = new Set<PlanModule>();

  if (answers.primaryGoals.includes('All of the above')) {
    modules.add('meals');
    modules.add('groceries');
    modules.add('chores');
    modules.add('tasks');
    modules.add('workouts');
  } else {
    if (answers.primaryGoals.includes('Meals & groceries')) {
      modules.add('meals');
      modules.add('groceries');
    }
    if (answers.primaryGoals.includes('Chores & routines')) modules.add('chores');
    if (answers.primaryGoals.includes('Family calendar & tasks')) modules.add('tasks');
    if (answers.primaryGoals.includes('Fitness & workouts')) modules.add('workouts');
  }

  if (answers.mealPreference === 'No meal planning') modules.delete('meals');
  if (answers.mealPreference === 'Just generate grocery lists') {
    modules.delete('meals');
    modules.add('groceries');
  }

  if (answers.reminderToggles.tasks) modules.add('tasks');
  if (answers.reminderToggles.groceries) modules.add('groceries');
  if (answers.reminderToggles.meals && answers.mealPreference !== 'No meal planning') modules.add('meals');
  if (answers.reminderToggles.chores) modules.add('chores');
  if (answers.reminderToggles.workouts && hasFitnessGoal(answers)) modules.add('workouts');

  const order: PlanModule[] = ['meals', 'groceries', 'chores', 'tasks', 'workouts'];
  return order.filter((module) => modules.has(module));
}

function mapReminderProfile(style: ReminderStyle | null): ReminderProfile {
  if (style === 'Minimal') return 'minimal';
  if (style === 'Persistent (keep nudging me)') return 'persistent';
  return 'normal';
}

function buildPersonalizedPlan(answers: OnboardingAnswers): PersonalizedPlan {
  const enabledModules = buildEnabledModules(answers);
  const intensity = answers.routineIntensity === 'Light touch'
    ? 'light'
    : answers.routineIntensity === 'Highly organized'
    ? 'high'
    : 'balanced';
  const workoutDays = answers.workoutFrequency === '0-2' ? 2 : answers.workoutFrequency === '6+' ? 6 : 4;

  const suggested: string[] = [];
  if (enabledModules.includes('meals') && enabledModules.includes('groceries')) suggested.push("This week's meal plan + grocery list");
  if (enabledModules.includes('chores')) suggested.push('Chore schedule + responsibilities');
  if (enabledModules.includes('tasks')) suggested.push('Top 5 tasks to set up');
  if (enabledModules.includes('workouts')) suggested.push(`Workout plan (${answers.workoutFrequency || '3-5'} days/week)`);
  if (answers.nutritionTracking === 'Track full macros') suggested.push('Macro targets dashboard');
  if (answers.nutritionTracking === 'Track protein only') suggested.push('Protein-first scoreboard');
  if (answers.hydrationTracking === 'Daily water goal') suggested.push('Daily hydration reminders');
  if (answers.stepGoal && answers.stepGoal !== 'No step goal') suggested.push(`Step goal tracker (${answers.stepGoal})`);
  if (answers.sleepGoal && answers.sleepGoal !== 'No sleep target') suggested.push(`Sleep target (${answers.sleepGoal})`);
  if (answers.alcoholGoal && answers.alcoholGoal !== 'Not tracking') suggested.push(`Alcohol target (${answers.alcoholGoal})`);

  return {
    enabledModules,
    defaultSchedules: {
      intensity,
      planningCadence: intensity === 'high' ? 'Weekly + midweek refresh' : intensity === 'light' ? 'Weekly quick check-in' : 'Weekly planning block',
      reminderMoments: intensity === 'high' ? ['7:30 AM', '12:00 PM', '6:00 PM'] : intensity === 'light' ? ['8:00 AM', '6:00 PM'] : ['8:00 AM', '6:00 PM', '8:30 PM'],
      defaultWorkoutDays: workoutDays,
    },
    suggestedLists: suggested.slice(0, 5),
    reminderProfile: mapReminderProfile(answers.reminderStyle),
  };
}

export default function SettingsPage() {
  const { user, isDemoUser, profile, subscription, isSubscribed, updateProfile, updateEmail } = useAuth();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [storedOnboardingResult, setStoredOnboardingResult] = useState<StoredOnboardingResult | null>(null);
  const [accountDetails, setAccountDetails] = useState({
    fullName: '',
    householdName: '',
    email: '',
  });
  const [commonDepartureAddresses, setCommonDepartureAddresses] = useState<string[]>([]);
  const [commonDepartureDraft, setCommonDepartureDraft] = useState('');
  const [savedDepartureProfile, setSavedDepartureProfile] = useState(() =>
    loadDepartureAddressProfile(user?.id),
  );
  const [accountSaving, setAccountSaving] = useState(false);
  const [bodyUnits, setBodyUnits] = useState<Record<string, BodyUnitSystem>>({});
  const [loading, setLoading] = useState(true);
  const [smsPrefs, setSmsPrefs] = useState<SmsPreferences>(() =>
    defaultSmsPreferences(
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York',
    ),
  );
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsTesting, setSmsTesting] = useState(false);
  const [macroDialogPersonId, setMacroDialogPersonId] = useState<string | null>(null);
  const canUseRemoteSms = Boolean(user?.id && user.id !== 'demo-user');
  const adultMacroProfiles = listDashboardProfiles();
  const inferredBillingInterval = inferBillingIntervalFromPriceId(subscription?.priceId);
  const nextChargeAmount = amountForBillingInterval(inferredBillingInterval);
  const trialEndDate = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const currentPeriodEndDate = subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  const accessEndDate = getSubscriptionAccessEndDate(subscription);
  const normalizedSubscriptionStatus = String(subscription?.status || '').toLowerCase();
  const isTrialing = normalizedSubscriptionStatus === 'trialing';
  const isActiveSubscription = normalizedSubscriptionStatus === 'active';
  const isCanceledWithAccess = normalizedSubscriptionStatus === 'canceled' && hasSubscriptionAccess(subscription);
  const displaySubscriptionStatus = isCanceledWithAccess ? 'canceled' : subscription?.status || 'inactive';

  const refreshSmsPrefs = useCallback(async () => {
    const savedDepartureProfile = loadDepartureAddressProfile(user?.id);
    setSavedDepartureProfile(savedDepartureProfile);
    setCommonDepartureAddresses(loadCommonDepartureAddresses(user?.id));
    if (!canUseRemoteSms) {
      setSmsPrefs((prev) => ({
        ...prev,
        home_address: savedDepartureProfile.homeAddress,
        work_address: savedDepartureProfile.workAddress,
      }));
      return;
    }
    const sms = await loadSmsPreferences();
    setSmsPrefs({
      ...sms,
      home_address: savedDepartureProfile.homeAddress || sms.home_address,
      work_address: savedDepartureProfile.workAddress || sms.work_address,
    });
  }, [canUseRemoteSms, user?.id]);

  useEffect(() => {
    setAccountDetails({
      fullName: profile?.fullName || '',
      householdName: profile?.householdName || '',
      email: user?.email || '',
    });
  }, [profile?.fullName, profile?.householdName, user?.email]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const [stored, rawSettingsDocument] = await Promise.all([
        loadOnboardingResult(user?.id),
        loadProfileSettingsDocument(user?.id).catch(() => ({})),
      ]);
      if (!mounted) return;
      setStoredOnboardingResult(stored);
      const mappedFromCanonical = mapStoredOnboardingToSettingsAnswers(stored?.onboarding);
      const mappedFromLegacyOnboarding = mapLegacySettingsAnswers(stored?.onboarding);
      const mappedFromSavedSettings = mapLegacySettingsAnswers(
        getProfileSettingsValue(rawSettingsDocument, ['settingsAnswers']),
      );
      setAnswers(
        mergeAnswers(
          EMPTY_ANSWERS,
          mappedFromCanonical,
          mappedFromLegacyOnboarding,
          mappedFromSavedSettings,
        ),
      );
      const profiles = getProfiles();
      const nextBodyUnits = Object.values(profiles)
        .filter((dashboardProfile) => dashboardProfile.memberType === 'adult')
        .reduce<Record<string, BodyUnitSystem>>((acc, dashboardProfile) => {
          acc[dashboardProfile.id] = dashboardProfile.macroPlan.bodyUnitSystem || 'imperial';
          return acc;
        }, {});
      setBodyUnits(nextBodyUnits);
      if (canUseRemoteSms) {
        try {
          await refreshSmsPrefs();
        } catch (error) {
          if (mounted) {
            toast({
              title: 'Could not load SMS settings',
              description: error instanceof Error ? error.message : 'Please try again.',
              variant: 'destructive',
            });
          }
        }
      } else if (mounted) {
        await refreshSmsPrefs();
      }
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [canUseRemoteSms, refreshSmsPrefs, toast, user?.id]);

  useEffect(() => {
    if (!canUseRemoteSms) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const latest = await loadSmsPreferences();
        if (cancelled) return;
        setSmsPrefs((prev) => {
          const next = {
            ...latest,
            home_address: prev.home_address || latest.home_address,
            work_address: prev.work_address || latest.work_address,
          };
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
      } catch {
        // Keep current view if refresh fails.
      }
    };
    const onFocus = () => {
      void sync();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sync();
      }
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [canUseRemoteSms]);

  const limitReached = !answers.primaryGoals.includes('All of the above')
    && answers.primaryGoals.filter((item) => item !== 'All of the above').length >= 3;

  const togglePrimaryGoal = (goal: PrimaryGoal) => {
    setAnswers((prev) => {
      if (goal === 'All of the above') {
        if (prev.primaryGoals.includes(goal)) return { ...prev, primaryGoals: [] };
        return { ...prev, primaryGoals: [...PRIMARY_GOAL_OPTIONS] };
      }
      const withoutAll = prev.primaryGoals.filter((item) => item !== 'All of the above');
      if (withoutAll.includes(goal)) return { ...prev, primaryGoals: withoutAll.filter((item) => item !== goal) };
      if (withoutAll.length >= 3) return prev;
      return { ...prev, primaryGoals: [...withoutAll, goal] };
    });
  };

  const setSingle = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleReminder = (key: keyof OnboardingAnswers['reminderToggles']) => {
    setAnswers((prev) => ({
      ...prev,
      reminderToggles: {
        ...prev.reminderToggles,
        [key]: !prev.reminderToggles[key],
      },
    }));
  };

  const updateSmsPref = <K extends keyof SmsPreferences>(key: K, value: SmsPreferences[K]) => {
    setSmsPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const toggleSmsOffset = (offset: number) => {
    setSmsPrefs((prev) => {
      const nextOffsets = prev.reminder_offsets_minutes.includes(offset)
        ? prev.reminder_offsets_minutes.filter((value) => value !== offset)
        : [...prev.reminder_offsets_minutes, offset];
      return {
        ...prev,
        reminder_offsets_minutes: nextOffsets.sort((a, b) => b - a),
      };
    });
  };

  const toggleSmsModule = (moduleName: SmsReminderModule) => {
    setSmsPrefs((prev) => {
      const next = prev.include_modules.includes(moduleName)
        ? prev.include_modules.filter((name) => name !== moduleName)
        : [...prev.include_modules, moduleName];
      return {
        ...prev,
        include_modules: next,
      };
    });
  };

  const normalizeAddressField = (value: string): string =>
    value.trim().replace(/\s+/g, ' ');

  const isSameOrContainedAddress = (candidateKey: string, referenceKey: string): boolean => {
    if (!candidateKey || !referenceKey) return false;
    return candidateKey === referenceKey
      || candidateKey.includes(referenceKey)
      || referenceKey.includes(candidateKey);
  };

  const persistDepartureAddresses = (includeDraft = false) => {
    const homeAddress = normalizeAddressField(smsPrefs.home_address);
    const workAddress = normalizeAddressField(smsPrefs.work_address);
    const homeKey = normalizeAddressForCompare(homeAddress);
    const workKey = normalizeAddressForCompare(workAddress);

    const candidates = [...commonDepartureAddresses];
    if (includeDraft && commonDepartureDraft.trim()) {
      candidates.push(commonDepartureDraft);
    }

    const nextCommon = candidates
      .map((item) => normalizeAddressField(String(item || '')))
      .filter((item) => {
        const key = normalizeAddressForCompare(item);
        if (!key) return false;
        return !isSameOrContainedAddress(key, homeKey) && !isSameOrContainedAddress(key, workKey);
      });

    const savedCommon = saveCommonDepartureAddresses(nextCommon, user?.id);
    const savedProfile = saveDepartureAddressProfile(
      {
        homeAddress,
        workAddress,
      },
      user?.id,
    );
    setSavedDepartureProfile(savedProfile);
    setSmsPrefs((prev) => ({
      ...prev,
      home_address: homeAddress,
      work_address: workAddress,
    }));
    setCommonDepartureAddresses(savedCommon);
    if (includeDraft) setCommonDepartureDraft('');

    return { homeAddress, workAddress, savedCommon };
  };

  const saveSmsSettings = async () => {
    if (!canUseRemoteSms) {
      toast({
        title: 'SMS is not connected yet',
        description: 'Refresh and start demo again to initialize a demo auth session.',
        variant: 'destructive',
      });
      return;
    }
    setSmsSaving(true);
    try {
      const { homeAddress, workAddress } = persistDepartureAddresses(true);
      const saved = await saveSmsPreferences({
        ...smsPrefs,
        home_address: homeAddress,
        work_address: workAddress,
      });
      const mergedHome = saved.home_address || homeAddress;
      const mergedWork = saved.work_address || workAddress;
      setSmsPrefs({
        ...saved,
        home_address: mergedHome,
        work_address: mergedWork,
      });
      const savedProfile = saveDepartureAddressProfile(
        {
          homeAddress: mergedHome,
          workAddress: mergedWork,
        },
        user?.id,
      );
      setSavedDepartureProfile(savedProfile);
      toast({ title: 'SMS settings saved' });
    } catch (error) {
      toast({
        title: 'Could not save SMS settings',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSmsSaving(false);
    }
  };

  const sendSmsTest = async () => {
    if (!canUseRemoteSms) {
      toast({
        title: 'SMS is not connected yet',
        description: 'Refresh and start demo again to initialize a demo auth session.',
        variant: 'destructive',
      });
      return;
    }
    setSmsTesting(true);
    try {
      await sendSmsTestMessage();
      toast({ title: 'Test SMS sent' });
    } catch (error) {
      toast({
        title: 'Could not send test SMS',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSmsTesting(false);
    }
  };

  const save = async () => {
    const { homeAddress, workAddress } = persistDepartureAddresses(true);
    const nextOnboarding = applySettingsAnswersToStoredOnboarding(storedOnboardingResult?.onboarding, answers);
    const payload: StoredOnboardingResult = {
      completedAt: storedOnboardingResult?.completedAt || new Date().toISOString(),
      onboarding: nextOnboarding,
      personalizedPlan:
        storedOnboardingResult?.personalizedPlan || (buildPersonalizedPlan(answers) as unknown as Record<string, unknown>),
    };
    try {
      await saveOnboardingResult(user?.id, payload);
      if (user?.id) {
        await updateProfileSettingsValue(user.id, ['settingsAnswers'], answers as unknown as Record<string, unknown>);
      }
      setStoredOnboardingResult(payload);
      if (canUseRemoteSms) {
        const savedSms = await saveSmsPreferences({
          ...smsPrefs,
          home_address: homeAddress,
          work_address: workAddress,
        });
        const mergedHome = savedSms.home_address || homeAddress;
        const mergedWork = savedSms.work_address || workAddress;
        setSmsPrefs({
          ...savedSms,
          home_address: mergedHome,
          work_address: mergedWork,
        });
        const savedProfile = saveDepartureAddressProfile(
          {
            homeAddress: mergedHome,
            workAddress: mergedWork,
          },
          user?.id,
        );
        setSavedDepartureProfile(savedProfile);
      }
      Object.entries(bodyUnits).forEach(([personId, unitSystem]) => {
        updateMacroPlan(personId, { bodyUnitSystem: unitSystem });
      });
      toast({ title: 'Settings saved', description: 'Onboarding preferences were updated.' });
    } catch (error: unknown) {
      toast({
        title: 'Could not save settings',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const saveAccountDetails = async () => {
    const { homeAddress, workAddress } = persistDepartureAddresses(true);

    if (!user?.id || isDemoUser) {
      toast({
        title: 'Addresses saved',
        description: 'Sign in to save name and email changes.',
      });
      return;
    }

    const fullName = accountDetails.fullName.trim();
    const householdName = accountDetails.householdName.trim();
    const nextEmail = accountDetails.email.trim().toLowerCase();
    const currentEmail = user.email?.trim().toLowerCase() || '';

    if (fullName.length < 2) {
      toast({
        title: 'Full name is required',
        description: 'Addresses were saved. Enter at least 2 characters for your name.',
        variant: 'destructive',
      });
      return;
    }
    if (!EMAIL_PATTERN.test(nextEmail)) {
      toast({
        title: 'Valid email required',
        description: 'Addresses were saved. Enter a valid account email address.',
        variant: 'destructive',
      });
      return;
    }

    setAccountSaving(true);
    try {
      await updateProfile({
        full_name: fullName,
        household_name: householdName || null,
      });

      if (canUseRemoteSms) {
        try {
          const savedSms = await saveSmsPreferences({
            ...smsPrefs,
            home_address: homeAddress,
            work_address: workAddress,
          });
          const mergedHome = savedSms.home_address || homeAddress;
          const mergedWork = savedSms.work_address || workAddress;
          setSmsPrefs({
            ...savedSms,
            home_address: mergedHome,
            work_address: mergedWork,
          });
          const savedProfile = saveDepartureAddressProfile(
            {
              homeAddress: mergedHome,
              workAddress: mergedWork,
            },
            user?.id,
          );
          setSavedDepartureProfile(savedProfile);
        } catch (smsError) {
          toast({
            title: 'Address sync skipped',
            description: smsError instanceof Error ? smsError.message : 'Saved locally. SMS profile sync failed.',
            variant: 'destructive',
          });
        }
      }

      if (nextEmail !== currentEmail) {
        await updateEmail(nextEmail);
        toast({
          title: 'Account details saved',
          description: 'Email change requested. Confirm the new email from your inbox if prompted.',
        });
      } else {
        toast({ title: 'Account details saved' });
      }
    } catch (error) {
      toast({
        title: 'Could not save account details',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setAccountSaving(false);
    }
  };

  const addCommonDepartureAddress = () => {
    const next = normalizeAddressField(commonDepartureDraft);
    if (!next) return;
    const home = normalizeAddressForCompare(smsPrefs.home_address);
    const work = normalizeAddressForCompare(smsPrefs.work_address);
    const nextKey = normalizeAddressForCompare(next);
    if (nextKey === home || nextKey === work) {
      setCommonDepartureDraft('');
      return;
    }
    setCommonDepartureAddresses((prev) => {
      const saved = saveCommonDepartureAddresses([...prev, next], user?.id);
      return saved;
    });
    setCommonDepartureDraft('');
  };

  const removeCommonDepartureAddress = (value: string) => {
    setCommonDepartureAddresses((prev) => {
      const next = prev.filter((item) => item !== value);
      return saveCommonDepartureAddresses(next, user?.id);
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Settings" subtitle="Edit onboarding preferences and lifestyle targets" />
        <p className="text-sm text-muted-foreground">Loading your settings...</p>
      </AppLayout>
    );
  }

  const displayHomeAddress = smsPrefs.home_address.trim() || savedDepartureProfile.homeAddress;
  const displayWorkAddress = smsPrefs.work_address.trim() || savedDepartureProfile.workAddress;

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        subtitle="Edit onboarding preferences and lifestyle targets"
        action={<Button onClick={save}>Save Changes</Button>}
      />

      <div className="space-y-6">
        <SectionCard title="Account details" subtitle="Manage your name, household name, and login email">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">Full name</p>
              <Input
                value={accountDetails.fullName}
                onChange={(event) =>
                  setAccountDetails((prev) => ({ ...prev, fullName: event.target.value }))
                }
                placeholder="Your full name"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Household name</p>
              <Input
                value={accountDetails.householdName}
                onChange={(event) =>
                  setAccountDetails((prev) => ({ ...prev, householdName: event.target.value }))
                }
                placeholder="Optional household name"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <p className="text-sm font-medium">Email</p>
              <Input
                type="email"
                value={accountDetails.email}
                onChange={(event) =>
                  setAccountDetails((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="you@example.com"
              />
              <p className="text-xs text-muted-foreground">
                This is the email used for sign-in and account notifications.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Home address</p>
              <Input
                placeholder="123 Main St, Phoenix, AZ"
                value={smsPrefs.home_address}
                onChange={(e) => updateSmsPref('home_address', e.target.value)}
              />
              {displayHomeAddress ? (
                <p className="text-xs text-muted-foreground">Saved as Home: {displayHomeAddress}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No home address saved yet.</p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Work address</p>
              <Input
                placeholder="Office address (optional)"
                value={smsPrefs.work_address}
                onChange={(e) => updateSmsPref('work_address', e.target.value)}
              />
              {displayWorkAddress ? (
                <p className="text-xs text-muted-foreground">Saved as Work: {displayWorkAddress}</p>
              ) : (
                <p className="text-xs text-muted-foreground">No work address saved yet.</p>
              )}
            </div>
            <div className="space-y-2 md:col-span-2">
              <p className="text-sm font-medium">Other common leaving-from addresses</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Gym, school, childcare, parent pickup, etc."
                  value={commonDepartureDraft}
                  onChange={(e) => setCommonDepartureDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCommonDepartureAddress();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addCommonDepartureAddress}>
                  Add
                </Button>
              </div>
              {commonDepartureAddresses.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {commonDepartureAddresses.map((address) => (
                    <button
                      key={address}
                      type="button"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
                      onClick={() => removeCommonDepartureAddress(address)}
                      title="Remove address"
                    >
                      <span className="max-w-[240px] truncate">{address}</span>
                      <span className="text-foreground">x</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add common places you leave from so events can reuse them quickly.
                </p>
              )}
            </div>
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => void saveAccountDetails()} disabled={accountSaving}>
              {accountSaving ? 'Saving account...' : 'Save account details'}
            </Button>
          </div>
        </SectionCard>

        {BILLING_ENABLED && !isDemoUser && (
          <SectionCard title="Billing" subtitle="View your trial, billing timing, and cancel options">
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Status</p>
                  <p className="mt-1 text-base font-semibold capitalize">{displaySubscriptionStatus}</p>
                </div>
                {isCanceledWithAccess && accessEndDate ? (
                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Access through</p>
                    <p className="mt-1 text-base font-semibold">{accessEndDate.toLocaleDateString()}</p>
                  </div>
                ) : isTrialing && trialEndDate ? (
                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Free trial ends</p>
                    <p className="mt-1 text-base font-semibold">{trialEndDate.toLocaleDateString()}</p>
                  </div>
                ) : currentPeriodEndDate ? (
                  <div className="rounded-xl border border-border bg-background px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Next billing date</p>
                    <p className="mt-1 text-base font-semibold">{currentPeriodEndDate.toLocaleDateString()}</p>
                  </div>
                ) : null}
              </div>

              {nextChargeAmount !== null && normalizedSubscriptionStatus !== 'canceled' && (
                <p className="text-sm text-muted-foreground">
                  {isTrialing ? 'After your trial, you will be charged ' : 'Your current billing amount is '}
                  <span className="font-medium text-foreground">
                    {inferredBillingInterval === 'yearly'
                      ? `${formatUsd(nextChargeAmount)} per year`
                      : `${formatUsd(nextChargeAmount)} per month`}
                  </span>
                  .
                </p>
              )}

              {isTrialing && trialEndDate && (
                <p className="text-sm text-muted-foreground">
                  Cancel before <span className="font-medium text-foreground">{trialEndDate.toLocaleDateString()}</span> and you will not be charged.
                </p>
              )}

              {isCanceledWithAccess && accessEndDate && (
                <p className="text-sm text-muted-foreground">
                  Your subscription is canceled. You still have access through{' '}
                  <span className="font-medium text-foreground">{accessEndDate.toLocaleDateString()}</span>.
                </p>
              )}

              {isSubscribed ? (
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <Link to="/billing">Manage or cancel billing</Link>
                  </Button>
                  <p className="self-center text-sm text-muted-foreground">
                    Billing changes and cancellation are handled through the secure billing page.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline">
                    <Link to="/billing">Open billing</Link>
                  </Button>
                  <p className="self-center text-sm text-muted-foreground">
                    Open billing to start or manage your trial.
                  </p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        <SectionCard title="SMS schedule texts" subtitle="Daily schedule texts, night-before preview, and event reminders">
          {canUseRemoteSms ? (
            <div className="space-y-4">
              <label className="w-full rounded-xl border border-border px-4 py-3 flex items-center justify-between">
                <span className="text-sm">Enable SMS updates</span>
                <Switch
                  checked={smsPrefs.enabled}
                  onCheckedChange={(checked) => updateSmsPref('enabled', Boolean(checked))}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Phone (E.164)</p>
                  <Input
                    placeholder="+15551234567"
                    value={smsPrefs.phone_e164}
                    onChange={(e) => updateSmsPref('phone_e164', e.target.value)}
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Timezone</p>
                  <Input
                    placeholder="America/New_York"
                    value={smsPrefs.timezone}
                    onChange={(e) => updateSmsPref('timezone', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">Default leaving from</p>
                <OptionList
                  options={['Home', 'Work', 'Ask each event']}
                  selected={[
                    smsPrefs.default_departure_source === 'work'
                      ? 'Work'
                      : smsPrefs.default_departure_source === 'custom'
                      ? 'Ask each event'
                      : 'Home',
                  ]}
                  onToggle={(value) =>
                    updateSmsPref(
                      'default_departure_source',
                      value === 'Work' ? 'work' : value === 'Ask each event' ? 'custom' : 'home',
                    )
                  }
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="w-full rounded-xl border border-border px-4 py-3 flex items-center justify-between">
                  <span className="text-sm">Morning text</span>
                  <Switch
                    checked={smsPrefs.morning_digest_enabled}
                    onCheckedChange={(checked) => updateSmsPref('morning_digest_enabled', Boolean(checked))}
                  />
                </label>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Morning time</p>
                  <Input
                    type="time"
                    value={smsPrefs.morning_digest_time}
                    onChange={(e) => updateSmsPref('morning_digest_time', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="w-full rounded-xl border border-border px-4 py-3 flex items-center justify-between">
                  <span className="text-sm">Night-before text</span>
                  <Switch
                    checked={smsPrefs.night_before_enabled}
                    onCheckedChange={(checked) => updateSmsPref('night_before_enabled', Boolean(checked))}
                  />
                </label>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Night-before time</p>
                  <Input
                    type="time"
                    value={smsPrefs.night_before_time}
                    onChange={(e) => updateSmsPref('night_before_time', e.target.value)}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 space-y-3">
                <label className="w-full flex items-center justify-between">
                  <span className="text-sm font-medium">Grocery planning reminder</span>
                  <Switch
                    checked={smsPrefs.grocery_reminder_enabled}
                    onCheckedChange={(checked) => updateSmsPref('grocery_reminder_enabled', Boolean(checked))}
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Day</p>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={smsPrefs.grocery_reminder_day}
                      onChange={(e) =>
                        updateSmsPref('grocery_reminder_day', e.target.value as SmsPreferences['grocery_reminder_day'])
                      }
                    >
                      <option value="monday">Monday</option>
                      <option value="tuesday">Tuesday</option>
                      <option value="wednesday">Wednesday</option>
                      <option value="thursday">Thursday</option>
                      <option value="friday">Friday</option>
                      <option value="saturday">Saturday</option>
                      <option value="sunday">Sunday</option>
                    </select>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Time</p>
                    <Input
                      type="time"
                      value={smsPrefs.grocery_reminder_time}
                      onChange={(e) => updateSmsPref('grocery_reminder_time', e.target.value || '20:00')}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Separate from night-before digest. This checks if next week meals/grocery are still incomplete.
                </p>
              </div>

              <label className="w-full rounded-xl border border-border px-4 py-3 flex items-center justify-between">
                <span className="text-sm">Event reminder texts</span>
                <Switch
                  checked={smsPrefs.event_reminders_enabled}
                  onCheckedChange={(checked) => updateSmsPref('event_reminders_enabled', Boolean(checked))}
                />
              </label>

              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">Reminder offsets</p>
                <div className="flex flex-wrap gap-2">
                  {[0, 60, 30].map((offset) => {
                    const active = smsPrefs.reminder_offsets_minutes.includes(offset);
                    return (
                      <Button
                        key={offset}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleSmsOffset(offset)}
                      >
                        {offset === 0 ? 'At event time' : `${offset} min before`}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">Event sources</p>
                <div className="flex flex-wrap gap-2">
                  {VISIBLE_SMS_REMINDER_MODULES.map((moduleName) => {
                    const active = smsPrefs.include_modules.includes(moduleName);
                    return (
                      <Button
                        key={moduleName}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleSmsModule(moduleName)}
                      >
                        {SMS_MODULE_LABELS[moduleName]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Quiet hours start</p>
                  <Input
                    type="time"
                    value={smsPrefs.quiet_hours_start || ''}
                    onChange={(e) => updateSmsPref('quiet_hours_start', e.target.value || null)}
                  />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-1">Quiet hours end</p>
                  <Input
                    type="time"
                    value={smsPrefs.quiet_hours_end || ''}
                    onChange={(e) => updateSmsPref('quiet_hours_end', e.target.value || null)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void saveSmsSettings()} disabled={smsSaving}>
                  {smsSaving ? 'Saving SMS...' : 'Save SMS settings'}
                </Button>
                <Button variant="outline" onClick={() => void sendSmsTest()} disabled={smsTesting}>
                  {smsTesting ? 'Sending test...' : 'Send test SMS'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              SMS needs a connected auth session. Refresh and sign in again, then this section will activate.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Primary goals" subtitle="Pick up to 3 focus areas">
          <OptionList
            options={PRIMARY_GOAL_OPTIONS}
            selected={answers.primaryGoals}
            onToggle={togglePrimaryGoal}
            multi
            disabledOptions={limitReached ? PRIMARY_GOAL_OPTIONS.filter((opt) => !answers.primaryGoals.includes(opt) && opt !== 'All of the above') : []}
          />
        </SectionCard>

        <SectionCard title="Household + planning style">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium mb-2">Who are we planning for?</p>
              <OptionList options={HOUSEHOLD_OPTIONS} selected={answers.householdType ? [answers.householdType] : []} onToggle={(v) => setSingle('householdType', v)} />
            </div>
            <div className="space-y-6">
              {answers.householdType === 'Family' && (
                <div>
                  <p className="text-sm font-medium mb-2">How many kids?</p>
                  <OptionList options={KID_COUNT_OPTIONS} selected={answers.kidCount ? [answers.kidCount] : []} onToggle={(v) => setSingle('kidCount', v)} />
                </div>
              )}
              <div>
                <p className="text-sm font-medium mb-2">Your role</p>
                <OptionList options={ROLE_OPTIONS} selected={answers.role ? [answers.role] : []} onToggle={(v) => setSingle('role', v)} />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Week structure</p>
                <OptionList options={INTENSITY_OPTIONS} selected={answers.routineIntensity ? [answers.routineIntensity] : []} onToggle={(v) => setSingle('routineIntensity', v)} />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Meals, groceries, chores">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium mb-2">Meal planning</p>
              <OptionList options={MEAL_OPTIONS} selected={answers.mealPreference ? [answers.mealPreference] : []} onToggle={(v) => setSingle('mealPreference', v)} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Shopping mode</p>
              <OptionList options={GROCERY_MODE_OPTIONS} selected={answers.groceryMode ? [answers.groceryMode] : []} onToggle={(v) => setSingle('groceryMode', v)} />
            </div>
            {(answers.groceryMode === 'Pickup' || answers.groceryMode === 'Delivery' || answers.groceryMode === 'Mix') && (
              <div>
                <p className="text-sm font-medium mb-2">Store</p>
                <OptionList options={GROCERY_STORE_OPTIONS} selected={answers.groceryStore ? [answers.groceryStore] : []} onToggle={(v) => setSingle('groceryStore', v)} />
              </div>
            )}
            <div>
              <p className="text-sm font-medium mb-2">Chores assignment</p>
              <OptionList options={CHORE_OPTIONS} selected={answers.choreStyle ? [answers.choreStyle] : []} onToggle={(v) => setSingle('choreStyle', v)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Health and lifestyle targets">
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium mb-2">Nutrition tracking</p>
              <OptionList options={NUTRITION_TRACKING_OPTIONS} selected={answers.nutritionTracking ? [answers.nutritionTracking] : []} onToggle={(v) => setSingle('nutritionTracking', v)} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Water tracking</p>
              <OptionList options={HYDRATION_OPTIONS} selected={answers.hydrationTracking ? [answers.hydrationTracking] : []} onToggle={(v) => setSingle('hydrationTracking', v)} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Workout days / week</p>
              <OptionList options={WORKOUT_FREQ_OPTIONS} selected={answers.workoutFrequency ? [answers.workoutFrequency] : []} onToggle={(v) => setSingle('workoutFrequency', v)} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Workout location</p>
              <OptionList options={WORKOUT_LOCATION_OPTIONS} selected={answers.workoutLocation ? [answers.workoutLocation] : []} onToggle={(v) => setSingle('workoutLocation', v)} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Daily step goal</p>
              <OptionList options={STEP_GOAL_OPTIONS} selected={answers.stepGoal ? [answers.stepGoal] : []} onToggle={(v) => setSingle('stepGoal', v)} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Sleep target</p>
              <OptionList options={SLEEP_GOAL_OPTIONS} selected={answers.sleepGoal ? [answers.sleepGoal] : []} onToggle={(v) => setSingle('sleepGoal', v)} />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Alcohol goal</p>
              <OptionList options={ALCOHOL_GOAL_OPTIONS} selected={answers.alcoholGoal ? [answers.alcoholGoal] : []} onToggle={(v) => setSingle('alcoholGoal', v)} />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Macro calculator + targets"
          subtitle="Set up or adjust calorie and macro targets here. If you have not set them yet, the Meals planner will still surface the calculator until you do."
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you want to revisit the full guided setup, you can also rerun onboarding below.
            </p>
            <div className="flex flex-wrap gap-3">
              {adultMacroProfiles.map((macroProfile) => (
                <Button
                  key={macroProfile.id}
                  variant="outline"
                  onClick={() => setMacroDialogPersonId(macroProfile.id)}
                >
                  Open {macroProfile.name} Macro Calculator
                </Button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Body units for macro calculator">
          <div className="grid gap-6 md:grid-cols-2">
            {adultMacroProfiles.map((macroProfile) => (
              <div key={macroProfile.id}>
                <p className="text-sm font-medium mb-2">{macroProfile.name}</p>
                <OptionList
                  options={['Imperial (ft/in, lb)', 'Metric (cm, kg)']}
                  selected={[
                    (bodyUnits[macroProfile.id] || 'imperial') === 'imperial'
                      ? 'Imperial (ft/in, lb)'
                      : 'Metric (cm, kg)',
                  ]}
                  onToggle={(value) =>
                    setBodyUnits((prev) => ({
                      ...prev,
                      [macroProfile.id]: value.startsWith('Imperial') ? 'imperial' : 'metric',
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Reminder channels" subtitle="Control what you get nudges for">
          <div className="space-y-3">
            {([
              ['tasks', 'Tasks'],
              ['groceries', 'Groceries'],
              ['meals', 'Meals'],
              ['chores', 'Chores'],
              ['workouts', 'Workouts'],
            ] as const).map(([key, label]) => (
              <label key={key} className="w-full rounded-xl border border-border px-4 py-3 flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch checked={answers.reminderToggles[key]} onCheckedChange={() => toggleReminder(key)} />
              </label>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Referral program" subtitle="Beta">
          <p className="text-sm text-muted-foreground">
            Referral program is in beta and not launched yet. We will enable this section when the public launch is ready.
          </p>
        </SectionCard>

        <div className="flex flex-wrap gap-3">
          <Button onClick={save}>Save Changes</Button>
          <Link to="/onboarding?force=1">
            <Button variant="outline">Re-run Full Onboarding</Button>
          </Link>
        </div>
        <MacroGoalDialog
          personId={macroDialogPersonId || 'me'}
          open={Boolean(macroDialogPersonId)}
          onOpenChange={(open) => {
            if (!open) setMacroDialogPersonId(null);
          }}
          onSaved={() => {
            setMacroDialogPersonId(null);
          }}
        />
      </div>
    </AppLayout>
  );
}
