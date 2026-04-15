import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DayOfWeek } from '@/types';
import { Plus, RotateCcw, CheckCircle2, X, PiggyBank, Wallet, Clock3, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { syncDerivedCalendarSnapshot } from '@/lib/calendarFeed';
import {
  choresStateStorageKey,
  hydrateChoresStateFromAccount,
  persistChoresStateToAccount,
} from '@/lib/choresStateStore';

const getCurrentDay = (): DayOfWeek => {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()] as DayOfWeek;
};

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const allDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

type RewardUnit = 'money' | 'points';
type ChoreFrequency = 'daily' | 'weekly' | 'other';
type NonDailyChoreFrequency = Exclude<ChoreFrequency, 'daily'>;
type SkillCadence = 'daily' | 'weekly' | 'weekly_any' | 'custom_weekly' | 'monthly';

interface RewardChore {
  id: string;
  name: string;
  isCompleted: boolean;
  reward: number;
  rewardUnit: RewardUnit;
  completionDates?: string[];
}

interface RewardWeeklyChore extends RewardChore {
  day?: DayOfWeek;
  days?: DayOfWeek[];
  scheduleType?: NonDailyChoreFrequency;
}

interface ClaimedExtraChore {
  id: string;
  sourceId: string;
  name: string;
  reward: number;
  penalty: number;
  dueAt: string;
  isCompleted: boolean;
  isFailed: boolean;
  createdAt: string;
  completedAt?: string;
  failedAt?: string;
}

interface SkillDevelopmentItem {
  id: string;
  name: string;
  targetMinutes: number;
  points: number;
  cadence: SkillCadence;
  day?: DayOfWeek;
  days?: DayOfWeek[];
  completionDates?: string[];
}

interface ExtraChoreOpportunity {
  id: string;
  name: string;
  reward: number;
  penalty: number;
  hoursToComplete: number;
  createdAt: string;
}

interface ChildEconomy {
  id: string;
  name: string;
  dailyChores: RewardChore[];
  weeklyChores: RewardWeeklyChore[];
  skillItems: SkillDevelopmentItem[];
  extraChores: ClaimedExtraChore[];
  piggyBank: number;
  pointsBank: number;
  lifetimeEarned: number;
  lifetimePointsEarned: number;
  lifetimePenalties: number;
  cashedOut: number;
}

interface ChoresState {
  children: ChildEconomy[];
  availableExtraChores: ExtraChoreOpportunity[];
  lastDailyResetDate: string;
  lastWeeklyResetDate: string;
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateKey(): string {
  return formatDateKey(new Date());
}

function weekResetDateKey(date = new Date()): string {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return formatDateKey(weekStart);
}

const money = (amount: number) => `$${amount.toFixed(2)}`;

function normalizeRewardUnit(value: unknown): RewardUnit {
  return value === 'points' ? 'points' : 'money';
}

function formatPoints(amount: number): string {
  const normalized = Number.isFinite(amount) ? amount : 0;
  return Number.isInteger(normalized)
    ? `${normalized} pts`
    : `${normalized.toFixed(2).replace(/\.?0+$/, '')} pts`;
}

function formatReward(amount: number, unit: RewardUnit): string {
  return unit === 'points' ? formatPoints(amount) : money(amount);
}

function normalizeNonNegativeNumber(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

function normalizeNonDailyFrequency(chore: Partial<RewardWeeklyChore>): NonDailyChoreFrequency {
  if (chore.scheduleType === 'weekly' || chore.scheduleType === 'other') return chore.scheduleType;
  const days = Array.isArray(chore.days)
    ? chore.days.filter((day): day is DayOfWeek => allDays.includes(day))
    : [];
  return days.length > 1 ? 'other' : 'weekly';
}

function normalizeWeeklyDays(chore: RewardWeeklyChore): DayOfWeek[] {
  const fromDays = Array.isArray(chore.days)
    ? chore.days.filter((day): day is DayOfWeek => allDays.includes(day))
    : [];
  if (fromDays.length > 0) return [...new Set(fromDays)];
  if (chore.day && allDays.includes(chore.day)) return [chore.day];
  return ['monday'];
}

function normalizeSkillDays(skill: SkillDevelopmentItem): DayOfWeek[] {
  const fromDays = Array.isArray(skill.days)
    ? skill.days.filter((day): day is DayOfWeek => allDays.includes(day))
    : [];
  if (fromDays.length > 0) return [...new Set(fromDays)];
  if (skill.day && allDays.includes(skill.day)) return [skill.day];
  return ['monday'];
}

function normalizeSkillCadence(value: unknown): SkillCadence {
  if (
    value === 'daily'
    || value === 'weekly'
    || value === 'weekly_any'
    || value === 'custom_weekly'
    || value === 'monthly'
  ) {
    return value;
  }
  return 'weekly_any';
}

function weekDateKeys(date = new Date()): string[] {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + index);
    return formatDateKey(next);
  });
}

function monthKey(date = new Date()): string {
  return formatDateKey(date).slice(0, 7);
}

function skillCompletedOnDate(skill: SkillDevelopmentItem, dateKey: string): boolean {
  return normalizeCompletionDates(skill.completionDates).includes(dateKey);
}

function skillCompletedThisWeek(skill: SkillDevelopmentItem, today = new Date()): boolean {
  const completionDates = normalizeCompletionDates(skill.completionDates);
  const currentWeek = new Set(weekDateKeys(today));
  return completionDates.some((dateKey) => currentWeek.has(dateKey));
}

function skillCompletedThisMonth(skill: SkillDevelopmentItem, today = new Date()): boolean {
  const completionDates = normalizeCompletionDates(skill.completionDates);
  const currentMonthKey = monthKey(today);
  return completionDates.some((dateKey) => dateKey.startsWith(currentMonthKey));
}

function skillDueToday(skill: SkillDevelopmentItem, currentDay: DayOfWeek): boolean {
  switch (skill.cadence) {
    case 'daily':
      return true;
    case 'weekly':
      return (skill.day || 'monday') === currentDay;
    case 'custom_weekly':
      return normalizeSkillDays(skill).includes(currentDay);
    default:
      return false;
  }
}

function skillWindowLabel(skill: SkillDevelopmentItem): string {
  switch (skill.cadence) {
    case 'daily':
      return 'Daily';
    case 'weekly':
      return `${dayLabels[skill.day || 'monday']}`;
    case 'weekly_any':
      return 'Any time this week';
    case 'custom_weekly':
      return normalizeSkillDays(skill).map((day) => dayLabels[day].slice(0, 3)).join(', ');
    case 'monthly':
      return 'Any time this month';
    default:
      return 'Scheduled';
  }
}

function toggleDateInList(list: string[], dateKey: string, active: boolean): string[] {
  return active
    ? [...new Set([...list, dateKey])]
    : list.filter((entry) => entry !== dateKey);
}

function normalizeCompletionDates(value: unknown, fallbackDate?: string): string[] {
  const normalized = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item))
        .map((item) => item.trim())
    : [];
  const unique = [...new Set(normalized)];
  if (unique.length > 0) return unique;
  return fallbackDate ? [fallbackDate] : [];
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function dispatchChoresStateUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('homehub:chores-state-updated'));
  }
}

function choresStateKey(userId?: string | null): string {
  return choresStateStorageKey(userId);
}

function defaultState(): ChoresState {
  return {
    children: [],
    availableExtraChores: [],
    lastDailyResetDate: todayDateKey(),
    lastWeeklyResetDate: weekResetDateKey(),
  };
}

