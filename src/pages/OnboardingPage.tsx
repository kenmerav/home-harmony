import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, HeartHandshake, ShoppingBasket, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
  'High protein',
  'Family-friendly',
  'Quick meals',
  'Budget-friendly',
  'Healthy / clean eating',
  'Comfort food',
  'Kid-friendly',
  'Mix of everything',
] as const;

const DIET_PREFERENCE_OPTIONS = [
  'Paleo',
  'Low carb',
  'Gluten free',
  'Dairy free',
  'Vegetarian',
  'Pescatarian',
  'Organic',
  'Mix of everything',
] as const;

const FOOD_RESTRICTION_OPTIONS = ['No pork', 'No beef', 'Allergy-aware'] as const;

const KID_AGE_RANGE_OPTIONS = ['0-4', '5-8', '9-12', '13-17'] as const;

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

const DESIRED_OUTCOME_OPTIONS = [
  'Calmer evenings',
  'Less decision fatigue',
  'Easier dinners',
  'More organized weeks',
  'Smoother school/sports logistics',
] as const;

const PENDING_TEMPLATE_KEY = 'homehub.pendingTemplate.v1';

type MainPainPoint = (typeof PAIN_POINT_OPTIONS)[number];
type WeeklyRhythm = (typeof WEEKLY_RHYTHM_OPTIONS)[number];
type MealStylePreference = (typeof MEAL_STYLE_OPTIONS)[number];
type DietPreference = (typeof DIET_PREFERENCE_OPTIONS)[number];
type FoodRestriction = (typeof FOOD_RESTRICTION_OPTIONS)[number];
type KidAgeRange = (typeof KID_AGE_RANGE_OPTIONS)[number];
type GroceryStorePreference = (typeof GROCERY_STORE_OPTIONS)[number];
type GroceryMode = (typeof GROCERY_MODE_OPTIONS)[number];
type PlanningStyle = (typeof PLANNING_STYLE_OPTIONS)[number];
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
  | 'planningStyle'
  | 'groceryPreferences'
  | 'desiredOutcome'
  | 'mirror'
  | 'experience'
  | 'commitment'
  | 'paywallPrep';

type PlanModule = 'meals' | 'groceries' | 'chores' | 'tasks';

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
  groceryStorePreferences: GroceryStorePreference[];
  groceryShoppingMode: GroceryMode | null;
  planningStyle: PlanningStyle | null;
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
  groceryStorePreferences: ["Fry's"],
  groceryShoppingMode: null,
  planningStyle: null,
  desiredOutcome: null,
  commitmentConfirmed: false,
};

const parseAvoidFoods = (raw: string): string[] =>
  raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

function buildSteps(answers: OnboardingAnswers): StepId[] {
  const steps: StepId[] = [
    'welcome',
    'painPoint',
    'aha',
    'household',
  ];

  if (answers.kidsCount > 0) {
    steps.push('kidAgeRanges');
  }

  steps.push(
    'weeklyRhythm',
    'mealStyles',
    'dietPreferences',
    'foodRestrictions',
    'avoidFoods',
    'planningStyle',
    'groceryPreferences',
    'desiredOutcome',
    'mirror',
    'experience',
    'commitment',
    'paywallPrep',
  );

  return steps;
}

function isStepComplete(step: StepId, answers: OnboardingAnswers): boolean {
  switch (step) {
    case 'welcome':
    case 'aha':
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
    case 'avoidFoods':
      return true;
    case 'planningStyle':
      return answers.planningStyle !== null;
    case 'groceryPreferences':
      return answers.groceryShoppingMode !== null && answers.groceryStorePreferences.length > 0;
    case 'desiredOutcome':
      return answers.desiredOutcome !== null;
    case 'commitment':
      return answers.commitmentConfirmed;
    default:
      return false;
  }
}

function singleSelection<T extends string>(value: T | null): T[] {
  return value ? [value] : [];
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
  return values.includes(incoming)
    ? values.filter((item) => item !== incoming)
    : [...values, incoming];
}

function householdSummary(answers: OnboardingAnswers): string {
  const adults = `${answers.adultsCount} adult${answers.adultsCount === 1 ? '' : 's'}`;
  const kids = answers.kidsCount > 0 ? `${answers.kidsCount} kid${answers.kidsCount === 1 ? '' : 's'}` : 'no kids';
  const ageText = answers.kidAgeRanges.length > 0 ? ` (${answers.kidAgeRanges.join(', ')})` : '';
  return `${adults}, ${kids}${ageText}`;
}

function normalizeDietaryPreferences(answers: OnboardingAnswers): string[] {
  const combined = [
    ...answers.dietPreferences,
    ...answers.mealStylePreferences,
    ...answers.foodRestrictions,
  ];

  if (answers.kidsCount > 0 && !combined.includes('Kid-friendly')) {
    combined.push('Kid-friendly');
  }

  return Array.from(new Set(combined));
}

