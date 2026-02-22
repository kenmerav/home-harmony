import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DayOfWeek } from '@/types';
import { Lock, Unlock, SkipForward, RefreshCw, ChevronLeft, ChevronRight, Shuffle, Settings2, Scale, Wand2 } from 'lucide-react';
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
  swapMeal,
  updateMealRecipe,
  toggleMealLock,
  toggleMealSkip,
  DbPlannedMeal,
  MealGenerationOptions,
} from '@/lib/api/meals';
import { normalizeRecipeInstructions } from '@/lib/recipeText';
import { getRecipeImageUrl } from '@/data/recipeImages';
import { estimateCookMinutes } from '@/lib/recipeTime';
import { DbRecipe, fetchRecipes } from '@/lib/api/recipes';
import {
  DinnerReminderPrefs,
  MenuRejuvenatePrefs,
  getDinnerReminderPrefs,
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

const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const dayFullLabels: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
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

export default function MealsPage() {
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
    maxCookMinutes: null,
    dayLocks: {},
  });
  const [dinnerReminderPrefs, setDinnerReminderPrefsState] = useState<DinnerReminderPrefs>({
    enabled: false,
    preferredDinnerTime: '18:00',
  });
  const [menuRejuvenatePrefs, setMenuRejuvenatePrefsState] = useState<MenuRejuvenatePrefs>({
    enabled: false,
    day: 'friday',
    time: '15:00',
    lastRanForWeekOf: null,
  });
  const [swapDialogMeal, setSwapDialogMeal] = useState<DbPlannedMeal | null>(null);
  const [swapMode, setSwapMode] = useState<'random' | 'choose' | 'request'>('random');
  const [allRecipes, setAllRecipes] = useState<DbRecipe[]>([]);
  const [chooseRecipeQuery, setChooseRecipeQuery] = useState('');
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [swapRequest, setSwapRequest] = useState('');
  const [requestMaxMinutes, setRequestMaxMinutes] = useState('');
  const [pantryOpen, setPantryOpen] = useState(false);
  const [pantryInput, setPantryInput] = useState('');
  const [pantryMatches, setPantryMatches] = useState<PantryMatch[]>([]);
  const favoriteIds = getFavoriteIds();
  const kidFriendlyOverrides = getKidFriendlyOverrides();
  const { toast } = useToast();
  const isKidFriendlyRecipe = (recipe: DbRecipe) =>
    kidFriendlyOverrides[recipe.id] ?? inferKidFriendly(recipe);

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  const weekLabel = format(weekStart, 'MMM d') + ' – ' + format(addDays(weekStart, 6), 'MMM d');

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

    const cookMinutes = estimateCookMinutes(todayMeal.recipes.instructions) ?? 30;
    const [dinnerHour, dinnerMinute] = dinnerReminderPrefs.preferredDinnerTime
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
      description: `Start "${todayMeal.recipes.name}" now to hit your ${dinnerReminderPrefs.preferredDinnerTime} dinner time.`,
    });
  }, [dinnerReminderPrefs, meals, toast, weekOffset]);

  const ensureRecipesLoaded = useCallback(async () => {
    const recipes = await fetchRecipes();
    setAllRecipes(recipes);
    return recipes;
  }, []);

  useEffect(() => {
    if (!rulesOpen || allRecipes.length > 0) return;
    void ensureRecipesLoaded();
  }, [rulesOpen, allRecipes.length, ensureRecipesLoaded]);

  const savePlanRules = () => {
    const maxCookMinutes =
      typeof planRules.maxCookMinutes === 'number' && planRules.maxCookMinutes > 0
        ? Math.round(planRules.maxCookMinutes)
        : null;
    const dayLocks = planRules.dayLocks || {};
    const next = {
      preferFavorites: !!planRules.preferFavorites,
      preferKidFriendly: !!planRules.preferKidFriendly,
      maxCookMinutes,
      dayLocks,
    };
    setPlanRulesState(next);
    setPlanRules(next);
    setDinnerReminderPrefs(dinnerReminderPrefs);
    setMenuRejuvenatePrefs(menuRejuvenatePrefs);
    setRulesOpen(false);
    toast({ title: 'Planner rules saved' });
  };

  const handleRegenerate = async (daysToRegen?: DayOfWeek[]) => {
    setRegenerating(true);
    try {
      const data = await generateMeals(weekOffset, daysToRegen, planRules);
      setMeals(data);
      toast({ title: 'Meals generated!', description: `${data.length} meals planned for the week` });
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
    setSwapMode('random');
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
      } else if (swapMode === 'choose') {
        const recipeOptions = allRecipes
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name));

        const exactMatch = recipeOptions.find(
          (r) => r.name.toLowerCase().trim() === chooseRecipeQuery.toLowerCase().trim(),
        );
        const resolvedRecipeId = selectedRecipeId || exactMatch?.id || '';

        if (!resolvedRecipeId) {
          toast({ title: 'Type or pick a recipe first', variant: 'destructive' });
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

  return (
    <AppLayout>
      <PageHeader
        title="Weekly Meals"
        subtitle="Dinner plan for the week"
        action={
          <div className="flex gap-2">
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
            <Button size="sm" onClick={() => handleRegenerate()} disabled={regenerating}>
              <RefreshCw className={cn("w-4 h-4 mr-2", regenerating && "animate-spin")} />
              Regenerate
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

      {loading ? (
        <div className="space-y-3">
          {days.map(d => (
            <div key={d} className="bg-card rounded-xl border border-border p-4 h-20 animate-pulse" />
          ))}
        </div>
      ) : meals.length === 0 ? (
        <div className="text-center py-12">
          <RefreshCw className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No meals planned for this week</p>
          <p className="text-sm text-muted-foreground mt-1">Click "Regenerate" to auto-fill from your recipes</p>
        </div>
      ) : (
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
                  "bg-card rounded-xl border border-border p-4 transition-gentle",
                  isToday && "ring-2 ring-primary/20 border-primary/30",
                  meal?.is_skipped && "opacity-60"
                )}
              >
                <div
                  className={cn("flex items-start gap-4", meal?.recipes && !meal?.is_skipped && "cursor-pointer")}
                  onClick={() => {
                    if (meal?.recipes && !meal.is_skipped) setSelectedMeal(meal);
                  }}
                >
                  <div className={cn("w-12 text-center flex-shrink-0", isToday && "text-primary")}>
                    <p className="text-xs font-medium uppercase text-muted-foreground">{dayLabels[day]}</p>
                    <p className={cn("text-2xl font-display font-semibold", isToday ? "text-primary" : "text-foreground")}>
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
                    ) : meal?.is_skipped && recipe ? (
                      <div className="text-muted-foreground">
                        <p className="font-medium line-through">{recipe.name}</p>
                        <p className="text-sm">Skipped</p>
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <p className="text-sm">No meal planned</p>
                      </div>
                    )}
                  </div>

                  {meal && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant={getMealMultiplier(meal.id) === 2 ? 'default' : 'ghost'}
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDoubleMeal(meal.id);
                        }}
                        title="Double recipe for grocery list"
                      >
                        <Scale className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSwapDialog(meal);
                        }}
                        title="Swap meal"
                      >
                        <Wand2 className="w-4 h-4 text-muted-foreground" />
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
                        <SkipForward className={cn("w-4 h-4", meal.is_skipped ? "text-destructive" : "text-muted-foreground")} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
          <Scale className="w-3.5 h-3.5" />
          <span>2x Grocery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>Anchored</span>
        </div>
      </div>

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
        <DialogContent className="sm:max-w-md">
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
                checked={!!planRules.preferKidFriendly}
                onCheckedChange={(v) => setPlanRulesState((p) => ({ ...p, preferKidFriendly: !!v }))}
              />
              <span className="text-sm">Prefer kid-friendly recipes when generating</span>
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
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={dinnerReminderPrefs.enabled}
                  onCheckedChange={(v) =>
                    setDinnerReminderPrefsState((prev) => ({ ...prev, enabled: !!v }))
                  }
                />
                <span className="text-sm">Dinner prep reminder</span>
              </label>
              {dinnerReminderPrefs.enabled && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Preferred dinner time</p>
                  <Input
                    type="time"
                    value={dinnerReminderPrefs.preferredDinnerTime}
                    onChange={(e) =>
                      setDinnerReminderPrefsState((prev) => ({
                        ...prev,
                        preferredDinnerTime: e.target.value || '18:00',
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Reminder fires at dinner time minus estimated cook time.
                  </p>
                </div>
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
                Pick a recipe for any day to keep it consistent every week.
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
                      {allRecipes
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((recipe) => (
                          <option key={recipe.id} value={recipe.id}>
                            {recipe.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRulesOpen(false)}>Cancel</Button>
              <Button onClick={savePlanRules}>Save Rules</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Swap Meal Dialog */}
      <Dialog open={!!swapDialogMeal} onOpenChange={(open) => !open && setSwapDialogMeal(null)}>
        <DialogContent className="sm:max-w-lg">
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
            </div>

            {swapMode === 'choose' && (
              <div className="space-y-2">
                <p className="text-sm mb-1">Type a recipe title or pick one</p>
                <Input
                  value={chooseRecipeQuery}
                  onChange={(e) => setChooseRecipeQuery(e.target.value)}
                  placeholder="Search recipe title..."
                />
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedRecipeId}
                  onChange={(e) => setSelectedRecipeId(e.target.value)}
                >
                  <option value="">Select recipe...</option>
                  {allRecipes
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
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
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSwapDialogMeal(null)}>Cancel</Button>
              <Button onClick={applySwap}>Apply Swap</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pantry Matcher */}
      <Dialog open={pantryOpen} onOpenChange={setPantryOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
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
    </AppLayout>
  );
}
