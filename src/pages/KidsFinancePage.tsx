import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  allocationForChild,
  DEFAULT_KIDS_FINANCE_ALLOCATION,
  hydrateKidsFinanceStateFromAccount,
  persistKidsFinanceStateToAccount,
  readStoredKidsFinanceState,
  setAllocationForChild,
  setSpendingGoalForChild,
  spendingGoalForChild,
  type KidsFinanceEarningAdjustment,
  type KidsFinanceAllocation,
  type KidsFinanceState,
  type KidsInvestmentLot,
  type VooQuote,
  writeStoredKidsFinanceState,
} from '@/lib/kidsFinanceStore';
import { hydrateChoresStateFromAccount, readStoredChoresState } from '@/lib/choresStateStore';
import { cn } from '@/lib/utils';
import { ArrowRightLeft, ArrowUpRight, Banknote, ChevronDown, CircleDollarSign, HandCoins, Landmark, Pencil, PiggyBank, Target, Trash2, TrendingUp } from 'lucide-react';

type PeriodPreset = 'this_week' | 'this_month' | 'this_year' | 'last_90' | 'all_time' | 'custom';

type RewardUnit = 'money' | 'points';

interface RewardChore {
  id: string;
  name: string;
  reward: number;
  rewardUnit?: RewardUnit;
  completionDates?: string[];
}

interface ClaimedExtraChore {
  id: string;
  name: string;
  reward: number;
  isCompleted: boolean;
  completedAt?: string;
}

interface FinanceChild {
  id: string;
  name: string;
  dailyChores: RewardChore[];
  weeklyChores: RewardChore[];
  extraChores: ClaimedExtraChore[];
  piggyBank: number;
  lifetimeEarned: number;
  cashedOut: number;
}

interface EarnedEvent {
  id: string;
  childId: string;
  childName: string;
  sourceName: string;
  amount: number;
  dateKey: string;
  sourceType: 'daily' | 'weekly' | 'extra' | 'legacy';
}

interface DateRange {
  label: string;
  start: string | null;
  end: string | null;
}

const emptyFinanceState: KidsFinanceState = {
  childSettings: [],
  investmentLots: [],
  cashOuts: [],
  earningAdjustments: [],
  spendingGoals: [],
  transfers: [],
};

const money = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number.isFinite(amount) ? amount : 0);