function buildGoalsText(answers: OnboardingAnswers): string {
  const rhythm = answers.weeklyRhythm.join(', ').toLowerCase();
  const meals = answers.mealStylePreferences.join(', ').toLowerCase();
  const diets = answers.dietPreferences.join(', ').toLowerCase();
  const stores = answers.groceryStorePreferences.join(', ');
  const avoid = parseAvoidFoods(answers.avoidFoods);

  return [
    `Main pressure: ${answers.mainPainPoint || 'not provided'}.`,
    `Desired outcome: ${answers.desiredOutcome || 'calmer week'}.`,
    `Weekly rhythm: ${rhythm || 'not provided'}.`,
    `Meal style: ${meals || 'not provided'}.`,
    `Diet focus: ${diets || 'not provided'}.`,
    answers.mealDietNotes.trim() ? `Extra meal/diet notes: ${answers.mealDietNotes.trim()}.` : null,
    `Shopping: ${answers.groceryShoppingMode || 'not set'} at ${stores}.`,
    avoid.length ? `Avoid foods: ${avoid.join(', ')}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

export default function OnboardingPage() {
  const { user, profile, profileLoading, isProfileComplete, isSubscribed, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forceOnboarding = searchParams.get('force') === '1';
  const { toast } = useToast();

  const draft = useMemo(() => loadOnboardingDraft(user?.id), [user?.id]);
  const [answers, setAnswers] = useState<OnboardingAnswers>(
    draft?.onboarding ? ({ ...DEFAULT_ONBOARDING, ...draft.onboarding } as OnboardingAnswers) : DEFAULT_ONBOARDING,
  );
  const [currentStepId, setCurrentStepId] = useState<StepId>(
    draft?.stepId ? (draft.stepId as StepId) : 'welcome',
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const steps = useMemo(() => buildSteps(answers), [answers]);
  const stepIndex = Math.max(0, steps.indexOf(currentStepId));
  const progress = (stepIndex + 1) / steps.length;

  const recipeProfile: StarterRecipeProfile = useMemo(
    () => ({
      dietPreferences: answers.dietPreferences,
      mealStylePreferences: answers.mealStylePreferences,
      foodRestrictions: answers.foodRestrictions,
      avoidFoods: parseAvoidFoods(answers.avoidFoods),
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
      enabledModules: ['meals', 'groceries', 'tasks', 'chores'],
      suggestedLists: [
        'This week\'s dinner plan (auto-matched)',
        'Grocery list grouped by store run',
        'Busy-night fallback meal list',
        'Weekly reset checklist',
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

  useEffect(() => {
    if (forceOnboarding || profileLoading || !isProfileComplete) return;
    navigate(getPostAuthRoute(isSubscribed), { replace: true });
  }, [forceOnboarding, isProfileComplete, isSubscribed, navigate, profileLoading]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(PENDING_TEMPLATE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as { slug?: string };
      if (parsed?.slug === 'busy-family-weeknight-system') {
        setAnswers((prev) => ({
          ...prev,
          mainPainPoint: 'Figuring out dinner every night',
          weeklyRhythm: ['After-school activities most days', 'Fast-paced work week'],
          mealStylePreferences: ['Quick meals', 'Family-friendly', 'Kid-friendly'],
          dietPreferences: ['Organic'],
          planningStyle: 'Suggest meals for me',
          desiredOutcome: 'Calmer evenings',
        }));
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

  const setSingle = <K extends keyof OnboardingAnswers>(key: K, value: OnboardingAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const completeOnboarding = async () => {
    if (!user) {
      navigate('/signin', { replace: true });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const familySize = answers.adultsCount + answers.kidsCount;
      const dietaryPreferences = normalizeDietaryPreferences(answers);
      const fullName = profile?.fullName?.trim() || (user.email?.split('@')[0] || 'Home Harmony User');
      const householdName =
        profile?.householdName?.trim() ||
        `${answers.adultsCount + answers.kidsCount} Person Home`;

      await updateProfile({
        full_name: fullName,
        household_name: householdName,
        family_size: familySize,
        goals: buildGoalsText(answers),
        dietary_preferences: dietaryPreferences,
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
            avoidFoods: parseAvoidFoods(answers.avoidFoods),
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
          answers.weeklyRhythm.includes('Fast-paced work week') ||
          answers.weeklyRhythm.includes('Sports-heavy week')
            ? 30
            : null,
        dayLocks: {},
      });

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
        },
        `onboarding_complete:${user.id}`,
      );

      clearOnboardingDraft(user.id);
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

  const painAhaCopy = useMemo(() => {
    const pain = answers.mainPainPoint;
    if (!pain) return 'Most families are not disorganized. They are overloaded and making too many decisions in too little time.';

    const map: Record<MainPainPoint, string> = {
      'Figuring out dinner every night': 'The 4:30pm "what are we eating" scramble is one of the fastest ways to drain energy from the whole evening.',
      'Keeping up with the family schedule': 'When schedules live in multiple places, everyone feels behind even when they are trying hard.',
      'Grocery planning and follow-through': 'Without a clear plan, groceries become reactive and expensive, and key ingredients are always missing.',
      'Reducing the mental load': 'Mental load comes from carrying every moving part in your head, not from a lack of effort.',
      'Managing sports/school/activity logistics': 'Sports nights and school logistics make dinner timing hard unless the week is planned around real constraints.',
      'Building better routines': 'Routines break when they are too complex for real life. Simple repeatable systems stick.',
    };

    return map[pain];
  }, [answers.mainPainPoint]);

  const mirrorLine = useMemo(() => {
    const rhythm = answers.weeklyRhythm.join(', ').toLowerCase();
    const meals = answers.mealStylePreferences.join(', ').toLowerCase();
    const diets = answers.dietPreferences.join(', ').toLowerCase();
    const note = answers.mealDietNotes.trim();
    return `You\'re managing ${rhythm || 'a busy week'} for ${householdSummary(answers)}, and want ${meals || 'faster dinners'} with ${diets || 'meals that fit your preferences'}${note ? ` (plus: ${note})` : ''}.`;
  }, [answers]);

  let content: React.ReactNode = null;
  let footer: React.ReactNode = null;

  switch (currentStepId) {
    case 'welcome':
      content = (
        <QuestionScreen
          title="Bring calm to your family week"
          helper="Answer a few quick questions and we\'ll build a real weekly meal and grocery preview for your household."
          align="center"
        >
          <div className="h-full grid place-items-center">
            <div className="max-w-md rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center">
              <HeartHandshake className="mx-auto mb-3 h-9 w-9 text-primary" />
              <p className="text-sm text-muted-foreground">
                Home Harmony is built to reduce decision fatigue, not add another app to manage.
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
          title="Which part of family life feels hardest right now?"
          helper="Pick the one that creates the most stress this week."
        >
          <OptionList
            options={PAIN_POINT_OPTIONS}
            selected={singleSelection(answers.mainPainPoint)}
            onToggle={(value) => setSingle('mainPainPoint', value)}
          />
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('painPoint', answers)} />;
      break;

    case 'aha':
      content = (
        <QuestionScreen title="You\'re not failing. Your week is overloaded." helper="This is where Home Harmony helps most.">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-sm text-foreground">{painAhaCopy}</p>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground">
                We\'ll build your plan around your real schedule so dinners, groceries, and routines run with less friction.
              </p>
            </div>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="That\'s exactly it" onPrimary={goNext} />;
      break;

    case 'household':
      content = (
        <QuestionScreen title="Who are we planning for?" helper="Set household size so meals and planning are realistic.">
          <div className="space-y-6">
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Adults</p>
              <div className="mt-3 flex items-center gap-3">
                <Button variant="outline" type="button" onClick={() => setSingle('adultsCount', Math.max(1, answers.adultsCount - 1))}>-</Button>
                <span className="min-w-8 text-center text-lg font-semibold">{answers.adultsCount}</span>
                <Button variant="outline" type="button" onClick={() => setSingle('adultsCount', Math.min(6, answers.adultsCount + 1))}>+</Button>
              </div>
            </div>

            <div className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">Kids</p>
              <div className="mt-3 flex items-center gap-3">
                <Button variant="outline" type="button" onClick={() => {
                  const next = Math.max(0, answers.kidsCount - 1);
                  setAnswers((prev) => ({ ...prev, kidsCount: next, kidAgeRanges: next === 0 ? [] : prev.kidAgeRanges }));
                }}>-</Button>
                <span className="min-w-8 text-center text-lg font-semibold">{answers.kidsCount}</span>
                <Button variant="outline" type="button" onClick={() => setSingle('kidsCount', Math.min(8, answers.kidsCount + 1))}>+</Button>
              </div>
            </div>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('household', answers)} />;
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
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('kidAgeRanges', answers)} />;
      break;

    case 'weeklyRhythm':
      content = (
        <QuestionScreen title="What does your week usually look like?" helper="Pick what best describes your normal rhythm.">
          <OptionList
            options={WEEKLY_RHYTHM_OPTIONS}
            selected={answers.weeklyRhythm}
            onToggle={(value) => setAnswers((prev) => ({ ...prev, weeklyRhythm: toggleValue(prev.weeklyRhythm, value) }))}
            multi
          />
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('weeklyRhythm', answers)} />;
      break;

    case 'mealStyles':
      content = (
        <QuestionScreen
          title="What kinds of meals should we prioritize?"
          helper="This is how we tailor your week so dinner actually works in real life."
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
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('mealStyles', answers)} />;
      break;

    case 'dietPreferences':
      content = (
        <QuestionScreen
          title="Diet and food preference profile"
          helper="Required: choose your household diet style so recipe suggestions are matched correctly."
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
                placeholder="Optional: halal at home, kids dislike spicy food, organic produce first, etc."
                rows={3}
              />
            </div>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('dietPreferences', answers)} />;
      break;

    case 'foodRestrictions':
      content = (
        <QuestionScreen title="Any hard food restrictions?" helper="These are enforced when we build your meal suggestions.">
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
        <QuestionScreen title="Anything your family dislikes or avoids?" helper="Optional. Add ingredients or foods to avoid.">
          <div className="space-y-3">
            <Textarea
              value={answers.avoidFoods}
              onChange={(event) => setSingle('avoidFoods', event.target.value)}
              placeholder="Examples: mushrooms, tuna, cilantro"
              rows={6}
            />
            <p className="text-xs text-muted-foreground">Separate with commas or new lines.</p>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} />;
      break;

    case 'planningStyle':
      content = (
        <QuestionScreen title="How do you want planning to feel?" helper="We\'ll tune recommendations around your style.">
          <OptionList
            options={PLANNING_STYLE_OPTIONS}
            selected={singleSelection(answers.planningStyle)}
            onToggle={(value) => setSingle('planningStyle', value)}
          />
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('planningStyle', answers)} />;
      break;

    case 'groceryPreferences':
      content = (
        <QuestionScreen title="How do you shop groceries?" helper="Set your preferred mode and stores for grocery links and list routing.">
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
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('groceryPreferences', answers)} />;
      break;

    case 'desiredOutcome':
      content = (
        <QuestionScreen title="What result matters most right now?" helper="Pick one outcome to optimize first.">
          <OptionList
            options={DESIRED_OUTCOME_OPTIONS}
            selected={singleSelection(answers.desiredOutcome)}
            onToggle={(value) => setSingle('desiredOutcome', value)}
          />
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('desiredOutcome', answers)} />;
      break;

    case 'mirror':
      content = (
        <QuestionScreen title="Here\'s what we heard" helper="This setup is now tailored to your household.">
          <div className="space-y-4">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="text-sm">{mirrorLine}</p>
            </div>
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              Main pressure: <span className="text-foreground">{answers.mainPainPoint}</span>
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
          title="Your sample week is ready"
          helper={`Based on your ${answers.weeklyRhythm.join(', ').toLowerCase()} rhythm and ${answers.dietPreferences.join(', ').toLowerCase()} preferences.`}
        >
          <div className="space-y-5">
            <div className="rounded-xl border border-border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-primary" />
                Dinner preview
              </div>
              <div className="space-y-2">
                {previewWeek.map((item) => (
                  <div key={`${item.day}-${item.recipe.name}`} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
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
        <QuestionScreen title="Ready to run a calmer week?" helper="One tap to lock this in.">
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
                <span>Yes — I want calmer evenings, easier dinners, and less weekly stress.</span>
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
              This helps us keep recommendations aligned to what you care about most.
            </p>
          </div>
        </QuestionScreen>
      );
      footer = <BottomCTA primaryLabel="Continue" onPrimary={goNext} primaryDisabled={!isStepComplete('commitment', answers)} />;
      break;

    case 'paywallPrep':
      content = (
        <QuestionScreen
          title={BILLING_ENABLED ? 'Your personalized plan is ready to unlock' : 'Your Home Harmony plan is ready'}
          helper={
            BILLING_ENABLED
              ? 'You already built your custom week. Continue to unlock it and keep your plan running each week.'
              : 'Meals, groceries, and weekly coordination are now personalized for your household.'
          }
          align="center"
        >
          <div className="h-full grid place-items-center">
            <div className="max-w-md rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-8 text-center">
              <Sparkles className="mx-auto mb-3 h-9 w-9 text-primary" />
              <p className="text-sm text-muted-foreground">{personalizedPlan.summary}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {BILLING_ENABLED
                  ? 'Continue to choose your plan and keep this personalized setup active.'
                  : 'Continue to apply this plan inside the app and keep your week in sync.'}
              </p>
            </div>
          </div>
          {submitError && <p className="mt-4 text-sm text-destructive">{submitError}</p>}
        </QuestionScreen>
      );
      footer = (
        <BottomCTA
          primaryLabel={BILLING_ENABLED ? 'Continue to plans' : 'Apply my plan'}
          onPrimary={completeOnboarding}
          secondaryLabel="Edit answers"
          onSecondary={() => setCurrentStepId('painPoint')}
          loading={submitting}
        />
      );
      break;

    default:
      content = null;
      footer = null;
      break;
  }

  const canContinue = isStepComplete(currentStepId, answers);

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
