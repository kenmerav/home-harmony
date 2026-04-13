import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MacroGoalDialog } from '@/components/nutrition/MacroGoalDialog';
import { DayOfWeek } from '@/types';
import { Lock, Unlock, SkipForward, RefreshCw, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Shuffle, Settings2, Plus, Trash2, Calculator, Sparkles, Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, addWeeks } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  fetchMealsForWeek,
  generateMeals,
  NO_MEAL_NEEDED_LOCK,
  setMealForDay,
  setNoMealNeededForDay,
  swapMeal,
  updateMealRecipe,
  toggleMealLock,
  toggleMealSkip,
  DbPlannedMeal,
  MealGenerationOptions,
} from '@/lib/api/meals';
import { hasRecipeInstructions, normalizeRecipeInstructions } from '@/lib/recipeText';
import { getRecipeImageUrl } from '@/data/recipeImages';
import { estimateCookMinutes } from '@/lib/recipeTime';
import { DbRecipe, fetchRecipes } from '@/lib/api/recipes';
import {
  DinnerReminderPrefs,
  MenuRejuvenatePrefs,
  getDinnerReminderPrefs,
  getDinnerServingsByProfile,
  getDinnerTimeForDay,
  getFavoriteIds,
  getKidFriendlyOverrides,
  getMealMultiplier,
  getMenuRejuvenatePrefs,
  getPlanRules,
  hasShownDinnerReminder,
  markDinnerReminderShown,
  markMenuRejuvenatedForWeek,
  setDinnerReminderPrefs,
  setMealMultiplier,
  setMenuRejuvenatePrefs,
  setPlanRules,
} from '@/lib/mealPrefs';
import { inferKidFriendly } from '@/lib/kidFriendly';
import { trackGrowthEventSafe } from '@/lib/api/growthAnalytics';
import { syncScheduledMealsToCalendar } from '@/lib/calendarStore';
import { useAuth } from '@/contexts/AuthContext';
import {
  calculateMacroRecommendation,
  getProfiles,
  listDashboardProfiles,
  type MacroPlan,
  type MacroQuestionnaire,
} from '@/lib/macroGame';
import {
  addPlannedFoodEntry,
  addOrUpdateCommonFood,
  deletePlannedFoodEntry,
  deletePlannedFoodEntriesByDateAndMealType,
  getCommonFoods,
  getPlannedFoodEntries,
  materializePlannedFoodEntriesForDate,
  listCommonPlannedFoods,
  updatePlannedFoodEntry,
  type PlannedFoodRepeatMode,
  type PlannedFoodEntry,
  type PlannedMealType,
} from '@/lib/mealBudgetPlanner';
import { suggestMealsForRemainingMacros, type MacroMealSuggestion } from '@/lib/macroMealSuggestions';
import { filterAlcoholPresets, findAlcoholPresetById } from '@/lib/alcoholPresets';
import { estimateMealFromDescription, estimateMealFromPhoto } from '@/lib/api/mealPhoto';
import { getMealLogs } from '@/lib/macroGame';
import { loadSmsPreferences, saveSmsPreferences } from '@/lib/api/sms';

const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const dayFullLabels: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

const PLANNED_MEAL_TYPE_OPTIONS: PlannedMealType[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'alcohol',
];

const plannedMealTypeLabel: Record<PlannedMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  dessert: 'Dessert',
  alcohol: 'Alcohol',
};

const dayFromDate = (date: Date): DayOfWeek =>
  (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    date.getDay()
  ] || 'monday') as DayOfWeek;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const normalizeText = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function recipeTitleMatchesQuery(recipeName: string, query: string): boolean {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return true;
  const normalizedName = normalizeText(recipeName);
  if (normalizedName.includes(normalizedQuery)) return true;
  return normalizedQuery.split(' ').filter(Boolean).every((term) => normalizedName.includes(term));
}

function recipeNeedsInstructions(recipe: DbRecipe): boolean {
  return !hasRecipeInstructions(recipe.instructions);
}

function recipePickerLabel(recipe: DbRecipe): string {
  return recipeNeedsInstructions(recipe) ? `${recipe.name} - Needs instructions` : recipe.name;
}

function scoreRecipeForRequest(recipe: DbRecipe, request: string): number {
  const terms = normalizeText(request).split(' ').filter((t) => t.length > 1);
  if (terms.length === 0) return 0;
  const haystack = normalizeText(
    `${recipe.name} ${(recipe.ingredients || []).join(' ')} ${recipe.instructions || ''}`,
  );
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += recipe.name.toLowerCase().includes(term) ? 2 : 1;
  }
  return score;
}

interface PantryMatch {
  recipe: DbRecipe;
  matched: string[];
  missing: string[];
}

type PlannerViewMode = 'weekly-breakfasts' | 'weekly-dinners' | 'weekly-lunches' | 'weekly-snacks' | 'daily-all' | 'weekly-meal-grid';
type TopMealsViewMode = 'dinner-list' | 'breakfast-list' | 'lunch-list' | 'snack-list' | 'weekly-meal-grid';

const plannerViewModeLabel: Record<PlannerViewMode, string> = {
  'daily-all': 'Daily - All Meals',
  'weekly-breakfasts': 'Weekly - Breakfasts',
  'weekly-lunches': 'Weekly - Lunches',
  'weekly-snacks': 'Weekly - Snacks',
  'weekly-dinners': 'Weekly - Dinners',
  'weekly-meal-grid': 'Weekly - Meal Grid',
};

type MealGridRowKey = 'breakfast' | 'snack-1' | 'lunch' | 'snack-2' | 'dinner';

interface MealGridRow {
  key: MealGridRowKey;
  label: string;
  mealType: PlannedMealType;
}

interface GridQuickAddContext {
  date: string;
  mealType: PlannedMealType;
  entryId?: string | null;
}

type PlannerRepeatMode = PlannedFoodRepeatMode;
type DinnerServingsByProfile = Record<string, Record<string, number>>;

const DINNER_SERVINGS_STORAGE_KEY = 'homehub.mealPlannerDinnerServings.v1';
const QUICK_ADD_DRAFT_STORAGE_KEY = 'homehub.mealsQuickAddDraft.v1';

function normalizeIntegerInput(value: string): string {
  const digitsOnly = value.replace(/\D/g, '');
  if (!digitsOnly) return '';
  return digitsOnly.replace(/^0+(?=\d)/, '');
}

function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const [wholeRaw, ...rest] = cleaned.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '');
  if (rest.length === 0) return whole;
  return `${whole || '0'}.${rest.join('').replace(/\./g, '')}`;
}

function formatQuarterStep(value: number): string {
  const rounded = Math.round(value * 4) / 4;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

const MEAL_GRID_ROWS: MealGridRow[] = [
  { key: 'breakfast', label: 'Breakfast', mealType: 'breakfast' },
  { key: 'snack-1', label: 'Snack', mealType: 'snack' },
  { key: 'lunch', label: 'Lunch', mealType: 'lunch' },
  { key: 'snack-2', label: 'Snack', mealType: 'snack' },
  { key: 'dinner', label: 'Dinner', mealType: 'dinner' },
];

function metricProgress(current: number, target: number): number {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min((current / target) * 100, 150));
}

