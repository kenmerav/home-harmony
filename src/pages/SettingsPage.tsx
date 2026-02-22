import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { OptionList } from '@/components/onboarding/OptionList';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { loadOnboardingResult, saveOnboardingResult, type StoredOnboardingResult } from '@/lib/onboardingStore';

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
const WORKOUT_FREQ_OPTIONS = ['0-2', '3-5', '6+'] as const;
const WORKOUT_LOCATION_OPTIONS = ['Home', 'Gym', 'Both'] as const;
const NUTRITION_TRACKING_OPTIONS = ['Track full macros', 'Track protein only', 'Track calories only', 'Skip nutrition tracking'] as const;
const HYDRATION_OPTIONS = ['Daily water goal', 'Casual water tracking', 'Not now'] as const;
const STEP_GOAL_OPTIONS = ['5,000', '8,000', '10,000', '12,000+', 'No step goal'] as const;
const SLEEP_GOAL_OPTIONS = ['7 hours', '8 hours', '9+ hours', 'No sleep target'] as const;
const ALCOHOL_GOAL_OPTIONS = ['Not tracking', 'Limit to weekends', 'Limit drinks per week', 'Reduce as much as possible'] as const;

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

const DEFAULT_ANSWERS: OnboardingAnswers = {
  primaryGoals: ['Meals & groceries', 'Chores & routines', 'Family calendar & tasks'],
  householdType: 'Family',
  kidCount: '2',
  role: 'Primary planner',
  routineIntensity: 'Balanced',
  mealPreference: 'Plan weeknights only',
  groceryMode: 'Pickup',
  groceryStore: 'Walmart',
  choreStyle: 'Rotating schedule',
  reminderStyle: 'Normal',
  workoutFrequency: '3-5',
  workoutLocation: 'Both',
  nutritionTracking: 'Track protein only',
  hydrationTracking: 'Daily water goal',
  stepGoal: '8,000',
  sleepGoal: '8 hours',
  alcoholGoal: 'Limit to weekends',
  reminderToggles: {
    tasks: true,
    groceries: true,
    meals: true,
    chores: true,
    workouts: true,
  },
};

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
  const { user } = useAuth();
  const { toast } = useToast();
  const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULT_ANSWERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      const stored = await loadOnboardingResult(user?.id);
      if (!mounted) return;
      if (stored?.onboarding && typeof stored.onboarding === 'object') {
        setAnswers((prev) => ({ ...prev, ...(stored.onboarding as Partial<OnboardingAnswers>) }));
      }
      setLoading(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

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

  const save = async () => {
    const payload: StoredOnboardingResult = {
      completedAt: new Date().toISOString(),
      onboarding: answers as unknown as Record<string, unknown>,
      personalizedPlan: buildPersonalizedPlan(answers) as unknown as Record<string, unknown>,
    };
    try {
      await saveOnboardingResult(user?.id, payload);
      toast({ title: 'Settings saved', description: 'Onboarding preferences were updated.' });
    } catch (error: unknown) {
      toast({
        title: 'Could not save settings',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Settings" subtitle="Edit onboarding preferences and lifestyle targets" />
        <p className="text-sm text-muted-foreground">Loading your settings...</p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Settings"
        subtitle="Edit onboarding preferences and lifestyle targets"
        action={<Button onClick={save}>Save Changes</Button>}
      />

      <div className="space-y-6">
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

        <div className="flex flex-wrap gap-3">
          <Button onClick={save}>Save Changes</Button>
          <Link to="/onboarding?force=1">
            <Button variant="outline">Re-run Full Onboarding</Button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