const percent = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1)}%`;

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date = new Date()): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDateKeyFromIso(value?: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return dateKey(parsed);
}

function normalizeMoney(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * 100) / 100);
}

function normalizeChildren(input: unknown): FinanceChild[] {
  const record = input && typeof input === 'object' && !Array.isArray(input)
    ? input as { children?: unknown[] }
    : {};
  if (!Array.isArray(record.children)) return [];
  return record.children
    .map((item) => {
      const child = item as Partial<FinanceChild>;
      return {
        id: String(child.id || '').trim(),
        name: String(child.name || 'Kid').trim(),
        dailyChores: Array.isArray(child.dailyChores) ? child.dailyChores as RewardChore[] : [],
        weeklyChores: Array.isArray(child.weeklyChores) ? child.weeklyChores as RewardChore[] : [],
        extraChores: Array.isArray(child.extraChores) ? child.extraChores as ClaimedExtraChore[] : [],
        piggyBank: normalizeMoney(child.piggyBank),
        lifetimeEarned: normalizeMoney(child.lifetimeEarned),
        cashedOut: normalizeMoney(child.cashedOut),
      };
    })
    .filter((child) => child.id.length > 0);
}

function completedMoneyEventsForChild(child: FinanceChild): EarnedEvent[] {
  const events: EarnedEvent[] = [];

  const addChoreEvents = (sourceType: 'daily' | 'weekly', chore: RewardChore) => {
    if (chore.rewardUnit === 'points') return;
    const amount = normalizeMoney(chore.reward);
    if (amount <= 0 || !Array.isArray(chore.completionDates)) return;
    chore.completionDates.forEach((completionDate, index) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) return;
      events.push({
        id: `${child.id}:${sourceType}:${chore.id}:${completionDate}:${index}`,
        childId: child.id,
        childName: child.name,
        sourceName: chore.name,
        amount,
        dateKey: completionDate,
        sourceType,
      });
    });
  };

  child.dailyChores.forEach((chore) => addChoreEvents('daily', chore));
  child.weeklyChores.forEach((chore) => addChoreEvents('weekly', chore));
  child.extraChores.forEach((extra) => {
    if (!extra.isCompleted) return;
    const amount = normalizeMoney(extra.reward);
    const completedDate = toDateKeyFromIso(extra.completedAt);
    if (amount <= 0 || !completedDate) return;
    events.push({
      id: `${child.id}:extra:${extra.id}:${completedDate}`,
      childId: child.id,
      childName: child.name,
      sourceName: extra.name,
      amount,
      dateKey: completedDate,
      sourceType: 'extra',
    });
  });

  const trackedTotal = events.reduce((sum, event) => sum + event.amount, 0);
  const missingLegacy = Math.max(0, normalizeMoney(child.lifetimeEarned) - trackedTotal);
  if (missingLegacy > 0.01) {
    events.push({
      id: `${child.id}:legacy-earned`,
      childId: child.id,
      childName: child.name,
      sourceName: 'Previous earnings',
      amount: missingLegacy,
      dateKey: dateKey(new Date()),
      sourceType: 'legacy',
    });
  }

  return events;
}

function rangeForPreset(preset: PeriodPreset, customStart: string, customEnd: string): DateRange {
  const now = new Date();
  if (preset === 'all_time') return { label: 'All time', start: null, end: null };
  if (preset === 'this_week') {
    const start = startOfWeek(now);
    return { label: 'This week', start: dateKey(start), end: dateKey(addDays(start, 6)) };
  }
  if (preset === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { label: 'This month', start: dateKey(start), end: dateKey(end) };
  }
  if (preset === 'this_year') {
    return { label: 'This year', start: `${now.getFullYear()}-01-01`, end: `${now.getFullYear()}-12-31` };
  }
  if (preset === 'last_90') {
    return { label: 'Last 90 days', start: dateKey(addDays(now, -89)), end: dateKey(now) };
  }
  return {
    label: 'Custom',
    start: customStart || null,
    end: customEnd || null,
  };
}

function isInRange(event: EarnedEvent, range: DateRange): boolean {
  if (range.start && event.dateKey < range.start) return false;
  if (range.end && event.dateKey > range.end) return false;
  return true;
}

function applyEarningAdjustments(events: EarnedEvent[], adjustments: KidsFinanceEarningAdjustment[]): EarnedEvent[] {
  if (adjustments.length === 0) return events;
  const adjustmentMap = new Map(adjustments.map((adjustment) => [adjustment.eventId, adjustment]));

  return events
    .map((event) => {
      const adjustment = adjustmentMap.get(event.id);
      if (!adjustment) return event;
      if (adjustment.deleted) return null;
      return {
        ...event,
        amount: adjustment.amount ?? event.amount,
        sourceName: adjustment.sourceName || event.sourceName,
        dateKey: adjustment.dateKey || event.dateKey,
      };
    })
    .filter((event): event is EarnedEvent => Boolean(event));
}

function allocationDollars(totalEarned: number, allocation: KidsFinanceAllocation) {
  return {
    tithing: totalEarned * allocation.tithing / 100,
    investing: totalEarned * allocation.investing / 100,
    taxes: totalEarned * allocation.taxes / 100,
    remaining: totalEarned * allocation.remaining / 100,
  };
}

function transferTotal(
  state: KidsFinanceState,
  childId: string,
  destination?: 'tithing' | 'investing',
): number {
  return state.transfers
    .filter((transfer) => transfer.childId === childId && (!destination || transfer.to === destination))
    .reduce((sum, transfer) => sum + transfer.amount, 0);
}

function totalPercent(allocation: KidsFinanceAllocation): number {
  return allocation.tithing + allocation.investing + allocation.taxes + allocation.remaining;
}

function daysSince(value: string): number {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return 0;
  return Math.floor((Date.now() - created) / (24 * 60 * 60 * 1000));
}

function lotsForChild(state: KidsFinanceState, childId: string): KidsInvestmentLot[] {
  return state.investmentLots.filter((lot) => lot.childId === childId);
}

function activeSharesForChild(state: KidsFinanceState, childId: string): number {
  const bought = lotsForChild(state, childId).reduce((sum, lot) => sum + lot.shares, 0);
  const sold = state.cashOuts
    .filter((cashOut) => cashOut.childId === childId)
    .reduce((sum, cashOut) => sum + cashOut.shares, 0);
  return Math.max(0, bought - sold);
}

function eligibleCashOutShares(state: KidsFinanceState, childId: string): number {
  const matureShares = lotsForChild(state, childId)
    .filter((lot) => daysSince(lot.createdAt) >= 30)
    .reduce((sum, lot) => sum + lot.shares, 0);
  const sold = state.cashOuts
    .filter((cashOut) => cashOut.childId === childId)
    .reduce((sum, cashOut) => sum + cashOut.shares, 0);
  return Math.max(0, matureShares - sold);
}

function nextAllocationWithChangedField(
  current: KidsFinanceAllocation,
  field: keyof KidsFinanceAllocation,
  rawValue: string,
): KidsFinanceAllocation {
  const value = Math.min(100, Math.max(0, Number.parseFloat(rawValue) || 0));
  const next = { ...current, [field]: value };
  if (field !== 'remaining') {
    next.remaining = Math.max(0, Math.round((100 - next.tithing - next.investing - next.taxes) * 100) / 100);
  }
  return next;
}

export default function KidsFinancePage() {
  const { user, sharedHouseholdOwnerId, householdScopeLoading } = useAuth();
  const { toast } = useToast();
  const activeScopeId = sharedHouseholdOwnerId || user?.id || null;
  const [children, setChildren] = useState<FinanceChild[]>([]);
  const [financeState, setFinanceState] = useState<KidsFinanceState>(emptyFinanceState);
  const [loaded, setLoaded] = useState(false);
  const [period, setPeriod] = useState<PeriodPreset>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [quote, setQuote] = useState<VooQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [cashOutAmounts, setCashOutAmounts] = useState<Record<string, string>>({});
  const [goalDrafts, setGoalDrafts] = useState<Record<string, { title: string; targetAmount: string }>>({});
  const [transferDrafts, setTransferDrafts] = useState<Record<string, { amount: string; to: 'tithing' | 'investing' }>>({});
  const [editingEvent, setEditingEvent] = useState<EarnedEvent | null>(null);
  const [earningDraft, setEarningDraft] = useState({ sourceName: '', amount: '', dateKey: '' });

  useEffect(() => {
    if (householdScopeLoading) return;
    let cancelled = false;

    const load = async () => {
      if (activeScopeId) {
        try {
          await Promise.all([
            hydrateChoresStateFromAccount(activeScopeId),
            hydrateKidsFinanceStateFromAccount(activeScopeId),
          ]);
        } catch (error) {
          console.error('Failed to hydrate kids finance state:', error);
        }
      }
      if (cancelled) return;
      setChildren(normalizeChildren(readStoredChoresState(activeScopeId)));
      setFinanceState(readStoredKidsFinanceState(activeScopeId));
      setLoaded(true);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeScopeId, householdScopeLoading]);

  useEffect(() => {
    const refresh = () => {
      setChildren(normalizeChildren(readStoredChoresState(activeScopeId)));
    };
    window.addEventListener('homehub:chores-state-updated', refresh);
    return () => {
      window.removeEventListener('homehub:chores-state-updated', refresh);
    };
  }, [activeScopeId]);

  useEffect(() => {
    if (!loaded) return;
    writeStoredKidsFinanceState(financeState, activeScopeId);
    void persistKidsFinanceStateToAccount(activeScopeId, financeState);
  }, [activeScopeId, financeState, loaded]);

  useEffect(() => {
    let cancelled = false;
    const loadQuote = async () => {
      setQuoteError(null);
      const { data, error } = await supabase.functions.invoke<VooQuote>('market-quote', {
        body: { symbol: 'VOO' },
      });
      if (cancelled) return;
      if (error || !data?.price) {
        setQuoteError(error?.message || 'Could not load the VOO quote.');
        return;
      }
      setQuote(data);
    };

    void loadQuote();
    return () => {
      cancelled = true;
    };
  }, []);

  const rawEvents = useMemo(
    () => children.flatMap((child) => completedMoneyEventsForChild(child)),
    [children],
  );
  const allEvents = useMemo(
    () => applyEarningAdjustments(rawEvents, financeState.earningAdjustments),
    [financeState.earningAdjustments, rawEvents],
  );
  const selectedRange = useMemo(() => rangeForPreset(period, customStart, customEnd), [customEnd, customStart, period]);
  const periodEvents = useMemo(
    () => allEvents.filter((event) => isInRange(event, selectedRange)),
    [allEvents, selectedRange],
  );

  const allTimeEarnedByChild = useMemo(() => {
    const map = new Map<string, number>();
    allEvents.forEach((event) => map.set(event.childId, (map.get(event.childId) || 0) + event.amount));
    return map;
  }, [allEvents]);

  useEffect(() => {
    if (!loaded || !quote?.price || children.length === 0) return;
    let changed = false;
    const nextLots = [...financeState.investmentLots];

    children.forEach((child) => {
      const allocation = allocationForChild(financeState, child.id);
      const targetPrincipal = (allTimeEarnedByChild.get(child.id) || 0) * allocation.investing / 100;
      const alreadyTracked = financeState.investmentLots
        .filter((lot) => lot.childId === child.id && lot.source === 'auto_allocation')
        .reduce((sum, lot) => sum + lot.amount, 0)
        + financeState.cashOuts
          .filter((cashOut) => cashOut.childId === child.id)
          .reduce((sum, cashOut) => sum + cashOut.amount, 0);
      const missingPrincipal = Math.round((targetPrincipal - alreadyTracked) * 100) / 100;
      if (missingPrincipal > 0.01) {
        changed = true;
        nextLots.push({
          id: `voo-lot-${child.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          childId: child.id,
          createdAt: new Date().toISOString(),
          amount: missingPrincipal,
          shares: missingPrincipal / quote.price,
          pricePerShare: quote.price,
          symbol: 'VOO',
          source: 'auto_allocation',
        });
      } else if (missingPrincipal < -0.01) {
        let excessPrincipal = Math.abs(missingPrincipal);
        for (let index = nextLots.length - 1; index >= 0 && excessPrincipal > 0.01; index -= 1) {
          const lot = nextLots[index];
          if (lot.childId !== child.id || lot.source !== 'auto_allocation') continue;
          changed = true;
          if (lot.amount <= excessPrincipal + 0.01) {
            excessPrincipal -= lot.amount;
            nextLots.splice(index, 1);
          } else {
            const nextAmount = Math.round((lot.amount - excessPrincipal) * 100) / 100;
            nextLots[index] = {
              ...lot,
              amount: nextAmount,
              shares: lot.pricePerShare > 0 ? nextAmount / lot.pricePerShare : lot.shares,
            };
            excessPrincipal = 0;
          }
        }
      }
    });

    if (changed) {
      setFinanceState((current) => ({ ...current, investmentLots: nextLots }));
    }
  }, [allTimeEarnedByChild, children, financeState, loaded, quote]);

  const updateAllocation = (childId: string, field: keyof KidsFinanceAllocation, value: string) => {
    setFinanceState((current) => {
      const currentAllocation = allocationForChild(current, childId);
      return setAllocationForChild(current, childId, nextAllocationWithChangedField(currentAllocation, field, value));
    });
  };

  const saveSpendingGoal = (childId: string) => {
    const draft = goalDrafts[childId] || { title: '', targetAmount: '' };
    const targetAmount = normalizeMoney(draft.targetAmount);
    setFinanceState((current) => setSpendingGoalForChild(current, childId, draft.title, targetAmount));
    toast({
      title: 'Goal saved',
      description: targetAmount > 0 ? 'The remaining-money tracker is updated.' : 'The goal amount was cleared.',
    });
  };

  const transferFromRemaining = (childId: string, availableRemaining: number) => {
    const draft = transferDrafts[childId] || { amount: '', to: 'tithing' as const };
    const amount = normalizeMoney(draft.amount);
    if (amount <= 0) return;
    if (amount > availableRemaining + 0.01) {
      toast({
        title: 'Not enough remaining money',
        description: `Only ${money(availableRemaining)} is available to move.`,
        variant: 'destructive',
      });
      return;
    }
    if (draft.to === 'investing' && !quote?.price) {
      toast({
        title: 'VOO quote needed',
        description: 'Wait for the quote to load before moving money into investing.',
        variant: 'destructive',
      });
      return;
    }

    setFinanceState((current) => ({
      ...current,
      transfers: [
        ...current.transfers,
        {
          id: `remaining-transfer-${childId}-${Date.now()}`,
          childId,
          createdAt: new Date().toISOString(),
          amount,
          from: 'remaining',
          to: draft.to,
        },
      ],
      investmentLots: draft.to === 'investing' && quote?.price
        ? [
            ...current.investmentLots,
            {
              id: `voo-manual-${childId}-${Date.now()}`,
              childId,
              createdAt: new Date().toISOString(),
              amount,
              shares: amount / quote.price,
              pricePerShare: quote.price,
              symbol: 'VOO',
              source: 'manual_adjustment',
            },
          ]
        : current.investmentLots,
    }));
    setTransferDrafts((current) => ({ ...current, [childId]: { amount: '', to: draft.to } }));
    toast({
      title: 'Money moved',
      description: `${money(amount)} moved from remaining to ${draft.to}.`,
    });
  };

  const mergeEarningAdjustment = (eventId: string, updates: Omit<KidsFinanceEarningAdjustment, 'eventId'>) => {
    setFinanceState((current) => {
      const existing = current.earningAdjustments.find((adjustment) => adjustment.eventId === eventId);
      const nextAdjustment = {
        ...existing,
        ...updates,
        eventId,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...current,
        earningAdjustments: [
          ...current.earningAdjustments.filter((adjustment) => adjustment.eventId !== eventId),
          nextAdjustment,
        ],
      };
    });
  };

  const openEditEarning = (event: EarnedEvent) => {
    setEditingEvent(event);
    setEarningDraft({
      sourceName: event.sourceName,
      amount: String(event.amount),
      dateKey: event.dateKey,
    });
  };

  const saveEditedEarning = () => {
    if (!editingEvent) return;
    const amount = normalizeMoney(earningDraft.amount);
    const sourceName = earningDraft.sourceName.trim();
    if (!sourceName || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(earningDraft.dateKey)) {
      toast({
        title: 'Check the earning details',
        description: 'Name, date, and amount are required before saving.',
        variant: 'destructive',
      });
      return;
    }

    mergeEarningAdjustment(editingEvent.id, {
      sourceName,
      amount,
      dateKey: earningDraft.dateKey,
      deleted: false,
    });
    setEditingEvent(null);
    toast({ title: 'Finance earning updated', description: 'The corrected amount is now used in finance totals.' });
  };

  const deleteEarningFromFinance = (event: EarnedEvent) => {
    mergeEarningAdjustment(event.id, { deleted: true });
    toast({
      title: 'Earning removed from finance',
      description: 'The chore history is unchanged, but this entry no longer counts in finance totals.',
    });
  };

  const handleCashOut = (childId: string) => {
    if (!quote?.price) return;
    const amount = normalizeMoney(cashOutAmounts[childId]);
    const maxAmount = eligibleCashOutShares(financeState, childId) * quote.price;
    if (amount <= 0) return;
    if (amount > maxAmount + 0.01) {
      toast({
        title: 'Cash out not available yet',
        description: `Only ${money(maxAmount)} is eligible after the 1 month holding period.`,
        variant: 'destructive',
      });
      return;
    }

    setFinanceState((current) => ({
      ...current,
      cashOuts: [
        ...current.cashOuts,
        {
          id: `voo-cashout-${childId}-${Date.now()}`,
          childId,
          createdAt: new Date().toISOString(),
          amount,
          shares: amount / quote.price,
          pricePerShare: quote.price,
          symbol: 'VOO',
        },
      ],
    }));
    setCashOutAmounts((current) => ({ ...current, [childId]: '' }));
    toast({ title: 'Investment cash out recorded', description: `${money(amount)} was moved out of simulated VOO.` });
  };

  const totals = useMemo(() => {
    const earned = periodEvents.reduce((sum, event) => sum + event.amount, 0);
    return { earned };
  }, [periodEvents]);

  return (
    <AppLayout contentWidthClassName="w-full max-w-[1700px]">
      <PageHeader
        title="Kids Financial Hub"
        subtitle="Split chore earnings into giving, investing, taxes, and spending money."
        action={
          <Link to="/chores">
            <Button variant="outline">
              <PiggyBank className="h-4 w-4 mr-2" />
              Chores
            </Button>
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionCard title="Time period" subtitle="See running totals for the range you choose.">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Range</Label>
                <Select value={period} onValueChange={(value) => setPeriod(value as PeriodPreset)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_week">This week</SelectItem>
                    <SelectItem value="this_month">This month</SelectItem>
                    <SelectItem value="this_year">This year</SelectItem>
                    <SelectItem value="last_90">Last 90 days</SelectItem>
                    <SelectItem value="all_time">All time</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {period === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Start</Label>
                    <Input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End</Label>
                    <Input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} />
                  </div>
                </div>
              )}
              <div className="rounded-xl border bg-muted/30 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{selectedRange.label}</p>
                <p className="mt-2 font-display text-4xl font-semibold">{money(totals.earned)}</p>
                <p className="text-sm text-muted-foreground">earned by kids in this period</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="VOO tracker" subtitle="Investing is simulated as Vanguard S&P 500 ETF shares.">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-xl border bg-background p-3">
                <span className="text-muted-foreground">Current VOO quote</span>
                <span className="font-semibold">{quote ? money(quote.price) : 'Loading...'}</span>
              </div>
              {quote?.asOf && (
                <p className="text-xs text-muted-foreground">
                  Quote from {quote.source}. Last update: {quote.asOf}.
                </p>
              )}
              {quoteError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  {quoteError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                New invested dollars automatically buy simulated VOO shares. Cash outs unlock after a 1 month holding period.
              </p>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          {children.length === 0 ? (
            <SectionCard title="No kids yet" subtitle="Add kids on the chores page first.">
              <Link to="/chores">
                <Button>
                  <PiggyBank className="h-4 w-4 mr-2" />
                  Add Kids
                </Button>
              </Link>
            </SectionCard>
          ) : (
            children.map((child) => {
              const allocation = allocationForChild(financeState, child.id);
              const childPeriodEvents = periodEvents.filter((event) => event.childId === child.id);
              const periodEarned = childPeriodEvents.reduce((sum, event) => sum + event.amount, 0);
              const allTimeEarned = allTimeEarnedByChild.get(child.id) || 0;
              const periodBuckets = allocationDollars(periodEarned, allocation);
              const lifetimeBuckets = allocationDollars(allTimeEarned, allocation);
              const transferredToTithing = transferTotal(financeState, child.id, 'tithing');
              const transferredToInvesting = transferTotal(financeState, child.id, 'investing');
              const transferredFromRemaining = transferredToTithing + transferredToInvesting;
              const remainingAvailable = Math.max(0, lifetimeBuckets.remaining - transferredFromRemaining);
              const lifetimeGiving = lifetimeBuckets.tithing + transferredToTithing;
              const spendingGoal = spendingGoalForChild(financeState, child.id);
              const goalDraft = goalDrafts[child.id] || {
                title: spendingGoal.title,
                targetAmount: spendingGoal.targetAmount > 0 ? String(spendingGoal.targetAmount) : '',
              };
              const goalTarget = normalizeMoney(goalDraft.targetAmount || spendingGoal.targetAmount);
              const goalProgress = goalTarget > 0 ? Math.min(100, remainingAvailable / goalTarget * 100) : 0;
              const transferDraft = transferDrafts[child.id] || { amount: '', to: 'tithing' as const };
              const childLots = lotsForChild(financeState, child.id);
              const activeShares = activeSharesForChild(financeState, child.id);
              const currentInvestmentValue = activeShares * (quote?.price || 0);
              const principal = childLots.reduce((sum, lot) => sum + lot.amount, 0)
                - financeState.cashOuts
                  .filter((cashOut) => cashOut.childId === child.id)
                  .reduce((sum, cashOut) => sum + cashOut.amount, 0);
              const gainLoss = currentInvestmentValue - principal;
              const cashOutAvailable = quote ? eligibleCashOutShares(financeState, child.id) * quote.price : 0;
              const allocationTotal = totalPercent(allocation);

              return (
                <SectionCard
                  key={child.id}
                  title={child.name}
                  subtitle={`${money(periodEarned)} earned in ${selectedRange.label.toLowerCase()} • ${money(allTimeEarned)} all time`}
                  action={<Badge variant="outline">{allocationTotal === 100 ? 'Balanced' : `${percent(allocationTotal)} allocated`}</Badge>}
                >
                  <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-4">
                        {[
                          ['Tithing', periodBuckets.tithing, allocation.tithing, HandCoins, 'text-amber-700'],
                          ['Investing', periodBuckets.investing, allocation.investing, TrendingUp, 'text-emerald-700'],
                          ['Taxes', periodBuckets.taxes, allocation.taxes, Landmark, 'text-sky-700'],
                          ['Remaining', periodBuckets.remaining, allocation.remaining, Banknote, 'text-primary'],
                        ].map(([label, amount, allocationPercent, Icon, color]) => (
                          <div key={String(label)} className="rounded-2xl border bg-background p-4">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">{String(label)}</p>
                              <Icon className={cn('h-4 w-4', String(color))} />
                            </div>
                            <p className="mt-3 font-display text-2xl font-semibold">{money(Number(amount))}</p>
                            <p className="text-sm text-muted-foreground">{percent(Number(allocationPercent))} of earnings</p>
                          </div>
                          ))}
                        </div>

                        <div className="rounded-2xl border bg-background p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Target className="h-5 w-5 text-primary" />
                                <p className="font-semibold">Remaining goal</p>
                              </div>
                              <p className="mt-3 text-sm text-muted-foreground">Available to spend</p>
                              <p className="font-display text-5xl font-semibold text-primary">{money(remainingAvailable)}</p>
                              <div className="mt-4">
                                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                                  <span className="font-medium">{goalDraft.title.trim() || 'No spending goal yet'}</span>
                                  <span className="text-muted-foreground">
                                    {goalTarget > 0 ? `${money(Math.min(remainingAvailable, goalTarget))} / ${money(goalTarget)}` : money(0)}
                                  </span>
                                </div>
                                <Progress value={goalProgress} />
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {goalTarget > 0
                                    ? `${money(Math.max(0, goalTarget - remainingAvailable))} left to reach this goal.`
                                    : 'Set a goal so kids can see exactly what their remaining money is working toward.'}
                                </p>
                              </div>
                            </div>

                            <div className="grid w-full gap-3 lg:max-w-sm">
                              <div className="space-y-2">
                                <Label>What they want to buy</Label>
                                <Input
                                  placeholder="Example: art kit, bike, game"
                                  value={goalDraft.title}
                                  onChange={(event) =>
                                    setGoalDrafts((current) => ({
                                      ...current,
                                      [child.id]: { ...goalDraft, title: event.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Goal amount</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={goalDraft.targetAmount}
                                  onChange={(event) =>
                                    setGoalDrafts((current) => ({
                                      ...current,
                                      [child.id]: { ...goalDraft, targetAmount: event.target.value },
                                    }))
                                  }
                                />
                              </div>
                              <Button type="button" onClick={() => saveSpendingGoal(child.id)}>
                                Save Goal
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-2xl border bg-muted/20 p-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <ArrowRightLeft className="h-5 w-5 text-primary" />
                                <p className="font-semibold">Move remaining money</p>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                Transfer spending money into tithing or simulated investing whenever they choose.
                              </p>
                              <p className="mt-2 text-sm">
                                Already moved: {money(transferredToTithing)} to tithing • {money(transferredToInvesting)} to investing
                              </p>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-[140px_150px_auto]">
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Amount"
                                value={transferDraft.amount}
                                onChange={(event) =>
                                  setTransferDrafts((current) => ({
                                    ...current,
                                    [child.id]: { ...transferDraft, amount: event.target.value },
                                  }))
                                }
                              />
                              <Select
                                value={transferDraft.to}
                                onValueChange={(value) =>
                                  setTransferDrafts((current) => ({
                                    ...current,
                                    [child.id]: { ...transferDraft, to: value as 'tithing' | 'investing' },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="tithing">Tithing</SelectItem>
                                  <SelectItem value="investing">Investing</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                onClick={() => transferFromRemaining(child.id, remainingAvailable)}
                                disabled={remainingAvailable <= 0}
                              >
                                Move
                              </Button>
                            </div>
                          </div>
                        </div>

                        <Collapsible defaultOpen={false} className="rounded-2xl border bg-muted/20 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-semibold">Allocation settings</p>
                              <p className="text-sm text-muted-foreground">Increase any bucket. Remaining adjusts automatically unless you edit it.</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {allocationTotal !== 100 && (
                                <Badge variant="destructive">{percent(allocationTotal)} total</Badge>
                              )}
                              <CollapsibleTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  aria-label="Toggle allocation settings"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <div className="mt-4 grid gap-3 sm:grid-cols-4">
                              {(['tithing', 'investing', 'taxes', 'remaining'] as const).map((field) => (
                                <div key={field} className="space-y-2">
                                  <Label className="capitalize">{field}</Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="1"
                                      value={String(allocation[field])}
                                      onChange={(event) => updateAllocation(child.id, field, event.target.value)}
                                    />
                                    <span className="text-sm text-muted-foreground">%</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border bg-background p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Lifetime giving</p>
                          <p className="mt-2 font-display text-3xl font-semibold">{money(lifetimeGiving)}</p>
                          <p className="text-sm text-muted-foreground">allocation plus remaining transfers</p>
                        </div>
                        <div className="rounded-2xl border bg-background p-4">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Lifetime taxes set aside</p>
                          <p className="mt-2 font-display text-3xl font-semibold">{money(lifetimeBuckets.taxes)}</p>
                          <p className="text-sm text-muted-foreground">practice bucket for future tax lessons</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-2xl border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Simulated VOO</p>
                          <p className="font-display text-3xl font-semibold">{money(currentInvestmentValue)}</p>
                        </div>
                        <CircleDollarSign className="h-8 w-8 text-primary" />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-muted-foreground">Shares</p>
                          <p className="font-semibold">{activeShares.toFixed(4)}</p>
                        </div>
                        <div className="rounded-xl bg-muted/40 p-3">
                          <p className="text-muted-foreground">Gain/Loss</p>
                          <p className={cn('font-semibold', gainLoss >= 0 ? 'text-primary' : 'text-destructive')}>
                            {gainLoss >= 0 ? '+' : ''}{money(gainLoss)}
                          </p>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Cash out available</span>
                          <span className="font-medium">{money(cashOutAvailable)}</span>
                        </div>
                        <Progress value={currentInvestmentValue > 0 ? Math.min(100, cashOutAvailable / currentInvestmentValue * 100) : 0} />
                        <p className="mt-2 text-xs text-muted-foreground">Investments become available after 1 month.</p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Cash out amount"
                          value={cashOutAmounts[child.id] || ''}
                          onChange={(event) => setCashOutAmounts((current) => ({ ...current, [child.id]: event.target.value }))}
                        />
                        <Button onClick={() => handleCashOut(child.id)} disabled={!quote || cashOutAvailable <= 0}>
                          Cash Out
                        </Button>
                      </div>
                      <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">How this works</p>
                        <p className="mt-1">
                          {child.name}&apos;s investing bucket buys simulated VOO shares. It keeps moving with the VOO quote until you cash it out.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold">Recent earnings in this period</p>
                      <Badge variant="outline">{childPeriodEvents.length} items</Badge>
                    </div>
                    {childPeriodEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No paid chores or extra chores recorded for this period.</p>
                    ) : (
                      <div className="space-y-2">
                        {childPeriodEvents.slice(0, 8).map((event) => (
                          <div key={event.id} className="flex items-center justify-between gap-3 rounded-xl bg-background p-3 text-sm">
                            <div>
                              <p className="font-medium">{event.sourceName}</p>
                              <p className="text-xs text-muted-foreground">{event.dateKey} • {event.sourceType}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">{money(event.amount)}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditEarning(event)}
                                aria-label={`Edit ${event.sourceName}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => deleteEarningFromFinance(event)}
                                aria-label={`Remove ${event.sourceName} from finance`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {childPeriodEvents.length > 8 && (
                      <p className="mt-3 text-xs text-muted-foreground">Showing the latest 8 earnings for this period.</p>
                    )}
                  </div>
                </SectionCard>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <ArrowUpRight className="h-4 w-4" />
          Teaching note
        </div>
        <p className="mt-1">
          This is a learning tracker, not tax or investment advice. The VOO section simulates investing so kids can see how patience and market movement affect money over time.
        </p>
      </div>

      <Dialog open={Boolean(editingEvent)} onOpenChange={(open) => !open && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit finance earning</DialogTitle>
            <DialogDescription>
              This only changes the kids finance ledger. It does not delete the original chore completion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={earningDraft.sourceName}
                onChange={(event) => setEarningDraft((current) => ({ ...current, sourceName: event.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount earned</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={earningDraft.amount}
                  onChange={(event) => setEarningDraft((current) => ({ ...current, amount: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={earningDraft.dateKey}
                  onChange={(event) => setEarningDraft((current) => ({ ...current, dateKey: event.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingEvent(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEditedEarning}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