function plannerNeedsMacroSetup(
  profileId: string,
  profileName: string | undefined,
  macroPlan: MacroPlan | undefined,
): boolean {
  if (!macroPlan?.questionnaire) return true;

  const normalizedName = (profileName || '').toLowerCase();
  const femaleHint =
    profileId === 'wife' || normalizedName.includes('wife') || normalizedName.includes('mom');
  const defaultQuestionnaire: MacroQuestionnaire = femaleHint
    ? {
        sex: 'female',
        age: 34,
        heightCm: 165,
        weightKg: 68,
        activityLevel: 'moderate',
        goal: 'fat_loss',
        pace: 'moderate',
      }
    : {
        sex: 'male',
        age: 35,
        heightCm: 180,
        weightKg: 84,
        activityLevel: 'moderate',
        goal: 'muscle_gain',
        pace: 'moderate',
      };

  const defaultRecommendation = calculateMacroRecommendation(defaultQuestionnaire);
  const defaultWaterTarget = femaleHint ? 80 : 100;
  const defaultAlcoholLimit = femaleHint ? 1 : 2;

  return (
    macroPlan.questionnaire.sex === defaultQuestionnaire.sex &&
    macroPlan.questionnaire.age === defaultQuestionnaire.age &&
    macroPlan.questionnaire.heightCm === defaultQuestionnaire.heightCm &&
    macroPlan.questionnaire.weightKg === defaultQuestionnaire.weightKg &&
    macroPlan.questionnaire.activityLevel === defaultQuestionnaire.activityLevel &&
    macroPlan.questionnaire.goal === defaultQuestionnaire.goal &&
    macroPlan.questionnaire.pace === defaultQuestionnaire.pace &&
    macroPlan.calories === defaultRecommendation.calories &&
    macroPlan.protein_g === defaultRecommendation.protein_g &&
    macroPlan.carbs_g === defaultRecommendation.carbs_g &&
    macroPlan.fat_g === defaultRecommendation.fat_g &&
    (macroPlan.bodyUnitSystem || 'imperial') === 'imperial' &&
    Boolean(macroPlan.proteinOnlyMode) === false &&
    (macroPlan.waterTargetOz ?? defaultWaterTarget) === defaultWaterTarget &&
    (macroPlan.alcoholLimitDrinks ?? defaultAlcoholLimit) === defaultAlcoholLimit
  );
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function dinnerServingsStorageKey(userId?: string | null): string {
  return `${DINNER_SERVINGS_STORAGE_KEY}:${userId || 'anon'}`;
}

function readDinnerServings(userId?: string | null): DinnerServingsByProfile {
  return getDinnerServingsByProfile(userId);
}

function writeDinnerServings(values: DinnerServingsByProfile, userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(dinnerServingsStorageKey(userId), JSON.stringify(values));
}

function quickAddDraftStorageKey(userId?: string | null) {
  return `${QUICK_ADD_DRAFT_STORAGE_KEY}:${userId || 'anon'}`;
}

type QuickAddDraft = {
  context: GridQuickAddContext;
  form: {
    date: string;
    mealType: PlannedMealType;
    recipeId: string;
    name: string;
    servings: string;
    calories: string;
    protein_g: string;
    carbs_g: string;
    fat_g: string;
  };
  recipeQuery: string;
  photoNote: string;
  quickAddMode: 'estimate' | 'recipe' | 'manual';
  repeatMode: PlannerRepeatMode;
  repeatDays: DayOfWeek[];
  plannerDay: string;
  suggestionDate: string;
  dashboardId: string;
};

function readQuickAddDraft(userId?: string | null): QuickAddDraft | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(quickAddDraftStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as QuickAddDraft | null;
    if (!parsed || typeof parsed !== 'object' || !parsed.context || !parsed.form) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeQuickAddDraft(userId: string | null | undefined, draft: QuickAddDraft | null) {
  if (!canUseSessionStorage()) return;
  const key = quickAddDraftStorageKey(userId);
  if (!draft) {
    window.sessionStorage.removeItem(key);
    return;
  }
  window.sessionStorage.setItem(key, JSON.stringify(draft));
}

export default function MealsPage() {
  const { user } = useAuth();
  const hasRestoredQuickAddDraftRef = useRef(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [meals, setMeals] = useState<DbPlannedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectiveDialogOpen, setSelectiveDialogOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<DayOfWeek>>(new Set());
  const [selectedMeal, setSelectedMeal] = useState<DbPlannedMeal | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [planRules, setPlanRulesState] = useState<MealGenerationOptions>({
    preferFavorites: true,
    preferKidFriendly: false,
    favoritesOnly: false,
    kidFriendlyOnly: false,
    maxCookMinutes: null,
    dayLocks: {},
  });
  const [dinnerReminderPrefs, setDinnerReminderPrefsState] = useState<DinnerReminderPrefs>({
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
  });
  const [menuRejuvenatePrefs, setMenuRejuvenatePrefsState] = useState<MenuRejuvenatePrefs>({
    enabled: false,
    day: 'friday',
    time: '15:00',
    lastRanForWeekOf: null,
  });
  const [swapDialogMeal, setSwapDialogMeal] = useState<DbPlannedMeal | null>(null);
  const [swapMode, setSwapMode] = useState<'random' | 'choose' | 'request' | 'none'>('random');
  const [allRecipes, setAllRecipes] = useState<DbRecipe[]>([]);
  const [chooseRecipeQuery, setChooseRecipeQuery] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [swapRequest, setSwapRequest] = useState('');
  const [requestMaxMinutes, setRequestMaxMinutes] = useState('');
  const [manualDialogDay, setManualDialogDay] = useState<DayOfWeek | null>(null);
  const [manualRecipeId, setManualRecipeId] = useState('');
  const [manualRecipeQuery, setManualRecipeQuery] = useState('');
  const [macroDialogOpen, setMacroDialogOpen] = useState(false);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [pantryOpen, setPantryOpen] = useState(false);
  const [pantryInput, setPantryInput] = useState('');
  const [pantryMatches, setPantryMatches] = useState<PantryMatch[]>([]);
  const [plannerEntries, setPlannerEntries] = useState<PlannedFoodEntry[]>([]);
  const [mealLogRefreshTick, setMealLogRefreshTick] = useState(0);
  const [topMealsViewMode, setTopMealsViewMode] = useState<TopMealsViewMode>('dinner-list');
  const [plannerViewMode, setPlannerViewMode] = useState<PlannerViewMode>('daily-all');
  const [plannerDay, setPlannerDay] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [plannerExpandedByDate, setPlannerExpandedByDate] = useState<Record<string, boolean>>({});
  const [plannerDashboardId, setPlannerDashboardId] = useState('me');
  const [plannerDinnerServingsByProfile, setPlannerDinnerServingsByProfile] = useState<DinnerServingsByProfile>({});
  const [plannerDinnerAdjustDate, setPlannerDinnerAdjustDate] = useState<string | null>(null);
  const [plannerRecipeQuery, setPlannerRecipeQuery] = useState('');
  const [plannerPhotoNote, setPlannerPhotoNote] = useState('');
  const [plannerQuickAddMode, setPlannerQuickAddMode] = useState<'estimate' | 'recipe' | 'manual'>('estimate');
  const [estimatingPlannerPhoto, setEstimatingPlannerPhoto] = useState(false);
  const [alcoholPresetQuery, setAlcoholPresetQuery] = useState('');
  const [gridQuickAddContext, setGridQuickAddContext] = useState<GridQuickAddContext | null>(null);
  const [plannerRepeatMode, setPlannerRepeatMode] = useState<PlannerRepeatMode>('once');
  const [plannerRepeatDays, setPlannerRepeatDays] = useState<Set<DayOfWeek>>(new Set());
  const [macroSuggestions, setMacroSuggestions] = useState<MacroMealSuggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionDate, setSuggestionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [suggestionRemaining, setSuggestionRemaining] = useState<{
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  } | null>(null);
  const [plannerForm, setPlannerForm] = useState<{
    date: string;
    mealType: PlannedMealType;
    recipeId: string;
    name: string;
    servings: string;
    calories: string;
    protein_g: string;
    carbs_g: string;
    fat_g: string;
  }>({
    date: format(new Date(), 'yyyy-MM-dd'),
    mealType: 'breakfast',
    recipeId: '',
    name: '',
    servings: '1',
    calories: '',
    protein_g: '',
    carbs_g: '',
    fat_g: '',
  });
  const favoriteIds = getFavoriteIds();
  const kidFriendlyOverrides = getKidFriendlyOverrides();
  const { toast } = useToast();
  const isKidFriendlyRecipe = (recipe: DbRecipe) =>
    kidFriendlyOverrides[recipe.id] ?? inferKidFriendly(recipe);

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  const weekLabel = format(weekStart, 'MMM d') + ' – ' + format(addDays(weekStart, 6), 'MMM d');
  const dashboardProfiles = listDashboardProfiles();
  const macroProfiles = getProfiles();
  const plannerDashboard = dashboardProfiles.find((profile) => profile.id === plannerDashboardId) || dashboardProfiles[0] || null;

  const loadMeals = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMealsForWeek(weekOffset);
      setMeals(data);
    } catch (err) {
      console.error('Failed to load meals:', err);
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    setPlanRulesState(getPlanRules());
    setDinnerReminderPrefsState(getDinnerReminderPrefs());
    setMenuRejuvenatePrefsState(getMenuRejuvenatePrefs());
    void loadMeals();
  }, [loadMeals]);

  useEffect(() => {
    const available = dashboardProfiles.map((profile) => profile.id);
    if (available.length === 0) return;
    if (!available.includes(plannerDashboardId)) {
      setPlannerDashboardId(available[0]);
    }
  }, [dashboardProfiles, plannerDashboardId]);

  useEffect(() => {
    setPlannerEntries(getPlannedFoodEntries(user?.id));
  }, [user?.id]);

  useEffect(() => {
    const refresh = () => setPlannerEntries(getPlannedFoodEntries(user?.id));
    window.addEventListener('homehub:planned-food-updated', refresh);
    return () => window.removeEventListener('homehub:planned-food-updated', refresh);
  }, [user?.id]);

  useEffect(() => {
    const refresh = () => setMealLogRefreshTick((prev) => prev + 1);
    window.addEventListener('homehub:macro-state-updated', refresh);
    return () => window.removeEventListener('homehub:macro-state-updated', refresh);
  }, []);

  useEffect(() => {
    setPlannerDinnerServingsByProfile(readDinnerServings(user?.id));
  }, [user?.id]);

  useEffect(() => {
    if (hasRestoredQuickAddDraftRef.current) return;
    const draft = readQuickAddDraft(user?.id);
    hasRestoredQuickAddDraftRef.current = true;
    if (!draft?.context) return;

    setPlannerDashboardId(draft.dashboardId || 'me');
    setPlannerForm(draft.form);
    setPlannerRecipeQuery(draft.recipeQuery || '');
    setPlannerPhotoNote(draft.photoNote || '');
    setPlannerQuickAddMode(draft.quickAddMode || 'estimate');
    setPlannerRepeatMode(draft.repeatMode || 'once');
    setPlannerRepeatDays(new Set(draft.repeatDays || []));
    setPlannerDay(draft.plannerDay || draft.form.date);
    setSuggestionDate(draft.suggestionDate || draft.form.date);
    setGridQuickAddContext(draft.context);
  }, [user?.id]);

  useEffect(() => {
    if (!hasRestoredQuickAddDraftRef.current) return;
    if (!gridQuickAddContext) {
      writeQuickAddDraft(user?.id, null);
      return;
    }

    writeQuickAddDraft(user?.id, {
      context: gridQuickAddContext,
      form: plannerForm,
      recipeQuery: plannerRecipeQuery,
      photoNote: plannerPhotoNote,
      quickAddMode: plannerQuickAddMode,
      repeatMode: plannerRepeatMode,
      repeatDays: Array.from(plannerRepeatDays),
      plannerDay,
      suggestionDate,
      dashboardId: plannerDashboardId,
    });
  }, [
    gridQuickAddContext,
    plannerForm,
    plannerRecipeQuery,
    plannerPhotoNote,
    plannerQuickAddMode,
    plannerRepeatMode,
    plannerRepeatDays,
    plannerDay,
    suggestionDate,
    plannerDashboardId,
    user?.id,
  ]);

  useEffect(() => {
    if (!menuRejuvenatePrefs.enabled) return;

    const now = new Date();
    const scheduled = new Date(now);
    const currentDayIndex = now.getDay();
    const targetDayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(
      menuRejuvenatePrefs.day,
    );
    const delta = targetDayIndex - currentDayIndex;
    const [hour, minute] = menuRejuvenatePrefs.time.split(':').map((x) => Number.parseInt(x, 10) || 0);
    scheduled.setDate(now.getDate() + delta);
    scheduled.setHours(hour, minute, 0, 0);

    if (now < scheduled) return;

    const nextWeekOf = format(addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 1), 'yyyy-MM-dd');
    if (menuRejuvenatePrefs.lastRanForWeekOf === nextWeekOf) return;

    let cancelled = false;
    const run = async () => {
      try {
        await generateMeals(1, undefined, planRules);
        if (cancelled) return;
        markMenuRejuvenatedForWeek(nextWeekOf);
        setMenuRejuvenatePrefsState((prev) => ({ ...prev, lastRanForWeekOf: nextWeekOf }));
        toast({
          title: 'Next week menu regenerated',
          description: `Auto-regenerated week starting ${nextWeekOf}.`,
        });
      } catch (error) {
        console.error('Failed auto-regenerating next week menu:', error);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [menuRejuvenatePrefs, planRules, toast]);

  useEffect(() => {
    if (!dinnerReminderPrefs.enabled) return;
    if (weekOffset !== 0 || meals.length === 0) return;

    const now = new Date();
    const today = dayFromDate(now);
    const todayMeal = meals.find((m) => m.day === today && !m.is_skipped && !!m.recipes);
    if (!todayMeal?.recipes) return;
    const targetDinnerTime = getDinnerTimeForDay(today, dinnerReminderPrefs);

    const cookMinutes = estimateCookMinutes(todayMeal.recipes.instructions) ?? 30;
    const [dinnerHour, dinnerMinute] = targetDinnerTime
      .split(':')
      .map((x) => Number.parseInt(x, 10) || 0);
    const dinnerTime = new Date(now);
    dinnerTime.setHours(dinnerHour, dinnerMinute, 0, 0);
    const prepTime = new Date(dinnerTime.getTime() - cookMinutes * 60_000);
    const reminderWindowEnd = new Date(dinnerTime.getTime() + 90 * 60_000);

    if (now < prepTime || now > reminderWindowEnd) return;

    const dateKey = format(now, 'yyyy-MM-dd');
    if (hasShownDinnerReminder(dateKey, todayMeal.id)) return;

    markDinnerReminderShown(dateKey, todayMeal.id);
    toast({
      title: 'Dinner prep reminder',
      description: `Start "${todayMeal.recipes.name}" now to hit your ${targetDinnerTime} dinner time.`,
    });
  }, [dinnerReminderPrefs, meals, toast, weekOffset]);

  const ensureRecipesLoaded = useCallback(async () => {
    if (allRecipes.length > 0) return allRecipes;
    setRecipesLoading(true);
    try {
      const recipes = await fetchRecipes();
      setAllRecipes(recipes);
      return recipes;
    } finally {
      setRecipesLoading(false);
    }
  }, [allRecipes]);

  useEffect(() => {
    if (!rulesOpen || allRecipes.length > 0) return;
    void ensureRecipesLoaded();
  }, [rulesOpen, allRecipes.length, ensureRecipesLoaded]);

  useEffect(() => {
    if (allRecipes.length > 0 || recipesLoading) return;
    void ensureRecipesLoaded().catch((error) => {
      console.error('Failed preloading recipes:', error);
      setRecipesLoading(false);
    });
  }, [allRecipes.length, ensureRecipesLoaded, recipesLoading]);

  const refreshPlannerEntries = useCallback(() => {
    setPlannerEntries(getPlannedFoodEntries(user?.id));
  }, [user?.id]);

  const savePlanRules = async () => {
    const maxCookMinutes =
      typeof planRules.maxCookMinutes === 'number' && planRules.maxCookMinutes > 0
        ? Math.round(planRules.maxCookMinutes)
        : null;
    const dayLocks = planRules.dayLocks || {};
    const next = {
      preferFavorites: !!planRules.preferFavorites,
      preferKidFriendly: !!planRules.preferKidFriendly,
      favoritesOnly: !!planRules.favoritesOnly,
      kidFriendlyOnly: !!planRules.kidFriendlyOnly,
      maxCookMinutes,
      dayLocks,
    };
    setPlanRulesState(next);
    setPlanRules(next);
    setDinnerReminderPrefs(dinnerReminderPrefs);
    setMenuRejuvenatePrefs(menuRejuvenatePrefs);
    if (user?.id) {
      try {
        const smsPrefs = await loadSmsPreferences();
        await saveSmsPreferences({
          ...smsPrefs,
          preferred_dinner_time: getDinnerTimeForDay('monday', dinnerReminderPrefs),
          dinner_times_by_day: { ...dinnerReminderPrefs.dinnerTimesByDay },
        });
      } catch (error) {
        console.error('Failed syncing dinner reminder times to SMS settings:', error);
      }
    }
    try {
      await syncScheduledMealsToCalendar(meals);
    } catch (error) {
      console.error('Failed syncing meal calendar after rules save:', error);
    }
    setRulesOpen(false);
    toast({ title: 'Planner rules saved' });
  };

  const handleRegenerate = async (daysToRegen?: DayOfWeek[]) => {
    setRegenerating(true);
    try {
      const data = await generateMeals(weekOffset, daysToRegen, planRules);
      setMeals(data);
      toast({ title: 'Meals generated!', description: `${data.length} meals planned for the week` });
      await trackGrowthEventSafe(
        'meals_regenerated',
        {
          weekOffset,
          days: daysToRegen || days,
          preferFavorites: !!planRules.preferFavorites,
          preferKidFriendly: !!planRules.preferKidFriendly,
          favoritesOnly: !!planRules.favoritesOnly,
          kidFriendlyOnly: !!planRules.kidFriendlyOnly,
          maxCookMinutes: planRules.maxCookMinutes || null,
        },
      );
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to generate meals'), variant: 'destructive' });
    } finally {
      setRegenerating(false);
      setSelectiveDialogOpen(false);
      setSelectedDays(new Set());
    }
  };

  const handleSwap = async (meal: DbPlannedMeal) => {
    try {
      const data = await swapMeal(meal.id, meal.week_of, meal.day);
      setMeals(data);
      toast({ title: 'Meal swapped', description: `New recipe for ${dayFullLabels[meal.day as DayOfWeek]}` });
    } catch {
      toast({ title: 'Error', description: 'Failed to swap meal', variant: 'destructive' });
    }
  };

  const openSwapDialog = async (meal: DbPlannedMeal) => {
    setSwapDialogMeal(meal);
    setSwapMode('choose');
    setChooseRecipeQuery('');
    setSelectedRecipeId('');
    setSwapRequest('');
    setRequestMaxMinutes('');
    try {
      await ensureRecipesLoaded();
    } catch {
      toast({ title: 'Error', description: 'Failed to load recipes', variant: 'destructive' });
    }
  };

  const applySwap = async () => {
    if (!swapDialogMeal) return;
    try {
      if (swapMode === 'random') {
        await handleSwap(swapDialogMeal);
      } else if (swapMode === 'none') {
        setMeals((prev) => prev.map((meal) =>
          meal.id === swapDialogMeal.id ? { ...meal, is_skipped: true } : meal,
        ));
        await toggleMealSkip(swapDialogMeal.id, true, swapDialogMeal.week_of);
        toast({ title: 'Meal cleared', description: 'This day is now marked as no meal needed.' });
        setSwapDialogMeal(null);
        return;
      } else if (swapMode === 'choose') {
        const exactMatch = recipeOptions.find(
          (r) => r.name.toLowerCase().trim() === chooseRecipeQuery.toLowerCase().trim(),
        );
        const singleFiltered = chooseRecipeOptions.length === 1 ? chooseRecipeOptions[0] : null;
        const resolvedRecipeId = selectedRecipeId || exactMatch?.id || singleFiltered?.id || '';

        if (!resolvedRecipeId) {
          toast({ title: 'Type or pick a recipe first', variant: 'destructive' });
          return;
        }
        if (resolvedRecipeId === NO_MEAL_NEEDED_LOCK) {
          setMeals((prev) => prev.map((meal) =>
            meal.id === swapDialogMeal.id ? { ...meal, is_skipped: true } : meal,
          ));
          await toggleMealSkip(swapDialogMeal.id, true, swapDialogMeal.week_of);
          toast({ title: 'Meal cleared', description: 'This day is now marked as no meal needed.' });
          setSwapDialogMeal(null);
          return;
        }
        const selectedRecipe = recipeOptions.find((recipe) => recipe.id === resolvedRecipeId);
        if (selectedRecipe && recipeNeedsInstructions(selectedRecipe)) {
          toast({
            title: 'Recipe needs instructions',
            description: `Add instructions to ${selectedRecipe.name} before choosing it.`,
            variant: 'destructive',
          });
          return;
        }
        const data = await updateMealRecipe(swapDialogMeal.id, resolvedRecipeId, swapDialogMeal.week_of);
        setMeals(data);
        toast({ title: 'Meal updated' });
      } else {
        const request = swapRequest.trim();
        if (!request) {
          toast({ title: 'Enter a request first', variant: 'destructive' });
          return;
        }
        const maxMinutes = Number.parseInt(requestMaxMinutes, 10);
        const candidates = allRecipes
          .filter((r) => r.id !== swapDialogMeal.recipe_id)
          .filter((r) => !recipeNeedsInstructions(r))
          .filter((r) => !Number.isFinite(maxMinutes) || maxMinutes <= 0 || (estimateCookMinutes(r.instructions) ?? 9999) <= maxMinutes)
          .map((r) => ({ recipe: r, score: scoreRecipeForRequest(r, request) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score);
        if (candidates.length === 0) {
          toast({ title: 'No matches', description: 'Try a broader request.', variant: 'destructive' });
          return;
        }
        const data = await updateMealRecipe(swapDialogMeal.id, candidates[0].recipe.id, swapDialogMeal.week_of);
        setMeals(data);
        toast({ title: 'Meal swapped', description: `Matched: ${candidates[0].recipe.name}` });
      }
      setSwapDialogMeal(null);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Failed to swap meal'), variant: 'destructive' });
    }
  };

  const toggleDoubleMeal = (mealId: string) => {
    const current = getMealMultiplier(mealId);
    const next = current === 2 ? 1 : 2;
    setMealMultiplier(mealId, next);
    setMeals((prev) => [...prev]);
    toast({ title: next === 2 ? 'Recipe doubled for grocery list' : 'Recipe set to normal size' });
  };

  const runPantryMatcher = async () => {
    try {
      const recipes = await ensureRecipesLoaded();
      const pantryTokens = pantryInput
        .split(/[\n,]/)
        .map((x) => normalizeText(x))
        .filter(Boolean);
      if (pantryTokens.length === 0) {
        setPantryMatches([]);
        return;
      }
      const matches: PantryMatch[] = recipes
        .map((r) => {
          const ingredients = (r.ingredients || []).map((i) => normalizeText(i));
          const matched = pantryTokens.filter((p) => ingredients.some((ing) => ing.includes(p) || p.includes(ing)));
          const missing = ingredients.filter((ing) => !pantryTokens.some((p) => ing.includes(p) || p.includes(ing)));
          return { recipe: r, matched, missing };
        })
        .filter((m) => m.matched.length > 0)
        .sort((a, b) => (b.matched.length - b.missing.length) - (a.matched.length - a.missing.length))
        .slice(0, 12);
      setPantryMatches(matches);
    } catch {
      toast({ title: 'Error', description: 'Failed to run pantry matching', variant: 'destructive' });
    }
  };

  const handleToggleLock = async (meal: DbPlannedMeal) => {
    const newVal = !meal.is_locked;
    setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, is_locked: newVal } : m));
    try {
      await toggleMealLock(meal.id, newVal, meal.week_of);
    } catch {
      setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, is_locked: !newVal } : m));
    }
  };

  const handleToggleSkip = async (meal: DbPlannedMeal) => {
    const newVal = !meal.is_skipped;
    setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, is_skipped: newVal } : m));
    try {
      await toggleMealSkip(meal.id, newVal, meal.week_of);
    } catch {
      setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, is_skipped: !newVal } : m));
    }
  };

  const getMealForDay = (day: DayOfWeek) => meals.find(m => m.day === day);

  const openSelectiveRegenerate = () => {
    const unlocked = days.filter(d => {
      const meal = getMealForDay(d);
      return !meal || !meal.is_locked;
    });
    setSelectedDays(new Set(unlocked));
    setSelectiveDialogOpen(true);
  };

  const toggleDaySelection = (day: DayOfWeek) => {
    const next = new Set(selectedDays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setSelectedDays(next);
  };

  const recipeOptions = allRecipes
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const plannerRecipeOptions = recipeOptions.filter((recipe) =>
    plannerRecipeQuery.trim()
      ? recipeTitleMatchesQuery(recipe.name, plannerRecipeQuery)
      : true,
  );
  const commonFoodOptions = getCommonFoods(user?.id);
  const commonFoodTypeahead = plannerRecipeQuery.trim()
    ? commonFoodOptions.filter((food) => recipeTitleMatchesQuery(food.name, plannerRecipeQuery)).slice(0, 8)
    : [];
  const chooseRecipeOptions = recipeOptions.filter((recipe) =>
    chooseRecipeQuery.trim()
      ? recipeTitleMatchesQuery(recipe.name, chooseRecipeQuery)
      : true,
  );
  const manualRecipeOptions = recipeOptions.filter((recipe) =>
    manualRecipeQuery.trim()
      ? recipeTitleMatchesQuery(recipe.name, manualRecipeQuery)
      : true,
  );
  const plannerRecipeTypeahead = plannerRecipeQuery.trim() ? plannerRecipeOptions.slice(0, 8) : [];
  const chooseRecipeTypeahead = chooseRecipeQuery.trim() ? chooseRecipeOptions : [];
  const manualRecipeTypeahead = manualRecipeQuery.trim() ? manualRecipeOptions.slice(0, 8) : [];
  const manualSelectedRecipe = recipeOptions.find((recipe) => recipe.id === manualRecipeId) || null;
  const manualHasExactSelection =
    !!manualSelectedRecipe &&
    normalizeText(manualSelectedRecipe.name) === normalizeText(manualRecipeQuery.trim());
  const alcoholPresetOptions = filterAlcoholPresets(alcoholPresetQuery).slice(0, 40);

  const setPlannerRepeatModeSafe = (nextMode: PlannerRepeatMode) => {
    setPlannerRepeatMode(nextMode);
    if (nextMode === 'selected_days') {
      setPlannerRepeatDays((prev) => {
        if (prev.size > 0) return prev;
        return new Set<DayOfWeek>([dayFromDate(new Date(`${plannerForm.date}T12:00:00`))]);
      });
    }
  };

  const togglePlannerRepeatDay = (day: DayOfWeek) => {
    setPlannerRepeatDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const updatePlannerFormServings = (nextValue: string) => {
    setPlannerForm((prev) => {
      const normalizedServings = normalizeDecimalInput(nextValue);
      const previousServings = Number.parseFloat(prev.servings);
      const nextServings = Number.parseFloat(normalizedServings);

      if (
        !normalizedServings ||
        !Number.isFinite(previousServings) ||
        previousServings <= 0 ||
        !Number.isFinite(nextServings) ||
        nextServings <= 0
      ) {
        return { ...prev, servings: normalizedServings };
      }

      const scaleValue = (value: string) => {
        if (!value.trim()) return '';
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) return value;
        return String(Math.max(0, Math.round((parsed / previousServings) * nextServings)));
      };

      return {
        ...prev,
        servings: normalizedServings,
        calories: scaleValue(prev.calories),
        protein_g: scaleValue(prev.protein_g),
        carbs_g: scaleValue(prev.carbs_g),
        fat_g: scaleValue(prev.fat_g),
      };
    });
  };

  const nudgePlannerFormServings = (delta: number) => {
    const currentServings = Number.parseFloat(plannerForm.servings);
    const baseValue = Number.isFinite(currentServings) && currentServings > 0 ? currentServings : 1;
    const nextValue = Math.max(0.25, Math.round((baseValue + delta) * 4) / 4);
    updatePlannerFormServings(formatQuarterStep(nextValue));
  };

  const handlePlannerServingsKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      nudgePlannerFormServings(0.25);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      nudgePlannerFormServings(-0.25);
    }
  };

  const snapPlannerFormServingsToQuarter = () => {
    const currentServings = Number.parseFloat(plannerForm.servings);
    if (!Number.isFinite(currentServings) || currentServings <= 0) return;
    updatePlannerFormServings(formatQuarterStep(currentServings));
  };

  const closeGridQuickAdd = () => {
    setGridQuickAddContext(null);
    setPlannerRepeatMode('once');
    setPlannerRepeatDays(new Set());
    setPlannerPhotoNote('');
  };

  const resetPlannerItemFields = (keepRepeat = false) => {
    setPlannerRecipeQuery('');
    setPlannerForm((prev) => ({
      ...prev,
      recipeId: '',
      name: '',
      servings: '1',
      calories: '',
      protein_g: '',
      carbs_g: '',
      fat_g: '',
    }));
    if (!keepRepeat) {
      setPlannerRepeatMode('once');
      setPlannerRepeatDays(new Set());
    }
  };

  const selectRecipeForPlanner = (recipeId: string) => {
    const recipe = recipeOptions.find((entry) => entry.id === recipeId);
    if (!recipe) {
      setPlannerForm((prev) => ({ ...prev, recipeId }));
      if (!recipeId) setPlannerRecipeQuery('');
      return;
    }
    if (recipeNeedsInstructions(recipe)) {
      toast({
        title: 'Recipe needs instructions',
        description: `Add instructions to ${recipe.name} before using it in your meal plan.`,
        variant: 'destructive',
      });
      return;
    }

    setPlannerForm((prev) => ({
      ...prev,
      recipeId: recipe.id,
      name: recipe.name,
      calories: String(Math.round(recipe.calories || 0)),
      protein_g: String(Math.round(recipe.protein_g || 0)),
      carbs_g: String(Math.round(recipe.carbs_g || 0)),
      fat_g: String(Math.round(recipe.fat_g || 0)),
    }));
    // Collapse typeahead list after a recipe is selected.
    setPlannerRecipeQuery('');
    setPlannerQuickAddMode('recipe');
  };

  const selectCommonFoodForPlanner = (commonFoodId: string) => {
    const commonFood = commonFoodOptions.find((entry) => entry.id === commonFoodId);
    if (!commonFood) return;
    setPlannerForm((prev) => ({
      ...prev,
      recipeId: '',
      name: commonFood.name,
      servings: String(commonFood.servings),
      calories: String(commonFood.calories),
      protein_g: String(commonFood.protein_g),
      carbs_g: String(commonFood.carbs_g),
      fat_g: String(commonFood.fat_g),
      mealType: commonFood.defaultMealType || prev.mealType,
    }));
    setPlannerRecipeQuery('');
    setPlannerQuickAddMode('manual');
    toast({
      title: 'Common food loaded',
      description: `${commonFood.name} is ready to add or adjust.`,
    });
  };

  const savePlannerFormAsCommonFood = (options: { silent?: boolean } = {}) => {
    const servings = Number.parseFloat(plannerForm.servings);
    const calories = Number.parseInt(plannerForm.calories, 10);
    const protein = Number.parseInt(plannerForm.protein_g, 10) || 0;
    const carbs = Number.parseInt(plannerForm.carbs_g, 10) || 0;
    const fat = Number.parseInt(plannerForm.fat_g, 10) || 0;

    if (!plannerForm.name.trim()) {
      toast({ title: 'Add a food name first', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(servings) || servings <= 0) {
      toast({ title: 'Servings must be greater than 0', variant: 'destructive' });
      return;
    }
    if (!Number.isFinite(calories) || calories < 0) {
      toast({ title: 'Add calories before saving this common food', variant: 'destructive' });
      return;
    }

    addOrUpdateCommonFood(
      {
        name: plannerForm.name.trim(),
        defaultMealType: plannerForm.mealType,
        servings,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
      },
      user?.id,
    );

    if (!options.silent) {
      toast({
        title: 'Saved to My Foods',
        description: `${plannerForm.name.trim()} will now be easy to reuse without making it a recipe.`,
      });
    }
  };

  const selectRecipeForSwap = (recipeId: string) => {
    const recipe = recipeOptions.find((entry) => entry.id === recipeId);
    if (recipe && recipeNeedsInstructions(recipe)) {
      toast({
        title: 'Recipe needs instructions',
        description: `Add instructions to ${recipe.name} before choosing it.`,
        variant: 'destructive',
      });
      return;
    }
    setSelectedRecipeId(recipeId);
    if (recipe) setChooseRecipeQuery(recipe.name);
  };

  const selectRecipeForManual = (recipeId: string) => {
    const recipe = recipeOptions.find((entry) => entry.id === recipeId);
    if (recipe && recipeNeedsInstructions(recipe)) {
      toast({
        title: 'Recipe needs instructions',
        description: `Add instructions to ${recipe.name} before choosing it.`,
        variant: 'destructive',
      });
      return;
    }
    setManualRecipeId(recipeId);
    if (recipe) setManualRecipeQuery(recipe.name);
  };

  const applyAlcoholPreset = (presetId: string) => {
    const preset = findAlcoholPresetById(presetId);
    if (!preset) return;
    setPlannerForm((prev) => ({
      ...prev,
      mealType: 'alcohol',
      recipeId: '',
      name: `${preset.name} (${preset.serving})`,
      servings: '1',
      calories: String(preset.calories),
      protein_g: String(preset.protein_g),
      carbs_g: String(preset.carbs_g),
      fat_g: String(preset.fat_g),
    }));
    setPlannerRecipeQuery('');
  };

  const getPlannerEstimateServings = () => {
    const trimmed = plannerForm.servings.trim();
    if (!trimmed) return '';
    const numeric = Number.parseFloat(trimmed);
    if (!Number.isFinite(numeric) || numeric <= 0) return '';
    return String(Math.round(numeric * 100) / 100);
  };

  const buildPlannerEstimateNote = () => {
    const servingsText = getPlannerEstimateServings();
    const note = plannerPhotoNote.trim();
    if (servingsText && note) return `${note}. I had ${servingsText} serving${servingsText === '1' ? '' : 's'}.`;
    if (servingsText) return `I had ${servingsText} serving${servingsText === '1' ? '' : 's'} from this nutrition label.`;
    return note;
  };

  const handleEstimatePlannerMealPhoto = async (file: File | null) => {
    if (!file) return;
    setPlannerQuickAddMode('estimate');
    setEstimatingPlannerPhoto(true);
    try {
      const estimateNote = buildPlannerEstimateNote();
      const result = await estimateMealFromPhoto(file, estimateNote);
      if (!result.success || !result.meal) {
        toast({
          title: 'Could not estimate meal',
          description: result.error || 'Try a clearer nutrition label photo or add a short note with what is in the meal.',
          variant: 'destructive',
        });
        return;
      }

      setPlannerForm((prev) => ({
        ...prev,
        recipeId: '',
        name: result.meal?.name || prev.name,
        servings: getPlannerEstimateServings() || '1',
        calories: String(result.meal?.calories || 0),
        protein_g: String(result.meal?.protein_g || 0),
        carbs_g: String(result.meal?.carbs_g || 0),
        fat_g: String(result.meal?.fat_g || 0),
      }));
      setPlannerRecipeQuery('');

      toast({
        title: 'Meal estimated from nutrition label photo',
        description: result.meal.assumptions || `${result.meal.name} was added to the planner form.`,
      });
    } finally {
      setEstimatingPlannerPhoto(false);
    }
  };

  const handleEstimatePlannerMealDescription = async () => {
    const baseNote = plannerPhotoNote.trim();
    if (!baseNote) {
      toast({
        title: 'Describe the meal first',
        description: 'Type what you ate so AI can estimate the calories and macros.',
        variant: 'destructive',
      });
      return;
    }
    const trimmedNote = buildPlannerEstimateNote().trim();

    setPlannerQuickAddMode('estimate');
    setEstimatingPlannerPhoto(true);
    try {
      const result = await estimateMealFromDescription(trimmedNote);
      if (!result.success || !result.meal) {
        toast({
          title: 'Could not estimate meal',
          description: result.error || 'Try adding a little more detail about what you ate.',
          variant: 'destructive',
        });
        return;
      }

      setPlannerForm((prev) => ({
        ...prev,
        recipeId: '',
        name: result.meal?.name || prev.name,
        servings: getPlannerEstimateServings() || '1',
        calories: String(result.meal?.calories || 0),
        protein_g: String(result.meal?.protein_g || 0),
        carbs_g: String(result.meal?.carbs_g || 0),
        fat_g: String(result.meal?.fat_g || 0),
      }));
      setPlannerRecipeQuery('');

      toast({
        title: 'Meal estimated from description',
        description: result.meal.assumptions || `${result.meal.name} was added to the planner form.`,
      });
    } finally {
      setEstimatingPlannerPhoto(false);
    }
  };

  const openManualDialog = async (day: DayOfWeek) => {
    setManualDialogDay(day);
    setManualRecipeId('');
    setManualRecipeQuery('');
    try {
      await ensureRecipesLoaded();
    } catch {
      toast({ title: 'Error', description: 'Failed to load recipes', variant: 'destructive' });
    }
  };

  const applyManualMealForDay = async () => {
    if (!manualDialogDay || !manualRecipeId) {
      toast({ title: 'Choose a recipe first', variant: 'destructive' });
      return;
    }
    const selectedRecipe = recipeOptions.find((recipe) => recipe.id === manualRecipeId);
    if (selectedRecipe && recipeNeedsInstructions(selectedRecipe)) {
      toast({
        title: 'Recipe needs instructions',
        description: `Add instructions to ${selectedRecipe.name} before using it in your meal plan.`,
        variant: 'destructive',
      });
      return;
    }
    try {
      const data = await setMealForDay(weekOffset, manualDialogDay, manualRecipeId);
      setMeals(data);
      setManualDialogDay(null);
      toast({ title: `${dayFullLabels[manualDialogDay]} updated` });
    } catch (error: unknown) {
      toast({
        title: 'Could not set meal',
        description: getErrorMessage(error, 'Failed to save this day.'),
        variant: 'destructive',
      });
    }
  };

  const applyNoMealNeededForDay = async () => {
    if (!manualDialogDay) return;
    try {
      const data = await setNoMealNeededForDay(weekOffset, manualDialogDay);
      setMeals(data);
      setManualDialogDay(null);
      toast({
        title: `${dayFullLabels[manualDialogDay]} updated`,
        description: 'This day is now marked as no meal needed.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Could not update day',
        description: getErrorMessage(error, 'Failed to mark this day as no meal needed.'),
        variant: 'destructive',
      });
    }
  };

  const addPlannerItem = (options: { prepareAnother?: boolean } = {}): boolean => {
    const servings = Number.parseFloat(plannerForm.servings);
    const calories = Number.parseInt(plannerForm.calories, 10);
    const protein = Number.parseInt(plannerForm.protein_g, 10) || 0;
    const carbs = Number.parseInt(plannerForm.carbs_g, 10) || 0;
    const fat = Number.parseInt(plannerForm.fat_g, 10) || 0;

    if (!plannerForm.date) {
      toast({ title: 'Pick a date', variant: 'destructive' });
      return false;
    }
    if (!plannerForm.name.trim()) {
      toast({ title: 'Add a meal/item name', variant: 'destructive' });
      return false;
    }
    if (!Number.isFinite(servings) || servings <= 0) {
      toast({ title: 'Servings must be greater than 0', variant: 'destructive' });
      return false;
    }
    if (!Number.isFinite(calories) || calories < 0) {
      toast({ title: 'Add calories to project totals', variant: 'destructive' });
      return false;
    }
    if (plannerForm.recipeId) {
      const selectedRecipe = recipeOptions.find((recipe) => recipe.id === plannerForm.recipeId);
      if (selectedRecipe && recipeNeedsInstructions(selectedRecipe)) {
        toast({
          title: 'Recipe needs instructions',
          description: `Add instructions to ${selectedRecipe.name} before planning it.`,
          variant: 'destructive',
        });
        return false;
      }
    }

    const repeatDays =
      plannerRepeatMode === 'selected_days'
        ? Array.from(plannerRepeatDays)
        : plannerRepeatMode === 'daily'
          ? [...days]
          : null;
    const targetPersonId = plannerForm.mealType === 'dinner' ? null : plannerDashboard?.id || plannerDashboardId;
    const targetPersonName = plannerForm.mealType === 'dinner' ? null : plannerDashboard?.name || null;
    const shouldAutoSaveToFoods = !plannerForm.recipeId;
    if (gridQuickAddContext?.entryId) {
      updatePlannedFoodEntry(
        gridQuickAddContext.entryId,
        {
          date: plannerForm.date,
          mealType: plannerForm.mealType,
          personId: targetPersonId,
          personName: targetPersonName,
          name: plannerForm.name.trim(),
          servings,
          calories,
          protein_g: protein,
          carbs_g: carbs,
          fat_g: fat,
          sourceRecipeId: plannerForm.recipeId || null,
          repeatMode: plannerRepeatMode,
          repeatDays,
        },
        user?.id,
      );
      if (shouldAutoSaveToFoods) {
        savePlannerFormAsCommonFood({ silent: true });
      }
      refreshPlannerEntries();
      toast({
        title: 'Planned meal updated',
      });
      closeGridQuickAdd();
      return true;
    }

    addPlannedFoodEntry(
      {
        date: plannerForm.date,
        mealType: plannerForm.mealType,
        personId: targetPersonId,
        personName: targetPersonName,
        name: plannerForm.name.trim(),
        servings,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        sourceRecipeId: plannerForm.recipeId || null,
        repeatMode: plannerRepeatMode,
        repeatDays,
      },
      user?.id,
    );
    if (shouldAutoSaveToFoods) {
      savePlannerFormAsCommonFood({ silent: true });
    }
    resetPlannerItemFields(!!options.prepareAnother);
    refreshPlannerEntries();
    toast({
      title: plannerRepeatMode === 'once' ? 'Planned meal added' : 'Recurring meal added',
      description:
        plannerRepeatMode !== 'once'
          ? `${plannerForm.name.trim()} will now repeat ${plannerRepeatMode === 'daily' ? 'every day' : 'on the selected days'} until you delete it${targetPersonName ? ` for ${targetPersonName}` : ''}.`
          : options.prepareAnother
            ? 'Saved. You can add another recipe to this same slot now.'
            : undefined,
    });
    return true;
  };

  const openGridQuickAdd = (date: string, mealType: PlannedMealType) => {
    setPlannerForm((prev) => ({
      ...prev,
      date,
      mealType,
      recipeId: '',
      name: '',
      servings: '1',
      calories: '',
      protein_g: '',
      carbs_g: '',
      fat_g: '',
    }));
    setPlannerRecipeQuery('');
    setPlannerPhotoNote('');
    setPlannerDay(date);
    setSuggestionDate(date);
    setPlannerRepeatMode('once');
    setPlannerRepeatDays(new Set());
    setGridQuickAddContext({ date, mealType, entryId: null });
  };

  const openPlannerEntryEditor = (entry: PlannedFoodEntry) => {
    if (entry.personId && entry.personId !== plannerDashboardId) {
      setPlannerDashboardId(entry.personId);
    }
    setPlannerForm({
      date: entry.date,
      mealType: entry.mealType,
      recipeId: entry.sourceRecipeId || '',
      name: entry.name,
      servings: String(entry.servings),
      calories: String(entry.calories),
      protein_g: String(entry.protein_g),
      carbs_g: String(entry.carbs_g),
      fat_g: String(entry.fat_g),
    });
    setPlannerRecipeQuery('');
    setPlannerPhotoNote(entry.name);
    setPlannerDay(entry.date);
    setSuggestionDate(entry.date);
    setPlannerRepeatMode(entry.repeatMode || 'once');
    setPlannerRepeatDays(new Set(entry.repeatDays || []));
    setGridQuickAddContext({ date: entry.date, mealType: entry.mealType, entryId: entry.id });
  };

  const openPlannerQuickAdd = () => {
    const nextDate = plannerDay || format(new Date(), 'yyyy-MM-dd');
    setPlannerForm((prev) => ({
      ...prev,
      date: nextDate,
      recipeId: '',
      name: '',
      servings: '1',
      calories: '',
      protein_g: '',
      carbs_g: '',
      fat_g: '',
    }));
    setPlannerRecipeQuery('');
    setPlannerPhotoNote('');
    setSuggestionDate(nextDate);
    setPlannerRepeatMode('once');
    setPlannerRepeatDays(new Set());
    setGridQuickAddContext({ date: nextDate, mealType: plannerForm.mealType });
  };

  const commonPlannedFoods = listCommonPlannedFoods(user?.id, 10);

  const weekDateRows = days.map((day, index) => ({
    day,
    date: format(addDays(weekStart, index), 'yyyy-MM-dd'),
  }));
  const dinnerBaseByDate = new Map<string, { name: string; calories: number; protein_g: number; carbs_g: number; fat_g: number }>();
  for (const row of weekDateRows) {
    const meal = getMealForDay(row.day);
    if (!meal || meal.is_skipped || !meal.recipes) continue;
    dinnerBaseByDate.set(row.date, {
      name: meal.recipes.name,
      calories: Math.round(meal.recipes.calories || 0),
      protein_g: Math.round(meal.recipes.protein_g || 0),
      carbs_g: Math.round(meal.recipes.carbs_g || 0),
      fat_g: Math.round(meal.recipes.fat_g || 0),
    });
  }

  const getDinnerServingsForDate = (date: string) => {
    const value = plannerDinnerServingsByProfile[plannerDashboardId]?.[date];
    return Number.isFinite(value) ? Math.min(6, Math.max(0, value)) : 1;
  };

  const updateDinnerServingsForDate = (date: string, servings: number) => {
    const normalized = Math.min(6, Math.max(0, Math.round(servings * 100) / 100));
    setPlannerDinnerServingsByProfile((prev) => {
      const nextProfile = {
        ...(prev[plannerDashboardId] || {}),
        [date]: normalized,
      };
      const next = {
        ...prev,
        [plannerDashboardId]: nextProfile,
      };
      writeDinnerServings(next, user?.id);
      return next;
    });
  };

  const scopedPlannerEntries = plannerEntries.filter((entry) => {
    if (entry.mealType === 'dinner') {
      return !entry.personId;
    }
    return !entry.personId || entry.personId === plannerDashboardId;
  });
  const scopedMealLogs = useMemo(
    () =>
      getMealLogs().filter((log) => {
        if (plannerDashboardId === 'me') {
          return !log.person || log.person === 'me';
        }
        return log.person === plannerDashboardId;
      }),
    [mealLogRefreshTick, plannerDashboardId],
  );

  const entriesByDate = weekDateRows.reduce<Record<string, PlannedFoodEntry[]>>((acc, row) => {
    acc[row.date] = materializePlannedFoodEntriesForDate(scopedPlannerEntries, row.date);
    return acc;
  }, {});

  const macroTarget =
    macroProfiles[plannerDashboardId]?.macroPlan || macroProfiles.me?.macroPlan || {
      calories: 2000,
      protein_g: 140,
      carbs_g: 180,
      fat_g: 70,
    };
  const selectedMacroProfile = macroProfiles[plannerDashboardId] || macroProfiles.me;
  const shouldShowPlannerMacroCalculator = plannerNeedsMacroSetup(
    plannerDashboardId,
    plannerDashboard?.name,
    selectedMacroProfile?.macroPlan,
  );

  const projectedByDate = weekDateRows.reduce<
    Record<string, { calories: number; protein_g: number; carbs_g: number; fat_g: number }>
  >((acc, row) => {
    const dinnerBase = dinnerBaseByDate.get(row.date);
    const dinnerServings = getDinnerServingsForDate(row.date);
    const entries = entriesByDate[row.date] || [];
    const totals = {
      calories: Math.round((dinnerBase?.calories || 0) * dinnerServings),
      protein_g: Math.round((dinnerBase?.protein_g || 0) * dinnerServings),
      carbs_g: Math.round((dinnerBase?.carbs_g || 0) * dinnerServings),
      fat_g: Math.round((dinnerBase?.fat_g || 0) * dinnerServings),
    };
    for (const entry of entries) {
      totals.calories += entry.calories;
      totals.protein_g += entry.protein_g;
      totals.carbs_g += entry.carbs_g;
      totals.fat_g += entry.fat_g;
    }
    acc[row.date] = totals;
    return acc;
  }, {});

  const getProjectedForDateAndView = (
    date: string,
    viewMode: PlannerViewMode = plannerViewMode,
  ): { calories: number; protein_g: number; carbs_g: number; fat_g: number } => {
    const dinnerBase = dinnerBaseByDate.get(date);
    const dinnerServings = getDinnerServingsForDate(date);
    const entries = entriesByDate[date] || [];

    if (viewMode === 'daily-all' || viewMode === 'weekly-meal-grid') {
      return projectedByDate[date] || { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
    }

    const totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };

    if (viewMode === 'weekly-dinners' && dinnerBase) {
      totals.calories += Math.round(dinnerBase.calories * dinnerServings);
      totals.protein_g += Math.round(dinnerBase.protein_g * dinnerServings);
      totals.carbs_g += Math.round(dinnerBase.carbs_g * dinnerServings);
      totals.fat_g += Math.round(dinnerBase.fat_g * dinnerServings);
    }

    const filteredEntries = entries.filter((entry) => {
      if (viewMode === 'weekly-breakfasts') return entry.mealType === 'breakfast';
      if (viewMode === 'weekly-lunches') return entry.mealType === 'lunch';
      if (viewMode === 'weekly-snacks') return entry.mealType === 'snack';
      if (viewMode === 'weekly-dinners') return entry.mealType === 'dinner';
      return true;
    });

    for (const entry of filteredEntries) {
      totals.calories += entry.calories;
      totals.protein_g += entry.protein_g;
      totals.carbs_g += entry.carbs_g;
      totals.fat_g += entry.fat_g;
    }

    return totals;
  };

  const firstPlannerDateWithContent =
    weekDateRows.find((row) => Boolean(dinnerBaseByDate.get(row.date)) || (entriesByDate[row.date]?.length ?? 0) > 0)?.date ||
    weekDateRows[0]?.date ||
    format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const weekStartDate = weekDateRows[0]?.date;
    const weekEndDate = weekDateRows[weekDateRows.length - 1]?.date;
    if (!weekStartDate || !weekEndDate) return;
    if (plannerDay >= weekStartDate && plannerDay <= weekEndDate) return;

    setPlannerDay(firstPlannerDateWithContent);
    setPlannerForm((prev) => (prev.date === firstPlannerDateWithContent ? prev : { ...prev, date: firstPlannerDateWithContent }));
    setSuggestionDate(firstPlannerDateWithContent);
  }, [firstPlannerDateWithContent, plannerDay, weekDateRows]);

  const applyMacroSuggestionToPlanner = (suggestion: MacroMealSuggestion) => {
    setPlannerForm((prev) => ({
      ...prev,
      date: suggestionDate,
      recipeId: suggestion.recipeId,
      name: suggestion.name,
      calories: String(suggestion.calories),
      protein_g: String(suggestion.protein_g),
      carbs_g: String(suggestion.carbs_g),
      fat_g: String(suggestion.fat_g),
    }));
    setPlannerRecipeQuery('');
    toast({
      title: 'Suggestion applied',
      description: 'Added to planner form. Click "Add to plan" to save it.',
    });
  };

  const runMacroSuggestions = async () => {
    if (!suggestionDate) {
      toast({ title: 'Pick a date first', variant: 'destructive' });
      return;
    }
    setSuggestionLoading(true);
    try {
      const recipes = await ensureRecipesLoaded();
      const projected = getProjectedForDateAndView(suggestionDate, 'daily-all');
      const remaining = {
        calories: macroTarget.calories - projected.calories,
        protein_g: macroTarget.protein_g - projected.protein_g,
        carbs_g: macroTarget.carbs_g - projected.carbs_g,
        fat_g: macroTarget.fat_g - projected.fat_g,
      };
      setSuggestionRemaining(remaining);

      const suggestions = suggestMealsForRemainingMacros({
        recipes,
        target: macroTarget,
        projected,
        desiredMealType: plannerForm.mealType,
        limit: 6,
      });

      setMacroSuggestions(suggestions);
      if (!suggestions.length) {
        toast({
          title: 'No suggestions yet',
          description: 'Add recipes first, then try suggestions again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Could not generate suggestions',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setSuggestionLoading(false);
    }
  };

  const pickSuggestedRecipeForMealType = (
    candidates: DbRecipe[],
    usedRecipeIds: Set<string>,
  ): DbRecipe | null => {
    if (candidates.length === 0) return null;
    const available = candidates.filter((recipe) => !usedRecipeIds.has(recipe.id));
    const pool = available.length > 0 ? available : candidates;
    const weightedPool = pool.flatMap((recipe) =>
      favoriteIds.has(recipe.id) ? [recipe, recipe, recipe] : [recipe],
    );
    return weightedPool[Math.floor(Math.random() * weightedPool.length)] || null;
  };

  const regeneratePlannerGridRow = async (row: MealGridRow) => {
    if (row.mealType === 'dinner') {
      await handleRegenerate();
      return;
    }

    const recipes = await ensureRecipesLoaded();
    const mealType = row.mealType;
    const isSnackFirstSlot = row.key === 'snack-1';
    const isSnackSecondSlot = row.key === 'snack-2';

    const candidatePool = recipes.filter((recipe) => {
      if (mealType === 'breakfast') return recipe.meal_type === 'breakfast' || recipe.meal_type === 'snack';
      if (mealType === 'lunch') return recipe.meal_type === 'lunch' || recipe.meal_type === 'dinner';
      if (mealType === 'snack') return recipe.meal_type === 'snack' || recipe.meal_type === 'breakfast';
      return recipe.meal_type === mealType;
    });

    const filteredCandidatePool = candidatePool.filter((recipe) => {
      if (planRules.favoritesOnly && !favoriteIds.has(recipe.id)) return false;
      if (planRules.kidFriendlyOnly && !isKidFriendlyRecipe(recipe)) return false;
      return true;
    });

    if (filteredCandidatePool.length === 0) {
      toast({
        title: `No ${plannedMealTypeLabel[mealType].toLowerCase()} recipes found`,
        description: `Try loosening favorites/kid-friendly filters or import more ${plannedMealTypeLabel[mealType].toLowerCase()} recipes.`,
        variant: 'destructive',
      });
      return;
    }

    const usedRecipeIds = new Set<string>();
    let updatedCount = 0;

    for (const rowDate of weekDateRows) {
      const entriesForDate = (entriesByDate[rowDate.date] || []).filter((entry) => entry.mealType === mealType);
      if (isSnackFirstSlot) {
        if (entriesForDate[0]) {
          deletePlannedFoodEntry(entriesForDate[0].id, user?.id);
        }
      } else if (isSnackSecondSlot) {
        if (entriesForDate[1]) {
          deletePlannedFoodEntry(entriesForDate[1].id, user?.id);
        }
      } else {
        deletePlannedFoodEntriesByDateAndMealType(
          rowDate.date,
          mealType,
          mealType === 'dinner' ? null : plannerDashboardId,
          user?.id,
        );
      }

      const pickedRecipe = pickSuggestedRecipeForMealType(filteredCandidatePool, usedRecipeIds);
      if (!pickedRecipe) continue;
      usedRecipeIds.add(pickedRecipe.id);

      addPlannedFoodEntry(
        {
          date: rowDate.date,
          mealType,
          personId: mealType === 'dinner' ? null : plannerDashboard?.id || plannerDashboardId,
          personName: mealType === 'dinner' ? null : plannerDashboard?.name || null,
          name: pickedRecipe.name,
          servings: 1,
          calories: Math.max(0, Math.round(pickedRecipe.calories || 0)),
          protein_g: Math.max(0, Math.round(pickedRecipe.protein_g || 0)),
          carbs_g: Math.max(0, Math.round(pickedRecipe.carbs_g || 0)),
          fat_g: Math.max(0, Math.round(pickedRecipe.fat_g || 0)),
          sourceRecipeId: pickedRecipe.id,
        },
        user?.id,
      );
      updatedCount += 1;
    }

    refreshPlannerEntries();
    toast({
      title: `${row.label} regenerated`,
      description: `Updated ${updatedCount} day${updatedCount === 1 ? '' : 's'} for this week.`,
    });
  };

  const plannerRows =
    plannerViewMode === 'daily-all'
      ? weekDateRows.filter((row) => row.date === plannerDay)
      : weekDateRows;
  const focusedProjected = getProjectedForDateAndView(plannerDay, plannerViewMode);
  const focusedCalorieDelta = focusedProjected.calories - macroTarget.calories;
  const focusedCalorieStatus =
    focusedCalorieDelta > 0
      ? `${focusedCalorieDelta} over target`
      : focusedCalorieDelta < 0
      ? `${Math.abs(focusedCalorieDelta)} under target`
      : 'On target';
  const focusedCalorieProgress = metricProgress(focusedProjected.calories, macroTarget.calories);
  const focusedProteinProgress = metricProgress(focusedProjected.protein_g, macroTarget.protein_g);
  const focusedCarbsProgress = metricProgress(focusedProjected.carbs_g, macroTarget.carbs_g);
  const focusedFatProgress = metricProgress(focusedProjected.fat_g, macroTarget.fat_g);
  const focusedProteinCals = Math.max(0, focusedProjected.protein_g * 4);
  const focusedCarbsCals = Math.max(0, focusedProjected.carbs_g * 4);
  const focusedFatCals = Math.max(0, focusedProjected.fat_g * 9);
  const focusedMacroCalTotal = focusedProteinCals + focusedCarbsCals + focusedFatCals;
  const focusedProteinDeg = focusedMacroCalTotal > 0 ? (focusedProteinCals / focusedMacroCalTotal) * 360 : 0;
  const focusedCarbsDeg = focusedMacroCalTotal > 0 ? (focusedCarbsCals / focusedMacroCalTotal) * 360 : 0;
  const focusedMacroPie = focusedMacroCalTotal > 0
    ? `conic-gradient(#2f7d5b 0 ${focusedProteinDeg}deg, #d28f2a ${focusedProteinDeg}deg ${focusedProteinDeg + focusedCarbsDeg}deg, #b4506d ${focusedProteinDeg + focusedCarbsDeg}deg 360deg)`
    : 'conic-gradient(#d1d5db 0 360deg)';
  const focusedDinnerServings = getDinnerServingsForDate(plannerDay);
  const focusedHasSharedDinner = Boolean(dinnerBaseByDate.get(plannerDay));

  const getEntriesForGridCell = (entries: PlannedFoodEntry[], row: MealGridRow): PlannedFoodEntry[] => {
    if (row.key === 'snack-1') return entries.filter((entry) => entry.mealType === 'snack').slice(0, 1);
    if (row.key === 'snack-2') return entries.filter((entry) => entry.mealType === 'snack').slice(1, 2);
    return entries.filter((entry) => entry.mealType === row.mealType);
  };

  return (
    <AppLayout>
      <PageHeader
        title="Weekly Meals"
        subtitle="Dinner plan for the week"
        action={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            <Button size="sm" onClick={() => handleRegenerate()} disabled={regenerating}>
              <RefreshCw className={cn("w-4 h-4 mr-2", regenerating && "animate-spin")} />
              Regenerate
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPantryOpen(true)}>
              What Can I Make?
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRulesOpen(true)}>
              <Settings2 className="w-4 h-4 mr-2" />
              Rules
            </Button>
            <Button size="sm" variant="outline" onClick={openSelectiveRegenerate} disabled={regenerating}>
              <Shuffle className="w-4 h-4 mr-2" />
              Choose
            </Button>
          </div>
        }
      />

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(prev => prev - 1)}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <p className="font-medium">{weekLabel}</p>
          {weekOffset === 0 && <p className="text-xs text-muted-foreground">This Week</p>}
        </div>
        <Button variant="ghost" size="icon" onClick={() => setWeekOffset(prev => prev + 1)}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={topMealsViewMode === 'breakfast-list' ? 'default' : 'outline'}
          onClick={() => setTopMealsViewMode('breakfast-list')}
        >
          Breakfast List
        </Button>
        <Button
          size="sm"
          variant={topMealsViewMode === 'lunch-list' ? 'default' : 'outline'}
          onClick={() => setTopMealsViewMode('lunch-list')}
        >
          Lunch List
        </Button>
        <Button
          size="sm"
          variant={topMealsViewMode === 'snack-list' ? 'default' : 'outline'}
          onClick={() => setTopMealsViewMode('snack-list')}
        >
          Snack List
        </Button>
        <Button
          size="sm"
          variant={topMealsViewMode === 'dinner-list' ? 'default' : 'outline'}
          onClick={() => setTopMealsViewMode('dinner-list')}
        >
          Dinner List
        </Button>
        <Button
          size="sm"
          variant={topMealsViewMode === 'weekly-meal-grid' ? 'default' : 'outline'}
          onClick={() => setTopMealsViewMode('weekly-meal-grid')}
          className="hidden md:inline-flex"
        >
          Weekly Meal Grid
        </Button>
        {dashboardProfiles.length > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Adult dashboard</span>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={plannerDashboardId}
              onChange={(event) => setPlannerDashboardId(event.target.value)}
            >
              {dashboardProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {days.map(d => (
            <div key={d} className="bg-card rounded-xl border border-border p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {meals.length === 0 && (
            <div className="text-center py-6 text-muted-foreground">
              <RefreshCw className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No meals planned for this week yet.</p>
              <p className="text-sm mt-1">Use "Add Meal" on any day or click Regenerate.</p>
            </div>
          )}
          {topMealsViewMode === 'weekly-meal-grid' ? (
            <>
            <div className="rounded-lg border border-border bg-card p-4 md:hidden">
              <p className="text-sm text-muted-foreground">
                Weekly meal grid is optimized for tablet/desktop.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setTopMealsViewMode('dinner-list')}
              >
                Switch to dinner list
              </Button>
            </div>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <div
                className="grid min-w-[900px]"
                style={{ gridTemplateColumns: '220px repeat(7, minmax(100px, 1fr))' }}
              >
                <div className="border-b border-r border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Meal
                </div>
                {weekDateRows.map((row) => (
                  <div
                    key={`top-grid-header-${row.date}`}
                    className="border-b border-r border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground last:border-r-0"
                  >
                    {format(new Date(`${row.date}T00:00:00`), 'EEE d')}
                  </div>
                ))}
                {MEAL_GRID_ROWS.map((gridRow) => (
                  <Fragment key={`top-grid-row-${gridRow.key}`}>
                    <div className="border-b border-r border-border bg-muted/10 px-3 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="text-sm font-medium text-foreground">{gridRow.label}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto justify-start px-0 py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => void regeneratePlannerGridRow(gridRow)}
                          disabled={regenerating || recipesLoading}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          Regenerate
                        </Button>
                      </div>
                    </div>
                    {weekDateRows.map((row) => {
                      const dayMeal = getMealForDay(row.day);
                      const entries = entriesByDate[row.date] || [];
                      const cellEntries = getEntriesForGridCell(entries, gridRow);
                      const showDinner = gridRow.key === 'dinner' && dayMeal?.recipes && !dayMeal.is_skipped;

                      return (
                        <div
                          key={`top-grid-cell-${gridRow.key}-${row.date}`}
                          className="border-b border-r border-border p-2 last:border-r-0"
                        >
                          <div className="space-y-2">
                            {showDinner && dayMeal?.recipes && (
                              <div
                                className="cursor-pointer rounded-md border border-border bg-primary/5 px-2 py-1.5"
                                onClick={() => setSelectedMeal(dayMeal)}
                              >
                                <p className="text-xs font-medium leading-tight">{dayMeal.recipes.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {Math.round(dayMeal.recipes.calories || 0)} cal
                                </p>
                                <div className="mt-1 flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openSwapDialog(dayMeal);
                                    }}
                                  >
                                    Swap
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void openManualDialog(row.day);
                                    }}
                                  >
                                    Change
                                  </Button>
                                </div>
                              </div>
                            )}
                            {cellEntries.map((entry) => (
                              <div key={entry.id} className="rounded-md border border-border bg-background px-2 py-1.5">
                                <div className="flex items-start justify-between gap-1">
                                  <p className="text-xs font-medium leading-tight">{entry.name}</p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => {
                                      deletePlannedFoodEntry(entry.id, user?.id);
                                      refreshPlannerEntries();
                                    }}
                                    title="Remove planned item"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {entry.calories} cal
                                </p>
                              </div>
                            ))}
                            {!showDinner && cellEntries.length === 0 && (
                              <div className="rounded-md border border-dashed border-border px-2 py-2 text-center text-[11px] text-muted-foreground">
                                Empty
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-full text-xs"
                              onClick={() => openGridQuickAdd(row.date, gridRow.mealType)}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              Add
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            </>
          ) : topMealsViewMode === 'dinner-list' ? (
            <div className="space-y-3 stagger-children">
              {days.map((day, index) => {
                const meal = getMealForDay(day);
                const date = format(addDays(weekStart, index), 'd');
                const isToday = format(addDays(weekStart, index), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                const recipe = meal?.recipes;

                return (
                  <div
                    key={day}
                    className={cn(
                      'bg-card rounded-xl border border-border p-4 transition-gentle',
                      isToday && 'ring-2 ring-primary/20 border-primary/30',
                      meal?.is_skipped && 'opacity-60',
                    )}
                  >
                    <div
                      className={cn('flex items-start gap-4', meal?.recipes && !meal?.is_skipped && 'cursor-pointer')}
                      onClick={() => {
                        if (meal?.recipes && !meal.is_skipped) setSelectedMeal(meal);
                      }}
                    >
                      <div className={cn('w-12 text-center flex-shrink-0', isToday && 'text-primary')}>
                        <p className="text-xs font-medium uppercase text-muted-foreground">{dayLabels[day]}</p>
                        <p className={cn('text-2xl font-display font-semibold', isToday ? 'text-primary' : 'text-foreground')}>
                          {date}
                        </p>
                      </div>

                      <div className="flex-1 min-w-0">
                        {meal && recipe && !meal.is_skipped ? (
                          <div>
                            <h3 className="font-medium text-foreground">{recipe.name}</h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span>{recipe.calories} cal</span>
                              <span>•</span>
                              <span>{recipe.protein_g}g protein</span>
                              {estimateCookMinutes(recipe.instructions) && (
                                <>
                                  <span>•</span>
                                  <span>{estimateCookMinutes(recipe.instructions)} min</span>
                                </>
                              )}
                              {favoriteIds.has(recipe.id) && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary">Favorite</span>
                                </>
                              )}
                              {isKidFriendlyRecipe(recipe) && (
                                <>
                                  <span>•</span>
                                  <span className="text-accent">Kid Friendly</span>
                                </>
                              )}
                              {recipe.is_anchored && (
                                <>
                                  <span>•</span>
                                  <span className="text-primary text-xs">Anchored</span>
                                </>
                              )}
                            </div>
                          </div>
                        ) : meal?.is_skipped ? (
                          <div className="text-muted-foreground">
                            <p className="font-medium">No meal needed</p>
                            <p className="text-sm">This day is intentionally left empty.</p>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">
                            <p className="text-sm">No meal planned</p>
                          </div>
                        )}
                      </div>

                      {meal ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSwapDialog(meal);
                            }}
                            title="Swap meal"
                          >
                            Swap
                          </Button>
                          <Button
                            variant={getMealMultiplier(meal.id) === 2 ? 'default' : 'ghost'}
                            size="sm"
                            className="h-8 min-w-8 px-2 text-xs font-semibold"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDoubleMeal(meal.id);
                            }}
                            title="Double recipe for grocery list"
                          >
                            2x
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleLock(meal);
                            }}
                          >
                            {meal.is_locked ? <Lock className="w-4 h-4 text-primary" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSkip(meal);
                            }}
                          >
                            <SkipForward className={cn('w-4 h-4', meal.is_skipped ? 'text-destructive' : 'text-muted-foreground')} />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              void openManualDialog(day);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Meal
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {weekDateRows.map((row) => {
                const mealType: PlannedMealType =
                  topMealsViewMode === 'breakfast-list'
                    ? 'breakfast'
                    : topMealsViewMode === 'snack-list'
                    ? 'snack'
                    : 'lunch';
                const label =
                  mealType === 'breakfast'
                    ? 'Breakfast'
                    : mealType === 'snack'
                    ? 'Snack'
                    : 'Lunch';
                const entries = (entriesByDate[row.date] || []).filter((entry) => entry.mealType === mealType);
                const loggedEntries = scopedMealLogs.filter(
                  (log) => log.date === row.date && log.mealType === mealType,
                );
                const date = format(new Date(`${row.date}T00:00:00`), 'd');
                const isToday = row.date === format(new Date(), 'yyyy-MM-dd');

                return (
                  <div
                    key={`top-list-${mealType}-${row.date}`}
                    className={cn(
                      'bg-card rounded-xl border border-border p-4 transition-gentle',
                      isToday && 'ring-2 ring-primary/20 border-primary/30',
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn('w-12 text-center flex-shrink-0', isToday && 'text-primary')}>
                        <p className="text-xs font-medium uppercase text-muted-foreground">{dayLabels[row.day]}</p>
                        <p className={cn('text-2xl font-display font-semibold', isToday ? 'text-primary' : 'text-foreground')}>
                          {date}
                        </p>
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        {entries.length > 0 ? (
                          entries.map((entry) => (
                            <div
                              key={entry.id}
                              role="button"
                              tabIndex={0}
                              className="w-full rounded-md border border-border px-3 py-2 text-left transition-colors hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                              onClick={() => openPlannerEntryEditor(entry)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  openPlannerEntryEditor(entry);
                                }
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium">
                                    {label}: {entry.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {entry.servings}x • {entry.calories} cal • {entry.protein_g}P • {entry.carbs_g}C • {entry.fat_g}F
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deletePlannedFoodEntry(entry.id, user?.id);
                                    refreshPlannerEntries();
                                  }}
                                  title="Remove planned item"
                                >
                                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          ))
                        ) : loggedEntries.length > 0 ? (
                          loggedEntries.map((entry) => (
                            <div key={entry.id} className="rounded-md border border-border bg-muted/10 px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium">
                                    {label}: {entry.recipeName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Logged • {entry.macros.calories} cal • {entry.macros.protein_g}P • {entry.macros.carbs_g}C • {entry.macros.fat_g}F
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">No {label.toLowerCase()} planned yet.</p>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => openGridQuickAdd(row.date, mealType)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add {label}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shuffle className="w-3.5 h-3.5" />
          <span>Swap</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5" />
          <span>Locked</span>
        </div>
        <div className="flex items-center gap-1.5">
          <SkipForward className="w-3.5 h-3.5" />
          <span>Skipped</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold leading-none">2x</span>
          <span>2x Grocery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>Anchored</span>
        </div>
      </div>

      <Accordion type="single" collapsible defaultValue="macro-budget-planner" className="mt-8 rounded-xl border border-border bg-card px-4">
        <AccordionItem value="macro-budget-planner" className="border-0">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="text-left">
              <h2 className="font-display text-xl">Macro Budget Planner</h2>
              <p className="text-sm text-muted-foreground">
                Plan out your meals for the week to make sure they fit your macros.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {focusedHasSharedDinner ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Dinner servings
                    </span>
                    {['0', '0.5', '1', '1.5', '2'].map((value) => (
                      <Button
                        key={`focused-dinner-serving-${plannerDay}-${value}`}
                        type="button"
                        size="sm"
                        variant={String(focusedDinnerServings) === value ? 'default' : 'outline'}
                        onClick={() => updateDinnerServingsForDate(plannerDay, Number(value))}
                      >
                        {value}x
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div />
                )}
                <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-muted-foreground">Target profile</span>
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={plannerDashboardId}
                  onChange={(event) => setPlannerDashboardId(event.target.value)}
                >
                  {dashboardProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                {shouldShowPlannerMacroCalculator ? (
                  <Button size="sm" variant="outline" onClick={() => setMacroDialogOpen(true)}>
                    <Calculator className="w-4 h-4 mr-1.5" />
                    Macro Calculator
                  </Button>
                ) : null}
                <Button size="sm" onClick={openPlannerQuickAdd}>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Food
                </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Breakfast, lunch, snacks, desserts, and drinks are planned for the selected adult dashboard. Dinner stays shared for the household.
              </p>

        <div className="grid gap-2 md:grid-cols-[220px_220px_1fr]">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">View mode</p>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={plannerViewMode}
              onChange={(event) => setPlannerViewMode(event.target.value as PlannerViewMode)}
            >
              {Object.entries(plannerViewModeLabel).map(([mode, label]) => (
                <option key={mode} value={mode}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Focus date</p>
            <Input
              type="date"
              value={plannerDay}
              onChange={(event) => {
                setPlannerDay(event.target.value);
                setPlannerForm((prev) => ({ ...prev, date: event.target.value }));
                setSuggestionDate(event.target.value);
              }}
            />
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">Focused day status</p>
            <p className="text-sm font-medium">
              {focusedProjected.calories} / {macroTarget.calories} cal • {focusedProjected.protein_g}P • {focusedProjected.carbs_g}C •{' '}
              {focusedProjected.fat_g}F
            </p>
            <p className={cn('text-xs', focusedCalorieDelta > 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {focusedCalorieStatus}
            </p>
          </div>
        </div>
        <div className="rounded-md border border-border bg-muted/10 p-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              {[
                { label: 'Calories', current: focusedProjected.calories, target: macroTarget.calories, progress: focusedCalorieProgress, color: 'bg-primary' },
                { label: 'Protein', current: focusedProjected.protein_g, target: macroTarget.protein_g, progress: focusedProteinProgress, color: 'bg-emerald-500' },
                { label: 'Carbs', current: focusedProjected.carbs_g, target: macroTarget.carbs_g, progress: focusedCarbsProgress, color: 'bg-amber-500' },
                { label: 'Fat', current: focusedProjected.fat_g, target: macroTarget.fat_g, progress: focusedFatProgress, color: 'bg-rose-500' },
              ].map((metric) => (
                <div key={`focused-metric-${metric.label}`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>{metric.label}</span>
                    <span className="text-muted-foreground">
                      {Math.round(metric.current)}/{Math.round(metric.target)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-2 rounded-full transition-all', metric.color)}
                      style={{ width: `${Math.min(metric.progress, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center">
              <div
                className="relative h-20 w-20 rounded-full border border-border"
                style={{ background: focusedMacroPie }}
                aria-label="Focused day macro split chart"
              >
                <div className="absolute inset-3 rounded-full bg-background" />
                <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                  {focusedMacroCalTotal > 0 ? 'Split' : 'No data'}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 mr-2"><span className="h-2 w-2 rounded-full bg-[#2f7d5b]" />P</span>
                <span className="inline-flex items-center gap-1 mr-2"><span className="h-2 w-2 rounded-full bg-[#d28f2a]" />C</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#b4506d]" />F</span>
              </div>
            </div>
          </div>
        </div>
        <Accordion type="single" collapsible className="rounded-lg border border-border px-3">
          <AccordionItem value="planner-ai" className="border-0">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="text-left">
                <p className="text-sm font-medium">AI meal suggestions for remaining macros</p>
                <p className="text-xs text-muted-foreground">
                  Uses your target and already planned meals to suggest better fits.
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="date"
                    value={suggestionDate}
                    onChange={(event) => setSuggestionDate(event.target.value)}
                    className="w-[170px]"
                  />
                  <Button variant="outline" onClick={() => void runMacroSuggestions()} disabled={suggestionLoading}>
                    <Sparkles className={cn('mr-1.5 h-4 w-4', suggestionLoading && 'animate-pulse')} />
                    {suggestionLoading ? 'Thinking...' : 'Suggest meals'}
                  </Button>
                </div>

                {suggestionRemaining ? (
                  <p className="text-xs text-muted-foreground">
                    Remaining for {format(new Date(`${suggestionDate}T00:00:00`), 'EEE, MMM d')}: {suggestionRemaining.calories}{' '}
                    cal • {suggestionRemaining.protein_g}P • {suggestionRemaining.carbs_g}C • {suggestionRemaining.fat_g}F
                  </p>
                ) : null}

                {macroSuggestions.length > 0 ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {macroSuggestions.map((suggestion) => (
                      <div key={`macro-suggestion-${suggestion.recipeId}`} className="rounded-md border border-border p-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium leading-tight">{suggestion.name}</p>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {suggestion.score}% fit
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {suggestion.calories} cal • {suggestion.protein_g}P • {suggestion.carbs_g}C • {suggestion.fat_g}F
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{suggestion.reason}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 h-7 text-xs"
                          onClick={() => applyMacroSuggestionToPlanner(suggestion)}
                        >
                          Use in planner
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-4 rounded-xl border border-border bg-card px-4">
          <Accordion type="single" collapsible defaultValue="planner-quick-add">
            <AccordionItem value="planner-quick-add" className="border-0">
              <AccordionTrigger className="py-4 hover:no-underline">
                <div className="text-left">
                  <h2 className="font-display text-xl">Quick Add Food Log</h2>
                  <p className="text-sm text-muted-foreground">
                    Add a food, copy something you already eat often, or use AI to estimate it for the selected day.
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="space-y-3">
                  <div className="rounded-md border border-border bg-muted/10 p-3 space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">1. Pick the day</p>
                        <Input
                          type="date"
                          value={plannerForm.date}
                          onChange={(event) => {
                            setPlannerForm((prev) => ({ ...prev, date: event.target.value }));
                            setSuggestionDate(event.target.value);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">2. Pick the meal slot</p>
                        <select
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={plannerForm.mealType}
                          onChange={(event) => {
                            const nextMealType = event.target.value as PlannedMealType;
                            setPlannerForm((prev) => ({
                              ...prev,
                              mealType: nextMealType,
                              recipeId: nextMealType === 'alcohol' ? '' : prev.recipeId,
                            }));
                          }}
                        >
                          {PLANNED_MEAL_TYPE_OPTIONS.map((mealType) => (
                            <option key={mealType} value={mealType}>
                              {plannedMealTypeLabel[mealType]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                  </div>

                  {plannerForm.mealType === 'alcohol' ? (
                    <div className="space-y-2 rounded-md border border-border bg-muted/10 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Common alcohol drinks (auto-fills calories/macros)
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input
                          placeholder="Search beer, wine, cocktails, shots..."
                          value={alcoholPresetQuery}
                          onChange={(event) => setAlcoholPresetQuery(event.target.value)}
                        />
                        <select
                          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                          defaultValue=""
                          onChange={(event) => {
                            if (!event.target.value) return;
                            applyAlcoholPreset(event.target.value);
                            event.currentTarget.value = '';
                          }}
                        >
                          <option value="">Choose common drink...</option>
                          {alcoholPresetOptions.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name} ({preset.serving}) - {preset.calories} cal
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-md border border-border bg-muted/10 p-3 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">3. Choose how you want to add it</p>
                          <p className="text-xs text-muted-foreground">
                            Start from AI, a saved recipe, or a manual item, then review the meal details below.
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={plannerQuickAddMode === 'estimate' ? 'default' : 'outline'}
                            onClick={() => setPlannerQuickAddMode('estimate')}
                          >
                            <Sparkles className="mr-1.5 h-4 w-4" />
                            Estimate
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={plannerQuickAddMode === 'recipe' ? 'default' : 'outline'}
                            onClick={() => setPlannerQuickAddMode('recipe')}
                          >
                            Recipe
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={plannerQuickAddMode === 'manual' ? 'default' : 'outline'}
                            onClick={() => setPlannerQuickAddMode('manual')}
                          >
                            Add Food
                          </Button>
                        </div>
                      </div>

                      {plannerQuickAddMode === 'estimate' ? (
                        <div className="space-y-3 border-t border-border/60 pt-3">
                          <p className="text-xs text-muted-foreground">
                            Estimate only. Manually entering your macros gives you the most reliable tracking.
                          </p>
                          <Input
                            placeholder="Describe what you ate: 3 servings deli chicken, 2 slices Sara Lee bread, Quest chips"
                            value={plannerPhotoNote}
                            onChange={(event) => setPlannerPhotoNote(event.target.value)}
                          />
                          <p className="text-[11px] text-muted-foreground">
                            For nutrition labels, set the servings below first and the estimate will use that amount.
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleEstimatePlannerMealDescription()}
                              disabled={estimatingPlannerPhoto}
                            >
                              {estimatingPlannerPhoto ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Sparkles className="mr-2 h-4 w-4" />
                              )}
                              Estimate from description
                            </Button>
                          </div>
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-muted/30">
                            {estimatingPlannerPhoto ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Estimating meal...
                              </>
                            ) : (
                              <>
                                <Camera className="h-4 w-4" />
                                Upload picture of nutrition label
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={estimatingPlannerPhoto}
                              onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                void handleEstimatePlannerMealPhoto(file);
                                event.currentTarget.value = '';
                              }}
                            />
                          </label>
                        </div>
                      ) : null}

                      {plannerQuickAddMode === 'recipe' ? (
                        <div className="space-y-3 border-t border-border/60 pt-3">
                          <div className="grid gap-2 md:grid-cols-2">
                            <Input
                              placeholder="Search recipes for planner..."
                              value={plannerRecipeQuery}
                              onChange={(event) => setPlannerRecipeQuery(event.target.value)}
                            />
                            <select
                              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={plannerForm.recipeId}
                              disabled={recipesLoading}
                              onChange={(event) => selectRecipeForPlanner(event.target.value)}
                            >
                              <option value="">Optional: choose from recipes</option>
                              {plannerRecipeOptions.map((recipe) => (
                                <option key={recipe.id} value={recipe.id} disabled={recipeNeedsInstructions(recipe)}>
                                  {recipePickerLabel(recipe)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {plannerRecipeTypeahead.length > 0 ? (
                            <div className="rounded-md border border-border bg-background p-1">
                              {plannerRecipeTypeahead.map((recipe) => (
                                <button
                                  key={`planner-typeahead-${recipe.id}`}
                                  type="button"
                                  className={cn(
                                    'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm',
                                    recipeNeedsInstructions(recipe) ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted',
                                  )}
                                  onClick={() => selectRecipeForPlanner(recipe.id)}
                                  disabled={recipeNeedsInstructions(recipe)}
                                >
                                  <span className="truncate">{recipe.name}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    {recipeNeedsInstructions(recipe) ? 'Needs instructions' : `${Math.round(recipe.calories || 0)} cal`}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {recipesLoading
                              ? 'Loading recipes...'
                              : `Showing ${plannerRecipeOptions.length} recipe${plannerRecipeOptions.length !== 1 ? 's' : ''}.`}
                          </p>
                        </div>
                      ) : null}

                      {plannerQuickAddMode === 'manual' ? (
                        <div className="border-t border-border/60 pt-3">
                          <p className="text-xs text-muted-foreground">
                            Use this for common foods like yogurt, rice cakes, shakes, deli meat, or anything you want to log without making it a recipe.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="rounded-md border border-border bg-muted/10 p-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">5. Review meal details</p>
                      <p className="text-xs text-muted-foreground">
                        Adjust the meal name, servings, and macros before saving it to your plan.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Saved foods</p>
                      <select
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                        defaultValue=""
                        onChange={(event) => {
                          if (!event.target.value) return;
                          selectCommonFoodForPlanner(event.target.value);
                          event.currentTarget.value = '';
                        }}
                      >
                        <option value="">Choose a saved food</option>
                        {commonFoodOptions.map((food) => (
                          <option key={`common-food-${food.id}`} value={food.id}>
                            {food.name} ({food.calories} cal{food.defaultMealType ? ` • ${plannedMealTypeLabel[food.defaultMealType]}` : ''})
                          </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1fr_140px]">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Meal name</p>
                        <Input
                          placeholder="Item name (ex: 3 eggs and toast)"
                          value={plannerForm.name}
                          onChange={(event) => setPlannerForm((prev) => ({ ...prev, name: event.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Servings</p>
                        <Input
                          type="number"
                          step="0.25"
                          min="0.1"
                          inputMode="decimal"
                          value={plannerForm.servings}
                          onChange={(event) => updatePlannerFormServings(event.target.value)}
                          onKeyDown={handlePlannerServingsKeyDown}
                          onBlur={snapPlannerFormServingsToQuarter}
                        />
                      </div>
                    </div>

                    <details className="rounded-md border border-border bg-background px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                        Manual macros (optional)
                      </summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Calories</p>
                          <Input
                            type="number"
                            min="0"
                            value={plannerForm.calories}
                            onChange={(event) => setPlannerForm((prev) => ({ ...prev, calories: normalizeIntegerInput(event.target.value) }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Protein</p>
                          <Input
                            type="number"
                            min="0"
                            value={plannerForm.protein_g}
                            onChange={(event) => setPlannerForm((prev) => ({ ...prev, protein_g: normalizeIntegerInput(event.target.value) }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Carbs</p>
                          <Input
                            type="number"
                            min="0"
                            value={plannerForm.carbs_g}
                            onChange={(event) => setPlannerForm((prev) => ({ ...prev, carbs_g: normalizeIntegerInput(event.target.value) }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Fat</p>
                          <Input
                            type="number"
                            min="0"
                            value={plannerForm.fat_g}
                            onChange={(event) => setPlannerForm((prev) => ({ ...prev, fat_g: normalizeIntegerInput(event.target.value) }))}
                          />
                        </div>
                      </div>
                    </details>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={addPlannerItem}>Add to plan</Button>
                      {commonFoodOptions.slice(0, 4).map((food) => (
                        <Button
                          key={food.id}
                          size="sm"
                          variant="outline"
                          onClick={() => selectCommonFoodForPlanner(food.id)}
                        >
                          {food.name}
                        </Button>
                      ))}
                      {commonPlannedFoods.slice(0, 6).map((food) => (
                        <Button
                          key={food}
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setPlannerQuickAddMode('manual');
                            setPlannerForm((prev) => ({
                              ...prev,
                              recipeId: '',
                              name: food,
                            }));
                          }}
                        >
                          {food}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

          <div className="grid gap-3">
          {plannerViewMode === 'weekly-meal-grid' ? (
            <>
            <div className="rounded-lg border border-border bg-card p-4 md:hidden">
              <p className="text-sm text-muted-foreground">
                Weekly meal grid is optimized for tablet/desktop.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => setPlannerViewMode('daily-all')}
              >
                Switch to daily view
              </Button>
            </div>
            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <div
                className="grid min-w-[900px]"
                style={{ gridTemplateColumns: '220px repeat(7, minmax(100px, 1fr))' }}
              >
                <div className="border-b border-r border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Meal
                </div>
                {weekDateRows.map((row) => (
                  <div
                    key={`grid-header-${row.date}`}
                    className="border-b border-r border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground last:border-r-0"
                  >
                    {format(new Date(`${row.date}T00:00:00`), 'EEE d')}
                  </div>
                ))}

                {MEAL_GRID_ROWS.map((gridRow) => (
                  <Fragment key={`grid-row-${gridRow.key}`}>
                    <div className="border-b border-r border-border bg-muted/10 px-3 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className="text-sm font-medium text-foreground">{gridRow.label}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto justify-start px-0 py-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                          onClick={() => void regeneratePlannerGridRow(gridRow)}
                          disabled={regenerating || recipesLoading}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5 shrink-0" />
                          Regenerate
                        </Button>
                      </div>
                    </div>
                    {weekDateRows.map((row) => {
                      const entries = entriesByDate[row.date] || [];
                      const cellEntries = getEntriesForGridCell(entries, gridRow);
                      const dinnerBase = dinnerBaseByDate.get(row.date);
                      const showScheduledDinner = gridRow.key === 'dinner' && Boolean(dinnerBase);
                      return (
                        <div
                          key={`grid-cell-${gridRow.key}-${row.date}`}
                          className="border-b border-r border-border p-2 last:border-r-0"
                        >
                          <div className="space-y-2">
                            {showScheduledDinner && dinnerBase && (
                              <div className="rounded-md border border-border bg-primary/5 px-2 py-1.5">
                                <p className="text-xs font-medium leading-tight">{dinnerBase.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {dinnerBase.calories} cal
                                </p>
                              </div>
                            )}
                            {cellEntries.map((entry) => (
                              <div key={entry.id} className="rounded-md border border-border bg-background px-2 py-1.5">
                                <div className="flex items-start justify-between gap-1">
                                  <p className="text-xs font-medium leading-tight">{entry.name}</p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => {
                                      deletePlannedFoodEntry(entry.id, user?.id);
                                      refreshPlannerEntries();
                                    }}
                                    title="Remove planned item"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {entry.calories} cal
                                </p>
                              </div>
                            ))}
                            {!showScheduledDinner && cellEntries.length === 0 && (
                              <div className="rounded-md border border-dashed border-border px-2 py-2 text-center text-[11px] text-muted-foreground">
                                Empty
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 w-full text-xs"
                              onClick={() => openGridQuickAdd(row.date, gridRow.mealType)}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              Add
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            </>
          ) : (
          plannerRows.map((row) => {
            const allEntries = entriesByDate[row.date] || [];
            const filteredEntries =
              plannerViewMode === 'weekly-breakfasts'
                ? allEntries.filter((entry) => entry.mealType === 'breakfast')
                : plannerViewMode === 'weekly-lunches'
                ? allEntries.filter((entry) => entry.mealType === 'lunch')
                : plannerViewMode === 'weekly-snacks'
                ? allEntries.filter((entry) => entry.mealType === 'snack')
                : plannerViewMode === 'weekly-dinners'
                ? allEntries.filter((entry) => entry.mealType === 'dinner')
                : allEntries;

            const dinnerBase = dinnerBaseByDate.get(row.date);
            const projected = getProjectedForDateAndView(row.date, plannerViewMode);
            const dinnerServings = getDinnerServingsForDate(row.date);
            const calorieDelta = projected.calories - macroTarget.calories;
            const calorieStatus =
              calorieDelta > 0
                ? `${calorieDelta} over budget`
                : calorieDelta < 0
                ? `${Math.abs(calorieDelta)} under budget`
                : 'On target';

            const shouldShowDinnerBase =
              Boolean(dinnerBase) &&
              (plannerViewMode === 'daily-all' || plannerViewMode === 'weekly-dinners');
            const dinnerAdjustOpen = plannerDinnerAdjustDate === row.date;
            const isExpanded = plannerExpandedByDate[row.date] ?? (plannerViewMode === 'daily-all');
            const showDetailedMetrics = false;
            const plannedCount = filteredEntries.length + (shouldShowDinnerBase ? 1 : 0);
            const calorieProgress = metricProgress(projected.calories, macroTarget.calories);
            const proteinProgress = metricProgress(projected.protein_g, macroTarget.protein_g);
            const carbsProgress = metricProgress(projected.carbs_g, macroTarget.carbs_g);
            const fatProgress = metricProgress(projected.fat_g, macroTarget.fat_g);
            const proteinCals = Math.max(0, projected.protein_g * 4);
            const carbsCals = Math.max(0, projected.carbs_g * 4);
            const fatCals = Math.max(0, projected.fat_g * 9);
            const macroCalTotal = proteinCals + carbsCals + fatCals;
            const proteinDeg = macroCalTotal > 0 ? (proteinCals / macroCalTotal) * 360 : 0;
            const carbsDeg = macroCalTotal > 0 ? (carbsCals / macroCalTotal) * 360 : 0;
            const macroPie = macroCalTotal > 0
              ? `conic-gradient(#2f7d5b 0 ${proteinDeg}deg, #d28f2a ${proteinDeg}deg ${proteinDeg + carbsDeg}deg, #b4506d ${proteinDeg + carbsDeg}deg 360deg)`
              : 'conic-gradient(#d1d5db 0 360deg)';

            return (
              <div key={row.date} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {format(new Date(`${row.date}T00:00:00`), 'EEE, MMM d')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={cn('text-xs', calorieDelta > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                      {calorieStatus}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      aria-label={isExpanded ? 'Collapse day details' : 'Expand day details'}
                      onClick={() =>
                        setPlannerExpandedByDate((prev) => {
                          const current = prev[row.date] ?? (plannerViewMode === 'daily-all');
                          return {
                            ...prev,
                            [row.date]: !current,
                          };
                        })
                      }
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {isExpanded ? (
                  <>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Projected {projected.calories} cal • {projected.protein_g}P • {projected.carbs_g}C • {projected.fat_g}F
                      {' '}| Target {macroTarget.calories} cal • {macroTarget.protein_g}P • {macroTarget.carbs_g}C • {macroTarget.fat_g}F
                    </p>
                    {showDetailedMetrics ? (
                      <div className="mt-3 rounded-md border border-border bg-muted/10 p-3">
                        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                          <div className="space-y-2">
                            {[
                              { label: 'Calories', current: projected.calories, target: macroTarget.calories, progress: calorieProgress, color: 'bg-primary' },
                              { label: 'Protein', current: projected.protein_g, target: macroTarget.protein_g, progress: proteinProgress, color: 'bg-emerald-500' },
                              { label: 'Carbs', current: projected.carbs_g, target: macroTarget.carbs_g, progress: carbsProgress, color: 'bg-amber-500' },
                              { label: 'Fat', current: projected.fat_g, target: macroTarget.fat_g, progress: fatProgress, color: 'bg-rose-500' },
                            ].map((metric) => (
                              <div key={metric.label}>
                                <div className="mb-1 flex items-center justify-between text-xs">
                                  <span>{metric.label}</span>
                                  <span className="text-muted-foreground">
                                    {Math.round(metric.current)}/{Math.round(metric.target)}
                                  </span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className={cn('h-2 rounded-full transition-all', metric.color)}
                                    style={{ width: `${Math.min(metric.progress, 100)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex flex-col items-center justify-center">
                            <div
                              className="relative h-20 w-20 rounded-full border border-border"
                              style={{ background: macroPie }}
                              aria-label="Macro split chart"
                            >
                              <div className="absolute inset-3 rounded-full bg-background" />
                              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium">
                                {macroCalTotal > 0 ? 'Split' : 'No data'}
                              </div>
                            </div>
                            <div className="mt-2 text-[10px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1 mr-2"><span className="h-2 w-2 rounded-full bg-[#2f7d5b]" />P</span>
                              <span className="inline-flex items-center gap-1 mr-2"><span className="h-2 w-2 rounded-full bg-[#d28f2a]" />C</span>
                              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#b4506d]" />F</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-2">
                      {shouldShowDinnerBase && dinnerBase && (
                        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() =>
                              setPlannerDinnerAdjustDate((current) => (current === row.date ? null : row.date))
                            }
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium">Dinner (scheduled): {dinnerBase.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {Math.round(dinnerBase.calories * dinnerServings)} cal • {Math.round(dinnerBase.protein_g * dinnerServings)}P • {Math.round(dinnerBase.carbs_g * dinnerServings)}C • {Math.round(dinnerBase.fat_g * dinnerServings)}F
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {dinnerBase.calories} cal per serving
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs font-medium text-foreground">{dinnerServings}x</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {dinnerAdjustOpen ? 'Hide servings' : 'Adjust servings'}
                                </p>
                              </div>
                            </div>
                          </button>
                          {dinnerAdjustOpen ? (
                            <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                              {['0', '0.5', '1', '1.5', '2'].map((value) => (
                                <Button
                                  key={`inline-dinner-serving-${row.date}-${value}`}
                                  type="button"
                                  size="sm"
                                  variant={String(dinnerServings) === value ? 'default' : 'outline'}
                                  onClick={() => updateDinnerServingsForDate(row.date, Number(value))}
                                >
                                  {value}x
                                </Button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                      {filteredEntries.map((entry) => (
                        <div
                          key={entry.id}
                          role="button"
                          tabIndex={0}
                          className="rounded-md border border-border px-3 py-2 flex items-start justify-between gap-2 transition-colors hover:bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary/20"
                          onClick={() => openPlannerEntryEditor(entry)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openPlannerEntryEditor(entry);
                            }
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium">
                              {plannedMealTypeLabel[entry.mealType]}: {entry.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {entry.servings}x • {entry.calories} cal • {entry.protein_g}P • {entry.carbs_g}C • {entry.fat_g}F
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(event) => {
                              event.stopPropagation();
                              deletePlannedFoodEntry(entry.id, user?.id);
                              refreshPlannerEntries();
                            }}
                            title="Remove planned item"
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      ))}
                      {!shouldShowDinnerBase && filteredEntries.length === 0 && (
                        <p className="text-sm text-muted-foreground">No items planned for this view.</p>
                      )}
                      {shouldShowDinnerBase && filteredEntries.length === 0 && (
                        <p className="text-sm text-muted-foreground">No extra planned items yet.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plannedCount} planned {plannedCount === 1 ? 'item' : 'items'}. Expand for details.
                  </p>
                )}
              </div>
            );
          })
          )}
          </div>
        </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Selective Regenerate Dialog */}
      <Dialog open={selectiveDialogOpen} onOpenChange={setSelectiveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Choose Days to Regenerate</DialogTitle>
            <DialogDescription>Select which days to get new meals. Locked days cannot be changed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {days.map(day => {
              const meal = getMealForDay(day);
              const isLocked = meal?.is_locked;
              return (
                <label
                  key={day}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer transition-gentle",
                    selectedDays.has(day) && !isLocked && "border-primary bg-primary/5",
                    isLocked && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Checkbox
                    checked={selectedDays.has(day)}
                    disabled={!!isLocked}
                    onCheckedChange={() => toggleDaySelection(day)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{dayFullLabels[day]}</p>
                    {meal?.recipes?.name && (
                      <p className="text-xs text-muted-foreground">
                        {meal.recipes.name}
                        {isLocked && ' 🔒'}
                      </p>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setSelectiveDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => handleRegenerate(Array.from(selectedDays))}
              disabled={selectedDays.size === 0 || regenerating}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", regenerating && "animate-spin")} />
              Regenerate {selectedDays.size} day{selectedDays.size !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Planner Rules */}
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Planner Rules</DialogTitle>
            <DialogDescription>Controls how meals are generated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <Checkbox
                checked={!!planRules.preferFavorites}
                onCheckedChange={(v) => setPlanRulesState((p) => ({ ...p, preferFavorites: !!v }))}
              />
              <span className="text-sm">Favorited meals are chosen more often</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox
                checked={!!planRules.favoritesOnly}
                onCheckedChange={(v) => setPlanRulesState((p) => ({ ...p, favoritesOnly: !!v }))}
              />
              <span className="text-sm">Favorites only when regenerating</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox
                checked={!!planRules.preferKidFriendly}
                onCheckedChange={(v) => setPlanRulesState((p) => ({ ...p, preferKidFriendly: !!v }))}
              />
              <span className="text-sm">Prefer kid-friendly recipes when generating</span>
            </label>
            <label className="flex items-center gap-3">
              <Checkbox
                checked={!!planRules.kidFriendlyOnly}
                onCheckedChange={(v) => setPlanRulesState((p) => ({ ...p, kidFriendlyOnly: !!v }))}
              />
              <span className="text-sm">Kid-friendly only when regenerating</span>
            </label>
            <div>
              <p className="text-sm mb-1">Choose meals under this time (minutes)</p>
              <Input
                type="number"
                min={0}
                value={planRules.maxCookMinutes ?? ''}
                onChange={(e) =>
                  setPlanRulesState((p) => ({
                    ...p,
                    maxCookMinutes: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                  }))
                }
                placeholder="No max"
              />
            </div>
            <div className="border border-border rounded-lg p-3 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-2">Dinner time by day</p>
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  {days.map((day) => (
                    <Fragment key={`dinner-time-${day}`}>
                      <span className="text-sm">{dayFullLabels[day]}</span>
                      <Input
                        type="time"
                        value={dinnerReminderPrefs.dinnerTimesByDay[day] || '18:00'}
                        onChange={(e) =>
                          setDinnerReminderPrefsState((prev) => {
                            const nextTime = e.target.value || '18:00';
                            const nextDinnerTimesByDay = {
                              ...prev.dinnerTimesByDay,
                              [day]: nextTime,
                            };
                            return {
                              ...prev,
                              preferredDinnerTime: nextDinnerTimesByDay.monday || nextTime,
                              dinnerTimesByDay: nextDinnerTimesByDay,
                            };
                          })
                        }
                      />
                    </Fragment>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Used for meal calendar timing and each night&apos;s dinner target.
                </p>
              </div>
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={dinnerReminderPrefs.enabled}
                  onCheckedChange={(v) =>
                    setDinnerReminderPrefsState((prev) => ({ ...prev, enabled: !!v }))
                  }
                />
                <span className="text-sm">Enable dinner prep reminder</span>
              </label>
              {dinnerReminderPrefs.enabled && (
                <p className="text-xs text-muted-foreground">
                  Reminder fires at that night&apos;s dinner time minus estimated cook time.
                </p>
              )}
            </div>
            <div className="border border-border rounded-lg p-3 space-y-3">
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={menuRejuvenatePrefs.enabled}
                  onCheckedChange={(v) =>
                    setMenuRejuvenatePrefsState((prev) => ({ ...prev, enabled: !!v }))
                  }
                />
                <span className="text-sm">Auto-rejuvenate next week menu</span>
              </label>
              {menuRejuvenatePrefs.enabled && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Day</p>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={menuRejuvenatePrefs.day}
                      onChange={(e) =>
                        setMenuRejuvenatePrefsState((prev) => ({
                          ...prev,
                          day: e.target.value as DayOfWeek,
                        }))
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
                    <p className="text-xs text-muted-foreground mb-1">Time</p>
                    <Input
                      type="time"
                      value={menuRejuvenatePrefs.time}
                      onChange={(e) =>
                        setMenuRejuvenatePrefsState((prev) => ({
                          ...prev,
                          time: e.target.value || '15:00',
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm mb-2 font-medium">Recurring Day Locks</p>
              <p className="text-xs text-muted-foreground mb-2">
                Pick a recipe for any day to keep it consistent every week, or choose `No meal needed` to intentionally leave that day empty.
              </p>
              <div className="space-y-2">
                {days.map((day) => (
                  <div key={day} className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-sm">{dayFullLabels[day]}</span>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={planRules.dayLocks?.[day] || ''}
                      onChange={(e) =>
                        setPlanRulesState((prev) => {
                          const nextDayLocks = { ...(prev.dayLocks || {}) };
                          if (e.target.value) nextDayLocks[day] = e.target.value;
                          else delete nextDayLocks[day];
                          return {
                            ...prev,
                            dayLocks: nextDayLocks,
                          };
                        })
                      }
                    >
                      <option value="">No lock</option>
                      <option value={NO_MEAL_NEEDED_LOCK}>No meal needed</option>
                      {allRecipes
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((recipe) => (
                          <option key={recipe.id} value={recipe.id} disabled={recipeNeedsInstructions(recipe)}>
                            {recipePickerLabel(recipe)}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRulesOpen(false)}>Cancel</Button>
              <Button onClick={() => void savePlanRules()}>Save Rules</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Meal Dialog */}
      <Dialog open={!!swapDialogMeal} onOpenChange={(open) => !open && setSwapDialogMeal(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Swap Meal</DialogTitle>
            <DialogDescription>
              {swapDialogMeal ? `Current: ${swapDialogMeal.recipes?.name || 'Unknown meal'}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant={swapMode === 'random' ? 'default' : 'outline'} onClick={() => setSwapMode('random')}>Random</Button>
              <Button variant={swapMode === 'choose' ? 'default' : 'outline'} onClick={() => setSwapMode('choose')}>Choose Recipe</Button>
              <Button variant={swapMode === 'request' ? 'default' : 'outline'} onClick={() => setSwapMode('request')}>Request</Button>
              <Button variant={swapMode === 'none' ? 'default' : 'outline'} onClick={() => setSwapMode('none')}>No Meal Needed</Button>
            </div>

            {swapMode === 'choose' && (
              <div className="space-y-2">
                <p className="text-sm mb-1">Type a recipe title or pick one</p>
                <Input
                  value={chooseRecipeQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setChooseRecipeQuery(value);
                    const exact = recipeOptions.find((recipe) => normalizeText(recipe.name) === normalizeText(value.trim()));
                    if (exact && !recipeNeedsInstructions(exact)) {
                      setSelectedRecipeId(exact.id);
                    } else if (!value.trim()) {
                      setSelectedRecipeId('');
                    } else {
                      setSelectedRecipeId('');
                    }
                  }}
                  placeholder="Search recipe title..."
                />
                <Button
                  type="button"
                  variant={selectedRecipeId === NO_MEAL_NEEDED_LOCK ? 'default' : 'outline'}
                  onClick={() => {
                    setSelectedRecipeId(NO_MEAL_NEEDED_LOCK);
                    setChooseRecipeQuery('');
                  }}
                >
                  No meal needed
                </Button>
                {chooseRecipeTypeahead.length > 0 ? (
                  <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-background p-1">
                    {chooseRecipeTypeahead.map((recipe) => (
                      <button
                        key={`swap-typeahead-${recipe.id}`}
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm',
                          recipeNeedsInstructions(recipe) ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted',
                        )}
                        onClick={() => selectRecipeForSwap(recipe.id)}
                        disabled={recipeNeedsInstructions(recipe)}
                      >
                        <span className="truncate">{recipe.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {recipeNeedsInstructions(recipe) ? 'Needs instructions' : `${Math.round(recipe.calories || 0)} cal`}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedRecipeId}
                  onChange={(e) => selectRecipeForSwap(e.target.value)}
                  disabled={recipesLoading}
                >
                  <option value="">Select recipe...</option>
                  <option value={NO_MEAL_NEEDED_LOCK}>No meal needed</option>
                  {chooseRecipeOptions.map((recipe) => (
                    <option key={recipe.id} value={recipe.id} disabled={recipeNeedsInstructions(recipe)}>
                      {recipePickerLabel(recipe)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {recipesLoading
                    ? 'Loading recipes...'
                    : `Showing ${chooseRecipeOptions.length} recipe${chooseRecipeOptions.length !== 1 ? 's' : ''}.`}
                </p>
              </div>
            )}

            {swapMode === 'request' && (
              <div className="space-y-2">
                <p className="text-sm">Describe what you want (ex: high protein chicken bowl)</p>
                <Textarea
                  rows={3}
                  value={swapRequest}
                  onChange={(e) => setSwapRequest(e.target.value)}
                  placeholder="high protein, quick, chicken..."
                />
                <Input
                  type="number"
                  min={0}
                  value={requestMaxMinutes}
                  onChange={(e) => setRequestMaxMinutes(e.target.value)}
                  placeholder="Optional max minutes"
                />
              </div>
            )}

            {swapMode === 'none' && (
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium">No meal needed</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This will clear the current meal and intentionally leave that day empty.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSwapDialogMeal(null)}>Cancel</Button>
              <Button onClick={applySwap}>Apply Swap</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grid Quick Add Dialog */}
      <Dialog open={!!gridQuickAddContext} onOpenChange={(open) => !open && closeGridQuickAdd()}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {gridQuickAddContext?.entryId ? 'Edit ' : 'Add '}{plannedMealTypeLabel[plannerForm.mealType]}
            </DialogTitle>
            <DialogDescription>
              {gridQuickAddContext
                ? format(new Date(`${gridQuickAddContext.date}T00:00:00`), 'EEEE, MMM d')
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                type="date"
                value={plannerForm.date}
                onChange={(event) => {
                  setPlannerForm((prev) => ({ ...prev, date: event.target.value }));
                  setSuggestionDate(event.target.value);
                }}
              />
              <select
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={plannerForm.mealType}
                onChange={(event) => {
                  const nextMealType = event.target.value as PlannedMealType;
                  setPlannerForm((prev) => ({
                    ...prev,
                    mealType: nextMealType,
                    recipeId: nextMealType === 'alcohol' ? '' : prev.recipeId,
                  }));
                }}
              >
                {PLANNED_MEAL_TYPE_OPTIONS.map((mealType) => (
                  <option key={mealType} value={mealType}>
                    {plannedMealTypeLabel[mealType]}
                  </option>
                ))}
              </select>
            </div>
            {!gridQuickAddContext?.entryId ? (
              <div className="rounded-md border border-border bg-muted/10 p-3">
                <p className="text-xs font-medium text-muted-foreground">Repeat this meal</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <Button
                    type="button"
                    variant={plannerRepeatMode === 'once' ? 'default' : 'outline'}
                    onClick={() => setPlannerRepeatModeSafe('once')}
                  >
                    Just this day
                  </Button>
                  <Button
                    type="button"
                    variant={plannerRepeatMode === 'daily' ? 'default' : 'outline'}
                    onClick={() => setPlannerRepeatModeSafe('daily')}
                  >
                    Every day
                  </Button>
                  <Button
                    type="button"
                    variant={plannerRepeatMode === 'selected_days' ? 'default' : 'outline'}
                    onClick={() => setPlannerRepeatModeSafe('selected_days')}
                  >
                    Certain days
                  </Button>
                </div>
                {plannerRepeatMode === 'selected_days' ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {days.map((day) => (
                      <Button
                        key={`grid-planner-repeat-${day}`}
                        type="button"
                        size="sm"
                        variant={plannerRepeatDays.has(day) ? 'default' : 'outline'}
                        onClick={() => togglePlannerRepeatDay(day)}
                      >
                        {dayLabels[day]}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {plannerForm.mealType === 'alcohol' ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/10 p-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Common alcohol drinks (auto-fills calories/macros)
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    placeholder="Search beer, wine, cocktails, shots..."
                    value={alcoholPresetQuery}
                    onChange={(event) => setAlcoholPresetQuery(event.target.value)}
                  />
                  <select
                    className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue=""
                    onChange={(event) => {
                      if (!event.target.value) return;
                      applyAlcoholPreset(event.target.value);
                      event.currentTarget.value = '';
                    }}
                  >
                    <option value="">Choose common drink...</option>
                    {alcoholPresetOptions.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name} ({preset.serving}) - {preset.calories} cal
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            {plannerForm.mealType !== 'alcohol' ? (
              <div className="rounded-md border border-border bg-muted/10 p-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Estimate from nutrition label or description</p>
                  <p className="text-xs text-muted-foreground">
                    Type what you ate or upload a nutrition label picture, then adjust anything manually if needed.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Estimate only. Manually entering your macros gives you the most reliable tracking.
                  </p>
                </div>
                <Input
                  placeholder="Describe what you ate: 3 servings deli chicken, 2 slices Sara Lee bread, Quest chips"
                  value={plannerPhotoNote}
                  onChange={(event) => setPlannerPhotoNote(event.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  For nutrition labels, set the servings below first and the estimate will use that amount.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleEstimatePlannerMealDescription()}
                    disabled={estimatingPlannerPhoto}
                  >
                    {estimatingPlannerPhoto ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Estimate from description
                  </Button>
                </div>
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-muted/30">
                  {estimatingPlannerPhoto ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Estimating meal...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4" />
                      Upload picture of nutrition label
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={estimatingPlannerPhoto}
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      void handleEstimatePlannerMealPhoto(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>
            ) : null}
            <Input
              placeholder="Search saved foods or recipes..."
              value={plannerRecipeQuery}
              onChange={(event) => setPlannerRecipeQuery(event.target.value)}
            />
            {commonFoodTypeahead.length > 0 ? (
              <div className="rounded-md border border-border bg-background p-1">
                <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Saved Foods
                </p>
                {commonFoodTypeahead.map((food) => (
                  <button
                    key={`dialog-common-food-chip-${food.id}`}
                    type="button"
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => selectCommonFoodForPlanner(food.id)}
                  >
                    <span className="truncate">{food.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {food.calories} cal
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {plannerRecipeTypeahead.length > 0 ? (
              <div className="rounded-md border border-border bg-background p-1">
                <p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Recipes
                </p>
                {plannerRecipeTypeahead.map((recipe) => (
                  <button
                    key={`grid-planner-typeahead-${recipe.id}`}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm',
                      recipeNeedsInstructions(recipe) ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted',
                    )}
                    onClick={() => selectRecipeForPlanner(recipe.id)}
                    disabled={recipeNeedsInstructions(recipe)}
                  >
                    <span className="truncate">{recipe.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {recipeNeedsInstructions(recipe) ? 'Needs instructions' : `${Math.round(recipe.calories || 0)} cal`}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Meal name</p>
              <Input
                placeholder="Or type food/meal (ex: Greek yogurt + granola)"
                value={plannerForm.name}
                onChange={(event) => setPlannerForm((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-5">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Servings</p>
                <Input
                  type="number"
                  step="0.25"
                  min="0.1"
                  inputMode="decimal"
                  value={plannerForm.servings}
                  onChange={(event) => updatePlannerFormServings(event.target.value)}
                  onKeyDown={handlePlannerServingsKeyDown}
                  onBlur={snapPlannerFormServingsToQuarter}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Calories</p>
                <Input
                  type="number"
                  min="0"
                  value={plannerForm.calories}
                  onChange={(event) => setPlannerForm((prev) => ({ ...prev, calories: normalizeIntegerInput(event.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Protein</p>
                <Input
                  type="number"
                  min="0"
                  value={plannerForm.protein_g}
                  onChange={(event) => setPlannerForm((prev) => ({ ...prev, protein_g: normalizeIntegerInput(event.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Carbs</p>
                <Input
                  type="number"
                  min="0"
                  value={plannerForm.carbs_g}
                  onChange={(event) => setPlannerForm((prev) => ({ ...prev, carbs_g: normalizeIntegerInput(event.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Fat</p>
                <Input
                  type="number"
                  min="0"
                  value={plannerForm.fat_g}
                  onChange={(event) => setPlannerForm((prev) => ({ ...prev, fat_g: normalizeIntegerInput(event.target.value) }))}
                />
              </div>
            </div>
            <div className="rounded-md border border-dashed border-border bg-muted/10 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">Saved foods</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Use this for repeat foods like Greek yogurt, rice cakes, shakes, or deli meat. Save it once, then pick it again later without calling it a recipe.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeGridQuickAdd}>
                Cancel
              </Button>
              {!gridQuickAddContext?.entryId ? (
                <Button variant="outline" onClick={() => addPlannerItem({ prepareAnother: true })}>
                  Save + Add Another
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  if (addPlannerItem()) {
                    if (!gridQuickAddContext?.entryId) {
                      closeGridQuickAdd();
                    }
                  }
                }}
              >
                {gridQuickAddContext?.entryId ? 'Save Changes' : 'Save Item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Add Meal Dialog */}
      <Dialog open={!!manualDialogDay} onOpenChange={(open) => !open && setManualDialogDay(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Add Meal</DialogTitle>
            <DialogDescription>
              {manualDialogDay ? `Choose a recipe for ${dayFullLabels[manualDialogDay]}, or mark it as no meal needed.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
              onClick={() => void applyNoMealNeededForDay()}
            >
              No Meal Needed
            </Button>
            <Input
              value={manualRecipeQuery}
              onChange={(event) => {
                const value = event.target.value;
                setManualRecipeQuery(value);
                const exact = recipeOptions.find((recipe) => normalizeText(recipe.name) === normalizeText(value.trim()));
                if (exact && !recipeNeedsInstructions(exact)) {
                  setManualRecipeId(exact.id);
                } else {
                  setManualRecipeId('');
                }
              }}
              placeholder="Search recipes..."
            />
            {manualSelectedRecipe ? (
              <div className="rounded-md border border-border bg-muted/10 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{manualSelectedRecipe.name}</p>
                    <p className="text-xs text-muted-foreground">{Math.round(manualSelectedRecipe.calories || 0)} cal</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setManualRecipeId('');
                      setManualRecipeQuery('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              </div>
            ) : null}
            {!manualHasExactSelection && manualRecipeTypeahead.length > 0 ? (
              <div className="rounded-md border border-border bg-background p-1">
                {manualRecipeTypeahead.map((recipe) => (
                  <button
                    key={`manual-typeahead-${recipe.id}`}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm',
                      recipeNeedsInstructions(recipe) ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted',
                    )}
                    onClick={() => selectRecipeForManual(recipe.id)}
                    disabled={recipeNeedsInstructions(recipe)}
                  >
                    <span className="truncate">{recipe.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {recipeNeedsInstructions(recipe) ? 'Needs instructions' : `${Math.round(recipe.calories || 0)} cal`}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {recipesLoading
                ? 'Loading recipes...'
                : manualSelectedRecipe
                  ? 'Recipe selected.'
                  : manualRecipeQuery.trim()
                    ? manualRecipeOptions.length > 0
                      ? `Showing ${manualRecipeOptions.length} recipe${manualRecipeOptions.length !== 1 ? 's' : ''}.`
                      : 'No matching recipes.'
                    : 'Start typing to find a recipe.'}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setManualDialogDay(null)}>Cancel</Button>
            <Button onClick={() => void applyManualMealForDay()}>Save Meal</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pantry Matcher */}
      <Dialog open={pantryOpen} onOpenChange={setPantryOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Have X Ingredients, What Can I Make?</DialogTitle>
            <DialogDescription>Enter ingredients you have. We'll suggest best matches.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              rows={4}
              value={pantryInput}
              onChange={(e) => setPantryInput(e.target.value)}
              placeholder="chicken, rice, onion, garlic, greek yogurt..."
            />
            <div className="flex justify-end">
              <Button onClick={runPantryMatcher}>Find Meals</Button>
            </div>
            {pantryMatches.length > 0 && (
              <div className="space-y-2">
                {pantryMatches.map((m) => (
                  <div key={m.recipe.id} className="rounded-lg border border-border p-3">
                    <p className="font-medium">{m.recipe.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Match: {m.matched.length} • Missing: {m.missing.length}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Missing sample: {m.missing.slice(0, 3).join(', ') || 'None'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Meal Details */}
      <Dialog open={!!selectedMeal} onOpenChange={(open) => !open && setSelectedMeal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {selectedMeal?.recipes?.name || 'Recipe'}
            </DialogTitle>
            <DialogDescription>
              {selectedMeal ? dayFullLabels[selectedMeal.day as DayOfWeek] : ''}
            </DialogDescription>
          </DialogHeader>

          {selectedMeal?.recipes && (
            <div className="space-y-5">
              {getRecipeImageUrl(selectedMeal.recipes.name) && (
                <div className="rounded-lg border border-border overflow-hidden">
                  <img
                    src={getRecipeImageUrl(selectedMeal.recipes.name)}
                    alt={selectedMeal.recipes.name}
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Calories</p>
                  <p className="font-semibold text-sm">{Math.round(selectedMeal.recipes.calories)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="font-semibold text-sm">{Math.round(selectedMeal.recipes.protein_g)}g</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="font-semibold text-sm">{Math.round(selectedMeal.recipes.carbs_g)}g</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="font-semibold text-sm">{Math.round(selectedMeal.recipes.fat_g)}g</p>
                </div>
              </div>

              {selectedMeal.recipes.ingredients?.length > 0 && (
                <section>
                  <h3 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">Ingredients</h3>
                  <ul className="space-y-1">
                    {selectedMeal.recipes.ingredients.map((ing, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section>
                <h3 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">Instructions</h3>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {normalizeRecipeInstructions(selectedMeal.recipes.instructions) || 'No instructions available for this recipe yet.'}
                </div>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <MacroGoalDialog
        personId={plannerDashboardId}
        open={macroDialogOpen}
        onOpenChange={setMacroDialogOpen}
      />
    </AppLayout>
  );
}
