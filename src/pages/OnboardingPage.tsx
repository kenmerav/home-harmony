import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { createOrGetHousehold } from '@/lib/api/family';
import { trackGrowthEventSafe } from '@/lib/api/growthAnalytics';
import { useToast } from '@/hooks/use-toast';
import { setPlanRules } from '@/lib/mealPrefs';
import { getPostAuthRoute } from '@/lib/billing';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  saveOnboardingResult,
  type StoredOnboardingResult,
} from '@/lib/onboardingStore';
import { BottomCTA } from '@/components/onboarding/BottomCTA';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { OptionList } from '@/components/onboarding/OptionList';
import { QuestionScreen } from '@/components/onboarding/QuestionScreen';

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
const GROCERY_STORE_OPTIONS = ['Walmart', 'Instacart', 'Amazon', 'Target', "Kroger/Fry's", 'Other'] as const;
const CHORE_OPTIONS = ['Rotating schedule', 'Fixed responsibilities', "I'll set it up later"] as const;
const REMINDER_STYLE_OPTIONS = ['Minimal', 'Normal', 'Persistent (keep nudging me)'] as const;
const FITNESS_LEVEL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'] as const;
const WORKOUT_FREQ_OPTIONS = ['0-2', '3-5', '6+'] as const;
const WORKOUT_LOCATION_OPTIONS = ['Home', 'Gym', 'Both'] as const;
const NUTRITION_TRACKING_OPTIONS = [
  'Track full macros',
  'Track protein only',
  'Track calories only',
  'Skip nutrition tracking',
] as const;
const HYDRATION_OPTIONS = ['Daily water goal', 'Casual water tracking', 'Not now'] as const;
const STEP_GOAL_OPTIONS = ['5,000', '8,000', '10,000', '12,000+', 'No step goal'] as const;
const SLEEP_GOAL_OPTIONS = ['7 hours', '8 hours', '9+ hours', 'No sleep target'] as const;
const ALCOHOL_GOAL_OPTIONS = [
  'Not tracking',
  'Limit to weekends',
  'Limit drinks per week',
  'Reduce as much as possible',
] as const;

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
type FitnessLevel = (typeof FITNESS_LEVEL_OPTIONS)[number];
type WorkoutFrequency = (typeof WORKOUT_FREQ_OPTIONS)[number];
type WorkoutLocation = (typeof WORKOUT_LOCATION_OPTIONS)[number];
type NutritionTracking = (typeof NUTRITION_TRACKING_OPTIONS)[number];
type HydrationTracking = (typeof HYDRATION_OPTIONS)[number];
type StepGoal = (typeof STEP_GOAL_OPTIONS)[number];
type SleepGoal = (typeof SLEEP_GOAL_OPTIONS)[number];
type AlcoholGoal = (typeof ALCOHOL_GOAL_OPTIONS)[number];

type StepId =
  | 'welcome'
  | 'preset'
  | 'primaryGoals'
  | 'household'
  | 'kidCount'
  | 'role'
  | 'intensity'
  | 'meal'
  | 'groceryMode'
  | 'groceryStore'
  | 'chores'
  | 'reminderStyle'
  | 'fitnessLevel'
  | 'workoutFrequency'
  | 'workoutLocation'
  | 'nutritionTracking'
  | 'hydrationTracking'
  | 'stepGoal'
  | 'sleepGoal'
  | 'alcoholGoal'
  | 'notifications'
  | 'value'
  | 'plan';

type PlanModule = 'meals' | 'groceries' | 'chores' | 'tasks' | 'workouts';
type ReminderProfile = 'minimal' | 'normal' | 'persistent';

