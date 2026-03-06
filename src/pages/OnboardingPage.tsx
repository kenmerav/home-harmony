import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, HeartHandshake, ShoppingBasket, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { createOrGetHousehold } from '@/lib/api/family';
import { trackGrowthEventSafe } from '@/lib/api/growthAnalytics';
import { seedStarterRecipesIfEmpty } from '@/lib/api/recipes';
import {
  buildPersonalizedDinnerWeek,
  buildPersonalizedGroceryPreview,
  type StarterRecipeProfile,
} from '@/data/starterDinnerRecipes';
import { defaultSmsPreferences, saveSmsPreferences } from '@/lib/api/sms';
import { useToast } from '@/hooks/use-toast';
import { BILLING_ENABLED, getPostAuthRoute } from '@/lib/billing';
import { setPlanRules } from '@/lib/mealPrefs';
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

const PAIN_POINT_OPTIONS = [
  'Figuring out dinner every night',
  'Keeping up with the family schedule',
  'Grocery planning and follow-through',
  'Reducing the mental load',
  'Managing sports/school/activity logistics',
  'Building better routines',
] as const;

const WEEKLY_RHYTHM_OPTIONS = [
  'Sports-heavy week',
  'After-school activities most days',
  'Mostly home in evenings',
  'Unpredictable schedule',
  'Fast-paced work week',
] as const;

const MEAL_STYLE_OPTIONS = [
  'Healthy and easy',
  'Quick meals',
  'Family-friendly',
  'Kid-friendly',
  'High protein',
  'Budget-friendly',
  'Comfort food',
  'Mix of everything',
] as const;

const DIET_PREFERENCE_OPTIONS = [
  'No specific diet',
  'Low carb',
  'Gluten free',
  'Dairy free',
  'Vegetarian',
  'Pescatarian',
  'Paleo',
  'Organic-first',
  'Mix of everything',
] as const;

const FOOD_RESTRICTION_OPTIONS = ['No pork', 'No beef', 'Allergy-aware'] as const;
const KID_AGE_RANGE_OPTIONS = ['0-4', '5-8', '9-12', '13-17'] as const;
const WEEKLY_STAPLE_OPTIONS = [
  'Taco Tuesday',
  'Pizza Friday',
  'Pasta night',
  'Soup night',
  'Breakfast for dinner',
  'Leftover night',
  'Other staple',
] as const;

const GROCERY_STORE_OPTIONS = [
  "Fry's",
  'Safeway',
  'Whole Foods',
  'Kroger',
  'Target',
  'Walmart',
  'Costco',
  'Instacart',
] as const;

const GROCERY_MODE_OPTIONS = ['In-store', 'Pickup', 'Delivery', 'Mix'] as const;

const PLANNING_STYLE_OPTIONS = [
  'Suggest meals for me',
  'Let me choose from ideas',
  'I mostly build my own plan',
] as const;

const GROCERY_PAIN_OPTIONS = [
  'Yes, I am tired of bouncing between recipes and grocery lists',
  'Sometimes, depending on the week',
  'No, grocery flow is fine right now',
] as const;

const CHORE_PAIN_OPTIONS = [
  'Yes, I am tired of repeating chores and reminders',
  'Sometimes, chores get missed',
  'No, chores are under control',
] as const;

const HEALTH_TRACKING_OPTIONS = [
  'Workout tracking',
  'Calorie tracking',
  'Macro tracking',
  'Protein-only tracking',
  'Goal tracking (water, steps, alcohol)',
  'Not right now',
] as const;

const WELLNESS_GOAL_OPTIONS = [
  'Increase water intake',
  'Hit a daily step goal',
  'Limit alcohol',
  'Improve sleep consistency',
] as const;

const WATER_TARGET_OPTIONS = ['No target right now', '64 oz', '80 oz', '100 oz+'] as const;
const STEP_TARGET_OPTIONS = ['No target right now', '5,000', '8,000', '10,000', '12,000+'] as const;
const ALCOHOL_TARGET_OPTIONS = [
  'Not tracking',
  'Limit to weekends',
  'Max 3 drinks/week',
  'Max 1 drink/day',
] as const;

const MORNING_TEXT_OPTIONS = [
  'Yes, send me a daily schedule text each morning',
  'No, skip morning schedule texts',
] as const;

const APPOINTMENT_REMINDER_OPTIONS = [
  'No reminders',
  '30 minutes before',
  '1 hour before',
  'Both 1 hour and 30 minutes',
] as const;

const DESIRED_OUTCOME_OPTIONS = [
  'Calmer evenings',
  'Less decision fatigue',
  'Easier dinners',
  'More organized weeks',
  'Smoother school/sports logistics',
] as const;

type MainPainPoint = (typeof PAIN_POINT_OPTIONS)[number];
type WeeklyRhythm = (typeof WEEKLY_RHYTHM_OPTIONS)[number];
type MealStylePreference = (typeof MEAL_STYLE_OPTIONS)[number];
type DietPreference = (typeof DIET_PREFERENCE_OPTIONS)[number];
type FoodRestriction = (typeof FOOD_RESTRICTION_OPTIONS)[number];
type KidAgeRange = (typeof KID_AGE_RANGE_OPTIONS)[number];
type WeeklyStaple = (typeof WEEKLY_STAPLE_OPTIONS)[number];
type GroceryStorePreference = (typeof GROCERY_STORE_OPTIONS)[number];
type GroceryMode = (typeof GROCERY_MODE_OPTIONS)[number];
type PlanningStyle = (typeof PLANNING_STYLE_OPTIONS)[number];
type GroceryPain = (typeof GROCERY_PAIN_OPTIONS)[number];
type ChorePain = (typeof CHORE_PAIN_OPTIONS)[number];
type HealthTrackingFocus = (typeof HEALTH_TRACKING_OPTIONS)[number];
type WellnessGoal = (typeof WELLNESS_GOAL_OPTIONS)[number];
type WaterTarget = (typeof WATER_TARGET_OPTIONS)[number];
type StepTarget = (typeof STEP_TARGET_OPTIONS)[number];
type AlcoholTarget = (typeof ALCOHOL_TARGET_OPTIONS)[number];
type MorningTextChoice = (typeof MORNING_TEXT_OPTIONS)[number];
type AppointmentReminder = (typeof APPOINTMENT_REMINDER_OPTIONS)[number];
type DesiredOutcome = (typeof DESIRED_OUTCOME_OPTIONS)[number];

