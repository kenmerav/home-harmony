import { useEffect, useState } from 'react';
import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfWeek, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { MacroBar } from '@/components/ui/MacroBar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCurrentDate } from '@/hooks/useCurrentDate';
import { mockMealPlan } from '@/data/mockData';
import { DbPlannedMeal, fetchMealsForWeek } from '@/lib/api/meals';
import { getPlannedFoodEntriesForDate } from '@/lib/mealBudgetPlanner';
import {
  getDinnerServingsByProfile,
  getDinnerServingsForProfileDate,
  setDinnerServingsByProfile,
} from '@/lib/mealPrefs';
import {
  AdultId,
  addDashboardTodo,
  addMealLog,
  deleteMealLog,
  deleteDashboardTodo,
  getActualMealLogsForDate,
  getFemaleHealthSettings,
  getCurrentStreak,
  getDailyScore,
  getDashboardTodos,
  getEffectiveMealLogsForDate,
  getProfiles,
  getWeekPoints,
  hydrateMacroGameActivityFromAccount,
  isDailyLogFullyLogged,
  toggleDashboardTodo,
  updateMealLog,
  updateFemaleHealthSettings,
} from '@/lib/macroGame';
import { DayOfWeek, MealLog } from '@/types';
import { Check, Flame, Pencil, Plus, Target, Trash2, Trophy, TrendingUp, X } from 'lucide-react';
import { MacroGoalDialog } from './MacroGoalDialog';

interface PersonNutritionDashboardProps {
  personId: AdultId;
  accent: 'primary' | 'accent';
}

interface DinnerCandidate {
  label: string;
  recipeId?: string;
  defaultServings: number;
  macros: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
  };
}

interface FemaleHealthDraft {
  cycleTrackingEnabled: boolean;
  pregnancyTrackingEnabled: boolean;
  lastPeriodStart: string;
  cycleLengthDays: string;
  pregnancyDueDate: string;
  notes: string;
}