function normalizeChildEconomy(
  child: ChildEconomy,
  fallbackDates: { daily?: string; weekly?: string; extras?: string } = {},
): ChildEconomy {
  const item = child as ChildEconomy;
  return {
    ...item,
    piggyBank: normalizeNonNegativeNumber(item.piggyBank),
    pointsBank: normalizeNonNegativeNumber(item.pointsBank),
    lifetimeEarned: normalizeNonNegativeNumber(item.lifetimeEarned),
    lifetimePointsEarned: normalizeNonNegativeNumber(item.lifetimePointsEarned),
    lifetimePenalties: normalizeNonNegativeNumber(item.lifetimePenalties),
    cashedOut: normalizeNonNegativeNumber(item.cashedOut),
    dailyChores: Array.isArray(item.dailyChores)
      ? item.dailyChores.map((chore) => ({
          ...chore,
          rewardUnit: normalizeRewardUnit((chore as Partial<RewardChore>).rewardUnit),
          completionDates: normalizeCompletionDates(
            (chore as Partial<RewardChore>).completionDates,
            chore.isCompleted ? fallbackDates.daily : undefined,
          ),
        }))
      : [],
    weeklyChores: Array.isArray(item.weeklyChores)
      ? item.weeklyChores.map((chore) => {
          const weeklyDays = normalizeWeeklyDays(chore as RewardWeeklyChore);
          return {
            ...chore,
            day: weeklyDays[0],
            days: weeklyDays,
            scheduleType: normalizeNonDailyFrequency(chore as Partial<RewardWeeklyChore>),
            rewardUnit: normalizeRewardUnit((chore as Partial<RewardChore>).rewardUnit),
            completionDates: normalizeCompletionDates(
              (chore as Partial<RewardChore>).completionDates,
              chore.isCompleted ? fallbackDates.weekly : undefined,
            ),
          };
        })
      : [],
    skillItems: Array.isArray((item as ChildEconomy & { skillItems?: SkillDevelopmentItem[] }).skillItems)
      ? (item as ChildEconomy & { skillItems?: SkillDevelopmentItem[] }).skillItems!.map((skill) => ({
          ...skill,
          cadence: normalizeSkillCadence(skill.cadence),
          day: normalizeSkillDays(skill)[0],
          days: normalizeSkillDays(skill),
          targetMinutes: Math.max(1, Math.round(Number(skill.targetMinutes) || 0) || 30),
          points: Math.max(0, Math.round(Number(skill.points) || 0) || 1),
          completionDates: normalizeCompletionDates(skill.completionDates),
        }))
      : [],
    extraChores: Array.isArray(item.extraChores)
      ? item.extraChores.map((extra) => ({
          ...extra,
          completedAt:
            typeof extra.completedAt === 'string' && extra.completedAt.trim()
              ? extra.completedAt
              : extra.isCompleted
                ? extra.createdAt || (fallbackDates.extras ? new Date().toISOString() : undefined)
                : undefined,
          failedAt:
            typeof extra.failedAt === 'string' && extra.failedAt.trim()
              ? extra.failedAt
              : extra.isFailed
                ? extra.dueAt || (fallbackDates.extras ? new Date().toISOString() : undefined)
                : undefined,
        }))
      : [],
  };
}

function loadState(userId?: string | null): ChoresState {
  if (!canUseStorage()) return defaultState();
  try {
    const raw = window.localStorage.getItem(choresStateKey(userId));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<ChoresState> | ChildEconomy[];
    const todayKey = todayDateKey();

    if (Array.isArray(parsed)) {
      // legacy: old format stored only children
      // Force one daily reset pass after migrating from legacy format.
      return {
        children: parsed.map((child) => normalizeChildEconomy(child)),
        availableExtraChores: [],
        lastDailyResetDate: '',
        lastWeeklyResetDate: '',
      };
    }

    const children = Array.isArray(parsed.children) ? parsed.children : [];
    const hasDailyResetDate =
      typeof parsed.lastDailyResetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastDailyResetDate);
    const hasWeeklyResetDate =
      typeof parsed.lastWeeklyResetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastWeeklyResetDate);
    const normalizedChildren = children.map((child) =>
      normalizeChildEconomy(child as ChildEconomy, {
        daily: hasDailyResetDate ? todayKey : undefined,
        weekly: hasWeeklyResetDate ? todayKey : undefined,
        extras: todayKey,
      }),
    );

    return {
      children: normalizedChildren,
      availableExtraChores: Array.isArray(parsed.availableExtraChores)
        ? parsed.availableExtraChores
        : [],
      lastDailyResetDate:
        hasDailyResetDate ? parsed.lastDailyResetDate : '',
      lastWeeklyResetDate:
        hasWeeklyResetDate ? parsed.lastWeeklyResetDate : '',
    };
  } catch {
    return defaultState();
  }
}

function saveState(state: ChoresState, userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(choresStateKey(userId), JSON.stringify(state));
  void persistChoresStateToAccount(userId, state as unknown as Record<string, unknown>);
  dispatchChoresStateUpdated();
}

function markOverdueExtras(children: ChildEconomy[]): { updated: ChildEconomy[]; changed: boolean } {
  let changed = false;
  const now = new Date();
  const updated = children.map((child) => {
    let childChanged = false;
    const extras = child.extraChores.map((extra) => {
      if (extra.isCompleted || extra.isFailed) return extra;
      if (new Date(extra.dueAt) > now) return extra;
      childChanged = true;
      changed = true;
      return { ...extra, isFailed: true, failedAt: new Date().toISOString() };
    });

    if (!childChanged) return child;

    const newlyFailed = extras.filter(
      (extra) => extra.isFailed && !child.extraChores.find((old) => old.id === extra.id)?.isFailed,
    );
    const penaltyTotal = newlyFailed.reduce((sum, chore) => sum + chore.penalty, 0);

    return {
      ...child,
      extraChores: extras,
      piggyBank: Math.max(0, child.piggyBank - penaltyTotal),
      lifetimePenalties: child.lifetimePenalties + penaltyTotal,
    };
  });

  return { updated, changed };
}