type StepId =
  | 'welcome'
  | 'painPoint'
  | 'aha'
  | 'household'
  | 'kidAgeRanges'
  | 'weeklyRhythm'
  | 'mealStyles'
  | 'dietPreferences'
  | 'foodRestrictions'
  | 'avoidFoods'
  | 'weeklyStaples'
  | 'recipesToImplement'
  | 'planningStyle'
  | 'groceryPreferences'
  | 'groceryPain'
  | 'choresPain'
  | 'healthTracking'
  | 'goalTracking'
  | 'scheduleText'
  | 'appointmentReminders'
  | 'desiredOutcome'
  | 'mirror'
  | 'experience'
  | 'commitment'
  | 'paywallPrep'
  | 'account';

type PlanModule = 'meals' | 'groceries' | 'chores' | 'tasks' | 'workouts';

interface OnboardingAnswers {
  adultsCount: number;
  kidsCount: number;
  kidAgeRanges: KidAgeRange[];
  mainPainPoint: MainPainPoint | null;
  weeklyRhythm: WeeklyRhythm[];
  mealStylePreferences: MealStylePreference[];
  dietPreferences: DietPreference[];
  foodRestrictions: FoodRestriction[];
  avoidFoods: string;
  mealDietNotes: string;
  weeklyStaples: WeeklyStaple[];
  weeklyStaplesOther: string;
  recipesToImplement: string;
  planningStyle: PlanningStyle | null;
  groceryStorePreferences: GroceryStorePreference[];
  groceryShoppingMode: GroceryMode | null;
  groceryPain: GroceryPain | null;
  chorePain: ChorePain | null;
  healthTrackingFocus: HealthTrackingFocus[];
  wellnessGoals: WellnessGoal[];
  waterTarget: WaterTarget | null;
  stepTarget: StepTarget | null;
  alcoholTarget: AlcoholTarget | null;
  morningTextChoice: MorningTextChoice | null;
  phoneNumber: string;
  appointmentReminder: AppointmentReminder | null;
  desiredOutcome: DesiredOutcome | null;
  commitmentConfirmed: boolean;
}

interface PersonalizedPlan {
  enabledModules: PlanModule[];
  suggestedLists: string[];
  weeklyPreview: {
    dinners: Array<{ day: string; recipe: string; cookMinutes: number }>;
    groceryPreview: string[];
  };
  summary: string;
}

interface AccountDraft {
  fullName: string;
  householdName: string;
  email: string;
  password: string;
}

const DEFAULT_ONBOARDING: OnboardingAnswers = {
  adultsCount: 2,
  kidsCount: 0,
  kidAgeRanges: [],
  mainPainPoint: null,
  weeklyRhythm: [],
  mealStylePreferences: [],
  dietPreferences: [],
  foodRestrictions: [],
  avoidFoods: '',
  mealDietNotes: '',
  weeklyStaples: [],
  weeklyStaplesOther: '',
  recipesToImplement: '',
  planningStyle: null,
  groceryStorePreferences: ["Fry's"],
  groceryShoppingMode: null,
  groceryPain: null,
  chorePain: null,
  healthTrackingFocus: [],
  wellnessGoals: [],
  waterTarget: null,
  stepTarget: null,
  alcoholTarget: null,
  morningTextChoice: null,
  phoneNumber: '',
  appointmentReminder: null,
  desiredOutcome: null,
  commitmentConfirmed: false,
};

const DEFAULT_ACCOUNT: AccountDraft = {
  fullName: '',
  householdName: '',
  email: '',
  password: '',
};

const parseListText = (raw: string): string[] =>
  raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toggleWithExclusive<T extends string>(values: T[], incoming: T, exclusiveLabel: T): T[] {
  if (incoming === exclusiveLabel) {
    return values.includes(exclusiveLabel) ? [] : [exclusiveLabel];
  }
  const withoutExclusive = values.filter((item) => item !== exclusiveLabel);
  if (withoutExclusive.includes(incoming)) {
    return withoutExclusive.filter((item) => item !== incoming);
  }
  return [...withoutExclusive, incoming];
}

function toggleWithMix<T extends string>(values: T[], incoming: T, mixLabel: T): T[] {
  if (incoming === mixLabel) {
    return values.includes(mixLabel) ? [] : [mixLabel];
  }
  const withoutMix = values.filter((item) => item !== mixLabel);
  if (withoutMix.includes(incoming)) {
    return withoutMix.filter((item) => item !== incoming);
  }
  return [...withoutMix, incoming];
}

function toggleValue<T extends string>(values: T[], incoming: T): T[] {
  return values.includes(incoming) ? values.filter((item) => item !== incoming) : [...values, incoming];
}

function singleSelection<T extends string>(value: T | null): T[] {
  return value ? [value] : [];
}

function householdSummary(answers: OnboardingAnswers): string {
  const adults = `${answers.adultsCount} adult${answers.adultsCount === 1 ? '' : 's'}`;
  const kids = answers.kidsCount > 0 ? `${answers.kidsCount} kid${answers.kidsCount === 1 ? '' : 's'}` : 'no kids';
  const ageText = answers.kidAgeRanges.length > 0 ? ` (${answers.kidAgeRanges.join(', ')})` : '';
  return `${adults}, ${kids}${ageText}`;
}

function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return cleaned;
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return phone.trim();
}