export function PersonNutritionDashboard({ personId, accent }: PersonNutritionDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setRefreshTick] = useState(0);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [liveMeals, setLiveMeals] = useState<DbPlannedMeal[]>([]);
  const [todoDraft, setTodoDraft] = useState('');
  const [editingMealLogId, setEditingMealLogId] = useState<string | null>(null);
  const [mealEditDraft, setMealEditDraft] = useState({
    recipeName: '',
    mealType: 'breakfast' as NonNullable<MealLog['mealType']>,
    servings: '1',
    calories: '0',
    protein: '0',
    carbs: '0',
    fat: '0',
  });
  const currentDate = useCurrentDate();
  const todayKey = format(currentDate, 'yyyy-MM-dd');
  const currentDay = getCurrentDay(currentDate);
  const currentWeekOf = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  useEffect(() => {
    let cancelled = false;
    const loadTodayMeals = async () => {
      try {
        const [currentWeekMeals, previousWeekMeals] = await Promise.all([fetchMealsForWeek(0), fetchMealsForWeek(-1)]);
        if (!cancelled) setLiveMeals([...previousWeekMeals, ...currentWeekMeals]);
      } catch (error) {
        console.error('Failed to load dashboard dinner candidate:', error);
      }
    };
    void loadTodayMeals();
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  useEffect(() => {
    const handleMacroStateUpdated = () => setRefreshTick((prev) => prev + 1);
    window.addEventListener('homehub:macro-state-updated', handleMacroStateUpdated);
    return () => window.removeEventListener('homehub:macro-state-updated', handleMacroStateUpdated);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const refreshMacroActivity = () => {
      void hydrateMacroGameActivityFromAccount(user.id);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshMacroActivity();
      }
    };

    refreshMacroActivity();
    window.addEventListener('focus', refreshMacroActivity);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refreshMacroActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

  const profile = getProfiles()[personId];
  const [femaleHealthDraft, setFemaleHealthDraft] = useState<FemaleHealthDraft>(() =>
    createFemaleHealthDraft(profile ? getFemaleHealthSettings(profile.id) : undefined),
  );

  useEffect(() => {
    setFemaleHealthDraft(createFemaleHealthDraft(profile ? getFemaleHealthSettings(profile.id) : undefined));
  }, [
    personId,
    profile?.femaleHealth?.cycleTrackingEnabled,
    profile?.femaleHealth?.pregnancyTrackingEnabled,
    profile?.femaleHealth?.lastPeriodStart,
    profile?.femaleHealth?.cycleLengthDays,
    profile?.femaleHealth?.pregnancyDueDate,
    profile?.femaleHealth?.notes,
  ]);

  if (!profile) {
    return (
      <AppLayout>
        <div className="rounded-xl border border-border bg-card p-6">
          <h1 className="font-display text-2xl">Dashboard not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">Pick another dashboard from the sidebar.</p>
        </div>
      </AppLayout>
    );
  }
  const macroPlan = profile.macroPlan || {
    calories: 2000,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    waterTargetOz: 0,
    alcoholLimitDrinks: 0,
    proteinOnlyMode: false,
    questionnaire: undefined,
  };
  const todos = getDashboardTodos(personId);
  const todaysActualLogs = getActualMealLogsForDate(personId, todayKey, user?.id);
  const questionnaire = macroPlan.questionnaire;
  const goalLabel = questionnaire?.goal ? questionnaire.goal.replace('_', ' ') : 'maintain';
  const isFemaleDashboard = questionnaire?.sex === 'female';
  const todayScore = getDailyScore(personId, todayKey);
  const currentStreak = getCurrentStreak(personId, currentDate);
  const weekPoints = getWeekPoints(personId, currentDate);
  const targetCalories = macroPlan.calories || 2000;
  const dashboardDinnerServings = getDinnerServingsForProfileDate(personId, todayKey, user?.id);
  const plannedDinnerEntry =
    getPlannedFoodEntriesForDate(todayKey, user?.id).find((entry) => entry.mealType === 'dinner') || null;
  const liveTodaysMeal = liveMeals.find(
    (meal) =>
      meal.week_of === currentWeekOf &&
      meal.day === currentDay &&
      !meal.is_skipped &&
      !!meal.recipes,
  );
  const tonightDinner: DinnerCandidate | null = (() => {
    if (plannedDinnerEntry) {
      const servings = Math.max(0.1, plannedDinnerEntry.servings || 1);
      return {
        label: plannedDinnerEntry.name,
        recipeId: plannedDinnerEntry.sourceRecipeId || undefined,
        defaultServings: servings,
        macros: {
          calories: Math.round(plannedDinnerEntry.calories / servings),
          protein_g: Math.round(plannedDinnerEntry.protein_g / servings),
          carbs_g: Math.round(plannedDinnerEntry.carbs_g / servings),
          fat_g: Math.round(plannedDinnerEntry.fat_g / servings),
        },
      };
    }

    if (liveTodaysMeal?.recipes) {
      return {
        label: liveTodaysMeal.recipes.name || "Tonight's dinner",
        recipeId: liveTodaysMeal.recipe_id,
        defaultServings: 1,
        macros: {
          calories: liveTodaysMeal.recipes.calories || 0,
          protein_g: liveTodaysMeal.recipes.protein_g || 0,
          carbs_g: liveTodaysMeal.recipes.carbs_g || 0,
          fat_g: liveTodaysMeal.recipes.fat_g || 0,
          fiber_g: liveTodaysMeal.recipes.fiber_g || undefined,
        },
      };
    }

    return createMockDinnerCandidate(currentDay);
  })();

  const handleQuickAddDinner = () => {
    if (!tonightDinner) return;
    const log: MealLog = {
      id: `dashboard-dinner-${Date.now()}-${personId}`,
      recipeId: tonightDinner.recipeId,
      recipeName: tonightDinner.label,
      date: todayKey,
      person: personId,
      mealType: 'dinner',
      servings: dashboardDinnerServings,
      macros: {
        calories: Math.round(tonightDinner.macros.calories * dashboardDinnerServings),
        protein_g: Math.round(tonightDinner.macros.protein_g * dashboardDinnerServings),
        carbs_g: Math.round(tonightDinner.macros.carbs_g * dashboardDinnerServings),
        fat_g: Math.round(tonightDinner.macros.fat_g * dashboardDinnerServings),
        fiber_g: tonightDinner.macros.fiber_g
          ? Math.round(tonightDinner.macros.fiber_g * dashboardDinnerServings)
          : undefined,
      },
      isQuickAdd: false,
      createdAt: new Date(),
    };
    addMealLog(log);
    setRefreshTick((prev) => prev + 1);
    toast({
      title: `Logged for ${profile.name}`,
      description: `${tonightDinner.label} • ${dashboardDinnerServings} serving${dashboardDinnerServings !== 1 ? 's' : ''}`,
    });
  };

  const handleDinnerServingsChange = (nextServings: number) => {
    const normalizedServings = Math.max(0.25, Math.min(6, Math.round(nextServings * 4) / 4));
    const currentValues = getDinnerServingsByProfile(user?.id);
    const nextValues = {
      ...currentValues,
      [personId]: {
        ...(currentValues[personId] || {}),
        [todayKey]: normalizedServings,
      },
    };
    setDinnerServingsByProfile(nextValues, user?.id);
    setRefreshTick((prev) => prev + 1);
  };

  const startEditingMealLog = (log: MealLog) => {
    setEditingMealLogId(log.id);
    setMealEditDraft({
      recipeName: log.recipeName,
      mealType: (log.mealType || 'breakfast') as NonNullable<MealLog['mealType']>,
      servings: String(log.servings),
      calories: String(Math.round(log.macros.calories)),
      protein: String(Math.round(log.macros.protein_g)),
      carbs: String(Math.round(log.macros.carbs_g)),
      fat: String(Math.round(log.macros.fat_g)),
    });
  };

  const cancelEditingMealLog = () => {
    setEditingMealLogId(null);
  };

  const saveMealLogEdit = () => {
    if (!editingMealLogId) return;
    const servings = Math.max(0.25, Number.parseFloat(mealEditDraft.servings) || 1);
    updateMealLog(
      editingMealLogId,
      {
        recipeName: mealEditDraft.recipeName.trim() || 'Meal',
        mealType: mealEditDraft.mealType,
        servings,
        macros: {
          calories: Math.max(0, Number.parseFloat(mealEditDraft.calories) || 0),
          protein_g: Math.max(0, Number.parseFloat(mealEditDraft.protein) || 0),
          carbs_g: Math.max(0, Number.parseFloat(mealEditDraft.carbs) || 0),
          fat_g: Math.max(0, Number.parseFloat(mealEditDraft.fat) || 0),
        },
      },
      user?.id,
    );
    setEditingMealLogId(null);
    setRefreshTick((prev) => prev + 1);
    toast({
      title: 'Meal updated',
      description: 'Your dashboard meal log now matches the updated values.',
    });
  };

  const handleDeleteMealLog = (logId: string) => {
    deleteMealLog(logId, user?.id);
    setEditingMealLogId((current) => (current === logId ? null : current));
    setRefreshTick((prev) => prev + 1);
    toast({
      title: 'Meal removed',
      description: 'That meal was removed from today’s log.',
    });
  };

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(currentDate, 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const score = getDailyScore(personId, dateStr);
    const effectiveLogs = getEffectiveMealLogsForDate(personId, dateStr);
    const projectedDinner = getProjectedDinnerForDate({
      meals: liveMeals,
      date,
      personId,
      userId: user?.id,
      includePlannedDinner: !effectiveLogs.some((log) => log.mealType === 'dinner'),
    });
    const combinedCalories = score.calories + projectedDinner.calories;
    const combinedProtein = score.protein_g + projectedDinner.protein_g;
    return {
      day: format(date, 'EEE'),
      date: dateStr,
      calories: combinedCalories,
      protein_g: combinedProtein,
      fullyLogged: isDailyLogFullyLogged(personId, dateStr) || combinedCalories >= targetCalories * 0.8,
      isToday: dateStr === todayKey,
    };
  });

  const fullyLoggedDays = weekData.filter((day) => day.fullyLogged);
  const averageProtein =
    fullyLoggedDays.length > 0
      ? Math.round(fullyLoggedDays.reduce((sum, day) => sum + day.protein_g, 0) / fullyLoggedDays.length)
      : 0;
  const averageCalories =
    fullyLoggedDays.length > 0
      ? Math.round(fullyLoggedDays.reduce((sum, day) => sum + day.calories, 0) / fullyLoggedDays.length)
      : 0;
  const accentBar = accent === 'primary' ? 'bg-primary' : 'bg-accent';
  const accentBarMuted = accent === 'primary' ? 'bg-primary/40' : 'bg-accent/40';
  const accentText = accent === 'primary' ? 'text-primary' : 'text-accent';
  const cycleLengthDays = Number.parseInt(femaleHealthDraft.cycleLengthDays, 10);
  const cycleStartDate = parseOptionalDate(femaleHealthDraft.lastPeriodStart);
  const dueDate = parseOptionalDate(femaleHealthDraft.pregnancyDueDate);
  const nextPeriodDate =
    femaleHealthDraft.cycleTrackingEnabled && cycleStartDate && Number.isFinite(cycleLengthDays)
      ? addDays(cycleStartDate, Math.max(20, Math.min(45, cycleLengthDays)))
      : null;
  const daysUntilNextPeriod = nextPeriodDate ? differenceInCalendarDays(nextPeriodDate, currentDate) : null;
  const cycleDay =
    femaleHealthDraft.cycleTrackingEnabled && cycleStartDate
      ? Math.max(1, differenceInCalendarDays(currentDate, cycleStartDate) + 1)
      : null;
  const pregnancyStartDate = dueDate ? addDays(dueDate, -280) : null;
  const pregnancyWeeks =
    femaleHealthDraft.pregnancyTrackingEnabled && pregnancyStartDate
      ? Math.max(1, Math.floor(differenceInCalendarDays(currentDate, pregnancyStartDate) / 7) + 1)
      : null;
  const daysUntilDueDate =
    femaleHealthDraft.pregnancyTrackingEnabled && dueDate ? differenceInCalendarDays(dueDate, currentDate) : null;

  const handleAddTodo = () => {
    const created = addDashboardTodo(personId, todoDraft);
    if (!created) {
      toast({ title: 'Add a to-do first', variant: 'destructive' });
      return;
    }
    setTodoDraft('');
    setRefreshTick((prev) => prev + 1);
    toast({
      title: 'To-do added',
      description: `${created.text} is now on ${profile.name}'s dashboard.`,
    });
  };

  const handleToggleTodo = (todoId: string) => {
    toggleDashboardTodo(personId, todoId);
    setRefreshTick((prev) => prev + 1);
  };

  const handleDeleteTodo = (todoId: string) => {
    deleteDashboardTodo(personId, todoId);
    setRefreshTick((prev) => prev + 1);
  };

  const handleSaveFemaleHealth = () => {
    updateFemaleHealthSettings(personId, {
      cycleTrackingEnabled: femaleHealthDraft.cycleTrackingEnabled,
      pregnancyTrackingEnabled: femaleHealthDraft.pregnancyTrackingEnabled,
      lastPeriodStart: femaleHealthDraft.cycleTrackingEnabled ? femaleHealthDraft.lastPeriodStart : '',
      cycleLengthDays:
        femaleHealthDraft.cycleTrackingEnabled && Number.isFinite(cycleLengthDays)
          ? Math.max(20, Math.min(45, cycleLengthDays))
          : 28,
      pregnancyDueDate: femaleHealthDraft.pregnancyTrackingEnabled ? femaleHealthDraft.pregnancyDueDate : '',
      notes: femaleHealthDraft.notes,
    });
    setRefreshTick((prev) => prev + 1);
    toast({
      title: 'Tracking updated',
      description: `${profile.name}'s cycle and pregnancy settings were saved.`,
    });
  };

  return (
    <AppLayout>
      <PageHeader
        title={profile.name}
        subtitle="Daily macro tracking and habit streaks"
        action={
          <Button size="sm" onClick={() => setGoalDialogOpen(true)}>
            <Target className="w-4 h-4 mr-2" />
            Set Goals
          </Button>
        }
      />

      <div className="space-y-6">
        <SectionCard
          title="Today's Progress"
          subtitle={`Final targets (editable): ${macroPlan.calories} cal • ${macroPlan.protein_g}P • ${macroPlan.carbs_g}C • ${macroPlan.fat_g}F`}
        >
          <MacroBar
            current={{
              calories: todayScore.calories,
              protein_g: todayScore.protein_g,
              carbs_g: todayScore.carbs_g,
              fat_g: todayScore.fat_g,
            }}
            target={{
              calories: macroPlan.calories,
              protein_g: macroPlan.protein_g,
              carbs_g: macroPlan.carbs_g,
              fat_g: macroPlan.fat_g,
            }}
          />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <MetricPill label="Points" value={`${todayScore.points}`} highlight />
            <MetricPill label="Streak" value={`${currentStreak} days`} />
            <MetricPill label="Water" value={`${todayScore.waterOz}/${macroPlan.waterTargetOz} oz`} />
            <MetricPill label="Alcohol" value={`${todayScore.alcoholDrinks}/${macroPlan.alcoholLimitDrinks}`} />
          </div>
        </SectionCard>

        <SectionCard
          title="Today's Meals"
          subtitle="Final targets (editable) are used for scoring and streaks."
          action={
            <Link to="/app">
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Quick Add
              </Button>
            </Link>
          }
        >
          {tonightDinner && (
            <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-primary/80">Tonight&apos;s Dinner</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-foreground">{tonightDinner.label}</h3>
                  <p className="text-sm text-muted-foreground">
                    {Math.round(tonightDinner.macros.calories)} cal/serving
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDinnerServingsChange(dashboardDinnerServings - 0.25)}
                    >
                      -
                    </Button>
                    <div className="rounded-md border border-border bg-background px-3 py-1 text-sm font-medium">
                      {dashboardDinnerServings} serving{dashboardDinnerServings !== 1 ? 's' : ''}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDinnerServingsChange(dashboardDinnerServings + 0.25)}
                    >
                      +
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Totals: {Math.round(tonightDinner.macros.calories * dashboardDinnerServings)} cal •{' '}
                      {Math.round(tonightDinner.macros.protein_g * dashboardDinnerServings)}g protein
                    </p>
                  </div>
                </div>
                <Button size="sm" onClick={handleQuickAddDinner}>
                  <Check className="w-4 h-4 mr-2" />
                  Add Dinner
                </Button>
              </div>
            </div>
          )}

          {todaysActualLogs.length > 0 ? (
            <div className="space-y-3">
              {todaysActualLogs.map((log) => (
                <div key={log.id} className="py-2 border-b border-border last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{log.recipeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {log.mealType ? log.mealType.charAt(0).toUpperCase() + log.mealType.slice(1) : 'Meal'} •{' '}
                        {log.servings} serving{log.servings !== 1 ? 's' : ''}
                        {log.isQuickAdd && ' • Quick Add'}
                      </p>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <p className="font-medium text-sm">{Math.round(log.macros.calories)} cal</p>
                        <p className="text-xs text-muted-foreground">{Math.round(log.macros.protein_g)}g protein</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEditingMealLog(log)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteMealLog(log.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {editingMealLogId === log.id ? (
                    <div className="mt-3 rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <Input
                          value={mealEditDraft.recipeName}
                          onChange={(event) => setMealEditDraft((prev) => ({ ...prev, recipeName: event.target.value }))}
                          placeholder="Meal name"
                        />
                        <select
                          value={mealEditDraft.mealType}
                          onChange={(event) =>
                            setMealEditDraft((prev) => ({
                              ...prev,
                              mealType: event.target.value as NonNullable<MealLog['mealType']>,
                            }))
                          }
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="breakfast">Breakfast</option>
                          <option value="lunch">Lunch</option>
                          <option value="dinner">Dinner</option>
                          <option value="snack">Snack</option>
                          <option value="dessert">Dessert</option>
                          <option value="alcohol">Alcohol</option>
                        </select>
                      </div>
                      <div className="grid gap-3 md:grid-cols-5">
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.25"
                          min="0.25"
                          value={mealEditDraft.servings}
                          onChange={(event) => setMealEditDraft((prev) => ({ ...prev, servings: event.target.value }))}
                          placeholder="Servings"
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={mealEditDraft.calories}
                          onChange={(event) => setMealEditDraft((prev) => ({ ...prev, calories: event.target.value }))}
                          placeholder="Calories"
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={mealEditDraft.protein}
                          onChange={(event) => setMealEditDraft((prev) => ({ ...prev, protein: event.target.value }))}
                          placeholder="Protein"
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={mealEditDraft.carbs}
                          onChange={(event) => setMealEditDraft((prev) => ({ ...prev, carbs: event.target.value }))}
                          placeholder="Carbs"
                        />
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={mealEditDraft.fat}
                          onChange={(event) => setMealEditDraft((prev) => ({ ...prev, fat: event.target.value }))}
                          placeholder="Fat"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={cancelEditingMealLog}>
                          <X className="w-4 h-4 mr-1" />
                          Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={saveMealLogEdit}>
                          <Check className="w-4 h-4 mr-1" />
                          Save Meal
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-muted-foreground">No meals logged today.</p>
          )}
        </SectionCard>

        <SectionCard
          title="To-Do List"
          subtitle="Personal tasks just for this adult dashboard"
        >
          <div className="flex gap-2">
            <Input
              value={todoDraft}
              onChange={(event) => setTodoDraft(event.target.value)}
              placeholder={`Add a to-do for ${profile.name}`}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddTodo();
                }
              }}
            />
            <Button onClick={handleAddTodo}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>

          {todos.length > 0 ? (
            <div className="mt-4 space-y-2">
              {todos.map((todo) => (
                <div
                  key={todo.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2"
                >
                  <Checkbox
                    checked={todo.isCompleted}
                    onCheckedChange={() => handleToggleTodo(todo.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={todo.isCompleted ? 'text-sm line-through text-muted-foreground' : 'text-sm'}>
                      {todo.text}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteTodo(todo.id)}
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              No to-dos yet for {profile.name}.
            </p>
          )}
        </SectionCard>

        {isFemaleDashboard && (
          <SectionCard
            title="Cycle + Pregnancy"
            subtitle="Optional planning tracker for female dashboards. This is for awareness only, not medical guidance."
            action={
              <Button size="sm" onClick={handleSaveFemaleHealth}>
                Save
              </Button>
            }
          >
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-border p-4">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={femaleHealthDraft.cycleTrackingEnabled}
                      onCheckedChange={(checked) =>
                        setFemaleHealthDraft((prev) => ({
                          ...prev,
                          cycleTrackingEnabled: checked === true,
                        }))
                      }
                    />
                    <div>
                      <p className="font-medium text-sm">Track cycle / period</p>
                      <p className="text-xs text-muted-foreground">
                        Save the last period start and estimate the next one for planning.
                      </p>
                    </div>
                  </label>
                  {femaleHealthDraft.cycleTrackingEnabled && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Last period start
                        </p>
                        <Input
                          type="date"
                          value={femaleHealthDraft.lastPeriodStart}
                          onChange={(event) =>
                            setFemaleHealthDraft((prev) => ({
                              ...prev,
                              lastPeriodStart: event.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Cycle length (days)
                        </p>
                        <Input
                          type="number"
                          min={20}
                          max={45}
                          value={femaleHealthDraft.cycleLengthDays}
                          onChange={(event) =>
                            setFemaleHealthDraft((prev) => ({
                              ...prev,
                              cycleLengthDays: event.target.value.replace(/[^\d]/g, '').slice(0, 2),
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border p-4">
                  <label className="flex items-start gap-3">
                    <Checkbox
                      checked={femaleHealthDraft.pregnancyTrackingEnabled}
                      onCheckedChange={(checked) =>
                        setFemaleHealthDraft((prev) => ({
                          ...prev,
                          pregnancyTrackingEnabled: checked === true,
                        }))
                      }
                    />
                    <div>
                      <p className="font-medium text-sm">Track pregnancy</p>
                      <p className="text-xs text-muted-foreground">
                        Save a due date so the dashboard can show a simple countdown.
                      </p>
                    </div>
                  </label>
                  {femaleHealthDraft.pregnancyTrackingEnabled && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Due date
                      </p>
                      <Input
                        type="date"
                        value={femaleHealthDraft.pregnancyDueDate}
                        onChange={(event) =>
                          setFemaleHealthDraft((prev) => ({
                            ...prev,
                            pregnancyDueDate: event.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              </div>

              {(femaleHealthDraft.cycleTrackingEnabled || femaleHealthDraft.pregnancyTrackingEnabled) && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cycle status</p>
                    {femaleHealthDraft.cycleTrackingEnabled ? (
                      cycleStartDate && nextPeriodDate ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-lg font-semibold">Day {cycleDay}</p>
                          <p className="text-sm text-muted-foreground">
                            Next period around {format(nextPeriodDate, 'MMM d')}
                            {typeof daysUntilNextPeriod === 'number'
                              ? daysUntilNextPeriod >= 0
                                ? ` (${daysUntilNextPeriod} day${daysUntilNextPeriod === 1 ? '' : 's'} away)`
                                : ` (${Math.abs(daysUntilNextPeriod)} day${Math.abs(daysUntilNextPeriod) === 1 ? '' : 's'} ago)`
                              : ''}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Add a last period date to start cycle estimates.</p>
                      )
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Cycle tracking is off for this dashboard.</p>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pregnancy status</p>
                    {femaleHealthDraft.pregnancyTrackingEnabled ? (
                      dueDate ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-lg font-semibold">
                            {pregnancyWeeks ? `Week ${pregnancyWeeks}` : 'Due date saved'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Due {format(dueDate, 'MMM d')}
                            {typeof daysUntilDueDate === 'number'
                              ? daysUntilDueDate >= 0
                                ? ` (${daysUntilDueDate} day${daysUntilDueDate === 1 ? '' : 's'} away)`
                                : ` (${Math.abs(daysUntilDueDate)} day${Math.abs(daysUntilDueDate) === 1 ? '' : 's'} past due)`
                              : ''}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Add a due date to show the pregnancy countdown.</p>
                      )
                    ) : (
                      <p className="mt-2 text-sm text-muted-foreground">Pregnancy tracking is off for this dashboard.</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
                <Textarea
                  rows={3}
                  value={femaleHealthDraft.notes}
                  onChange={(event) =>
                    setFemaleHealthDraft((prev) => ({
                      ...prev,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional planning notes, symptoms, or things to remember."
                />
              </div>
            </div>
          </SectionCard>
        )}

        <SectionCard
          title="This Week"
          subtitle={`Final targets (editable): ${targetCalories} calories/day`}
        >
          <div className="flex items-end justify-between gap-2 h-32">
            {weekData.map((day) => {
              const percentage = Math.min((day.calories / targetCalories) * 100, 100);
              const barHeight = Math.max(percentage, 5);

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-24">
                    <span className="text-xs text-muted-foreground mb-1">{day.calories > 0 ? day.calories : ''}</span>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${day.isToday ? accentBar : accentBarMuted}`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className={`text-xs ${day.isToday ? `font-medium ${accentText}` : 'text-muted-foreground'}`}>
                    {day.day}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
            <div className={`w-4 h-0.5 ${accentBarMuted}`} />
            <span className="text-xs text-muted-foreground">Target: {targetCalories} cal/day</span>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SectionCard>
            <div className="text-center">
              <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${accentText}`} />
              <p className="text-2xl font-display font-semibold">{averageProtein}g</p>
              <p className="text-xs text-muted-foreground">Avg Protein on fully logged days</p>
            </div>
          </SectionCard>
          <SectionCard>
            <div className="text-center">
              <Target className={`w-6 h-6 mx-auto mb-2 ${accentText}`} />
              <p className="text-2xl font-display font-semibold">{averageCalories}</p>
              <p className="text-xs text-muted-foreground">Avg Calories on fully logged days</p>
            </div>
          </SectionCard>
          <SectionCard>
            <div className="text-center">
              <Trophy className={`w-6 h-6 mx-auto mb-2 ${accentText}`} />
              <p className="text-2xl font-display font-semibold">{weekPoints}</p>
              <p className="text-xs text-muted-foreground">Week Points</p>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Game Mode">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-border px-3 py-1">
              {macroPlan.proteinOnlyMode ? 'Protein-only mode' : 'Full macro mode'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <Flame className="w-4 h-4 text-orange-500" />
              {currentStreak} day streak
            </span>
            <span className="rounded-full border border-border px-3 py-1">
              Goal: {goalLabel}
            </span>
          </div>
        </SectionCard>
      </div>

      <MacroGoalDialog
        personId={personId}
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        onSaved={() => setRefreshTick((prev) => prev + 1)}
      />
    </AppLayout>
  );
}

function MetricPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${highlight ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground'}`}
    >
      <p className="uppercase tracking-wide text-[10px]">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

function getCurrentDay(date = new Date()): DayOfWeek {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()] as DayOfWeek;
}

function createMockDinnerCandidate(day: DayOfWeek): DinnerCandidate | null {
  const mockDinner = mockMealPlan.find((meal) => meal.day === day)?.recipe;
  if (!mockDinner) return null;
  return {
    label: mockDinner.name,
    recipeId: mockDinner.id,
    defaultServings: 1,
    macros: mockDinner.macrosPerServing,
  };
}

function createFemaleHealthDraft(settings?: ReturnType<typeof getFemaleHealthSettings>): FemaleHealthDraft {
  const source = settings || {
    cycleTrackingEnabled: false,
    pregnancyTrackingEnabled: false,
    lastPeriodStart: '',
    cycleLengthDays: 28,
    pregnancyDueDate: '',
    notes: '',
  };
  return {
    cycleTrackingEnabled: source.cycleTrackingEnabled,
    pregnancyTrackingEnabled: source.pregnancyTrackingEnabled,
    lastPeriodStart: source.lastPeriodStart,
    cycleLengthDays: String(source.cycleLengthDays || 28),
    pregnancyDueDate: source.pregnancyDueDate,
    notes: source.notes,
  };
}

function parseOptionalDate(value: string): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function getProjectedDinnerForDate({
  meals,
  date,
  personId,
  userId,
  includePlannedDinner,
}: {
  meals: DbPlannedMeal[];
  date: Date;
  personId: AdultId;
  userId?: string | null;
  includePlannedDinner: boolean;
}): { calories: number; protein_g: number; carbs_g: number; fat_g: number } {
  if (!includePlannedDinner) {
    return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }
  const dateKey = format(date, 'yyyy-MM-dd');
  const weekOf = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const dayName = getCurrentDay(date);
  const dinnerMeal = meals.find(
    (meal) => meal.week_of === weekOf && meal.day === dayName && !meal.is_skipped && !!meal.recipes,
  );

  if (!dinnerMeal?.recipes) {
    return { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  }

  const servings = getDinnerServingsForProfileDate(personId, dateKey, userId);
  return {
    calories: Math.round((dinnerMeal.recipes.calories || 0) * servings),
    protein_g: Math.round((dinnerMeal.recipes.protein_g || 0) * servings),
    carbs_g: Math.round((dinnerMeal.recipes.carbs_g || 0) * servings),
    fat_g: Math.round((dinnerMeal.recipes.fat_g || 0) * servings),
  };
}