interface OnboardingAnswers {
  onboardingPreset: 'busy-family' | 'fitness-focused' | 'chores-first' | 'balanced-all-in' | null;
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
  fitnessLevel: FitnessLevel | null;
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
  notificationsOptIn: boolean | null;
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

const DEFAULT_ONBOARDING: OnboardingAnswers = {
  onboardingPreset: null,
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
  fitnessLevel: null,
  workoutFrequency: null,
  workoutLocation: null,
  nutritionTracking: null,
  hydrationTracking: null,
  stepGoal: null,
  sleepGoal: null,
  alcoholGoal: null,
  reminderToggles: {
    tasks: true,
    groceries: true,
    meals: true,
    chores: true,
    workouts: true,
  },
  notificationsOptIn: null,
};

const ONBOARDING_PRESET_OPTIONS = [
  'Busy family',
  'Fitness focused',
  'Chores first',
  'Balanced all-in',
] as const;

const PENDING_TEMPLATE_KEY = 'homehub.pendingTemplate.v1';

function hasFitnessGoal(onboarding: OnboardingAnswers): boolean {
  return onboarding.primaryGoals.includes('Fitness & workouts') || onboarding.primaryGoals.includes('All of the above');
}

function needsStoreStep(onboarding: OnboardingAnswers): boolean {
  return onboarding.groceryMode === 'Pickup' || onboarding.groceryMode === 'Delivery' || onboarding.groceryMode === 'Mix';
}

function buildSteps(onboarding: OnboardingAnswers): StepId[] {
  const steps: StepId[] = ['welcome', 'preset', 'primaryGoals', 'household'];

  if (onboarding.householdType === 'Family') {
    steps.push('kidCount');
  }

  steps.push('role', 'intensity', 'meal', 'groceryMode');

  if (needsStoreStep(onboarding)) {
    steps.push('groceryStore');
  }

  steps.push('chores', 'reminderStyle', 'nutritionTracking', 'hydrationTracking', 'stepGoal', 'sleepGoal', 'alcoholGoal');

  if (hasFitnessGoal(onboarding)) {
    steps.push('fitnessLevel', 'workoutFrequency', 'workoutLocation');
  }

  steps.push('notifications', 'value', 'plan');

  return steps;
}

function applyPresetToOnboarding(preset: NonNullable<OnboardingAnswers['onboardingPreset']>, current: OnboardingAnswers): OnboardingAnswers {
  const base: OnboardingAnswers = {
    ...current,
    onboardingPreset: preset,
  };

  switch (preset) {
    case 'busy-family':
      return {
        ...base,
        primaryGoals: ['Meals & groceries', 'Family calendar & tasks'],
        householdType: current.householdType || 'Family',
        role: current.role || 'Primary planner',
        routineIntensity: 'Balanced',
        mealPreference: 'Plan weeknights only',
        groceryMode: 'Pickup',
        groceryStore: current.groceryStore || 'Walmart',
        reminderStyle: 'Normal',
        nutritionTracking: current.nutritionTracking || 'Track protein only',
        hydrationTracking: current.hydrationTracking || 'Daily water goal',
      };
    case 'fitness-focused':
      return {
        ...base,
        primaryGoals: ['Fitness & workouts', 'Meals & groceries'],
        routineIntensity: 'Highly organized',
        mealPreference: 'Plan the whole week',
        reminderStyle: 'Persistent (keep nudging me)',
        fitnessLevel: current.fitnessLevel || 'Intermediate',
        workoutFrequency: '3-5',
        workoutLocation: 'Both',
        nutritionTracking: 'Track full macros',
        hydrationTracking: 'Daily water goal',
        stepGoal: '10,000',
        sleepGoal: '8 hours',
      };
    case 'chores-first':
      return {
        ...base,
        primaryGoals: ['Chores & routines', 'Family calendar & tasks'],
        routineIntensity: 'Highly organized',
        choreStyle: 'Rotating schedule',
        reminderStyle: 'Persistent (keep nudging me)',
        mealPreference: current.mealPreference || 'Plan weeknights only',
      };
    case 'balanced-all-in':
      return {
        ...base,
        primaryGoals: ['All of the above', ...PRIMARY_GOAL_OPTIONS.filter((option) => option !== 'All of the above')],
        routineIntensity: 'Balanced',
        mealPreference: 'Plan weeknights only',
        groceryMode: 'Mix',
        groceryStore: current.groceryStore || 'Instacart',
        choreStyle: 'Rotating schedule',
        reminderStyle: 'Normal',
        fitnessLevel: current.fitnessLevel || 'Beginner',
        workoutFrequency: '3-5',
        workoutLocation: 'Both',
        nutritionTracking: current.nutritionTracking || 'Track protein only',
        hydrationTracking: current.hydrationTracking || 'Daily water goal',
      };
    default:
      return base;
  }
}

function applyTemplateToOnboarding(templateSlug: string, current: OnboardingAnswers): OnboardingAnswers {
  switch (templateSlug) {
    case 'busy-family-weeknight-system':
      return applyPresetToOnboarding('busy-family', {
        ...current,
        mealPreference: 'Plan weeknights only',
        nutritionTracking: 'Track protein only',
      });
    case 'lean-grocery-budget-mode':
      return {
        ...current,
        primaryGoals: ['Meals & groceries'],
        groceryMode: 'Pickup',
        groceryStore: 'Walmart',
        mealPreference: 'Plan weeknights only',
      };
    case 'kids-chores-points-loop':
      return {
        ...current,
        primaryGoals: ['Chores & routines', 'Family calendar & tasks'],
        choreStyle: 'Rotating schedule',
        reminderStyle: 'Persistent (keep nudging me)',
      };
    case 'family-weekly-reset-board':
      return {
        ...current,
        primaryGoals: ['Family calendar & tasks', 'Chores & routines'],
        routineIntensity: 'Highly organized',
      };
    case 'three-day-family-fitness':
      return {
        ...current,
        primaryGoals: ['Fitness & workouts', 'Meals & groceries'],
        fitnessLevel: 'Beginner',
        workoutFrequency: '3-5',
        workoutLocation: 'Both',
      };
    case 'protein-water-consistency':
      return {
        ...current,
        nutritionTracking: 'Track protein only',
        hydrationTracking: 'Daily water goal',
        stepGoal: current.stepGoal || '8,000',
      };
    default:
      return current;
  }
}

function parseKids(kids: KidCount | null): number {
  if (!kids) return 0;
  if (kids === '5+') return 5;
  return Number.parseInt(kids, 10) || 0;
}

function getFamilySize(onboarding: OnboardingAnswers): number {
  switch (onboarding.householdType) {
    case 'Just me':
      return 1;
    case 'Me + partner':
      return 2;
    case 'Roommates':
      return 3;
    case 'Family':
      return Math.max(2, 2 + parseKids(onboarding.kidCount));
    default:
      return 1;
  }
}

function mapReminderProfile(style: ReminderStyle | null): ReminderProfile {
  if (style === 'Minimal') return 'minimal';
  if (style === 'Persistent (keep nudging me)') return 'persistent';
  return 'normal';
}

function buildEnabledModules(onboarding: OnboardingAnswers): PlanModule[] {
  const modules = new Set<PlanModule>();

  if (onboarding.primaryGoals.includes('All of the above')) {
    modules.add('meals');
    modules.add('groceries');
    modules.add('chores');
    modules.add('tasks');
    modules.add('workouts');
  } else {
    if (onboarding.primaryGoals.includes('Meals & groceries')) {
      modules.add('meals');
      modules.add('groceries');
    }
    if (onboarding.primaryGoals.includes('Chores & routines')) {
      modules.add('chores');
    }
    if (onboarding.primaryGoals.includes('Family calendar & tasks')) {
      modules.add('tasks');
    }
    if (onboarding.primaryGoals.includes('Fitness & workouts')) {
      modules.add('workouts');
    }
  }

  if (onboarding.mealPreference === 'No meal planning') {
    modules.delete('meals');
  }
  if (onboarding.mealPreference === 'Just generate grocery lists') {
    modules.delete('meals');
    modules.add('groceries');
  }

  if (onboarding.reminderToggles.tasks) modules.add('tasks');
  if (onboarding.reminderToggles.groceries) modules.add('groceries');
  if (onboarding.reminderToggles.meals && onboarding.mealPreference !== 'No meal planning') modules.add('meals');
  if (onboarding.reminderToggles.chores) modules.add('chores');
  if (onboarding.reminderToggles.workouts && hasFitnessGoal(onboarding)) modules.add('workouts');

  const order: PlanModule[] = ['meals', 'groceries', 'chores', 'tasks', 'workouts'];
  return order.filter((module) => modules.has(module));
}

function buildSuggestedLists(onboarding: OnboardingAnswers, enabledModules: PlanModule[]): string[] {
  const items: string[] = [];

  if (enabledModules.includes('meals') && enabledModules.includes('groceries')) {
    items.push("This week's meal plan + grocery list");
  } else if (enabledModules.includes('groceries')) {
    items.push('Weekly grocery staples list');
  }

  if (enabledModules.includes('chores')) {
    items.push(
      onboarding.choreStyle === 'Rotating schedule'
        ? 'Chore schedule (rotating)'
        : onboarding.choreStyle === 'Fixed responsibilities'
        ? 'Chore schedule (fixed responsibilities)'
        : 'Starter chores board (set up later)',
    );
  }

  if (enabledModules.includes('tasks')) {
    items.push('Top 5 tasks to set up');
  }

  if (enabledModules.includes('workouts')) {
    const freq = onboarding.workoutFrequency || '3-5';
    items.push(`Workout plan (${freq} days/week)`);
  }

  if (onboarding.nutritionTracking === 'Track full macros') {
    items.push('Macro targets dashboard (calories, protein, carbs, fats)');
  } else if (onboarding.nutritionTracking === 'Track protein only') {
    items.push('Protein-first scoreboard and streaks');
  } else if (onboarding.nutritionTracking === 'Track calories only') {
    items.push('Daily calorie budget tracker');
  }

  if (onboarding.hydrationTracking === 'Daily water goal') {
    items.push('Daily hydration target reminder');
  }
  if (onboarding.stepGoal && onboarding.stepGoal !== 'No step goal') {
    items.push(`Step goal tracker (${onboarding.stepGoal} per day)`);
  }
  if (onboarding.sleepGoal && onboarding.sleepGoal !== 'No sleep target') {
    items.push(`Sleep target check-in (${onboarding.sleepGoal})`);
  }
  if (onboarding.alcoholGoal && onboarding.alcoholGoal !== 'Not tracking') {
    items.push(`Alcohol habit target (${onboarding.alcoholGoal})`);
  }

  if (items.length < 3) {
    items.push('Morning routine checklist');
  }
  if (items.length < 4) {
    items.push('Evening reset checklist');
  }

  return items.slice(0, 5);
}

function buildPersonalizedPlan(onboarding: OnboardingAnswers): PersonalizedPlan {
  const enabledModules = buildEnabledModules(onboarding);

  const intensity = onboarding.routineIntensity === 'Light touch'
    ? 'light'
    : onboarding.routineIntensity === 'Highly organized'
    ? 'high'
    : 'balanced';

  const workoutDays = onboarding.workoutFrequency === '0-2' ? 2 : onboarding.workoutFrequency === '6+' ? 6 : 4;

  const schedules =
    intensity === 'light'
      ? {
          intensity,
          planningCadence: 'Weekly check-in every Sunday evening',
          reminderMoments: ['8:00 AM', '6:00 PM'],
          defaultWorkoutDays: workoutDays,
        }
      : intensity === 'high'
      ? {
          intensity,
          planningCadence: 'Weekly planning + midweek adjustment',
          reminderMoments: ['7:30 AM', '12:00 PM', '6:00 PM'],
          defaultWorkoutDays: workoutDays,
        }
      : {
          intensity,
          planningCadence: 'Weekly planning block on Sunday',
          reminderMoments: ['8:00 AM', '6:00 PM', '8:30 PM'],
          defaultWorkoutDays: workoutDays,
        };

  return {
    enabledModules,
    defaultSchedules: schedules,
    suggestedLists: buildSuggestedLists(onboarding, enabledModules),
    reminderProfile: mapReminderProfile(onboarding.reminderStyle),
  };
}

function isStepComplete(step: StepId, onboarding: OnboardingAnswers): boolean {
  switch (step) {
    case 'welcome':
      return true;
    case 'preset':
      return onboarding.onboardingPreset !== null;
    case 'primaryGoals':
      return onboarding.primaryGoals.length > 0;
    case 'household':
      return onboarding.householdType !== null;
    case 'kidCount':
      return onboarding.kidCount !== null;
    case 'role':
      return onboarding.role !== null;
    case 'intensity':
      return onboarding.routineIntensity !== null;
    case 'meal':
      return onboarding.mealPreference !== null;
    case 'groceryMode':
      return onboarding.groceryMode !== null;
    case 'groceryStore':
      return onboarding.groceryStore !== null;
    case 'chores':
      return onboarding.choreStyle !== null;
    case 'reminderStyle':
      return onboarding.reminderStyle !== null;
    case 'fitnessLevel':
      return onboarding.fitnessLevel !== null;
    case 'workoutFrequency':
      return onboarding.workoutFrequency !== null;
    case 'workoutLocation':
      return onboarding.workoutLocation !== null;
    case 'nutritionTracking':
      return onboarding.nutritionTracking !== null;
    case 'hydrationTracking':
      return onboarding.hydrationTracking !== null;
    case 'stepGoal':
      return onboarding.stepGoal !== null;
    case 'sleepGoal':
      return onboarding.sleepGoal !== null;
    case 'alcoholGoal':
      return onboarding.alcoholGoal !== null;
    case 'notifications':
    case 'value':
    case 'plan':
      return true;
    default:
      return false;
  }
}

function singleSelection<T extends string>(value: T | null): T[] {
  return value ? [value] : [];
}

function presetFromOption(option: (typeof ONBOARDING_PRESET_OPTIONS)[number]): NonNullable<OnboardingAnswers['onboardingPreset']> {
  if (option === 'Busy family') return 'busy-family';
  if (option === 'Fitness focused') return 'fitness-focused';
  if (option === 'Chores first') return 'chores-first';
  return 'balanced-all-in';
}

function presetToOption(preset: OnboardingAnswers['onboardingPreset']): (typeof ONBOARDING_PRESET_OPTIONS)[number] | null {
  if (preset === 'busy-family') return 'Busy family';
  if (preset === 'fitness-focused') return 'Fitness focused';
  if (preset === 'chores-first') return 'Chores first';
  if (preset === 'balanced-all-in') return 'Balanced all-in';
  return null;
}

function humanizeEmail(email?: string | null): string {
  if (!email) return 'Home Harmony User';
  const prefix = email.split('@')[0] || 'Home Harmony User';
  return prefix
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function deriveDietaryPreferences(onboarding: OnboardingAnswers): string[] {
  const choices = new Set<string>();
  if (onboarding.householdType === 'Family') choices.add('Kid Friendly');
  if (hasFitnessGoal(onboarding) || onboarding.nutritionTracking === 'Track protein only' || onboarding.nutritionTracking === 'Track full macros') {
    choices.add('High Protein');
  }
  if (onboarding.mealPreference === 'No meal planning') choices.add('Low Carb');
  if (choices.size === 0) choices.add('Kid Friendly');
  return Array.from(choices);
}

function buildGoalsText(onboarding: OnboardingAnswers, plan: PersonalizedPlan): string {
  const goals = onboarding.primaryGoals
    .filter((goal) => goal !== 'All of the above')
    .slice(0, 3)
    .join(', ')
    .toLowerCase();

  const coreGoal = goals || 'home routines';
  const mealLine = onboarding.mealPreference ? `Meals: ${onboarding.mealPreference}.` : '';
  const groceryLine = onboarding.groceryMode ? `Groceries: ${onboarding.groceryMode}${onboarding.groceryStore ? ` via ${onboarding.groceryStore}` : ''}.` : '';
  const structureLine = onboarding.routineIntensity ? `Structure: ${onboarding.routineIntensity}.` : '';
  const nutritionLine = onboarding.nutritionTracking ? `Nutrition: ${onboarding.nutritionTracking}.` : '';
  const lifestyleLine = [
    onboarding.hydrationTracking ? `Water: ${onboarding.hydrationTracking}` : null,
    onboarding.stepGoal ? `Steps: ${onboarding.stepGoal}` : null,
    onboarding.sleepGoal ? `Sleep: ${onboarding.sleepGoal}` : null,
    onboarding.alcoholGoal ? `Alcohol: ${onboarding.alcoholGoal}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return `Priorities: ${coreGoal}. ${mealLine} ${groceryLine} ${structureLine} ${nutritionLine} ${lifestyleLine ? `Lifestyle: ${lifestyleLine}.` : ''} Modules: ${plan.enabledModules.join(', ')}.`
    .replace(/\s+/g, ' ')
    .trim();
}

export default function OnboardingPage() {
  const { user, profile, profileLoading, isProfileComplete, isSubscribed, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forceOnboarding = searchParams.get('force') === '1';
  const { toast } = useToast();

  const draft = useMemo(() => loadOnboardingDraft(user?.id), [user?.id]);
  const [onboarding, setOnboarding] = useState<OnboardingAnswers>(
    draft?.onboarding ? ({ ...DEFAULT_ONBOARDING, ...draft.onboarding } as OnboardingAnswers) : DEFAULT_ONBOARDING,
  );
  const [currentStepId, setCurrentStepId] = useState<StepId>(
    draft?.stepId ? (draft.stepId as StepId) : 'welcome',
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const steps = useMemo(() => buildSteps(onboarding), [onboarding]);
  const stepIndex = Math.max(0, steps.indexOf(currentStepId));
  const progress = (stepIndex + 1) / steps.length;
  const personalizedPlan = useMemo(() => buildPersonalizedPlan(onboarding), [onboarding]);

  useEffect(() => {
    if (forceOnboarding || profileLoading || !isProfileComplete) return;
    navigate(getPostAuthRoute(isSubscribed), { replace: true });
  }, [forceOnboarding, isProfileComplete, isSubscribed, navigate, profileLoading]);

  useEffect(() => {
    if (!steps.includes(currentStepId)) {
      setCurrentStepId('notifications');
    }
  }, [currentStepId, steps]);

  useEffect(() => {
    saveOnboardingDraft(user?.id, {
      onboarding: onboarding as unknown as Record<string, unknown>,
      stepId: currentStepId,
    });
  }, [currentStepId, onboarding, user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(PENDING_TEMPLATE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { slug?: string };
      if (parsed?.slug) {
        setOnboarding((prev) => applyTemplateToOnboarding(parsed.slug || '', prev));
      }
    } catch {
      // ignore malformed template payload
    } finally {
      window.localStorage.removeItem(PENDING_TEMPLATE_KEY);
    }
  }, []);

  const goBack = () => {
    if (submitting) return;
    const idx = steps.indexOf(currentStepId);
    if (idx <= 0) {
      navigate('/signin', { replace: true });
      return;
    }
    setCurrentStepId(steps[idx - 1]);
  };

  const goNext = () => {
    const idx = steps.indexOf(currentStepId);
    const next = steps[idx + 1];
    if (next) setCurrentStepId(next);
  };

  const togglePrimaryGoal = (goal: PrimaryGoal) => {
    setOnboarding((prev) => {
      if (goal === 'All of the above') {
        if (prev.primaryGoals.includes(goal)) {
          return { ...prev, primaryGoals: [] };
        }
        return { ...prev, primaryGoals: [...PRIMARY_GOAL_OPTIONS] };
      }

      const withoutAll = prev.primaryGoals.filter((item) => item !== 'All of the above');
      if (withoutAll.includes(goal)) {
        return { ...prev, primaryGoals: withoutAll.filter((item) => item !== goal) };
      }
      if (withoutAll.length >= 3) {
        return prev;
      }
      return { ...prev, primaryGoals: [...withoutAll, goal] };
    });
  };

  const setSingle = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
    setOnboarding((prev) => ({ ...prev, [key]: value }));
  };

  const toggleReminder = (key: keyof OnboardingAnswers['reminderToggles']) => {
    setOnboarding((prev) => ({
      ...prev,
      reminderToggles: {
        ...prev.reminderToggles,
        [key]: !prev.reminderToggles[key],
      },
    }));
  };

  const completeOnboarding = async () => {
    if (!user) {
      navigate('/signin', { replace: true });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);

    try {
      const familySize = getFamilySize(onboarding);
      const dietaryPreferences = deriveDietaryPreferences(onboarding);
      const fullName =
        profile?.fullName?.trim() ||
        (typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name.trim() : '') ||
        humanizeEmail(user.email);
      const householdName =
        profile?.householdName?.trim() ||
        (onboarding.householdType ? `${onboarding.householdType} Home` : null);
      const goals = buildGoalsText(onboarding, personalizedPlan);

      await updateProfile({
        full_name: fullName,
        household_name: householdName,
        family_size: familySize,
        goals,
        dietary_preferences: dietaryPreferences,
      });

      try {
        await createOrGetHousehold(householdName || undefined);
      } catch (householdError) {
        console.error('Household setup failed during onboarding:', householdError);
        // Household can be created later in Family page; do not block onboarding completion.
      }

      const payload: StoredOnboardingResult = {
        completedAt: new Date().toISOString(),
        onboarding: onboarding as unknown as Record<string, unknown>,
        personalizedPlan: personalizedPlan as unknown as Record<string, unknown>,
      };
      await saveOnboardingResult(user.id, payload);

      if (personalizedPlan.enabledModules.includes('meals') || personalizedPlan.enabledModules.includes('groceries')) {
        setPlanRules({
          preferFavorites: true,
          preferKidFriendly: onboarding.householdType === 'Family',
          maxCookMinutes: onboarding.onboardingPreset === 'busy-family' ? 30 : null,
          dayLocks: {},
        });
      }

      await trackGrowthEventSafe(
        'onboarding_complete',
        {
          modules: personalizedPlan.enabledModules,
          reminderProfile: personalizedPlan.reminderProfile,
          preset: onboarding.onboardingPreset,
        },
        `onboarding_complete:${user.id}`,
      );

      clearOnboardingDraft(user.id);

      navigate('/getting-started', { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not finish onboarding. Please try again.';
      setSubmitError(message);
      toast({
        title: 'Unable to finish setup',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const enableReminders = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (window.Notification.permission === 'default') {
          await window.Notification.requestPermission();
        }
      } catch {
        // no-op: store opt-in regardless; browser may deny silently
      }
    }

    setOnboarding((prev) => ({ ...prev, notificationsOptIn: true }));
    goNext();
  };

  const skipReminders = () => {
    setOnboarding((prev) => ({ ...prev, notificationsOptIn: false }));
    goNext();
  };

  const limitReached = !onboarding.primaryGoals.includes('All of the above')
    && onboarding.primaryGoals.filter((item) => item !== 'All of the above').length >= 3;
  const disabledPrimaryOptions = limitReached
    ? PRIMARY_GOAL_OPTIONS.filter((option) => !onboarding.primaryGoals.includes(option) && option !== 'All of the above')
    : [];

  let content = null;
  let footer = null;

  switch (currentStepId) {
    case 'welcome': {
      content = (
        <QuestionScreen
          title="Build a home plan you'll actually use"
          helper="A few quick questions to tailor your dashboard and reminders."
          align="center"
        >
          <div className="h-full grid place-items-center">
            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center max-w-md">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Fast setup. No long form. Your personalized home plan in about 60-120 seconds.
              </p>
            </div>
          </div>
        </QuestionScreen>
      );

      footer = <BottomCTA primaryLabel="Get started" onPrimary={goNext} />;
      break;
    }

    case 'preset': {
      content = (
        <QuestionScreen
          title="Pick your starting style"
          helper="One tap gives you smart defaults. You can edit everything later."
        >
          <OptionList
            options={ONBOARDING_PRESET_OPTIONS}
            selected={singleSelection(presetToOption(onboarding.onboardingPreset))}
            onToggle={(value) =>
              setOnboarding((prev) => applyPresetToOnboarding(presetFromOption(value), prev))
            }
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('preset', onboarding)}
        />
      );
      break;
    }

    case 'primaryGoals': {
      content = (
        <QuestionScreen
          title="What do you want help with most?"
          helper="Pick up to 3 - you can change this anytime."
        >
          <OptionList
            options={PRIMARY_GOAL_OPTIONS}
            selected={onboarding.primaryGoals}
            onToggle={togglePrimaryGoal}
            multi
            disabledOptions={disabledPrimaryOptions}
          />
          {limitReached && (
            <p className="mt-3 text-xs text-muted-foreground">You can pick up to 3, or tap "All of the above".</p>
          )}
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('primaryGoals', onboarding)}
        />
      );
      break;
    }

    case 'household': {
      content = (
        <QuestionScreen title="Who are we planning for?">
          <OptionList
            options={HOUSEHOLD_OPTIONS}
            selected={singleSelection(onboarding.householdType)}
            onToggle={(value) => {
              setSingle('householdType', value);
              if (value !== 'Family') {
                setSingle('kidCount', null);
              }
            }}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('household', onboarding)}
        />
      );
      break;
    }

    case 'kidCount': {
      content = (
        <QuestionScreen title="How many kids?">
          <OptionList
            options={KID_COUNT_OPTIONS}
            selected={singleSelection(onboarding.kidCount)}
            onToggle={(value) => setSingle('kidCount', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('kidCount', onboarding)}
        />
      );
      break;
    }

    case 'role': {
      content = (
        <QuestionScreen title="What's your role at home?">
          <OptionList
            options={ROLE_OPTIONS}
            selected={singleSelection(onboarding.role)}
            onToggle={(value) => setSingle('role', value)}
          />
        </QuestionScreen>
      );

      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('role', onboarding)} />;
      break;
    }

    case 'intensity': {
      content = (
        <QuestionScreen title="How structured do you want your week?">
          <OptionList
            options={INTENSITY_OPTIONS}
            selected={singleSelection(onboarding.routineIntensity)}
            onToggle={(value) => setSingle('routineIntensity', value)}
          />
          <p className="mt-4 text-sm text-muted-foreground">
            This controls how many reminders and suggested routines we create.
          </p>
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('intensity', onboarding)}
        />
      );
      break;
    }

    case 'meal': {
      content = (
        <QuestionScreen title="How do you want meals to work?">
          <OptionList
            options={MEAL_OPTIONS}
            selected={singleSelection(onboarding.mealPreference)}
            onToggle={(value) => setSingle('mealPreference', value)}
          />
        </QuestionScreen>
      );

      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('meal', onboarding)} />;
      break;
    }

    case 'groceryMode': {
      content = (
        <QuestionScreen title="How do you shop?">
          <OptionList
            options={GROCERY_MODE_OPTIONS}
            selected={singleSelection(onboarding.groceryMode)}
            onToggle={(value) => {
              setSingle('groceryMode', value);
              if (value === 'In-store') {
                setSingle('groceryStore', null);
              }
            }}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('groceryMode', onboarding)}
        />
      );
      break;
    }

    case 'groceryStore': {
      content = (
        <QuestionScreen title="Where do you order groceries?">
          <OptionList
            options={GROCERY_STORE_OPTIONS}
            selected={singleSelection(onboarding.groceryStore)}
            onToggle={(value) => setSingle('groceryStore', value)}
          />
          <p className="mt-4 text-xs text-muted-foreground">No integration needed yet - we save this for future one-tap ordering.</p>
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('groceryStore', onboarding)}
        />
      );
      break;
    }

    case 'chores': {
      content = (
        <QuestionScreen title="How do you want chores assigned?">
          <OptionList
            options={CHORE_OPTIONS}
            selected={singleSelection(onboarding.choreStyle)}
            onToggle={(value) => setSingle('choreStyle', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('chores', onboarding)}
        />
      );
      break;
    }

    case 'reminderStyle': {
      content = (
        <QuestionScreen
          title="How should reminders feel?"
          helper="You can snooze or mute anytime."
        >
          <OptionList
            options={REMINDER_STYLE_OPTIONS}
            selected={singleSelection(onboarding.reminderStyle)}
            onToggle={(value) => setSingle('reminderStyle', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('reminderStyle', onboarding)}
        />
      );
      break;
    }

    case 'fitnessLevel': {
      content = (
        <QuestionScreen title="What's your fitness level?">
          <OptionList
            options={FITNESS_LEVEL_OPTIONS}
            selected={singleSelection(onboarding.fitnessLevel)}
            onToggle={(value) => setSingle('fitnessLevel', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('fitnessLevel', onboarding)}
        />
      );
      break;
    }

    case 'workoutFrequency': {
      content = (
        <QuestionScreen title="How many workouts per week?">
          <OptionList
            options={WORKOUT_FREQ_OPTIONS}
            selected={singleSelection(onboarding.workoutFrequency)}
            onToggle={(value) => setSingle('workoutFrequency', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('workoutFrequency', onboarding)}
        />
      );
      break;
    }

    case 'workoutLocation': {
      content = (
        <QuestionScreen title="Where do you work out?">
          <OptionList
            options={WORKOUT_LOCATION_OPTIONS}
            selected={singleSelection(onboarding.workoutLocation)}
            onToggle={(value) => setSingle('workoutLocation', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('workoutLocation', onboarding)}
        />
      );
      break;
    }

    case 'nutritionTracking': {
      content = (
        <QuestionScreen title="How do you want to track nutrition?">
          <OptionList
            options={NUTRITION_TRACKING_OPTIONS}
            selected={singleSelection(onboarding.nutritionTracking)}
            onToggle={(value) => setSingle('nutritionTracking', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('nutritionTracking', onboarding)}
        />
      );
      break;
    }

    case 'hydrationTracking': {
      content = (
        <QuestionScreen title="Do you want to track water?">
          <OptionList
            options={HYDRATION_OPTIONS}
            selected={singleSelection(onboarding.hydrationTracking)}
            onToggle={(value) => setSingle('hydrationTracking', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('hydrationTracking', onboarding)}
        />
      );
      break;
    }

    case 'stepGoal': {
      content = (
        <QuestionScreen title="What daily step goal do you want?">
          <OptionList
            options={STEP_GOAL_OPTIONS}
            selected={singleSelection(onboarding.stepGoal)}
            onToggle={(value) => setSingle('stepGoal', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('stepGoal', onboarding)}
        />
      );
      break;
    }

    case 'sleepGoal': {
      content = (
        <QuestionScreen title="Do you want a sleep target?">
          <OptionList
            options={SLEEP_GOAL_OPTIONS}
            selected={singleSelection(onboarding.sleepGoal)}
            onToggle={(value) => setSingle('sleepGoal', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('sleepGoal', onboarding)}
        />
      );
      break;
    }

    case 'alcoholGoal': {
      content = (
        <QuestionScreen title="Do you want to track alcohol habits?">
          <OptionList
            options={ALCOHOL_GOAL_OPTIONS}
            selected={singleSelection(onboarding.alcoholGoal)}
            onToggle={(value) => setSingle('alcoholGoal', value)}
          />
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('alcoholGoal', onboarding)}
        />
      );
      break;
    }

    case 'notifications': {
      content = (
        <QuestionScreen
          title="Stay on track"
          helper="Choose what you want reminders for."
        >
          <div className="space-y-3">
            {([
              ['tasks', 'Tasks'],
              ['groceries', 'Groceries'],
              ['meals', 'Meals'],
              ['chores', 'Chores'],
              ['workouts', 'Workouts'],
            ] as const).map(([key, label]) => (
              <label key={key} className="w-full rounded-2xl border border-border px-4 py-3 flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch checked={onboarding.reminderToggles[key]} onCheckedChange={() => toggleReminder(key)} />
              </label>
            ))}
          </div>
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Enable reminders"
          onPrimary={enableReminders}
          secondaryLabel="Not now"
          onSecondary={skipReminders}
        />
      );
      break;
    }

    case 'value': {
      content = (
        <QuestionScreen
          title="You're all set"
          helper="We built your dashboard, routines, and lists based on your answers."
          align="center"
        >
          <div className="h-full grid place-items-center">
            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center max-w-md">
              <CheckCircle2 className="w-8 h-8 text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Smart defaults are ready. You can edit anything later from settings.
              </p>
            </div>
          </div>
        </QuestionScreen>
      );

      footer = <BottomCTA primaryLabel="See my home plan" onPrimary={goNext} />;
      break;
    }

    case 'plan': {
      content = (
        <QuestionScreen title="Your Home Plan">
          <div className="space-y-3">
            {personalizedPlan.suggestedLists.map((item) => (
              <div key={item} className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
                {item}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-border p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Enabled modules</p>
            <div className="flex flex-wrap gap-2">
              {personalizedPlan.enabledModules.map((module) => (
                <span key={module} className="rounded-full border border-border px-3 py-1 text-xs capitalize">
                  {module}
                </span>
              ))}
            </div>
          </div>
          {submitError && (
            <p className="mt-4 text-sm text-destructive">{submitError}</p>
          )}
        </QuestionScreen>
      );

      footer = (
        <BottomCTA
          primaryLabel="Finish"
          onPrimary={completeOnboarding}
          secondaryLabel="Edit answers"
          onSecondary={() => setCurrentStepId('primaryGoals')}
          loading={submitting}
        />
      );
      break;
    }

    default:
      content = null;
      footer = null;
      break;
  }

  const canContinue = isStepComplete(currentStepId, onboarding);

  return (
    <OnboardingShell
      progress={progress}
      canGoBack={!submitting}
      onBack={goBack}
      footer={footer || <Button onClick={goNext} disabled={!canContinue}>Continue</Button>}
    >
      {content}
    </OnboardingShell>
  );
}
