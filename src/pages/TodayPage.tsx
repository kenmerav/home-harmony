import { useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfWeek, isSameDay } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { MacroBar } from '@/components/ui/MacroBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockMealPlan } from '@/data/mockData';
import { DayOfWeek, MealLog } from '@/types';
import {
  UtensilsCrossed,
  Camera,
  Check,
  SkipForward,
  Plus,
  Droplets,
  Wine,
  Trophy,
  Flame,
  CalendarDays,
  ClipboardList,
  ListChecks,
  Loader2,
  Dumbbell,
  ShoppingCart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCurrentDate } from '@/hooks/useCurrentDate';
import { estimateMealFromDescription, estimateMealFromPhoto } from '@/lib/api/mealPhoto';
import {
  addAlcohol,
  addMealLog,
  addWater,
  getDailyScore,
  getEffectiveMealLogsForDate,
  getFamilyLeaderboard,
  getProfiles,
  getCurrentStreak,
  hydrateMacroGameActivityFromAccount,
  listDashboardProfiles,
} from '@/lib/macroGame';
import { DbPlannedMeal, fetchMealsForWeek } from '@/lib/api/meals';
import { loadTasks, taskOccursOnDate } from '@/lib/taskStore';
import { useAuth } from '@/contexts/AuthContext';
import { CALENDAR_MODULE_META, fetchCalendarEventsForMonth } from '@/lib/calendarFeed';
import { CalendarEvent } from '@/lib/calendarStore';
import { getCommonFoods, getPlannedFoodEntriesForDate, PlannedFoodEntry } from '@/lib/mealBudgetPlanner';
import { loadOnboardingResult } from '@/lib/onboardingStore';
import { readStoredChoresState } from '@/lib/choresStateStore';

const getCurrentDay = (date = new Date()): DayOfWeek => {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()] as DayOfWeek;
};

const LEADERBOARD_PRIZE_KEY = 'homehub.leaderboardPrizeByWeek.v1';
const DEFAULT_WEEKLY_PRIZE = 'Winner gets M&Ms in their popcorn during family movie night.';

interface ChildChoreSummary {
  id: string;
  name: string;
  completed: number;
  total: number;
}

interface PendingChoreDetail {
  id: string;
  childId: string;
  childName: string;
  name: string;
}

type LogMealCategory = 'breakfast' | 'snacks' | 'lunch' | 'dinner' | 'drinks';

interface LogMealCandidate {
  id: string;
  recipeId?: string;
  label: string;
  personId?: string | null;
  personName?: string | null;
  defaultServings: number;
  macrosPerServing: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
  };
}

const LOG_MEAL_CATEGORY_OPTIONS: Array<{ value: LogMealCategory; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'snacks', label: 'Snacks' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'drinks', label: 'Drinks' },
];

function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const [wholeRaw, ...rest] = cleaned.split('.');
  const whole = wholeRaw.replace(/^0+(?=\d)/, '');
  if (rest.length === 0) return whole;
  return `${whole || '0'}.${rest.join('').replace(/\./g, '')}`;
}

function normalizeMealLookup(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadChildChoreSummary(userId?: string | null): ChildChoreSummary[] {
  try {
    const parsed = (readStoredChoresState(userId) || {}) as {
      children?: Array<{ id?: string; name?: string; dailyChores?: Array<{ isCompleted?: boolean }> }>;
    };
    const children = Array.isArray(parsed.children) ? parsed.children : [];
    return children.map((child, idx) => {
      const daily = Array.isArray(child.dailyChores) ? child.dailyChores : [];
      return {
        id: String(child.id || `child-${idx}`),
        name: String(child.name || 'Child'),
        completed: daily.filter((chore) => !!chore?.isCompleted).length,
        total: daily.length,
      };
    });
  } catch {
    return [];
  }
}

function loadPendingChoreDetails(userId?: string | null): PendingChoreDetail[] {
  try {
    const parsed = (readStoredChoresState(userId) || {}) as {
      children?: Array<{
        id?: string;
        name?: string;
        dailyChores?: Array<{ id?: string; name?: string; isCompleted?: boolean }>;
      }>;
    };
    const children = Array.isArray(parsed.children) ? parsed.children : [];
    return children.flatMap((child, childIndex) => {
      const childId = String(child.id || `child-${childIndex}`);
      const childName = String(child.name || 'Child');
      const dailyChores = Array.isArray(child.dailyChores) ? child.dailyChores : [];
      return dailyChores
        .filter((chore) => !chore?.isCompleted)
        .map((chore, choreIndex) => ({
          id: String(chore?.id || `${childId}-chore-${choreIndex}`),
          childId,
          childName,
          name: String(chore?.name || 'Chore'),
        }));
    });
  } catch {
    return [];
  }
}

type TodaySummaryView = 'schedule' | 'tasks' | 'chores' | 'actions';

interface FocusPrompt {
  focusLabel: string;
  focusRoute: string;
  launchChecklist: Array<{
    title: string;
    detail: string;
    href: string;
    cta: string;
  }>;
  wellnessSummary: string | null;
}

function readLaunchChecklist(input: unknown): FocusPrompt['launchChecklist'] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      title: typeof item.title === 'string' ? item.title.trim() : '',
      detail: typeof item.detail === 'string' ? item.detail.trim() : '',
      href: typeof item.href === 'string' ? item.href.trim() : '',
      cta: typeof item.cta === 'string' ? item.cta.trim() : '',
    }))
    .filter((item) => item.title && item.detail && item.href && item.cta);
}

function buildWellnessSummary(input: unknown): string | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const parts: string[] = [];
  if (Number.isFinite(Number(value.waterTargetOz)) && Number(value.waterTargetOz) > 0) {
    parts.push(`${Math.round(Number(value.waterTargetOz))} oz water`);
  }
  if (typeof value.stepGoal === 'string' && value.stepGoal.trim()) {
    parts.push(`${value.stepGoal.trim()} steps`);
  }
  if (Number.isFinite(Number(value.alcoholLimitDrinks)) && Number(value.alcoholLimitDrinks) >= 0) {
    parts.push(`${Number(value.alcoholLimitDrinks)} drink limit`);
  }
  if (typeof value.wakeUpTime === 'string' && value.wakeUpTime.trim()) {
    parts.push(`wake-up ${value.wakeUpTime.trim()}`);
  }
  if (Number.isFinite(Number(value.sleepTargetHours)) && Number(value.sleepTargetHours) > 0) {
    parts.push(`${Math.round(Number(value.sleepTargetHours))}h sleep`);
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}