export default function ChoresPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, sharedHouseholdOwnerId, householdScopeLoading } = useAuth();
  const childRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [state, setState] = useState<ChoresState>(() => defaultState());
  const [loadedForKey, setLoadedForKey] = useState<string | null>(null);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [addChoreOpen, setAddChoreOpen] = useState(false);
  const [choreChildId, setChoreChildId] = useState<string | null>(null);
  const [newChoreName, setNewChoreName] = useState('');
  const [newChoreType, setNewChoreType] = useState<ChoreFrequency>('daily');
  const [newChoreDay, setNewChoreDay] = useState<DayOfWeek>('monday');
  const [newChoreDays, setNewChoreDays] = useState<DayOfWeek[]>(['monday']);
  const [newChoreReward, setNewChoreReward] = useState('1');
  const [newChoreRewardUnit, setNewChoreRewardUnit] = useState<RewardUnit>('money');
  const [editChoreOpen, setEditChoreOpen] = useState(false);
  const [editingChoreTarget, setEditingChoreTarget] = useState<{
    childId: string;
    choreId: string;
    type: 'daily' | 'weekly';
  } | null>(null);
  const [editChoreName, setEditChoreName] = useState('');
  const [editChoreReward, setEditChoreReward] = useState('1');
  const [editChoreRewardUnit, setEditChoreRewardUnit] = useState<RewardUnit>('money');
  const [editChoreFrequency, setEditChoreFrequency] = useState<NonDailyChoreFrequency>('weekly');
  const [editChoreDay, setEditChoreDay] = useState<DayOfWeek>('monday');
  const [editChoreDays, setEditChoreDays] = useState<DayOfWeek[]>(['monday']);
  const [addSkillOpen, setAddSkillOpen] = useState(false);
  const [skillChildId, setSkillChildId] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCadence, setNewSkillCadence] = useState<SkillCadence>('weekly_any');
  const [newSkillDay, setNewSkillDay] = useState<DayOfWeek>('monday');
  const [newSkillDays, setNewSkillDays] = useState<DayOfWeek[]>(['monday']);
  const [newSkillMinutes, setNewSkillMinutes] = useState('30');
  const [newSkillPoints, setNewSkillPoints] = useState('1');
  const [editSkillOpen, setEditSkillOpen] = useState(false);
  const [editingSkillTarget, setEditingSkillTarget] = useState<{ childId: string; skillId: string } | null>(null);
  const [editSkillName, setEditSkillName] = useState('');
  const [editSkillCadence, setEditSkillCadence] = useState<SkillCadence>('weekly_any');
  const [editSkillDay, setEditSkillDay] = useState<DayOfWeek>('monday');
  const [editSkillDays, setEditSkillDays] = useState<DayOfWeek[]>(['monday']);
  const [editSkillMinutes, setEditSkillMinutes] = useState('30');
  const [editSkillPoints, setEditSkillPoints] = useState('1');
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [extraName, setExtraName] = useState('');
  const [extraReward, setExtraReward] = useState('3');
  const [extraPenalty, setExtraPenalty] = useState('2');
  const [extraHours, setExtraHours] = useState('24');
  const [cashOutAmounts, setCashOutAmounts] = useState<Record<string, string>>({});
  const currentDay = getCurrentDay();
  const { toast } = useToast();
  const activeScopeId = sharedHouseholdOwnerId || user?.id || null;
  const activeKey = activeScopeId || 'anon';

  const children = state.children;
  const availableExtraChores = state.availableExtraChores;

  useEffect(() => {
    if (householdScopeLoading) return;

    let cancelled = false;

    const loadSharedState = async () => {
      if (activeScopeId) {
        try {
          await hydrateChoresStateFromAccount(activeScopeId);
        } catch (error) {
          console.error('Failed to hydrate chores state for page load:', error);
        }
      }

      if (cancelled) return;
      setState(loadState(activeScopeId));
      setLoadedForKey(activeKey);
    };

    void loadSharedState();
    return () => {
      cancelled = true;
    };
  }, [activeKey, activeScopeId, householdScopeLoading]);

  useEffect(() => {
    if (typeof window === 'undefined' || householdScopeLoading) return;

    const refreshFromSharedState = () => {
      setState((current) => {
        const next = loadState(activeScopeId);
        return JSON.stringify(current) === JSON.stringify(next) ? current : next;
      });
      setLoadedForKey(activeKey);
    };

    window.addEventListener('homehub:chores-state-updated', refreshFromSharedState);
    return () => window.removeEventListener('homehub:chores-state-updated', refreshFromSharedState);
  }, [activeKey, activeScopeId, householdScopeLoading]);

  useEffect(() => {
    if (loadedForKey !== activeKey) return;
    saveState(state, activeScopeId);
  }, [state, activeScopeId, loadedForKey, activeKey]);

  useEffect(() => {
    if (loadedForKey !== activeKey) return;
    void syncDerivedCalendarSnapshot(activeScopeId, new Date());
  }, [state, activeScopeId, loadedForKey, activeKey]);

  useEffect(() => {
    if (loadedForKey !== activeKey) return;

    const applyOverdueCheck = () => {
      setState((prev) => {
        const next = markOverdueExtras(prev.children);
        return next.changed ? { ...prev, children: next.updated } : prev;
      });
    };

    applyOverdueCheck();
    const timer = window.setInterval(() => {
      applyOverdueCheck();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [activeKey, loadedForKey]);

  useEffect(() => {
    if (loadedForKey !== activeKey) return;

    const applyResetIfNeeded = () => {
      const today = todayDateKey();
      setState((prev) => {
        if (prev.lastDailyResetDate === today) return prev;
        return {
          ...prev,
          lastDailyResetDate: today,
          children: prev.children.map((child) => ({
            ...child,
            dailyChores: child.dailyChores.map((chore) => ({ ...chore, isCompleted: false })),
          })),
        };
      });
    };

    applyResetIfNeeded();
    const timer = window.setInterval(applyResetIfNeeded, 60_000);
    const onFocus = () => applyResetIfNeeded();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') applyResetIfNeeded();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeKey, loadedForKey]);

  useEffect(() => {
    if (loadedForKey !== activeKey) return;

    const applyWeeklyResetIfNeeded = () => {
      const thisWeek = weekResetDateKey();
      setState((prev) => {
        if (prev.lastWeeklyResetDate === thisWeek) return prev;
        return {
          ...prev,
          lastWeeklyResetDate: thisWeek,
          children: prev.children.map((child) => ({
            ...child,
            weeklyChores: child.weeklyChores.map((chore) => ({ ...chore, isCompleted: false })),
          })),
        };
      });
    };

    applyWeeklyResetIfNeeded();
    const timer = window.setInterval(applyWeeklyResetIfNeeded, 60_000);
    const onFocus = () => applyWeeklyResetIfNeeded();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') applyWeeklyResetIfNeeded();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [activeKey, loadedForKey]);

  useEffect(() => {
    const childId = searchParams.get('child');
    if (!childId) return;
    const target = childRefs.current[childId];
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const timer = window.setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('child');
        return next;
      }, { replace: true });
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [children, searchParams, setSearchParams]);

  const updateChild = (childId: string, updater: (child: ChildEconomy) => ChildEconomy) => {
    setState((prev) => ({
      ...prev,
      children: prev.children.map((child) => (child.id === childId ? updater(child) : child)),
    }));
  };

  const isDailyDone = (child: ChildEconomy): boolean =>
    child.dailyChores.length === 0 || child.dailyChores.every((chore) => chore.isCompleted);

  const toggleDailyChore = (childId: string, choreId: string) => {
    updateChild(childId, (child) => {
      const today = todayDateKey();
      let moneyDelta = 0;
      let pointsDelta = 0;
      const dailyChores = child.dailyChores.map((chore) => {
        if (chore.id !== choreId) return chore;
        const nextCompleted = !chore.isCompleted;
        if (chore.rewardUnit === 'points') {
          pointsDelta = nextCompleted ? chore.reward : -chore.reward;
        } else {
          moneyDelta = nextCompleted ? chore.reward : -chore.reward;
        }
        const completionDates = nextCompleted
          ? [...new Set([...normalizeCompletionDates(chore.completionDates), today])]
          : normalizeCompletionDates(chore.completionDates).filter((date) => date !== today);
        return { ...chore, isCompleted: nextCompleted, completionDates };
      });
      return {
        ...child,
        dailyChores,
        piggyBank: Math.max(0, child.piggyBank + moneyDelta),
        pointsBank: Math.max(0, child.pointsBank + pointsDelta),
        lifetimeEarned: moneyDelta > 0 ? child.lifetimeEarned + moneyDelta : child.lifetimeEarned,
        lifetimePointsEarned:
          pointsDelta > 0 ? child.lifetimePointsEarned + pointsDelta : child.lifetimePointsEarned,
      };
    });
  };

  const toggleWeeklyChore = (childId: string, choreId: string) => {
    updateChild(childId, (child) => {
      const today = todayDateKey();
      let moneyDelta = 0;
      let pointsDelta = 0;
      const weeklyChores = child.weeklyChores.map((chore) => {
        if (chore.id !== choreId) return chore;
        const nextCompleted = !chore.isCompleted;
        if (chore.rewardUnit === 'points') {
          pointsDelta = nextCompleted ? chore.reward : -chore.reward;
        } else {
          moneyDelta = nextCompleted ? chore.reward : -chore.reward;
        }
        const completionDates = nextCompleted
          ? [...new Set([...normalizeCompletionDates(chore.completionDates), today])]
          : normalizeCompletionDates(chore.completionDates).filter((date) => date !== today);
        return { ...chore, isCompleted: nextCompleted, completionDates };
      });
      return {
        ...child,
        weeklyChores,
        piggyBank: Math.max(0, child.piggyBank + moneyDelta),
        pointsBank: Math.max(0, child.pointsBank + pointsDelta),
        lifetimeEarned: moneyDelta > 0 ? child.lifetimeEarned + moneyDelta : child.lifetimeEarned,
        lifetimePointsEarned:
          pointsDelta > 0 ? child.lifetimePointsEarned + pointsDelta : child.lifetimePointsEarned,
      };
    });
  };

  const resetDaily = () => {
    const today = todayDateKey();
    setState((prev) => ({
      ...prev,
      lastDailyResetDate: today,
      children: prev.children.map((child) => ({
        ...child,
        dailyChores: child.dailyChores.map((chore) => ({ ...chore, isCompleted: false })),
      })),
    }));
    toast({
      title: 'Daily chores reset',
      description: 'Daily checkboxes were reset for everyone.',
    });
  };

  const addChild = () => {
    if (!newChildName.trim()) return;

    const child: ChildEconomy = {
      id: `child-${Date.now()}`,
      name: newChildName.trim(),
      dailyChores: [],
      weeklyChores: [],
      skillItems: [],
      extraChores: [],
      piggyBank: 0,
      pointsBank: 0,
      lifetimeEarned: 0,
      lifetimePointsEarned: 0,
      lifetimePenalties: 0,
      cashedOut: 0,
    };
    setState((prev) => ({ ...prev, children: [...prev.children, child] }));
    setNewChildName('');
    setAddChildOpen(false);
    toast({ title: 'Child added', description: `${child.name} was added.` });
  };

  const openAddChore = (childId: string) => {
    setChoreChildId(childId);
    setNewChoreName('');
    setNewChoreType('daily');
    setNewChoreDay('monday');
    setNewChoreDays(['monday']);
    setNewChoreReward('1');
    setNewChoreRewardUnit('money');
    setAddChoreOpen(true);
  };

  const toggleNewChoreDay = (day: DayOfWeek) => {
    setNewChoreDays((prev) => {
      const set = new Set(prev);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      if (set.size === 0) set.add(day);
      return allDays.filter((item) => set.has(item));
    });
  };

  const toggleEditChoreDay = (day: DayOfWeek) => {
    setEditChoreDays((prev) => {
      const set = new Set(prev);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      if (set.size === 0) set.add(day);
      return allDays.filter((item) => set.has(item));
    });
  };

  const addChore = () => {
    if (!newChoreName.trim() || !choreChildId) return;
    const reward = Math.max(0, Number.parseFloat(newChoreReward) || 0);

    updateChild(choreChildId, (child) => {
      if (newChoreType === 'daily') {
        const newChore: RewardChore = {
          id: `daily-${Date.now()}`,
          name: newChoreName.trim(),
          isCompleted: false,
          reward,
          rewardUnit: newChoreRewardUnit,
          completionDates: [],
        };
        return { ...child, dailyChores: [...child.dailyChores, newChore] };
      }
      const selectedDays =
        newChoreType === 'weekly'
          ? [newChoreDay]
          : newChoreDays.length > 0
            ? [...newChoreDays]
            : [newChoreDay];
      const newChore: RewardWeeklyChore = {
        id: `weekly-${Date.now()}`,
        name: newChoreName.trim(),
        day: selectedDays[0] || newChoreDay,
        days: selectedDays,
        scheduleType: newChoreType === 'other' ? 'other' : 'weekly',
        isCompleted: false,
        reward,
        rewardUnit: newChoreRewardUnit,
        completionDates: [],
      };
      return { ...child, weeklyChores: [...child.weeklyChores, newChore] };
    });

    setAddChoreOpen(false);
    toast({
      title: 'Chore added',
      description: `"${newChoreName}" added with ${formatReward(reward, newChoreRewardUnit)} reward.`,
    });
  };

  const openEditChore = (childId: string, type: 'daily' | 'weekly', choreId: string) => {
    const child = children.find((item) => item.id === childId);
    if (!child) return;
    if (type === 'daily') {
      const chore = child.dailyChores.find((item) => item.id === choreId);
      if (!chore) return;
      setEditChoreName(chore.name);
      setEditChoreReward(String(chore.reward));
      setEditChoreRewardUnit(normalizeRewardUnit(chore.rewardUnit));
      setEditChoreFrequency('weekly');
      setEditChoreDay('monday');
      setEditChoreDays(['monday']);
    } else {
      const chore = child.weeklyChores.find((item) => item.id === choreId);
      if (!chore) return;
      const weeklyDays = normalizeWeeklyDays(chore);
      setEditChoreName(chore.name);
      setEditChoreReward(String(chore.reward));
      setEditChoreRewardUnit(normalizeRewardUnit(chore.rewardUnit));
      setEditChoreFrequency(normalizeNonDailyFrequency(chore));
      setEditChoreDay(weeklyDays[0] || 'monday');
      setEditChoreDays(weeklyDays);
    }
    setEditingChoreTarget({ childId, choreId, type });
    setEditChoreOpen(true);
  };

  const saveEditedChore = () => {
    if (!editingChoreTarget || !editChoreName.trim()) return;
    const reward = Math.max(0, Number.parseFloat(editChoreReward) || 0);
    const { childId, choreId, type } = editingChoreTarget;

    updateChild(childId, (child) => {
      if (type === 'daily') {
        return {
          ...child,
          dailyChores: child.dailyChores.map((chore) =>
            chore.id === choreId
              ? { ...chore, name: editChoreName.trim(), reward, rewardUnit: editChoreRewardUnit }
              : chore,
          ),
        };
      }

      return {
        ...child,
        weeklyChores: child.weeklyChores.map((chore) => {
          if (chore.id !== choreId) return chore;
          const selectedDays =
            editChoreFrequency === 'weekly'
              ? [editChoreDay]
              : editChoreDays.length > 0
                ? [...editChoreDays]
                : [editChoreDay];
          return {
            ...chore,
            name: editChoreName.trim(),
            reward,
            rewardUnit: editChoreRewardUnit,
            day: selectedDays[0] || editChoreDay,
            days: selectedDays,
            scheduleType: editChoreFrequency,
          };
        }),
      };
    });

    setEditChoreOpen(false);
    setEditingChoreTarget(null);
    toast({ title: 'Chore updated' });
  };

  const deleteChore = () => {
    if (!editingChoreTarget) return;
    const { childId, choreId, type } = editingChoreTarget;
    updateChild(childId, (child) => {
      if (type === 'daily') {
        return {
          ...child,
          dailyChores: child.dailyChores.filter((chore) => chore.id !== choreId),
        };
      }
      return {
        ...child,
        weeklyChores: child.weeklyChores.filter((chore) => chore.id !== choreId),
      };
    });
    setEditChoreOpen(false);
    setEditingChoreTarget(null);
    toast({ title: 'Chore removed' });
  };

  const toggleNewSkillDay = (day: DayOfWeek) => {
    setNewSkillDays((prev) => {
      const set = new Set(prev);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      if (set.size === 0) set.add(day);
      return allDays.filter((item) => set.has(item));
    });
  };

  const toggleEditSkillDay = (day: DayOfWeek) => {
    setEditSkillDays((prev) => {
      const set = new Set(prev);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      if (set.size === 0) set.add(day);
      return allDays.filter((item) => set.has(item));
    });
  };

  const openAddSkill = (childId: string) => {
    setSkillChildId(childId);
    setNewSkillName('');
    setNewSkillCadence('weekly_any');
    setNewSkillDay('monday');
    setNewSkillDays(['monday']);
    setNewSkillMinutes('30');
    setNewSkillPoints('1');
    setAddSkillOpen(true);
  };

  const addSkill = () => {
    if (!newSkillName.trim() || !skillChildId) return;
    const targetMinutes = Math.max(1, Math.round(Number.parseFloat(newSkillMinutes) || 0) || 30);
    const points = Math.max(0, Math.round(Number.parseFloat(newSkillPoints) || 0) || 1);
    const selectedDays =
      newSkillCadence === 'custom_weekly'
        ? (newSkillDays.length > 0 ? [...newSkillDays] : [newSkillDay])
        : [newSkillDay];

    updateChild(skillChildId, (child) => ({
      ...child,
      skillItems: [
        ...child.skillItems,
        {
          id: `skill-${Date.now()}`,
          name: newSkillName.trim(),
          targetMinutes,
          points,
          cadence: newSkillCadence,
          day: selectedDays[0] || newSkillDay,
          days: newSkillCadence === 'custom_weekly' ? selectedDays : undefined,
          completionDates: [],
        },
      ],
    }));

    setAddSkillOpen(false);
    toast({
      title: 'Skill added',
      description: `"${newSkillName}" is now tracked in Skill Development.`,
    });
  };

  const openEditSkill = (childId: string, skillId: string) => {
    const child = children.find((item) => item.id === childId);
    const skill = child?.skillItems.find((item) => item.id === skillId);
    if (!skill) return;
    const skillDays = normalizeSkillDays(skill);
    setEditSkillName(skill.name);
    setEditSkillCadence(skill.cadence);
    setEditSkillDay(skillDays[0] || 'monday');
    setEditSkillDays(skillDays);
    setEditSkillMinutes(String(skill.targetMinutes || 30));
    setEditSkillPoints(String(skill.points || 1));
    setEditingSkillTarget({ childId, skillId });
    setEditSkillOpen(true);
  };

  const saveEditedSkill = () => {
    if (!editingSkillTarget || !editSkillName.trim()) return;
    const targetMinutes = Math.max(1, Math.round(Number.parseFloat(editSkillMinutes) || 0) || 30);
    const points = Math.max(0, Math.round(Number.parseFloat(editSkillPoints) || 0) || 1);
    const selectedDays =
      editSkillCadence === 'custom_weekly'
        ? (editSkillDays.length > 0 ? [...editSkillDays] : [editSkillDay])
        : [editSkillDay];

    updateChild(editingSkillTarget.childId, (child) => ({
      ...child,
      skillItems: child.skillItems.map((skill) =>
        skill.id === editingSkillTarget.skillId
          ? {
              ...skill,
              name: editSkillName.trim(),
              targetMinutes,
              points,
              cadence: editSkillCadence,
              day: selectedDays[0] || editSkillDay,
              days: editSkillCadence === 'custom_weekly' ? selectedDays : undefined,
            }
          : skill,
      ),
    }));

    setEditSkillOpen(false);
    setEditingSkillTarget(null);
    toast({ title: 'Skill updated' });
  };

  const deleteSkill = () => {
    if (!editingSkillTarget) return;
    updateChild(editingSkillTarget.childId, (child) => ({
      ...child,
      skillItems: child.skillItems.filter((skill) => skill.id !== editingSkillTarget.skillId),
    }));
    setEditSkillOpen(false);
    setEditingSkillTarget(null);
    toast({ title: 'Skill removed' });
  };

  const toggleSkill = (childId: string, skillId: string) => {
    updateChild(childId, (child) => {
      const today = todayDateKey();
      const currentWeek = new Set(weekDateKeys());
      const currentMonth = monthKey();
      let pointsDelta = 0;

      return {
        ...child,
        skillItems: child.skillItems.map((skill) => {
          if (skill.id !== skillId) return skill;
          const completionDates = normalizeCompletionDates(skill.completionDates);

          if (skill.cadence === 'weekly_any') {
            const isCompleted = completionDates.some((dateKey) => currentWeek.has(dateKey));
            pointsDelta = isCompleted ? -skill.points : skill.points;
            return {
              ...skill,
              completionDates: isCompleted
                ? completionDates.filter((dateKey) => !currentWeek.has(dateKey))
                : [...completionDates, today],
            };
          }

          if (skill.cadence === 'monthly') {
            const isCompleted = completionDates.some((dateKey) => dateKey.startsWith(currentMonth));
            pointsDelta = isCompleted ? -skill.points : skill.points;
            return {
              ...skill,
              completionDates: isCompleted
                ? completionDates.filter((dateKey) => !dateKey.startsWith(currentMonth))
                : [...completionDates, today],
            };
          }

          const isCompletedToday = completionDates.includes(today);
          pointsDelta = isCompletedToday ? -skill.points : skill.points;
          return {
            ...skill,
            completionDates: toggleDateInList(completionDates, today, !isCompletedToday),
          };
        }),
        pointsBank: Math.max(0, child.pointsBank + pointsDelta),
        lifetimePointsEarned:
          pointsDelta > 0 ? child.lifetimePointsEarned + pointsDelta : child.lifetimePointsEarned,
      };
    });
  };

  const removeChild = (childId: string) => {
    setState((prev) => ({ ...prev, children: prev.children.filter((child) => child.id !== childId) }));
    toast({ title: 'Child removed' });
  };

  const openPostExtra = () => {
    setExtraName('');
    setExtraReward('3');
    setExtraPenalty('2');
    setExtraHours('24');
    setAddExtraOpen(true);
  };

  const postExtraChore = () => {
    if (!extraName.trim()) return;
    const reward = Math.max(0, Number.parseFloat(extraReward) || 0);
    const penalty = Math.max(0, Number.parseFloat(extraPenalty) || 0);
    const hours = Math.max(1, Number.parseInt(extraHours, 10) || 1);
    const chore: ExtraChoreOpportunity = {
      id: `extra-board-${Date.now()}`,
      name: extraName.trim(),
      reward,
      penalty,
      hoursToComplete: hours,
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      availableExtraChores: [...prev.availableExtraChores, chore],
    }));
    setAddExtraOpen(false);
    toast({ title: 'Extra chore posted', description: `"${chore.name}" is now available for kids to grab.` });
  };

  const claimExtraChore = (childId: string, choreId: string) => {
    setState((prev) => {
      const child = prev.children.find((c) => c.id === childId);
      const boardChore = prev.availableExtraChores.find((c) => c.id === choreId);
      if (!child || !boardChore) return prev;

      if (!isDailyDone(child)) {
        toast({
          title: 'Finish daily chores first',
          description: `${child.name} must complete daily chores before grabbing extras.`,
          variant: 'destructive',
        });
        return prev;
      }

      const dueAt = new Date(Date.now() + boardChore.hoursToComplete * 60 * 60 * 1000).toISOString();
      return {
        availableExtraChores: prev.availableExtraChores.filter((c) => c.id !== choreId),
        children: prev.children.map((c) =>
          c.id !== childId
            ? c
            : {
                ...c,
                extraChores: [
                  ...c.extraChores,
                  {
                    id: `claimed-${Date.now()}`,
                    sourceId: boardChore.id,
                    name: boardChore.name,
                    reward: boardChore.reward,
                    penalty: boardChore.penalty,
                    dueAt,
                    isCompleted: false,
                    isFailed: false,
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
        ),
      };
    });
  };

  const removeExtraBoardChore = (choreId: string) => {
    setState((prev) => ({
      ...prev,
      availableExtraChores: prev.availableExtraChores.filter((chore) => chore.id !== choreId),
    }));
  };

  const completeExtraChore = (childId: string, extraId: string) => {
    updateChild(childId, (child) => {
      let earned = 0;
      const extraChores = child.extraChores.map((extra) => {
        if (extra.id !== extraId) return extra;
        if (extra.isCompleted || extra.isFailed) return extra;
        earned = extra.reward;
        return { ...extra, isCompleted: true, completedAt: new Date().toISOString() };
      });
      return {
        ...child,
        extraChores,
        piggyBank: child.piggyBank + earned,
        lifetimeEarned: child.lifetimeEarned + earned,
      };
    });
  };

  const cashOut = (childId: string) => {
    const amount = Number.parseFloat(cashOutAmounts[childId] || '0');
    if (!Number.isFinite(amount) || amount <= 0) return;
    const child = children.find((c) => c.id === childId);
    if (!child) return;
    if (amount > child.piggyBank) {
      toast({
        title: 'Not enough balance',
        description: `${child.name} only has ${money(child.piggyBank)}.`,
        variant: 'destructive',
      });
      return;
    }
    updateChild(childId, (current) => ({
      ...current,
      piggyBank: current.piggyBank - amount,
      cashedOut: current.cashedOut + amount,
    }));
    setCashOutAmounts((prev) => ({ ...prev, [childId]: '' }));
    toast({ title: 'Cash out recorded', description: `${money(amount)} paid out.` });
  };

  const totalDailyChores = useMemo(
    () => children.reduce((sum, child) => sum + child.dailyChores.length, 0),
    [children],
  );
  const completedDailyChores = useMemo(
    () =>
      children.reduce(
        (sum, child) => sum + child.dailyChores.filter((chore) => chore.isCompleted).length,
        0,
      ),
    [children],
  );

  return (
    <AppLayout>
      <PageHeader
        title="Kids Chores + Skills"
        subtitle={`${completedDailyChores} of ${totalDailyChores} daily chores done`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openPostExtra}>
              <Clock3 className="w-4 h-4 mr-2" />
              Post Extra Chore
            </Button>
            <Button variant="outline" size="sm" onClick={resetDaily}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Daily
            </Button>
          </div>
        }
      />

      <SectionCard
        title="Available Extra Chores"
        subtitle="Anyone can grab these, but only after daily chores are complete."
        action={
          <Button variant="outline" size="sm" onClick={openPostExtra}>
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        }
      >
        <div className="space-y-2">
          {availableExtraChores.length === 0 && (
            <p className="text-sm text-muted-foreground">No extra chores posted yet.</p>
          )}
          {availableExtraChores.map((chore) => (
            <div key={chore.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{chore.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Reward {money(chore.reward)} • Penalty {money(chore.penalty)} • {chore.hoursToComplete}h to complete
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeExtraBoardChore(chore.id)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {children.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {children.map((child) => (
                    <Button
                      key={`${chore.id}-${child.id}`}
                      size="sm"
                      variant="outline"
                      disabled={!isDailyDone(child)}
                      onClick={() => claimExtraChore(child.id, chore.id)}
                    >
                      {child.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      <div className="space-y-6 mt-6">
        {children.map((child) => {
          const dailyCompleted = child.dailyChores.filter((chore) => chore.isCompleted).length;
          const dailyTotal = child.dailyChores.length;
          const todaysWeekly = child.weeklyChores.filter((chore) =>
            normalizeWeeklyDays(chore).includes(currentDay),
          );
          const todaysSkills = child.skillItems.filter((skill) => skillDueToday(skill, currentDay));
          const flexibleSkills = child.skillItems.filter((skill) =>
            skill.cadence === 'weekly_any' || skill.cadence === 'monthly',
          );
          const currentWeekCompletedSkills = child.skillItems.filter((skill) =>
            skill.cadence === 'weekly_any' && skillCompletedThisWeek(skill),
          ).length;
          const currentMonthCompletedSkills = child.skillItems.filter((skill) =>
            skill.cadence === 'monthly' && skillCompletedThisMonth(skill),
          ).length;
          const skillSummaryParts: string[] = [];
          if (todaysSkills.length > 0) skillSummaryParts.push(`${todaysSkills.length} due today`);
          if (flexibleSkills.length > 0) {
            const weeklyCount = child.skillItems.filter((skill) => skill.cadence === 'weekly_any').length;
            const monthlyCount = child.skillItems.filter((skill) => skill.cadence === 'monthly').length;
            if (weeklyCount > 0) skillSummaryParts.push(`${currentWeekCompletedSkills}/${weeklyCount} weekly goals`);
            if (monthlyCount > 0) skillSummaryParts.push(`${currentMonthCompletedSkills}/${monthlyCount} monthly goals`);
          }

          return (
            <div
              key={child.id}
              ref={(node) => {
                childRefs.current[child.id] = node;
              }}
              className={cn(
                'rounded-xl transition-colors',
                searchParams.get('child') === child.id && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background',
              )}
            >
              <SectionCard
                title={child.name}
                subtitle={
                  dailyTotal > 0 ? `${dailyCompleted}/${dailyTotal} daily chores complete` : 'No chores yet'
                }
                action={
                  <Button variant="ghost" size="sm" onClick={() => removeChild(child.id)}>
                    <X className="w-4 h-4" />
                  </Button>
                }
              >
                <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <div className="rounded-md border border-border p-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <PiggyBank className="w-3.5 h-3.5" /> Piggy Bank
                    </p>
                    <p className="font-semibold">{money(child.piggyBank)}</p>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <p className="text-xs text-muted-foreground">Points Bank</p>
                    <p className="font-semibold">{formatPoints(child.pointsBank)}</p>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <p className="text-xs text-muted-foreground">Earned</p>
                    <p className="font-semibold text-primary">{money(child.lifetimeEarned)}</p>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <p className="text-xs text-muted-foreground">Points Earned</p>
                    <p className="font-semibold text-primary">{formatPoints(child.lifetimePointsEarned)}</p>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <p className="text-xs text-muted-foreground">Penalties</p>
                    <p className="font-semibold text-destructive">{money(child.lifetimePenalties)}</p>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5" /> Cashed Out
                    </p>
                    <p className="font-semibold">{money(child.cashedOut)}</p>
                  </div>
                </div>

                {child.dailyChores.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Daily</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {child.dailyChores.map((chore) => (
                        <label
                          key={chore.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer transition-gentle',
                            'hover:bg-muted/50',
                            chore.isCompleted && 'bg-primary/5 border-primary/20',
                          )}
                        >
                          <Checkbox
                            checked={chore.isCompleted}
                            onCheckedChange={() => toggleDailyChore(child.id, chore.id)}
                          />
                          <span
                            className={cn(
                              'flex-1 text-sm',
                              chore.isCompleted && 'line-through text-muted-foreground',
                            )}
                          >
                            {chore.name}
                          </span>
                          <span className="text-xs text-primary font-medium">{formatReward(chore.reward, chore.rewardUnit)}</span>
                          {chore.isCompleted && <CheckCircle2 className="w-4 h-4 text-primary" />}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openEditChore(child.id, 'daily', chore.id);
                            }}
                            title="Edit chore"
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {todaysWeekly.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Scheduled for Today</h4>
                    <div className="space-y-2">
                      {todaysWeekly.map((chore) => (
                        <label
                          key={chore.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-primary/30 cursor-pointer transition-gentle',
                            'hover:bg-primary/5',
                            chore.isCompleted && 'bg-primary/10 border-primary/40',
                          )}
                        >
                          <Checkbox
                            checked={chore.isCompleted}
                            onCheckedChange={() => toggleWeeklyChore(child.id, chore.id)}
                          />
                          <span
                            className={cn(
                              'flex-1 text-sm',
                              chore.isCompleted && 'line-through text-muted-foreground',
                            )}
                          >
                            {chore.name}
                          </span>
                          <span className="text-xs text-primary font-medium">{formatReward(chore.reward, chore.rewardUnit)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openEditChore(child.id, 'weekly', chore.id);
                            }}
                            title="Edit chore"
                          >
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {child.weeklyChores.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Scheduled Chores</h4>
                    <div className="flex flex-wrap gap-2">
                      {child.weeklyChores.map((chore) => (
                        <button
                          key={chore.id}
                          type="button"
                          onClick={() => openEditChore(child.id, 'weekly', chore.id)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs transition-colors',
                            normalizeWeeklyDays(chore).includes(currentDay)
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80',
                          )}
                        >
                          {normalizeWeeklyDays(chore).map((day) => dayLabels[day].slice(0, 3)).join(', ')}: {chore.name} ({formatReward(chore.reward, chore.rewardUnit)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium">Skill Development</h4>
                      <p className="text-xs text-muted-foreground">
                        {skillSummaryParts.length > 0
                          ? skillSummaryParts.join(' • ')
                          : 'Track practice goals like piano, soccer, reading, or Spanish.'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openAddSkill(child.id)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Skill
                    </Button>
                  </div>

                  {todaysSkills.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Due Today</h5>
                      <div className="space-y-2">
                        {todaysSkills.map((skill) => {
                          const completedToday = skillCompletedOnDate(skill, todayDateKey());
                          return (
                            <label
                              key={skill.id}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer transition-gentle hover:bg-muted/50',
                                completedToday && 'bg-primary/5 border-primary/20',
                              )}
                            >
                              <Checkbox
                                checked={completedToday}
                                onCheckedChange={() => toggleSkill(child.id, skill.id)}
                              />
                              <span className={cn('flex-1 text-sm', completedToday && 'line-through text-muted-foreground')}>
                                {skill.name}
                              </span>
                              <span className="text-xs text-muted-foreground">{skill.targetMinutes} min • {formatPoints(skill.points)}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openEditSkill(child.id, skill.id);
                                }}
                                title="Edit skill"
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {flexibleSkills.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Anytime Goals</h5>
                      <div className="space-y-2">
                        {flexibleSkills.map((skill) => {
                          const isDone = skill.cadence === 'monthly'
                            ? skillCompletedThisMonth(skill)
                            : skillCompletedThisWeek(skill);
                          return (
                            <label
                              key={skill.id}
                              className={cn(
                                'flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer transition-gentle hover:bg-muted/50',
                                isDone && 'bg-primary/5 border-primary/20',
                              )}
                            >
                              <Checkbox
                                checked={isDone}
                                onCheckedChange={() => toggleSkill(child.id, skill.id)}
                              />
                              <div className="flex-1">
                                <p className={cn('text-sm', isDone && 'line-through text-muted-foreground')}>{skill.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {skill.targetMinutes} min • {formatPoints(skill.points)} • {skillWindowLabel(skill)}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openEditSkill(child.id, skill.id);
                                }}
                                title="Edit skill"
                              >
                                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {child.skillItems.length > 0 && (
                    <div>
                      <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Skill Schedule</h5>
                      <div className="flex flex-wrap gap-2">
                        {child.skillItems.map((skill) => (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => openEditSkill(child.id, skill.id)}
                            className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/80"
                          >
                            {skillWindowLabel(skill)}: {skill.name} ({skill.targetMinutes} min • {formatPoints(skill.points)})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {child.skillItems.length === 0 && (
                    <p className="text-sm text-muted-foreground">No skill development goals added yet.</p>
                  )}
                </div>

                <div className="rounded-lg border border-border p-3 space-y-2">
                  <h4 className="text-sm font-medium">Claimed Extra Chores</h4>
                  {child.extraChores.length === 0 && (
                    <p className="text-xs text-muted-foreground">No extra chores claimed yet.</p>
                  )}
                  {child.extraChores.map((extra) => (
                    <div key={extra.id} className="rounded-md border border-border p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className={cn(
                              'text-sm font-medium',
                              extra.isFailed && 'text-destructive',
                              extra.isCompleted && 'text-primary',
                            )}
                          >
                            {extra.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Reward {money(extra.reward)} • Penalty {money(extra.penalty)} • Due{' '}
                            {new Date(extra.dueAt).toLocaleString()}
                          </p>
                        </div>
                        {extra.isCompleted ? (
                          <span className="text-xs text-primary font-medium">Completed</span>
                        ) : extra.isFailed ? (
                          <span className="text-xs text-destructive font-medium">Missed</span>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => completeExtraChore(child.id, extra.id)}>
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium mb-2">Cash Out</p>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.25"
                      value={cashOutAmounts[child.id] || ''}
                      onChange={(e) =>
                        setCashOutAmounts((prev) => ({ ...prev, [child.id]: e.target.value }))
                      }
                      placeholder="Amount"
                    />
                    <Button onClick={() => cashOut(child.id)}>Cash Out</Button>
                  </div>
                </div>

                <Button variant="ghost" size="sm" className="w-full" onClick={() => openAddChore(child.id)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Chore
                </Button>
                </div>
              </SectionCard>
            </div>
          );
        })}
      </div>

      <Button variant="outline" className="w-full mt-6" onClick={() => setAddChildOpen(true)}>
        <Plus className="w-4 h-4 mr-2" />
        Add Child
      </Button>

      <Dialog open={addChildOpen} onOpenChange={setAddChildOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Child</DialogTitle>
            <DialogDescription>Add a child for chores, rewards, and piggy bank tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Child's name"
              value={newChildName}
              onChange={(e) => setNewChildName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addChild()}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddChildOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addChild} disabled={!newChildName.trim()}>
                Add Child
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addChoreOpen} onOpenChange={setAddChoreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Chore</DialogTitle>
            <DialogDescription>
              Add a chore for {children.find((child) => child.id === choreChildId)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Chore name" value={newChoreName} onChange={(e) => setNewChoreName(e.target.value)} />

            <div className="space-y-2">
              <label className="text-sm font-medium">Frequency</label>
              <Select
                value={newChoreType}
                onValueChange={(value) => {
                  const next = value as ChoreFrequency;
                  setNewChoreType(next);
                  if (next === 'weekly') setNewChoreDays([newChoreDay]);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (one day)</SelectItem>
                  <SelectItem value="other">Other (specific days)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newChoreType === 'weekly' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Day of week</label>
                <Select value={newChoreDay} onValueChange={(value) => setNewChoreDay(value as DayOfWeek)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allDays.map((day) => (
                      <SelectItem key={`new-weekly-day-${day}`} value={day}>
                        {dayLabels[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {newChoreType === 'other' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Days of week</label>
                <div className="flex flex-wrap gap-2">
                  {allDays.map((day) => {
                    const active = newChoreDays.includes(day);
                    return (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => toggleNewChoreDay(day)}
                      >
                        {dayLabels[day].slice(0, 3)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reward amount</label>
                <Input
                  type="number"
                  min={0}
                  step={newChoreRewardUnit === 'points' ? '1' : '0.25'}
                  value={newChoreReward}
                  onChange={(e) => setNewChoreReward(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reward type</label>
                <Select
                  value={newChoreRewardUnit}
                  onValueChange={(value) => setNewChoreRewardUnit(value as RewardUnit)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="money">Money ($)</SelectItem>
                    <SelectItem value="points">Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddChoreOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addChore} disabled={!newChoreName.trim()}>
                Add Chore
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editChoreOpen} onOpenChange={setEditChoreOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Chore</DialogTitle>
            <DialogDescription>Update the chore details, reward, and schedule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Chore name"
              value={editChoreName}
              onChange={(event) => setEditChoreName(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reward amount</label>
                <Input
                  type="number"
                  min={0}
                  step={editChoreRewardUnit === 'points' ? '1' : '0.25'}
                  value={editChoreReward}
                  onChange={(event) => setEditChoreReward(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reward type</label>
                <Select
                  value={editChoreRewardUnit}
                  onValueChange={(value) => setEditChoreRewardUnit(value as RewardUnit)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="money">Money ($)</SelectItem>
                    <SelectItem value="points">Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editingChoreTarget?.type === 'weekly' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select
                    value={editChoreFrequency}
                    onValueChange={(value) => setEditChoreFrequency(value as NonDailyChoreFrequency)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly (one day)</SelectItem>
                      <SelectItem value="other">Other (specific days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editChoreFrequency === 'weekly' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Day of week</label>
                    <Select value={editChoreDay} onValueChange={(value) => setEditChoreDay(value as DayOfWeek)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allDays.map((day) => (
                          <SelectItem key={`edit-weekly-day-${day}`} value={day}>
                            {dayLabels[day]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Days of week</label>
                    <div className="flex flex-wrap gap-2">
                      {allDays.map((day) => {
                        const active = editChoreDays.includes(day);
                        return (
                          <Button
                            key={`edit-chore-day-${day}`}
                            type="button"
                            size="sm"
                            variant={active ? 'default' : 'outline'}
                            onClick={() => toggleEditChoreDay(day)}
                          >
                            {dayLabels[day].slice(0, 3)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="destructive" onClick={deleteChore}>
                Delete Chore
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditChoreOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEditedChore} disabled={!editChoreName.trim()}>
                  Save Chore
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addSkillOpen} onOpenChange={setAddSkillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Skill Goal</DialogTitle>
            <DialogDescription>
              Add a skill development goal for {children.find((child) => child.id === skillChildId)?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Skill name"
              value={newSkillName}
              onChange={(event) => setNewSkillName(event.target.value)}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Cadence</label>
              <Select
                value={newSkillCadence}
                onValueChange={(value) => setNewSkillCadence(value as SkillCadence)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (specific day)</SelectItem>
                  <SelectItem value="weekly_any">Weekly (any time that week)</SelectItem>
                  <SelectItem value="custom_weekly">Certain days each week</SelectItem>
                  <SelectItem value="monthly">Monthly (any time that month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(newSkillCadence === 'weekly') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Day of week</label>
                <Select value={newSkillDay} onValueChange={(value) => setNewSkillDay(value as DayOfWeek)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allDays.map((day) => (
                      <SelectItem key={`new-skill-day-${day}`} value={day}>
                        {dayLabels[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {newSkillCadence === 'custom_weekly' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Days of week</label>
                <div className="flex flex-wrap gap-2">
                  {allDays.map((day) => {
                    const active = newSkillDays.includes(day);
                    return (
                      <Button
                        key={`new-skill-toggle-${day}`}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => toggleNewSkillDay(day)}
                      >
                        {dayLabels[day].slice(0, 3)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Target minutes</label>
              <Input
                type="number"
                min={1}
                step="5"
                value={newSkillMinutes}
                onChange={(event) => setNewSkillMinutes(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Points</label>
              <Input
                type="number"
                min={0}
                step="1"
                value={newSkillPoints}
                onChange={(event) => setNewSkillPoints(event.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddSkillOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addSkill} disabled={!newSkillName.trim()}>
                Add Skill
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editSkillOpen} onOpenChange={setEditSkillOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Skill Goal</DialogTitle>
            <DialogDescription>Update the cadence and target time for this skill.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Skill name"
              value={editSkillName}
              onChange={(event) => setEditSkillName(event.target.value)}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Cadence</label>
              <Select
                value={editSkillCadence}
                onValueChange={(value) => setEditSkillCadence(value as SkillCadence)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly (specific day)</SelectItem>
                  <SelectItem value="weekly_any">Weekly (any time that week)</SelectItem>
                  <SelectItem value="custom_weekly">Certain days each week</SelectItem>
                  <SelectItem value="monthly">Monthly (any time that month)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {editSkillCadence === 'weekly' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Day of week</label>
                <Select value={editSkillDay} onValueChange={(value) => setEditSkillDay(value as DayOfWeek)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allDays.map((day) => (
                      <SelectItem key={`edit-skill-day-${day}`} value={day}>
                        {dayLabels[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editSkillCadence === 'custom_weekly' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Days of week</label>
                <div className="flex flex-wrap gap-2">
                  {allDays.map((day) => {
                    const active = editSkillDays.includes(day);
                    return (
                      <Button
                        key={`edit-skill-toggle-${day}`}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => toggleEditSkillDay(day)}
                      >
                        {dayLabels[day].slice(0, 3)}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Target minutes</label>
              <Input
                type="number"
                min={1}
                step="5"
                value={editSkillMinutes}
                onChange={(event) => setEditSkillMinutes(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Points</label>
              <Input
                type="number"
                min={0}
                step="1"
                value={editSkillPoints}
                onChange={(event) => setEditSkillPoints(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button variant="destructive" onClick={deleteSkill}>
                Delete Skill
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditSkillOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveEditedSkill} disabled={!editSkillName.trim()}>
                  Save Skill
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addExtraOpen} onOpenChange={setAddExtraOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Post Extra Chore</DialogTitle>
            <DialogDescription>
              Add an extra chore any kid can claim after completing daily chores.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Extra chore name" value={extraName} onChange={(e) => setExtraName(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Reward ($)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.25"
                  value={extraReward}
                  onChange={(e) => setExtraReward(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Penalty ($)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.25"
                  value={extraPenalty}
                  onChange={(e) => setExtraPenalty(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Time allowed (hours)</label>
              <Input
                type="number"
                min={1}
                step="1"
                value={extraHours}
                onChange={(e) => setExtraHours(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddExtraOpen(false)}>
                Cancel
              </Button>
              <Button onClick={postExtraChore} disabled={!extraName.trim()}>
                Post Chore
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
