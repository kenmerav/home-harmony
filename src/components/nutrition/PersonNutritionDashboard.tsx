import { useEffect, useMemo, useState } from 'react';
import { addDays, differenceInCalendarDays, format, isValid, parseISO, subDays } from 'date-fns';
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
import { getPlannedFoodEntries } from '@/lib/mealBudgetPlanner';
import {
  AdultId,
  addDashboardTodo,
  addMealLog,
  deleteDashboardTodo,
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
  updateFemaleHealthSettings,
} from '@/lib/macroGame';
import { DayOfWeek, MealLog } from '@/types';
import { Check, Flame, Plus, Target, Trash2, Trophy, TrendingUp } from 'lucide-react';
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
  const currentDate = useCurrentDate();
  const todayKey = format(currentDate, 'yyyy-MM-dd');
  const currentDay = getCurrentDay(currentDate);

  useEffect(() => {
    let cancelled = false;
    const loadTodayMeals = async () => {
      try {
        const data = await fetchMealsForWeek(0);
        if (!cancelled) setLiveMeals(data);
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
  const todos = getDashboardTodos(personId);
  const todaysLogs = getEffectiveMealLogsForDate(personId, todayKey);
  const isFemaleDashboard = profile.macroPlan.questionnaire.sex === 'female';
  const todayScore = getDailyScore(personId, todayKey);
  const currentStreak = getCurrentStreak(personId, currentDate);
  const weekPoints = getWeekPoints(personId, currentDate);
  const targetCalories = profile.macroPlan.calories || 2000;
  const plannedDinnerEntry = useMemo(
    () =>
      getPlannedFoodEntries(user?.id).find((entry) => entry.date === todayKey && entry.mealType === 'dinner') || null,
    [todayKey, user?.id],
  );
  const liveTodaysMeal = liveMeals.find((meal) => meal.day === currentDay && !meal.is_skipped && !!meal.recipes);
  const tonightDinner = useMemo<DinnerCandidate | null>(() => {
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
  }, [currentDay, liveTodaysMeal, plannedDinnerEntry]);

  const handleQuickAddDinner = () => {
    if (!tonightDinner) return;
    const log: MealLog = {
      id: `dashboard-dinner-${Date.now()}-${personId}`,
      recipeId: tonightDinner.recipeId,
      recipeName: tonightDinner.label,
      date: todayKey,
      person: personId,
      mealType: 'dinner',
      servings: tonightDinner.defaultServings,
      macros: {
        calories: Math.round(tonightDinner.macros.calories * tonightDinner.defaultServings),
        protein_g: Math.round(tonightDinner.macros.protein_g * tonightDinner.defaultServings),
        carbs_g: Math.round(tonightDinner.macros.carbs_g * tonightDinner.defaultServings),
        fat_g: Math.round(tonightDinner.macros.fat_g * tonightDinner.defaultServings),
        fiber_g: tonightDinner.macros.fiber_g
          ? Math.round(tonightDinner.macros.fiber_g * tonightDinner.defaultServings)
          : undefined,
      },
      isQuickAdd: false,
      createdAt: new Date(),
    };
    addMealLog(log);
    setRefreshTick((prev) => prev + 1);
    toast({
      title: `Logged for ${profile.name}`,
      description: `${tonightDinner.label} • ${tonightDinner.defaultServings} serving${tonightDinner.defaultServings !== 1 ? 's' : ''}`,
    });
  };

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(currentDate, 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const score = getDailyScore(personId, dateStr);
    return {
      day: format(date, 'EEE'),
      date: dateStr,
      calories: score.calories,
      protein_g: score.protein_g,
      fullyLogged: isDailyLogFullyLogged(personId, dateStr),
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
          subtitle={`Final targets (editable): ${profile.macroPlan.calories} cal • ${profile.macroPlan.protein_g}P • ${profile.macroPlan.carbs_g}C • ${profile.macroPlan.fat_g}F`}
        >
          <MacroBar
            current={{
              calories: todayScore.calories,
              protein_g: todayScore.protein_g,
              carbs_g: todayScore.carbs_g,
              fat_g: todayScore.fat_g,
            }}
            target={{
              calories: profile.macroPlan.calories,
              protein_g: profile.macroPlan.protein_g,
              carbs_g: profile.macroPlan.carbs_g,
              fat_g: profile.macroPlan.fat_g,
            }}
          />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <MetricPill label="Points" value={`${todayScore.points}`} highlight />
            <MetricPill label="Streak" value={`${currentStreak} days`} />
            <MetricPill label="Water" value={`${todayScore.waterOz}/${profile.macroPlan.waterTargetOz} oz`} />
            <MetricPill label="Alcohol" value={`${todayScore.alcoholDrinks}/${profile.macroPlan.alcoholLimitDrinks}`} />
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
                </div>
                <Button size="sm" onClick={handleQuickAddDinner}>
                  <Check className="w-4 h-4 mr-2" />
                  Add Dinner
                </Button>
              </div>
            </div>
          )}

          {todaysLogs.length > 0 ? (
            <div className="space-y-3">
              {todaysLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{log.recipeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.servings} serving{log.servings !== 1 ? 's' : ''}
                      {log.isQuickAdd && ' • Quick Add'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{Math.round(log.macros.calories)} cal</p>
                    <p className="text-xs text-muted-foreground">{Math.round(log.macros.protein_g)}g protein</p>
                  </div>
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
              {profile.macroPlan.proteinOnlyMode ? 'Protein-only mode' : 'Full macro mode'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <Flame className="w-4 h-4 text-orange-500" />
              {currentStreak} day streak
            </span>
            <span className="rounded-full border border-border px-3 py-1">
              Goal: {profile.macroPlan.questionnaire.goal.replace('_', ' ')}
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