function normalizeDietaryPreferences(answers: OnboardingAnswers): string[] {
  const combined = [
    ...answers.dietPreferences,
    ...answers.mealStylePreferences,
    ...answers.foodRestrictions,
    ...answers.healthTrackingFocus,
    ...answers.wellnessGoals,
  ];
  if (answers.kidsCount > 0 && !combined.includes('Kid-friendly')) {
    combined.push('Kid-friendly');
  }
  if (answers.weeklyStaples.length > 0) combined.push('Recurring staples');
  return Array.from(new Set(combined));
}

function buildDayLocks(answers: OnboardingAnswers): Partial<Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', string>> {
  const locks: Partial<Record<'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday', string>> = {};
  if (answers.weeklyStaples.includes('Taco Tuesday')) locks.tuesday = 'Taco night';
  if (answers.weeklyStaples.includes('Pizza Friday')) locks.friday = 'Pizza night';
  return locks;
}

function buildGoalsText(answers: OnboardingAnswers): string {
  const avoidFoods = parseListText(answers.avoidFoods);
  const recipeRequests = parseListText(answers.recipesToImplement);
  return [
    `Main pressure: ${answers.mainPainPoint || 'not provided'}.`,
    `Desired outcome: ${answers.desiredOutcome || 'calmer week'}.`,
    `Weekly rhythm: ${answers.weeklyRhythm.join(', ') || 'not provided'}.`,
    `Meal style: ${answers.mealStylePreferences.join(', ') || 'not provided'}.`,
    `Diet preferences: ${answers.dietPreferences.join(', ') || 'not provided'}.`,
    answers.mealDietNotes.trim() ? `Meal notes: ${answers.mealDietNotes.trim()}.` : null,
    avoidFoods.length > 0 ? `Avoid foods: ${avoidFoods.join(', ')}.` : null,
    answers.weeklyStaples.length > 0 ? `Staples: ${answers.weeklyStaples.join(', ')}.` : null,
    answers.weeklyStaplesOther.trim() ? `Staple notes: ${answers.weeklyStaplesOther.trim()}.` : null,
    recipeRequests.length > 0 ? `Recipes to add: ${recipeRequests.join(', ')}.` : null,
    `Grocery mode: ${answers.groceryShoppingMode || 'not set'} at ${answers.groceryStorePreferences.join(', ')}.`,
    `Grocery friction: ${answers.groceryPain || 'not provided'}.`,
    `Chore friction: ${answers.chorePain || 'not provided'}.`,
    `Health tracking: ${answers.healthTrackingFocus.join(', ') || 'none selected'}.`,
    answers.wellnessGoals.length > 0 ? `Wellness goals: ${answers.wellnessGoals.join(', ')}.` : null,
    answers.morningTextChoice ? `Morning schedule text: ${answers.morningTextChoice}.` : null,
    answers.appointmentReminder ? `Appointment reminder timing: ${answers.appointmentReminder}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function buildSteps(answers: OnboardingAnswers, needsAccountStep: boolean): StepId[] {
  const steps: StepId[] = ['welcome', 'painPoint', 'aha', 'household'];
  if (answers.kidsCount > 0) steps.push('kidAgeRanges');
  steps.push(
    'weeklyRhythm',
    'mealStyles',
    'dietPreferences',
    'foodRestrictions',
    'avoidFoods',
    'weeklyStaples',
    'recipesToImplement',
    'planningStyle',
    'groceryPreferences',
    'groceryPain',
    'choresPain',
    'healthTracking',
    'goalTracking',
    'scheduleText',
    'appointmentReminders',
    'desiredOutcome',
    'mirror',
    'experience',
    'commitment',
    'paywallPrep',
  );
  if (needsAccountStep) steps.push('account');
  return steps;
}

function isStepComplete(step: StepId, answers: OnboardingAnswers, account: AccountDraft): boolean {
  switch (step) {
    case 'welcome':
    case 'aha':
    case 'avoidFoods':
    case 'recipesToImplement':
    case 'goalTracking':
    case 'mirror':
    case 'experience':
    case 'paywallPrep':
      return true;
    case 'painPoint':
      return answers.mainPainPoint !== null;
    case 'household':
      return answers.adultsCount > 0 && answers.kidsCount >= 0;
    case 'kidAgeRanges':
      return answers.kidsCount === 0 || answers.kidAgeRanges.length > 0;
    case 'weeklyRhythm':
      return answers.weeklyRhythm.length > 0;
    case 'mealStyles':
      return answers.mealStylePreferences.length > 0;
    case 'dietPreferences':
      return answers.dietPreferences.length > 0;
    case 'foodRestrictions':
      return true;
    case 'weeklyStaples':
      return true;
    case 'planningStyle':
      return answers.planningStyle !== null;
    case 'groceryPreferences':
      return answers.groceryShoppingMode !== null && answers.groceryStorePreferences.length > 0;
    case 'groceryPain':
      return answers.groceryPain !== null;
    case 'choresPain':
      return answers.chorePain !== null;
    case 'healthTracking':
      return answers.healthTrackingFocus.length > 0;
    case 'scheduleText':
      if (answers.morningTextChoice === null) return false;
      if (answers.morningTextChoice === 'Yes, send me a daily schedule text each morning') {
        return answers.phoneNumber.trim().length > 0;
      }
      return true;
    case 'appointmentReminders':
      return answers.appointmentReminder !== null;
    case 'desiredOutcome':
      return answers.desiredOutcome !== null;
    case 'commitment':
      return answers.commitmentConfirmed;
    case 'account':
      return (
        account.fullName.trim().length > 1 &&
        EMAIL_PATTERN.test(account.email.trim()) &&
        account.password.trim().length >= 6
      );
    default:
      return false;
  }
}

export default function OnboardingPage() {
  const {
    user,
    profile,
    profileLoading,
    isProfileComplete,
    isSubscribed,
    updateProfile,
    signUp,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const forceOnboarding = searchParams.get('force') === '1';
  const needsAccountStep = !user;
  const actorKey = user?.id || 'anon';
  const hydratedForActor = useRef<string | null>(null);

  const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULT_ONBOARDING);
  const [currentStepId, setCurrentStepId] = useState<StepId>('welcome');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountDraft>(DEFAULT_ACCOUNT);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  useEffect(() => {
    if (hydratedForActor.current === actorKey) return;

    let draft = loadOnboardingDraft(user?.id);
    if (user?.id && !draft) {
      const anonDraft = loadOnboardingDraft(null);
      if (anonDraft) {
        saveOnboardingDraft(user.id, anonDraft);
        clearOnboardingDraft(null);
        draft = anonDraft;
      }
    }

    if (draft?.onboarding) {
      setAnswers((prev) => ({ ...prev, ...(draft?.onboarding as Partial<OnboardingAnswers>) }));
      if (draft.stepId) setCurrentStepId(draft.stepId as StepId);
    } else {
      setAnswers(DEFAULT_ONBOARDING);
      setCurrentStepId('welcome');
    }

    if (user?.email) {
      setAccount((prev) => ({ ...prev, email: prev.email || user.email || '' }));
    }

    hydratedForActor.current = actorKey;
  }, [actorKey, user?.email, user?.id]);

  const steps = useMemo(() => buildSteps(answers, needsAccountStep), [answers, needsAccountStep]);
  const stepIndex = Math.max(0, steps.indexOf(currentStepId));
  const progress = (stepIndex + 1) / steps.length;

  useEffect(() => {
    if (forceOnboarding || profileLoading || !user || !isProfileComplete) return;
    navigate(getPostAuthRoute(isSubscribed), { replace: true });
  }, [forceOnboarding, isProfileComplete, isSubscribed, navigate, profileLoading, user]);

  useEffect(() => {
    if (!steps.includes(currentStepId)) {
      setCurrentStepId(steps[steps.length - 1] || 'paywallPrep');
    }
  }, [currentStepId, steps]);

  useEffect(() => {
    saveOnboardingDraft(user?.id, {
      onboarding: answers as unknown as Record<string, unknown>,
      stepId: currentStepId,
    });
  }, [answers, currentStepId, user?.id]);

  const recipeProfile: StarterRecipeProfile = useMemo(
    () => ({
      dietPreferences: answers.dietPreferences,
      mealStylePreferences: answers.mealStylePreferences,
      foodRestrictions: answers.foodRestrictions,
      avoidFoods: parseListText(answers.avoidFoods),
      weeklyRhythm: answers.weeklyRhythm,
      kidsCount: answers.kidsCount,
    }),
    [answers],
  );

  const previewWeek = useMemo(() => buildPersonalizedDinnerWeek(recipeProfile, 5), [recipeProfile]);
  const groceryPreview = useMemo(
    () => buildPersonalizedGroceryPreview(previewWeek.map((item) => item.recipe), 10),
    [previewWeek],
  );

  const personalizedPlan = useMemo<PersonalizedPlan>(
    () => ({
      enabledModules: [
        'meals',
        'groceries',
        'chores',
        'tasks',
        ...(answers.healthTrackingFocus.includes('Workout tracking') ? (['workouts'] as PlanModule[]) : []),
      ],
      suggestedLists: [
        "This week's dinner plan (auto-matched)",
        'Grocery list grouped by store run',
        'Busy-night fallback meal list',
        'Weekly reset checklist',
        ...(answers.weeklyStaples.length > 0 ? ['Recurring staple nights'] : []),
      ],
      weeklyPreview: {
        dinners: previewWeek.map((item) => ({
          day: item.day,
          recipe: item.recipe.name,
          cookMinutes: item.cookMinutes,
        })),
        groceryPreview,
      },
      summary: `Built for ${householdSummary(answers)} with ${answers.mealStylePreferences.join(', ').toLowerCase()} meals and ${answers.dietPreferences.join(', ').toLowerCase()} preferences.`,
    }),
    [answers, groceryPreview, previewWeek],
  );

  const painAhaCopy = useMemo(() => {
    if (!answers.mainPainPoint) {
      return 'Most families are not disorganized. They are overloaded and making too many decisions in too little time.';
    }
    const copyMap: Record<MainPainPoint, string> = {
      'Figuring out dinner every night':
        'The 4:30 PM "what are we eating" scramble drains energy before the evening even starts.',
      'Keeping up with the family schedule':
        'When schedules live in multiple places, everyone feels behind even when they are trying hard.',
      'Grocery planning and follow-through':
        'Without a clear weekly flow, grocery runs become reactive, expensive, and incomplete.',
      'Reducing the mental load':
        'Mental load is carrying every moving part in your head, not a lack of effort.',
      'Managing sports/school/activity logistics':
        'Sports and school logistics break dinner plans unless the week is built around real constraints.',
      'Building better routines':
        'Routines fail when they are too complicated for real life. Simple, repeatable systems stick.',
    };
    return copyMap[answers.mainPainPoint];
  }, [answers.mainPainPoint]);

  const mirrorLine = useMemo(() => {
    const rhythm = answers.weeklyRhythm.join(', ').toLowerCase();
    const meals = answers.mealStylePreferences.join(', ').toLowerCase();
    const diets = answers.dietPreferences.join(', ').toLowerCase();
    return `You are managing ${rhythm || 'a busy week'} for ${householdSummary(answers)}, and want ${meals || 'faster dinners'} with ${diets || 'meals that fit your preferences'}.`;
  }, [answers]);

  const setSingle = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const goBack = () => {
    if (submitting || accountSubmitting) return;
    const idx = steps.indexOf(currentStepId);
    if (idx <= 0) {
      navigate(user ? '/app' : '/', { replace: true });
      return;
    }
    setCurrentStepId(steps[idx - 1]);
  };

  const goNext = () => {
    const idx = steps.indexOf(currentStepId);
    const next = steps[idx + 1];
    if (next) setCurrentStepId(next);
  };

  const completeOnboarding = async () => {
    if (!user) {
      navigate('/signin?onboarding=1', { replace: true });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const familySize = answers.adultsCount + answers.kidsCount;
      const dietaryPreferences = normalizeDietaryPreferences(answers);
      const fullName = profile?.fullName?.trim() || account.fullName.trim() || (user.email?.split('@')[0] || 'Home Harmony User');
      const householdName = profile?.householdName?.trim() || account.householdName.trim() || `${familySize} Person Home`;
      const normalizedPhone = normalizePhone(answers.phoneNumber);

      await updateProfile({
        full_name: fullName,
        household_name: householdName,
        family_size: familySize,
        goals: buildGoalsText(answers),
        dietary_preferences: dietaryPreferences,
        phone: normalizedPhone || null,
      });

      try {
        await createOrGetHousehold(householdName || undefined);
      } catch (householdError) {
        console.error('Household setup failed during onboarding:', householdError);
      }

      try {
        await seedStarterRecipesIfEmpty(
          {
            dietPreferences: answers.dietPreferences,
            mealStylePreferences: answers.mealStylePreferences,
            foodRestrictions: answers.foodRestrictions,
            avoidFoods: parseListText(answers.avoidFoods),
            weeklyRhythm: answers.weeklyRhythm,
            kidsCount: answers.kidsCount,
          },
          18,
        );
      } catch (seedError) {
        console.error('Starter recipe seeding failed:', seedError);
      }

      setPlanRules({
        preferFavorites: answers.planningStyle !== 'I mostly build my own plan',
        preferKidFriendly: answers.kidsCount > 0 || answers.mealStylePreferences.includes('Kid-friendly'),
        maxCookMinutes:
          answers.mealStylePreferences.includes('Quick meals') ||
          answers.mealStylePreferences.includes('Healthy and easy') ||
          answers.weeklyRhythm.includes('Fast-paced work week') ||
          answers.weeklyRhythm.includes('Sports-heavy week')
            ? 30
            : null,
        dayLocks: buildDayLocks(answers),
      });

      if (
        answers.morningTextChoice === 'Yes, send me a daily schedule text each morning' &&
        normalizedPhone
      ) {
        try {
          const timezoneGuess =
            typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/New_York';
          const reminderOffsets =
            answers.appointmentReminder === '30 minutes before'
              ? [30]
              : answers.appointmentReminder === '1 hour before'
              ? [60]
              : answers.appointmentReminder === 'Both 1 hour and 30 minutes'
              ? [60, 30]
              : [];

          await saveSmsPreferences({
            ...defaultSmsPreferences(timezoneGuess),
            enabled: true,
            phone_e164: normalizedPhone,
            morning_digest_enabled: true,
            event_reminders_enabled: reminderOffsets.length > 0,
            reminder_offsets_minutes: reminderOffsets.length > 0 ? reminderOffsets : [60, 30],
          });
        } catch (smsError) {
          console.error('Failed saving onboarding SMS preferences:', smsError);
        }
      }

      const payload: StoredOnboardingResult = {
        completedAt: new Date().toISOString(),
        onboarding: answers as unknown as Record<string, unknown>,
        personalizedPlan: personalizedPlan as unknown as Record<string, unknown>,
      };

      await saveOnboardingResult(user.id, payload);

      await trackGrowthEventSafe(
        'onboarding_complete',
        {
          adultsCount: answers.adultsCount,
          kidsCount: answers.kidsCount,
          painPoint: answers.mainPainPoint,
          outcome: answers.desiredOutcome,
          mealStyles: answers.mealStylePreferences,
          diets: answers.dietPreferences,
          staples: answers.weeklyStaples,
          hasRecipeRequests: parseListText(answers.recipesToImplement).length > 0,
          morningText: answers.morningTextChoice === 'Yes, send me a daily schedule text each morning',
        },
        `onboarding_complete:${user.id}`,
      );

      clearOnboardingDraft(user.id);
      clearOnboardingDraft(null);
      navigate(getPostAuthRoute(isSubscribed), { replace: true });
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

  const createAccountFromOnboarding = async () => {
    if (user) {
      setCurrentStepId('paywallPrep');
      return;
    }

    setAccountSubmitting(true);
    setAccountError(null);
    try {
      await signUp(account.email.trim(), account.password.trim(), {
        fullName: account.fullName.trim(),
        householdName: account.householdName.trim() || undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      toast({
        title: 'Account created',
        description: 'Sign in to apply your personalized plan.',
      });
      navigate('/signin?onboarding=1', { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not create account.';
      setAccountError(message);
    } finally {
      setAccountSubmitting(false);
    }
  };

  let content: React.ReactNode = null;
  let footer: React.ReactNode = null;

  switch (currentStepId) {
    case 'welcome':
      content = (
        <QuestionScreen
          title="Build a calmer family week in a few minutes"
          helper="We will ask a few focused questions and generate a real meal + grocery preview for your household."
          align="center"
        >
          <div className="h-full grid place-items-center">
            <div className="max-w-md rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center">
              <HeartHandshake className="mx-auto mb-3 h-9 w-9 text-primary" />
              <p className="text-sm text-muted-foreground">
                Home Harmony is built to reduce mental load around meals, groceries, chores, and weekly planning.
              </p>
            </div>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Start" onPrimary={goNext} />;
      break;

    case 'painPoint':
      content = (
        <QuestionScreen
          title="Which part of family life feels hardest to keep up with?"
          helper="Pick the one that causes the most pressure right now."
        >
          <OptionList
            options={PAIN_POINT_OPTIONS}
            selected={singleSelection(answers.mainPainPoint)}
            onToggle={(value) => setSingle('mainPainPoint', value)}
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('painPoint', answers, account)}
        />
      );
      break;

    case 'aha':
      content = (
        <QuestionScreen title="You are not behind. You are carrying too much." helper="This is where Home Harmony helps.">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-sm text-foreground">{painAhaCopy}</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">
                We are going to build your week around your real constraints so dinner, grocery flow, and routines feel easier.
              </p>
            </div>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="That is exactly it" onPrimary={goNext} />;
      break;

    case 'household':
      content = (
        <QuestionScreen title="Who are we planning for?" helper="Set your household size so plans are realistic.">
          <div className="space-y-6">
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Adults</p>
              <div className="mt-3 flex items-center gap-3">
                <Button variant="outline" type="button" onClick={() => setSingle('adultsCount', Math.max(1, answers.adultsCount - 1))}>
                  -
                </Button>
                <span className="min-w-8 text-center text-lg font-semibold">{answers.adultsCount}</span>
                <Button variant="outline" type="button" onClick={() => setSingle('adultsCount', Math.min(6, answers.adultsCount + 1))}>
                  +
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Kids</p>
              <div className="mt-3 flex items-center gap-3">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const next = Math.max(0, answers.kidsCount - 1);
                    setAnswers((prev) => ({ ...prev, kidsCount: next, kidAgeRanges: next === 0 ? [] : prev.kidAgeRanges }));
                  }}
                >
                  -
                </Button>
                <span className="min-w-8 text-center text-lg font-semibold">{answers.kidsCount}</span>
                <Button variant="outline" type="button" onClick={() => setSingle('kidsCount', Math.min(8, answers.kidsCount + 1))}>
                  +
                </Button>
              </div>
            </div>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} />;
      break;

    case 'kidAgeRanges':
      content = (
        <QuestionScreen title="What are your kids' age ranges?" helper="This helps with kid-friendly meal matching.">
          <OptionList
            options={KID_AGE_RANGE_OPTIONS}
            selected={answers.kidAgeRanges}
            onToggle={(value) => setAnswers((prev) => ({ ...prev, kidAgeRanges: toggleValue(prev.kidAgeRanges, value) }))}
            multi
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('kidAgeRanges', answers, account)}
        />
      );
      break;

    case 'weeklyRhythm':
      content = (
        <QuestionScreen title="What does your week usually look like?" helper="Pick what is true most weeks.">
          <OptionList
            options={WEEKLY_RHYTHM_OPTIONS}
            selected={answers.weeklyRhythm}
            onToggle={(value) => setAnswers((prev) => ({ ...prev, weeklyRhythm: toggleValue(prev.weeklyRhythm, value) }))}
            multi
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('weeklyRhythm', answers, account)}
        />
      );
      break;

    case 'mealStyles':
      content = (
        <QuestionScreen
          title="What kinds of meals should we prioritize?"
          helper="This is where we learn if you want healthy easy meals, fast dinners, budget meals, or a mix."
        >
          <OptionList
            options={MEAL_STYLE_OPTIONS}
            selected={answers.mealStylePreferences}
            onToggle={(value) =>
              setAnswers((prev) => ({
                ...prev,
                mealStylePreferences: toggleWithMix(prev.mealStylePreferences, value, 'Mix of everything'),
              }))
            }
            multi
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('mealStyles', answers, account)}
        />
      );
      break;

    case 'dietPreferences':
      content = (
        <QuestionScreen
          title="Any diet style we should follow?"
          helper="Required: choose one or more. If you just want healthy easy meals, choose No specific diet."
        >
          <div className="space-y-4">
            <OptionList
              options={DIET_PREFERENCE_OPTIONS}
              selected={answers.dietPreferences}
              onToggle={(value) =>
                setAnswers((prev) => ({
                  ...prev,
                  dietPreferences: toggleWithMix(prev.dietPreferences, value, 'Mix of everything'),
                }))
              }
              multi
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">Anything else we should account for?</p>
              <Textarea
                value={answers.mealDietNotes}
                onChange={(event) => setSingle('mealDietNotes', event.target.value)}
                placeholder="Optional: mild spice only, organic produce first, no very spicy meals, etc."
                rows={3}
              />
            </div>
          </div>
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('dietPreferences', answers, account)}
        />
      );
      break;

    case 'foodRestrictions':
      content = (
        <QuestionScreen title="Any hard food restrictions?" helper="These are enforced when we build meal suggestions.">
          <OptionList
            options={FOOD_RESTRICTION_OPTIONS}
            selected={answers.foodRestrictions}
            onToggle={(value) => setAnswers((prev) => ({ ...prev, foodRestrictions: toggleValue(prev.foodRestrictions, value) }))}
            multi
          />
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} />;
      break;

    case 'avoidFoods':
      content = (
        <QuestionScreen title="Any foods your family dislikes?" helper="Optional. We will avoid these in suggestions.">
          <div className="space-y-3">
            <Textarea
              value={answers.avoidFoods}
              onChange={(event) => setSingle('avoidFoods', event.target.value)}
              placeholder="Examples: mushrooms, tuna, cilantro"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">Separate items with commas or new lines.</p>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} />;
      break;

    case 'weeklyStaples':
      content = (
        <QuestionScreen
          title="Do you have staple nights each week?"
          helper="Examples: Taco Tuesday, Pizza Friday. We can lock these into your weekly planning."
        >
          <div className="space-y-4">
            <OptionList
              options={WEEKLY_STAPLE_OPTIONS}
              selected={answers.weeklyStaples}
              onToggle={(value) => setAnswers((prev) => ({ ...prev, weeklyStaples: toggleValue(prev.weeklyStaples, value) }))}
              multi
            />
            {answers.weeklyStaples.includes('Other staple') && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Describe your other staple nights</p>
                <Input
                  value={answers.weeklyStaplesOther}
                  onChange={(event) => setSingle('weeklyStaplesOther', event.target.value)}
                  placeholder="Example: Sunday grill night, Wednesday breakfast for dinner"
                />
              </div>
            )}
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} />;
      break;

    case 'recipesToImplement':
      content = (
        <QuestionScreen
          title="Any recipes you already want to include?"
          helper="Optional. Add recipe names now so they can be worked into your plan later."
        >
          <div className="space-y-3">
            <Textarea
              value={answers.recipesToImplement}
              onChange={(event) => setSingle('recipesToImplement', event.target.value)}
              placeholder="Examples: Grandma's chili, turkey taco bowls, chicken enchilada soup"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">Separate recipes with commas or new lines.</p>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} />;
      break;

    case 'planningStyle':
      content = (
        <QuestionScreen title="How do you want planning to feel?" helper="We tune your experience around this style.">
          <OptionList
            options={PLANNING_STYLE_OPTIONS}
            selected={singleSelection(answers.planningStyle)}
            onToggle={(value) => setSingle('planningStyle', value)}
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('planningStyle', answers, account)}
        />
      );
      break;

    case 'groceryPreferences':
      content = (
        <QuestionScreen
          title="How do you shop groceries?"
          helper="Set mode and stores so your list is routed to your preferred shopping flow."
        >
          <div className="space-y-6">
            <OptionList
              options={GROCERY_MODE_OPTIONS}
              selected={singleSelection(answers.groceryShoppingMode)}
              onToggle={(value) => setSingle('groceryShoppingMode', value)}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Preferred stores</p>
              <div className="grid grid-cols-2 gap-2">
                {GROCERY_STORE_OPTIONS.map((store) => (
                  <label key={store} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={answers.groceryStorePreferences.includes(store)}
                      onCheckedChange={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          groceryStorePreferences: toggleValue(prev.groceryStorePreferences, store),
                        }))
                      }
                    />
                    <span>{store}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('groceryPreferences', answers, account)}
        />
      );
      break;

    case 'groceryPain':
      content = (
        <QuestionScreen
          title="Does grocery planning feel fragmented?"
          helper="Are you tired of building a list and then flipping between recipes and grocery apps?"
        >
          <OptionList
            options={GROCERY_PAIN_OPTIONS}
            selected={singleSelection(answers.groceryPain)}
            onToggle={(value) => setSingle('groceryPain', value)}
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('groceryPain', answers, account)}
        />
      );
      break;

    case 'choresPain':
      content = (
        <QuestionScreen
          title="How are chores going right now?"
          helper="Are you tired of asking if chores were done or kids not knowing what they need to do?"
        >
          <OptionList
            options={CHORE_PAIN_OPTIONS}
            selected={singleSelection(answers.chorePain)}
            onToggle={(value) => setSingle('chorePain', value)}
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('choresPain', answers, account)}
        />
      );
      break;

    case 'healthTracking':
      content = (
        <QuestionScreen
          title="What health tracking do you want built in?"
          helper="Select what you care about now. We will keep this lightweight."
        >
          <OptionList
            options={HEALTH_TRACKING_OPTIONS}
            selected={answers.healthTrackingFocus}
            onToggle={(value) =>
              setAnswers((prev) => ({
                ...prev,
                healthTrackingFocus: toggleWithExclusive(prev.healthTrackingFocus, value, 'Not right now'),
              }))
            }
            multi
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('healthTracking', answers, account)}
        />
      );
      break;

    case 'goalTracking':
      content = (
        <QuestionScreen
          title="Any goal tracking priorities?"
          helper="Set quick targets for water, steps, and alcohol if you want them in your weekly view."
        >
          <div className="space-y-6">
            <OptionList
              options={WELLNESS_GOAL_OPTIONS}
              selected={answers.wellnessGoals}
              onToggle={(value) => setAnswers((prev) => ({ ...prev, wellnessGoals: toggleValue(prev.wellnessGoals, value) }))}
              multi
            />

            <div className="grid gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium mb-2">Water target</p>
                <OptionList
                  options={WATER_TARGET_OPTIONS}
                  selected={singleSelection(answers.waterTarget)}
                  onToggle={(value) => setSingle('waterTarget', value)}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Step target</p>
                <OptionList
                  options={STEP_TARGET_OPTIONS}
                  selected={singleSelection(answers.stepTarget)}
                  onToggle={(value) => setSingle('stepTarget', value)}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Alcohol target</p>
                <OptionList
                  options={ALCOHOL_TARGET_OPTIONS}
                  selected={singleSelection(answers.alcoholTarget)}
                  onToggle={(value) => setSingle('alcoholTarget', value)}
                />
              </div>
            </div>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} />;
      break;

    case 'scheduleText':
      content = (
        <QuestionScreen
          title="Would a morning text of your day help?"
          helper="If mornings feel chaotic, Home Harmony can text your schedule and priorities."
        >
          <div className="space-y-4">
            <OptionList
              options={MORNING_TEXT_OPTIONS}
              selected={singleSelection(answers.morningTextChoice)}
              onToggle={(value) => setSingle('morningTextChoice', value)}
            />
            {answers.morningTextChoice === 'Yes, send me a daily schedule text each morning' && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Phone number</p>
                <Input
                  value={answers.phoneNumber}
                  onChange={(event) => setSingle('phoneNumber', event.target.value)}
                  placeholder="+16155551234"
                />
                <p className="text-xs text-muted-foreground">
                  Use your mobile number. We save this to your SMS settings after account setup.
                </p>
              </div>
            )}
          </div>
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('scheduleText', answers, account)}
        />
      );
      break;

    case 'appointmentReminders':
      content = (
        <QuestionScreen
          title="Do you want appointment reminders?"
          helper="Choose reminder timing for events so fewer appointments slip through."
        >
          <OptionList
            options={APPOINTMENT_REMINDER_OPTIONS}
            selected={singleSelection(answers.appointmentReminder)}
            onToggle={(value) => setSingle('appointmentReminder', value)}
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('appointmentReminders', answers, account)}
        />
      );
      break;

    case 'desiredOutcome':
      content = (
        <QuestionScreen title="What result matters most this month?" helper="Pick one to optimize first.">
          <OptionList
            options={DESIRED_OUTCOME_OPTIONS}
            selected={singleSelection(answers.desiredOutcome)}
            onToggle={(value) => setSingle('desiredOutcome', value)}
          />
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('desiredOutcome', answers, account)}
        />
      );
      break;

    case 'mirror':
      content = (
        <QuestionScreen title="Here is what we heard" helper="Your setup is now tailored to your household.">
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="text-sm">{mirrorLine}</p>
            </div>
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              Main pressure: <span className="text-foreground">{answers.mainPainPoint}</span>
              <br />
              Grocery flow: <span className="text-foreground">{answers.groceryPain}</span>
              <br />
              Chores flow: <span className="text-foreground">{answers.chorePain}</span>
              <br />
              Primary outcome: <span className="text-foreground">{answers.desiredOutcome}</span>
            </div>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Show my sample week" onPrimary={goNext} />;
      break;

    case 'experience':
      content = (
        <QuestionScreen
          title="Your personalized sample week is ready"
          helper={`Built from your ${answers.weeklyRhythm.join(', ').toLowerCase()} rhythm and ${answers.dietPreferences.join(', ').toLowerCase()} preferences.`}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-primary" />
                Dinner preview
              </div>
              <div className="space-y-2">
                {previewWeek.map((item) => (
                  <div
                    key={`${item.day}-${item.recipe.name}`}
                    className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.day}</p>
                      <p className="text-xs text-muted-foreground">{item.recipe.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">~{item.cookMinutes} min</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <ShoppingBasket className="h-4 w-4 text-primary" />
                Grocery preview
              </div>
              <div className="flex flex-wrap gap-2">
                {groceryPreview.map((item) => (
                  <span key={item} className="rounded-full border border-border px-3 py-1 text-xs">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {answers.weeklyStaples.length > 0 && (
              <div className="rounded-xl border border-border p-4">
                <p className="text-sm font-medium mb-2">Staples we will keep in your week</p>
                <div className="flex flex-wrap gap-2">
                  {answers.weeklyStaples.map((item) => (
                    <span key={item} className="rounded-full border border-border px-3 py-1 text-xs">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              This is a real preview generated from your inputs. You can edit meal picks after setup.
            </p>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} />;
      break;

    case 'commitment':
      content = (
        <QuestionScreen title="Ready for calmer evenings and an easier week?" helper="One tap locks this in.">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSingle('commitmentConfirmed', !answers.commitmentConfirmed)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                answers.commitmentConfirmed
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border hover:border-primary/50 hover:bg-muted/60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span>Yes, I want less weekly stress and a plan my family can actually follow.</span>
                <span
                  className={`h-5 w-5 rounded-full border flex items-center justify-center text-[10px] ${
                    answers.commitmentConfirmed
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {answers.commitmentConfirmed ? '✓' : ''}
                </span>
              </div>
            </button>
            <p className="text-xs text-muted-foreground">
              We use this to keep recommendations aligned to your priorities.
            </p>
          </div>
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel="Continue"
          onPrimary={goNext}
          primaryDisabled={!isStepComplete('commitment', answers, account)}
        />
      );
      break;

    case 'paywallPrep':
      content = (
        <QuestionScreen
          title={
            user
              ? BILLING_ENABLED
                ? 'Your personalized plan is ready to unlock'
                : 'Your Home Harmony plan is ready'
              : 'Your personalized plan is ready'
          }
          helper={
            user
              ? BILLING_ENABLED
                ? 'Continue to choose your plan and keep this setup running each week.'
                : 'Meals, groceries, routines, and reminders are now personalized for your household.'
              : 'Create your account to save this setup and use it in the app.'
          }
          align="center"
        >
          <div className="h-full grid place-items-center">
            <div className="max-w-md rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center">
              <Sparkles className="mx-auto mb-3 h-9 w-9 text-primary" />
              <p className="text-sm text-muted-foreground">{personalizedPlan.summary}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {user
                  ? 'Continue to apply this plan inside the app and keep your week in sync.'
                  : 'Next step: create your account so this plan is saved to your household.'}
              </p>
            </div>
          </div>
          {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}
        </QuestionScreen>
      );
      footer = user ? (
        <BottomCTA
          primaryLabel={BILLING_ENABLED ? 'Continue to plans' : 'Apply my plan'}
          onPrimary={completeOnboarding}
          secondaryLabel="Edit answers"
          onSecondary={() => setCurrentStepId('painPoint')}
          loading={submitting}
        />
      ) : (
        <BottomCTA
          primaryLabel="Create free account"
          onPrimary={goNext}
          secondaryLabel="I already have an account"
          onSecondary={() => navigate('/signin?onboarding=1')}
        />
      );
      break;

    case 'account':
      content = (
        <QuestionScreen
          title="Create your account to save this plan"
          helper="You finished onboarding first. This account step saves your personalized setup."
        >
          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Full name"
              value={account.fullName}
              onChange={(event) => setAccount((prev) => ({ ...prev, fullName: event.target.value }))}
            />
            <Input
              type="text"
              placeholder="Household name (optional)"
              value={account.householdName}
              onChange={(event) => setAccount((prev) => ({ ...prev, householdName: event.target.value }))}
            />
            <Input
              type="email"
              placeholder="Email"
              value={account.email}
              onChange={(event) => setAccount((prev) => ({ ...prev, email: event.target.value }))}
            />
            <Input
              type="password"
              minLength={6}
              placeholder="Create password"
              value={account.password}
              onChange={(event) => setAccount((prev) => ({ ...prev, password: event.target.value }))}
            />
            {accountError && <p className="text-sm text-destructive">{accountError}</p>}
            <p className="text-xs text-muted-foreground">
              Already have an account? <Link to="/signin?onboarding=1" className="underline">Sign in and continue</Link>.
            </p>
          </div>
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel={accountSubmitting ? 'Creating account...' : 'Create account'}
          onPrimary={createAccountFromOnboarding}
          primaryDisabled={!isStepComplete('account', answers, account) || accountSubmitting}
        />
      );
      break;

    default:
      content = null;
      footer = null;
      break;
  }

  return (
    <OnboardingShell
      progress={progress}
      canGoBack={!submitting && !accountSubmitting}
      onBack={goBack}
      footer={footer}
    >
      {content}
    </OnboardingShell>
  );
}