export default function TodayPage() {
  const { user, profile } = useAuth();
  const currentDate = useCurrentDate();
  const todayLabel = format(currentDate, 'EEEE, MMMM d');
  const currentDay = getCurrentDay(currentDate);
  const todayKey = format(currentDate, 'yyyy-MM-dd');
  const weekKey = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const mockTodaysMeal = mockMealPlan.find((m) => m.day === currentDay);
  const { toast } = useToast();

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [mealServingsById, setMealServingsById] = useState<Record<string, string>>({});
  const [liveMeals, setLiveMeals] = useState<DbPlannedMeal[]>([]);
  const [prizeDialogOpen, setPrizeDialogOpen] = useState(false);
  const [leaderboardPrize, setLeaderboardPrize] = useState('');
  const [prizeInput, setPrizeInput] = useState('');
  const [todaysEvents, setTodaysEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [quickAddData, setQuickAddData] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    person: 'all',
  });
  const [quickAddPhotoNote, setQuickAddPhotoNote] = useState('');
  const [quickAddFoodQuery, setQuickAddFoodQuery] = useState('');
  const [estimatingMealPhoto, setEstimatingMealPhoto] = useState(false);
  const [logMealCategory, setLogMealCategory] = useState<LogMealCategory>('dinner');
  const [refreshTick, setRefreshTick] = useState(0);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [summaryView, setSummaryView] = useState<TodaySummaryView>('schedule');
  const [focusPrompt, setFocusPrompt] = useState<FocusPrompt>({
    focusLabel: 'First-week setup',
    focusRoute: '/app',
    launchChecklist: [],
    wellnessSummary: null,
  });

  useEffect(() => {
    let mounted = true;
    const loadPrompt = async () => {
      const stored = await loadOnboardingResult(user?.id);
      if (!mounted) return;
      const plan = stored?.personalizedPlan as Record<string, unknown> | undefined;
      const launchChecklist = readLaunchChecklist(plan?.launchChecklist).slice(0, 3);
      const focusLabel =
        typeof plan?.focusLabel === 'string' && plan.focusLabel.trim()
          ? plan.focusLabel.trim()
          : 'First-week setup';
      const focusRoute =
        typeof plan?.focusRoute === 'string' && plan.focusRoute.trim()
          ? plan.focusRoute.trim()
          : '/app';
      setFocusPrompt({
        focusLabel,
        focusRoute,
        launchChecklist,
        wellnessSummary: buildWellnessSummary(plan?.wellnessTargets),
      });
    };
    void loadPrompt();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadTodayMeals = async () => {
      try {
        const data = await fetchMealsForWeek(0);
        if (!cancelled) setLiveMeals(data);
      } catch (error) {
        console.error('Failed to load today meal plan:', error);
      }
    };
    void loadTodayMeals();
    return () => {
      cancelled = true;
    };
  }, [todayKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LEADERBOARD_PRIZE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      const storedPrize = parsed[weekKey] || '';
      const prize = storedPrize || DEFAULT_WEEKLY_PRIZE;
      if (!storedPrize) {
        window.localStorage.setItem(LEADERBOARD_PRIZE_KEY, JSON.stringify({ ...parsed, [weekKey]: prize }));
      }
      setLeaderboardPrize(prize);
      setPrizeInput(prize);
    } catch {
      setLeaderboardPrize(DEFAULT_WEEKLY_PRIZE);
      setPrizeInput(DEFAULT_WEEKLY_PRIZE);
    }
  }, [weekKey]);

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

  useEffect(() => {
    const triggerRefresh = () => setRefreshTick((prev) => prev + 1);
    window.addEventListener('homehub:calendar-events-updated', triggerRefresh);
    window.addEventListener('homehub:chores-state-updated', triggerRefresh);
    window.addEventListener('homehub:task-state-updated', triggerRefresh);
    window.addEventListener('homehub:meals-updated', triggerRefresh);
    return () => {
      window.removeEventListener('homehub:calendar-events-updated', triggerRefresh);
      window.removeEventListener('homehub:chores-state-updated', triggerRefresh);
      window.removeEventListener('homehub:task-state-updated', triggerRefresh);
      window.removeEventListener('homehub:meals-updated', triggerRefresh);
    };
  }, []);

  const refresh = () => setRefreshTick((prev) => prev + 1);
  const profiles = useMemo(() => getProfiles(), [refreshTick]);
  const dashboards = useMemo(() => listDashboardProfiles(), [refreshTick]);
  const todaysScores = useMemo(
    () =>
      dashboards.map((dashboard) => ({
        id: dashboard.id,
        label: dashboard.name,
        score: getDailyScore(dashboard.id, todayKey),
        streak: getCurrentStreak(dashboard.id, currentDate),
      })),
    [currentDate, dashboards, todayKey, refreshTick],
  );
  const leaderboard = useMemo(() => getFamilyLeaderboard(currentDate, user?.id), [currentDate, refreshTick, user?.id]);
  const childChores = useMemo(() => loadChildChoreSummary(user?.id), [refreshTick, user?.id]);
  const pendingChores = useMemo(() => loadPendingChoreDetails(user?.id), [refreshTick, user?.id]);
  const myFoodsEatenToday = useMemo(
    () => getEffectiveMealLogsForDate('me', todayKey, user?.id),
    [refreshTick, todayKey, user?.id],
  );
  const quickAddSavedFoods = useMemo(() => {
    const query = quickAddFoodQuery.trim().toLowerCase();
    const foods = getCommonFoods(user?.id);
    if (!query) return foods.slice(0, 8);
    return foods.filter((food) => food.name.toLowerCase().includes(query)).slice(0, 8);
  }, [quickAddFoodQuery, refreshTick, user?.id]);

  useEffect(() => {
    let cancelled = false;
    const loadTodayEvents = async () => {
      setEventsLoading(true);
      try {
        const events = await fetchCalendarEventsForMonth(currentDate, user?.id);
        if (cancelled) return;
        const todayEvents = events.filter((event) => {
          try {
            return isSameDay(parseISO(event.startsAt), currentDate);
          } catch {
            return false;
          }
        });
        setTodaysEvents(todayEvents);
      } catch (error) {
        console.error('Failed to load today calendar events:', error);
        if (!cancelled) setTodaysEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    };
    void loadTodayEvents();
    return () => {
      cancelled = true;
    };
  }, [currentDate, refreshTick, user?.id]);

  const todaysTasks = useMemo(() => {
    const today = new Date(currentDate);
    today.setHours(0, 0, 0, 0);
    const normalizedFullName = profile?.fullName?.trim().toLowerCase() || '';
    return loadTasks(user?.id)
      .filter((task) => {
        if (!task.assignedToId && !task.assignedToName) return true;
        if (task.assignedToId && user?.id && task.assignedToId === user.id) return true;
        if (task.assignedToId === 'me') return true;
        if (task.assignedToName && normalizedFullName && task.assignedToName.trim().toLowerCase() === normalizedFullName) {
          return true;
        }
        return false;
      })
      .filter((task) => taskOccursOnDate(task, today))
      .slice(0, 6);
  }, [currentDate, profile?.fullName, refreshTick, user?.id]);

  const pendingTaskCount = todaysTasks.filter((task) => task.status !== 'done').length;
  const pendingChoreCount = childChores.reduce((sum, child) => sum + Math.max(child.total - child.completed, 0), 0);
  const completedChoresCount = childChores.reduce((sum, child) => sum + child.completed, 0);
  const workoutCountToday = todaysEvents.filter((event) => event.module === 'workouts').length;
  const groceryActionCount = todaysEvents.filter(
    (event) => event.module === 'meals' || event.title.toLowerCase().includes('grocery'),
  ).length;
  const actionEvents = useMemo(
    () =>
      todaysEvents.filter(
        (event) => event.module === 'workouts' || event.module === 'meals' || event.title.toLowerCase().includes('grocery'),
      ),
    [todaysEvents],
  );

  const nextEvent = useMemo(() => {
    const now = Date.now();
    return (
      todaysEvents.find((event) => {
        if (event.allDay) return true;
        const end = event.endsAt ? parseISO(event.endsAt) : parseISO(event.startsAt);
        return end.getTime() >= now;
      }) || null
    );
  }, [todaysEvents]);

  const openSummaryDialog = (view: TodaySummaryView) => {
    setSummaryView(view);
    setSummaryDialogOpen(true);
  };

  const plannedEntriesToday = useMemo(
    () =>
      getPlannedFoodEntriesForDate(todayKey, user?.id).filter(
        (entry) => !entry.personId || entry.personId === 'me' || entry.personId === user?.id || entry.mealType === 'dinner',
      ),
    [refreshTick, todayKey, user?.id],
  );

  const liveTodaysMeal = liveMeals.find((m) => m.day === currentDay && !m.is_skipped && !!m.recipes);
  const fallbackDinner = liveTodaysMeal
    ? {
        recipeId: liveTodaysMeal.recipe_id,
        recipe: {
          name: liveTodaysMeal.recipes?.name || 'Unknown meal',
          servings: liveTodaysMeal.recipes?.servings || 1,
          macrosPerServing: {
            calories: liveTodaysMeal.recipes?.calories || 0,
            protein_g: liveTodaysMeal.recipes?.protein_g || 0,
            carbs_g: liveTodaysMeal.recipes?.carbs_g || 0,
            fat_g: liveTodaysMeal.recipes?.fat_g || 0,
            fiber_g: liveTodaysMeal.recipes?.fiber_g || undefined,
          },
        },
      }
    : null;

  const logMealCandidatesByCategory = useMemo<
    Record<LogMealCategory, LogMealCandidate[]>
  >(() => {
    const next: Record<LogMealCategory, LogMealCandidate[]> = {
      breakfast: [],
      snacks: [],
      lunch: [],
      dinner: [],
      drinks: [],
    };

    const addFromPlannedEntry = (entry: PlannedFoodEntry) => {
      const servings = Math.max(0.1, entry.servings || 1);
      const category: LogMealCategory =
        entry.mealType === 'alcohol'
          ? 'drinks'
          : entry.mealType === 'snack'
          ? 'snacks'
          : entry.mealType === 'dessert'
          ? 'snacks'
          : (entry.mealType as LogMealCategory);
      next[category].push({
        id: `planned-${entry.id}`,
        recipeId: entry.sourceRecipeId || undefined,
        label: entry.personName ? `${entry.name} - ${entry.personName}` : entry.name,
        personId: entry.personId || null,
        personName: entry.personName || null,
        defaultServings: servings,
        macrosPerServing: {
          calories: Math.max(0, Math.round(entry.calories / servings)),
          protein_g: Math.max(0, Math.round(entry.protein_g / servings)),
          carbs_g: Math.max(0, Math.round(entry.carbs_g / servings)),
          fat_g: Math.max(0, Math.round(entry.fat_g / servings)),
        },
      });
    };

    plannedEntriesToday.forEach(addFromPlannedEntry);

    const hasMatchingDinner = fallbackDinner
      ? next.dinner.some((entry) => entry.recipeId && entry.recipeId === fallbackDinner.recipeId)
      : false;
    if (fallbackDinner && !hasMatchingDinner) {
      next.dinner.unshift({
        id: `scheduled-${fallbackDinner.recipeId || fallbackDinner.recipe.name}`,
        recipeId: fallbackDinner.recipeId,
        label: fallbackDinner.recipe.name,
        defaultServings: 1,
        macrosPerServing: fallbackDinner.recipe.macrosPerServing,
      });
    } else if (!fallbackDinner && mockTodaysMeal?.recipe) {
      next.dinner.unshift({
        id: `mock-${mockTodaysMeal.recipeId}`,
        recipeId: mockTodaysMeal.recipeId,
        label: mockTodaysMeal.recipe.name,
        defaultServings: 1,
        macrosPerServing: mockTodaysMeal.recipe.macrosPerServing,
      });
    }

    return next;
  }, [fallbackDinner, mockTodaysMeal, plannedEntriesToday]);

  const logMealCandidates = logMealCandidatesByCategory[logMealCategory] || [];
  const tonightDinnerCandidate = logMealCandidatesByCategory.dinner[0] || null;
  const todayLogsByPerson = useMemo(() => {
    const next: Record<string, MealLog[]> = {
      me: getEffectiveMealLogsForDate('me', todayKey, user?.id),
    };
    dashboards.forEach((dashboard) => {
      next[dashboard.id] = getEffectiveMealLogsForDate(dashboard.id, todayKey, user?.id);
    });
    return next;
  }, [dashboards, refreshTick, todayKey, user?.id]);
  const myDinnerAlreadyLogged = useMemo(
    () => getEffectiveMealLogsForDate('me', todayKey, user?.id).some((log) => log.mealType === 'dinner'),
    [refreshTick, todayKey, user?.id],
  );

  useEffect(() => {
    setMealServingsById((prev) => {
      const next: Record<string, string> = {};
      logMealCandidates.forEach((entry) => {
        next[entry.id] = prev[entry.id] || String(entry.defaultServings || 1);
      });
      return next;
    });
  }, [logMealCandidates]);

  const parseServings = (raw: string) => {
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return 1;
    return Math.min(4, Math.max(0.25, parsed));
  };

  const logMealCandidate = (
    candidate: LogMealCandidate | null,
    person: string | 'all',
    servingsInput?: string,
  ) => {
    if (!candidate) return;
    const servings = parseServings(servingsInput ?? mealServingsById[candidate.id] ?? String(candidate.defaultServings || 1));
    const scaledMacros = {
      calories: Math.round(candidate.macrosPerServing.calories * servings),
      protein_g: Math.round(candidate.macrosPerServing.protein_g * servings),
      carbs_g: Math.round(candidate.macrosPerServing.carbs_g * servings),
      fat_g: Math.round(candidate.macrosPerServing.fat_g * servings),
      fiber_g: candidate.macrosPerServing.fiber_g
        ? Math.round(candidate.macrosPerServing.fiber_g * servings)
        : undefined,
    };

    const createLog = (target: string): MealLog => ({
      id: `log-${Date.now()}-${target}`,
      recipeId: candidate.recipeId,
      recipeName: candidate.label,
      date: todayKey,
      person: target,
      mealType:
        logMealCategory === 'snacks'
          ? 'snack'
          : logMealCategory === 'drinks'
            ? 'alcohol'
            : logMealCategory,
      servings,
      macros: scaledMacros,
      isQuickAdd: false,
      createdAt: new Date(),
    });

    if (person === 'all') {
      dashboards.forEach((dashboard) => addMealLog(createLog(dashboard.id)));
      toast({
        title: dashboards.length > 1 ? 'Logged for all dashboards' : 'Logged meal',
        description: `${candidate.label} • ${servings} servings`,
      });
    } else {
      addMealLog(createLog(person));
      const targetName = dashboards.find((dashboard) => dashboard.id === person)?.name || profiles[person]?.name || 'Dashboard';
      toast({
        title: `Logged for ${targetName}`,
        description: `${candidate.label} • ${servings} servings`,
      });
    }
    refresh();
  };

  const setCandidateServings = (candidateId: string, value: string) => {
    setMealServingsById((prev) => ({ ...prev, [candidateId]: value }));
  };

  const candidateAlreadyLogged = (candidate: LogMealCandidate): boolean => {
    const targetPersonId = candidate.personId || 'me';
    const logs = todayLogsByPerson[targetPersonId] || [];
    const candidateMealType =
      logMealCategory === 'snacks'
        ? 'snack'
        : logMealCategory === 'drinks'
          ? 'alcohol'
          : logMealCategory;
    const normalizedLabel = normalizeMealLookup(candidate.label);
    const normalizedBaseLabel = normalizeMealLookup(candidate.label.split(' - ')[0] || candidate.label);

    return logs.some((log) => {
      if (log.mealType !== candidateMealType) return false;
      if (candidate.recipeId && log.recipeId && candidate.recipeId === log.recipeId) return true;
      const normalizedLogName = normalizeMealLookup(log.recipeName || '');
      return normalizedLogName === normalizedLabel || normalizedLogName === normalizedBaseLabel;
    });
  };

  const submitQuickAdd = (input = quickAddData, options?: { closeDialog?: boolean; title?: string; description?: string }) => {
    const calories = Number.parseInt(input.calories, 10) || 0;
    const protein = Number.parseInt(input.protein, 10) || 0;
    const carbs = Number.parseInt(input.carbs, 10) || 0;
    const fat = Number.parseInt(input.fat, 10) || 0;

    if (calories <= 0) {
      toast({ title: 'Please enter calories', variant: 'destructive' });
      return false;
    }

    const createLog = (target: string): MealLog => ({
      id: `quickadd-${Date.now()}-${target}`,
      recipeName: input.name || 'Quick Add',
      date: todayKey,
      person: target,
      mealType:
        logMealCategory === 'snacks'
          ? 'snack'
          : logMealCategory === 'drinks'
            ? 'alcohol'
            : logMealCategory,
      servings: 1,
      macros: { calories, protein_g: protein, carbs_g: carbs, fat_g: fat },
      isQuickAdd: true,
      createdAt: new Date(),
    });

    if (input.person === 'all') {
      dashboards.forEach((dashboard) => addMealLog(createLog(dashboard.id)));
    } else {
      addMealLog(createLog(input.person));
    }

    toast({
      title: options?.title || 'Added',
      description: options?.description || `${calories} cal${input.name ? ` - ${input.name}` : ''}`,
    });

    if (options?.closeDialog !== false) {
      setQuickAddOpen(false);
    }
    setQuickAddData({ name: '', calories: '', protein: '', carbs: '', fat: '', person: 'all' });
    setQuickAddPhotoNote('');
    refresh();
    return true;
  };

  const handleQuickAdd = () => {
    submitQuickAdd();
  };

  const applyQuickAddSavedFood = (foodId: string) => {
    const selected = getCommonFoods(user?.id).find((food) => food.id === foodId);
    if (!selected) return;
    setQuickAddData((prev) => ({
      ...prev,
      name: selected.name,
      calories: String(selected.calories || 0),
      protein: String(selected.protein_g || 0),
      carbs: String(selected.carbs_g || 0),
      fat: String(selected.fat_g || 0),
    }));
  };

  const handleEstimateMealPhoto = async (file: File | null) => {
    if (!file) return;
    setEstimatingMealPhoto(true);
    try {
      const result = await estimateMealFromPhoto(file, quickAddPhotoNote);
      if (!result.success || !result.meal) {
        toast({
          title: 'Could not estimate meal',
          description: result.error || 'Try a clearer nutrition label or add a short description of what you ate.',
          variant: 'destructive',
        });
        return;
      }

      setQuickAddData((prev) => ({
        ...prev,
        name: result.meal?.name || prev.name,
        calories: String(result.meal?.calories || 0),
        protein: String(result.meal?.protein_g || 0),
        carbs: String(result.meal?.carbs_g || 0),
        fat: String(result.meal?.fat_g || 0),
      }));

      const estimatedQuickAddData = {
        ...quickAddData,
        name: result.meal?.name || quickAddData.name,
        calories: String(result.meal?.calories || 0),
        protein: String(result.meal?.protein_g || 0),
        carbs: String(result.meal?.carbs_g || 0),
        fat: String(result.meal?.fat_g || 0),
      };

      const looksUsable =
        (result.meal?.calories || 0) > 0 &&
        String(result.meal?.name || '').trim().toLowerCase() !== 'unknown meal';

      if (looksUsable) {
        submitQuickAdd(estimatedQuickAddData, {
          title: 'Meal estimated and logged',
          description: result.meal.assumptions || `${result.meal.name} was added to your log.`,
        });
      } else {
        toast({
          title: 'Meal estimated',
          description: result.meal.assumptions || `${result.meal.name} is ready to review before logging.`,
        });
      }
    } finally {
      setEstimatingMealPhoto(false);
    }
  };

  const handleEstimateMealDescription = async () => {
    if (!quickAddPhotoNote.trim()) {
      toast({ title: 'Describe what you ate first', variant: 'destructive' });
      return;
    }
    setEstimatingMealPhoto(true);
    try {
      const result = await estimateMealFromDescription(quickAddPhotoNote);
      if (!result.success || !result.meal) {
        toast({
          title: 'Could not estimate meal',
          description: result.error || 'Try a little more detail about what you ate.',
          variant: 'destructive',
        });
        return;
      }

      setQuickAddData((prev) => ({
        ...prev,
        name: result.meal?.name || prev.name,
        calories: String(result.meal?.calories || 0),
        protein: String(result.meal?.protein_g || 0),
        carbs: String(result.meal?.carbs_g || 0),
        fat: String(result.meal?.fat_g || 0),
      }));

      toast({
        title: 'Meal estimated',
        description: result.meal.assumptions || `${result.meal.name} is ready to review before adding.`,
      });
    } finally {
      setEstimatingMealPhoto(false);
    }
  };

  const adjustWater = (person: string, deltaOz: number) => {
    addWater(person, deltaOz, todayKey);
    refresh();
  };

  const adjustAlcohol = (person: string, deltaDrinks: number) => {
    addAlcohol(person, deltaDrinks, todayKey);
    refresh();
  };

  const saveWeeklyPrize = () => {
    const nextPrize = prizeInput.trim();
    if (!nextPrize) {
      toast({ title: 'Enter a prize', variant: 'destructive' });
      return;
    }
    try {
      const raw = window.localStorage.getItem(LEADERBOARD_PRIZE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      parsed[weekKey] = nextPrize;
      window.localStorage.setItem(LEADERBOARD_PRIZE_KEY, JSON.stringify(parsed));
      setLeaderboardPrize(nextPrize);
      setPrizeDialogOpen(false);
      toast({ title: 'Weekly prize updated' });
    } catch {
      toast({ title: 'Could not save prize', variant: 'destructive' });
    }
  };

  return (
    <AppLayout>
      <PageHeader title="Today" subtitle={todayLabel} />

      <div className="space-y-6 stagger-children">
        {(focusPrompt.launchChecklist.length > 0 || focusPrompt.wellnessSummary) && (
          <SectionCard
            title="Your Focus This Week"
            subtitle={`Home Harmony is currently prioritizing ${focusPrompt.focusLabel.toLowerCase()} for your setup.`}
            action={
              <Link to={focusPrompt.focusRoute}>
                <Button size="sm" variant="outline">Open {focusPrompt.focusLabel}</Button>
              </Link>
            }
          >
            {focusPrompt.wellnessSummary ? (
              <div className="mb-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Wellness targets: <span className="font-medium text-foreground">{focusPrompt.wellnessSummary}</span>
              </div>
            ) : null}
            {focusPrompt.launchChecklist.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
                {focusPrompt.launchChecklist.map((step, index) => (
                  <div key={`${step.title}-${index}`} className="rounded-lg border border-border p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Next step {index + 1}</p>
                    <p className="mt-1 font-medium">{step.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                    <Link to={step.href} className="mt-3 inline-block">
                      <Button size="sm" variant="outline">{step.cta}</Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        )}

        <SectionCard
          title="Daily Command Center"
          subtitle="Everything important for today, in one place"
          action={
            <Link to="/calendar">
              <Button variant="ghost" size="sm">
                Open Planner
              </Button>
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <button
              type="button"
              onClick={() => openSummaryDialog('schedule')}
              className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/30"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Next up</p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {nextEvent ? nextEvent.title : 'No upcoming event'}
              </p>
              {nextEvent && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatEventTime(nextEvent)}
                </p>
              )}
            </button>
            <button
              type="button"
              onClick={() => openSummaryDialog('schedule')}
              className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/30"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Today schedule</p>
              <p className="mt-1 text-2xl font-display font-semibold">{todaysEvents.length}</p>
              <p className="text-xs text-muted-foreground">events</p>
            </button>
            <button
              type="button"
              onClick={() => openSummaryDialog('tasks')}
              className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/30"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Open tasks</p>
              <p className="mt-1 text-2xl font-display font-semibold">{pendingTaskCount}</p>
              <p className="text-xs text-muted-foreground">to complete today</p>
            </button>
            <button
              type="button"
              onClick={() => openSummaryDialog('chores')}
              className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/30"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Chores pending</p>
              <p className="mt-1 text-2xl font-display font-semibold">{pendingChoreCount}</p>
              <p className="text-xs text-muted-foreground">{completedChoresCount} done</p>
            </button>
            <button
              type="button"
              onClick={() => openSummaryDialog('actions')}
              className="rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/30"
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Workouts + meal actions</p>
              <p className="mt-1 text-2xl font-display font-semibold">{workoutCountToday + groceryActionCount}</p>
              <p className="text-xs text-muted-foreground">planned actions</p>
            </button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to="/calendar">
              <Button size="sm" variant="outline">
                <CalendarDays className="w-4 h-4 mr-1" />
                Add event
              </Button>
            </Link>
            <Link to="/meals">
              <Button size="sm" variant="outline">
                <UtensilsCrossed className="w-4 h-4 mr-1" />
                Plan meals
              </Button>
            </Link>
            <Link to="/grocery">
              <Button size="sm" variant="outline">
                <ShoppingCart className="w-4 h-4 mr-1" />
                Open grocery
              </Button>
            </Link>
            <Link to="/tasks">
              <Button size="sm" variant="outline">
                <ClipboardList className="w-4 h-4 mr-1" />
                Manage tasks
              </Button>
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Today's Schedule"
          subtitle="Meals, chores, tasks, workouts, and reminders in one timeline"
          action={
            <Link to="/calendar">
              <Button variant="ghost" size="sm">
                Full Calendar
              </Button>
            </Link>
          }
        >
          {eventsLoading ? (
            <p className="text-sm text-muted-foreground">Loading today&apos;s timeline...</p>
          ) : todaysEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Nothing scheduled for today yet.
            </div>
          ) : (
            <div className="space-y-2">
              {todaysEvents.map((event) => {
                const meta = CALENDAR_MODULE_META[event.module] || CALENDAR_MODULE_META.manual;
                const Icon = moduleIconForEvent(event.module);
                return (
                  <div
                    key={event.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="flex min-w-0 gap-3">
                      <div className="mt-0.5 rounded-full bg-muted/50 p-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                        {event.description && (
                          <p className="truncate text-xs text-muted-foreground">{event.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{formatEventTime(event)}</p>
                      </div>
                    </div>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.badgeClass)}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard
            title="Tasks and Chores"
            subtitle="What needs attention today"
            action={
              <div className="flex items-center gap-2">
                <Link to="/tasks">
                  <Button variant="ghost" size="sm">
                    Tasks
                  </Button>
                </Link>
                <Link to="/chores">
                  <Button variant="ghost" size="sm">
                    Chores
                  </Button>
                </Link>
              </div>
            }
          >
            <div className="space-y-5">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Today&apos;s Tasks</p>
                <div className="space-y-2">
                  {todaysTasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tasks scheduled today.</p>
                  ) : (
                    todaysTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          {task.notes && <p className="truncate text-xs text-muted-foreground">{task.notes}</p>}
                        </div>
                        <StatusBadge status={task.status} />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Kids Chore Progress</p>
                {childChores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No kids added yet.</p>
                ) : (
                  <div className="space-y-2">
                    {childChores.map((child) => (
                      <div key={child.id} className="rounded-md border border-border px-3 py-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">{child.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {child.completed}/{child.total}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Log Today's Meals"
            subtitle="Choose a meal slot and log what was planned"
            action={
              <Link to="/meals">
                <Button variant="ghost" size="sm">
                  View Week
                </Button>
              </Link>
            }
          >
            {tonightDinnerCandidate && (
              <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-primary/80">Tonight&apos;s Dinner</p>
                    <h3 className="mt-1 font-display text-lg font-semibold text-foreground">{tonightDinnerCandidate.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      {Math.round(tonightDinnerCandidate.macrosPerServing.calories)} cal/serving
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={myDinnerAlreadyLogged ? 'outline' : 'default'}
                    disabled={myDinnerAlreadyLogged}
                    onClick={() => logMealCandidate(tonightDinnerCandidate, 'me', String(tonightDinnerCandidate.defaultServings || 1))}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    {myDinnerAlreadyLogged ? 'Dinner Already Logged' : 'Quick Add Dinner'}
                  </Button>
                </div>
                {myDinnerAlreadyLogged ? (
                  <p className="mt-3 text-xs text-muted-foreground">Dinner is already in your log for today.</p>
                ) : null}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Meal slot</label>
                <select
                  value={logMealCategory}
                  onChange={(event) => setLogMealCategory(event.target.value as LogMealCategory)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {LOG_MEAL_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

            {logMealCandidates.length > 0 ? (
              <div className="space-y-4">
                {logMealCandidates.map((candidate) => {
                  const servingsValue = mealServingsById[candidate.id] || String(candidate.defaultServings || 1);
                  const alreadyLogged = candidateAlreadyLogged(candidate);
                  return (
                    <div key={candidate.id} className="rounded-xl border border-border p-4 space-y-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <UtensilsCrossed className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-display text-lg font-semibold text-foreground">{candidate.label}</h3>
                          <p className="text-sm text-muted-foreground">
                            {Math.round(candidate.macrosPerServing.calories)} cal/serving
                          </p>
                          {candidate.personName ? (
                            <p className="text-xs text-muted-foreground">
                              Planned for {candidate.personName}
                            </p>
                          ) : null}
                          <MacroBar current={candidate.macrosPerServing} compact />
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Serving size to log</p>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.25"
                              min="0.25"
                              max="4"
                              value={servingsValue}
                              onChange={(e) => setCandidateServings(candidate.id, normalizeDecimalInput(e.target.value))}
                              className="h-8 w-20 text-center"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {['0.5', '0.75', '1', '1.25', '1.5', '2'].map((value) => (
                              <Button
                                key={value}
                                type="button"
                                size="sm"
                                variant={servingsValue === value ? 'default' : 'outline'}
                                onClick={() => setCandidateServings(candidate.id, value)}
                              >
                                {value}x
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 pt-1">
                        <Button
                          size="sm"
                          className="w-full"
                          variant={alreadyLogged ? 'outline' : 'default'}
                          disabled={alreadyLogged}
                          onClick={() => logMealCandidate(candidate, candidate.personId || 'all', servingsValue)}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          {alreadyLogged
                            ? 'Already Logged'
                            : candidate.personName
                              ? `Log for ${candidate.personName} (+points)`
                              : dashboards.length > 1
                                ? 'Log for all dashboards (+points)'
                                : 'Log meal (+points)'}
                        </Button>
                        {alreadyLogged ? (
                          <p className="text-xs text-muted-foreground">This item is already in today&apos;s log.</p>
                        ) : null}
                        {!candidate.personId && (
                          <div className="flex flex-wrap gap-2">
                            {dashboards.map((dashboard) => (
                              <Button
                                key={dashboard.id}
                                size="sm"
                                variant="outline"
                                onClick={() => logMealCandidate(candidate, dashboard.id, servingsValue)}
                              >
                                {dashboard.name}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <SkipForward className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No planned {logMealCategory === 'drinks' ? 'drinks' : logMealCategory} for today</p>
                <Link to="/meals" className="inline-flex mt-3">
                  <Button size="sm" variant="outline">Add to Meal Plan</Button>
                </Link>
              </div>
            )}
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Family Leaderboard"
          subtitle="Weekly points across nutrition + chores"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPrizeDialogOpen(true)}>
                Set Prize
              </Button>
              <Link to="/family">
                <Button size="sm" variant="ghost">Family Hub</Button>
              </Link>
            </div>
          }
        >
          <div className="mb-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-primary/80">This Week&apos;s Prize</p>
            <p className="text-sm font-medium text-foreground">{leaderboardPrize}</p>
          </div>
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div key={entry.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-center text-sm font-semibold">{index + 1}</span>
                  <span className="font-medium text-sm">{entry.name}</span>
                  {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                  <span className="text-xs text-muted-foreground">{entry.headline}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{entry.weekPoints} pts</p>
                  <p className="text-xs text-muted-foreground">today {entry.todayPoints}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Nutrition and Goals" subtitle="Track food, protein, water, and alcohol when needed">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {todaysScores.map((entry) => (
                  <div key={entry.id} className="rounded-lg border border-border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{entry.label}</p>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-orange-500" />
                          {entry.streak} day streak
                        </span>
                        <span className="font-semibold text-foreground">{entry.score.points} pts</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <BadgeLine label="Protein" hit={entry.score.proteinHit} />
                      <BadgeLine label="Calories" hit={entry.score.calorieHit} />
                      <BadgeLine label="Water" hit={entry.score.waterHit} />
                      <BadgeLine label="Alcohol" hit={entry.score.alcoholHit} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" onClick={() => adjustWater(entry.id, 16)}>
                        <Droplets className="w-4 h-4 mr-1" />
                        +16oz
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjustWater(entry.id, -16)}>
                        <Droplets className="w-4 h-4 mr-1" />
                        -16oz
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjustAlcohol(entry.id, 1)}>
                        <Wine className="w-4 h-4 mr-1" />
                        +1 drink
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => adjustAlcohol(entry.id, -1)}>
                        <Wine className="w-4 h-4 mr-1" />
                        -1 drink
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Water: {entry.score.waterOz} oz • Alcohol: {entry.score.alcoholDrinks} drinks
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {todaysScores.map((entry) => {
                  const targetProtein = profiles[entry.id]?.macroPlan?.protein_g || 0;
                  return (
                    <Link key={entry.id} to={`/dashboard/${entry.id}`} className="block">
                      <SectionCard className="card-hover">
                        <div className="text-center mb-3">
                          <p className="text-sm text-muted-foreground">{entry.label}</p>
                          <p className="text-2xl font-display font-semibold">{Math.round(entry.score.calories)}</p>
                          <p className="text-xs text-muted-foreground">calories today</p>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Protein</span>
                            <span className="font-medium">{Math.round(entry.score.protein_g)}g</span>
                          </div>
                          <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${targetProtein > 0 ? Math.min((entry.score.protein_g / targetProtein) * 100, 100) : 0}%` }}
                            />
                          </div>
                        </div>
                      </SectionCard>
                    </Link>
                  );
                })}
              </div>

              <Button variant="outline" className="w-full" onClick={() => setQuickAddOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Quick Add Meal
              </Button>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Foods Eaten Today</p>
                  <p className="text-sm text-muted-foreground">Your Me dashboard log for today</p>
                </div>
                <span className="text-sm text-muted-foreground">{myFoodsEatenToday.length} item{myFoodsEatenToday.length === 1 ? '' : 's'}</span>
              </div>

              {myFoodsEatenToday.length > 0 ? (
                <div className="space-y-3">
                  {myFoodsEatenToday.map((log) => (
                    <div key={log.id} className="rounded-md border border-border/80 px-3 py-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{log.recipeName}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.mealType ? log.mealType.charAt(0).toUpperCase() + log.mealType.slice(1) : 'Meal'} • {log.servings} serving{log.servings !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{Math.round(log.macros.calories)} cal</p>
                          <p className="text-xs text-muted-foreground">{Math.round(log.macros.protein_g)}g protein</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Nothing logged for Me yet today.
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Quick Add</DialogTitle>
            <DialogDescription>Log an unplanned meal or snack</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
              <div>
                <p className="text-sm font-medium">Estimate from nutrition label or description</p>
                <p className="text-xs text-muted-foreground">
                  Type what you ate or upload a nutrition label picture, then review and add it.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Estimate only. Manually entering your macros gives you the most reliable tracking.
                </p>
              </div>
              <Input
                placeholder="Describe what you ate: tuna sandwich, Greek yogurt, chips"
                value={quickAddPhotoNote}
                onChange={(e) => setQuickAddPhotoNote(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleEstimateMealDescription()}
                disabled={estimatingMealPhoto}
              >
                {estimatingMealPhoto ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Check className="mr-2 h-4 w-4" />
                )}
                Estimate from description
              </Button>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background px-3 py-3 text-sm font-medium text-foreground hover:bg-muted/30">
                {estimatingMealPhoto ? (
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
                  disabled={estimatingMealPhoto}
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    void handleEstimateMealPhoto(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            <div className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
              <div>
                <p className="text-sm font-medium">Saved Foods</p>
                <p className="text-xs text-muted-foreground">
                  Pick something you already log often and we’ll drop the macros in for you.
                </p>
              </div>
              <Input
                placeholder="Search My Foods..."
                value={quickAddFoodQuery}
                onChange={(e) => setQuickAddFoodQuery(e.target.value)}
              />
              {quickAddSavedFoods.length > 0 ? (
                <div className="rounded-md border border-border bg-background p-1">
                  {quickAddSavedFoods.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                      onClick={() => applyQuickAddSavedFood(food.id)}
                    >
                      <span className="truncate">{food.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{food.calories} cal</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No saved foods matched that search.</p>
              )}
            </div>

            <Input
              placeholder="Name (optional)"
              value={quickAddData.name}
              onChange={(e) => setQuickAddData((prev) => ({ ...prev, name: e.target.value }))}
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Calories *</label>
                <Input
                  type="number"
                  placeholder="200"
                  value={quickAddData.calories}
                  onChange={(e) => setQuickAddData((prev) => ({ ...prev, calories: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Protein (g)</label>
                <Input
                  type="number"
                  placeholder="20"
                  value={quickAddData.protein}
                  onChange={(e) => setQuickAddData((prev) => ({ ...prev, protein: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Carbs (g)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={quickAddData.carbs}
                  onChange={(e) => setQuickAddData((prev) => ({ ...prev, carbs: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Fat (g)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={quickAddData.fat}
                  onChange={(e) => setQuickAddData((prev) => ({ ...prev, fat: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Log for</label>
              <div className="flex flex-wrap gap-2">
                {[{ id: 'all', label: dashboards.length > 1 ? 'All dashboards' : 'This dashboard' }, ...dashboards.map((dashboard) => ({ id: dashboard.id, label: dashboard.name }))].map((option) => (
                  <Button
                    key={option.id}
                    type="button"
                    variant={quickAddData.person === option.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQuickAddData((prev) => ({ ...prev, person: option.id }))}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setQuickAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleQuickAdd}>
                <Plus className="w-4 h-4 mr-2" />
                Add
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={prizeDialogOpen} onOpenChange={setPrizeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Set Weekly Prize</DialogTitle>
            <DialogDescription>Choose this week&apos;s reward for the family leaderboard winner.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Example: Winner picks Friday dessert"
              value={prizeInput}
              onChange={(e) => setPrizeInput(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrizeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveWeeklyPrize}>Save Prize</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryDialogOpen} onOpenChange={setSummaryDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {summaryView === 'schedule'
                ? "Today's Schedule"
                : summaryView === 'tasks'
                  ? "Today's Tasks"
                  : summaryView === 'chores'
                    ? 'Pending Chores'
                    : "Today's Action Items"}
            </DialogTitle>
            <DialogDescription>
              {summaryView === 'schedule'
                ? 'Everything currently scheduled for today.'
                : summaryView === 'tasks'
                  ? 'The tasks still open for today.'
                  : summaryView === 'chores'
                    ? 'The daily chores that still need to be done.'
                    : 'Workout and meal-related actions planned for today.'}
            </DialogDescription>
          </DialogHeader>

          {summaryView === 'schedule' ? (
            todaysEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled for today yet.</p>
            ) : (
              <div className="space-y-2">
                {todaysEvents.map((event) => {
                  const meta = CALENDAR_MODULE_META[event.module] || CALENDAR_MODULE_META.manual;
                  const Icon = moduleIconForEvent(event.module);
                  return (
                    <div key={event.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
                      <div className="flex min-w-0 gap-3">
                        <div className="mt-0.5 rounded-full bg-muted/50 p-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                          {event.description ? <p className="truncate text-xs text-muted-foreground">{event.description}</p> : null}
                          <p className="text-xs text-muted-foreground">{formatEventTime(event)}</p>
                        </div>
                      </div>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.badgeClass)}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}

          {summaryView === 'tasks' ? (
            pendingTaskCount === 0 ? (
              <p className="text-sm text-muted-foreground">No open tasks scheduled for today.</p>
            ) : (
              <div className="space-y-2">
                {todaysTasks
                  .filter((task) => task.status !== 'done')
                  .map((task) => (
                    <div key={task.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{task.title}</p>
                        {task.notes ? <p className="truncate text-xs text-muted-foreground">{task.notes}</p> : null}
                      </div>
                      <StatusBadge status={task.status} />
                    </div>
                  ))}
              </div>
            )
          ) : null}

          {summaryView === 'chores' ? (
            pendingChores.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending daily chores right now.</p>
            ) : (
              <div className="space-y-2">
                {pendingChores.map((chore) => (
                  <div key={chore.id} className="rounded-md border border-border px-3 py-2">
                    <p className="text-sm font-medium">{chore.name}</p>
                    <p className="text-xs text-muted-foreground">{chore.childName}</p>
                  </div>
                ))}
              </div>
            )
          ) : null}

          {summaryView === 'actions' ? (
            actionEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workout or meal actions planned for today.</p>
            ) : (
              <div className="space-y-2">
                {actionEvents.map((event) => {
                  const meta = CALENDAR_MODULE_META[event.module] || CALENDAR_MODULE_META.manual;
                  const Icon = moduleIconForEvent(event.module);
                  return (
                    <div key={event.id} className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2">
                      <div className="flex min-w-0 gap-3">
                        <div className="mt-0.5 rounded-full bg-muted/50 p-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{formatEventTime(event)}</p>
                        </div>
                      </div>
                      <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', meta.badgeClass)}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

function formatEventTime(event: CalendarEvent): string {
  if (event.allDay) return 'All day';
  const start = parseISO(event.startsAt);
  if (event.endsAt) {
    const end = parseISO(event.endsAt);
    return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
  }
  return format(start, 'h:mm a');
}

function moduleIconForEvent(module: CalendarEvent['module']) {
  switch (module) {
    case 'meals':
      return UtensilsCrossed;
    case 'tasks':
      return ListChecks;
    case 'chores':
      return ClipboardList;
    case 'workouts':
      return Dumbbell;
    case 'reminders':
      return CalendarDays;
    case 'manual':
    default:
      return CalendarDays;
  }
}

function BadgeLine({ label, hit }: { label: string; hit: boolean }) {
  return (
    <div className={cn('rounded-md px-2 py-1 text-center text-xs border', hit ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/30 border-border text-muted-foreground')}>
      {label} {hit ? '✓' : '•'}
    </div>
  );
}
