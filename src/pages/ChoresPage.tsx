import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DayOfWeek } from '@/types';
import { Plus, RotateCcw, CheckCircle2, X, PiggyBank, Wallet, Clock3 } from 'lucide-react';
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

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';

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

interface RewardChore {
  id: string;
  name: string;
  isCompleted: boolean;
  reward: number;
}

interface RewardWeeklyChore extends RewardChore {
  day: DayOfWeek;
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
  extraChores: ClaimedExtraChore[];
  piggyBank: number;
  lifetimeEarned: number;
  lifetimePenalties: number;
  cashedOut: number;
}

interface ChoresState {
  children: ChildEconomy[];
  availableExtraChores: ExtraChoreOpportunity[];
}

const money = (amount: number) => `$${amount.toFixed(2)}`;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function choresStateKey(userId?: string | null): string {
  return `${CHORES_STATE_KEY_PREFIX}:${userId || 'anon'}`;
}

function defaultState(): ChoresState {
  return { children: [], availableExtraChores: [] };
}

function loadState(userId?: string | null): ChoresState {
  if (!canUseStorage()) return defaultState();
  try {
    const raw = window.localStorage.getItem(choresStateKey(userId));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<ChoresState> | ChildEconomy[];

    if (Array.isArray(parsed)) {
      // legacy: old format stored only children
      return { children: parsed, availableExtraChores: [] };
    }

    return {
      children: Array.isArray(parsed.children) ? parsed.children : [],
      availableExtraChores: Array.isArray(parsed.availableExtraChores)
        ? parsed.availableExtraChores
        : [],
    };
  } catch {
    return defaultState();
  }
}

function saveState(state: ChoresState, userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(choresStateKey(userId), JSON.stringify(state));
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
      return { ...extra, isFailed: true };
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
  const { user } = useAuth();
  const [state, setState] = useState<ChoresState>(() => defaultState());
  const [loadedForKey, setLoadedForKey] = useState<string | null>(null);
  const [addChildOpen, setAddChildOpen] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [addChoreOpen, setAddChoreOpen] = useState(false);
  const [choreChildId, setChoreChildId] = useState<string | null>(null);
  const [newChoreName, setNewChoreName] = useState('');
  const [newChoreType, setNewChoreType] = useState<'daily' | 'weekly'>('daily');
  const [newChoreDay, setNewChoreDay] = useState<DayOfWeek>('monday');
  const [newChoreReward, setNewChoreReward] = useState('1');
  const [addExtraOpen, setAddExtraOpen] = useState(false);
  const [extraName, setExtraName] = useState('');
  const [extraReward, setExtraReward] = useState('3');
  const [extraPenalty, setExtraPenalty] = useState('2');
  const [extraHours, setExtraHours] = useState('24');
  const [cashOutAmounts, setCashOutAmounts] = useState<Record<string, string>>({});
  const currentDay = getCurrentDay();
  const { toast } = useToast();
  const activeKey = user?.id || 'anon';

  const children = state.children;
  const availableExtraChores = state.availableExtraChores;

  useEffect(() => {
    setState(loadState(user?.id));
    setLoadedForKey(activeKey);
  }, [user?.id, activeKey]);

  useEffect(() => {
    if (loadedForKey !== activeKey) return;
    saveState(state, user?.id);
  }, [state, user?.id, loadedForKey, activeKey]);

  useEffect(() => {
    const firstPass = markOverdueExtras(children);
    if (firstPass.changed) {
      setState((prev) => ({ ...prev, children: firstPass.updated }));
    }

    const timer = window.setInterval(() => {
      setState((prev) => {
        const next = markOverdueExtras(prev.children);
        return next.changed ? { ...prev, children: next.updated } : prev;
      });
    }, 60_000);
    return () => window.clearInterval(timer);
    // intentionally run once on mount for stale overdue chores
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      let delta = 0;
      const dailyChores = child.dailyChores.map((chore) => {
        if (chore.id !== choreId) return chore;
        const nextCompleted = !chore.isCompleted;
        delta = nextCompleted ? chore.reward : -chore.reward;
        return { ...chore, isCompleted: nextCompleted };
      });
      return {
        ...child,
        dailyChores,
        piggyBank: Math.max(0, child.piggyBank + delta),
        lifetimeEarned: delta > 0 ? child.lifetimeEarned + delta : child.lifetimeEarned,
      };
    });
  };

  const toggleWeeklyChore = (childId: string, choreId: string) => {
    updateChild(childId, (child) => {
      let delta = 0;
      const weeklyChores = child.weeklyChores.map((chore) => {
        if (chore.id !== choreId) return chore;
        const nextCompleted = !chore.isCompleted;
        delta = nextCompleted ? chore.reward : -chore.reward;
        return { ...chore, isCompleted: nextCompleted };
      });
      return {
        ...child,
        weeklyChores,
        piggyBank: Math.max(0, child.piggyBank + delta),
        lifetimeEarned: delta > 0 ? child.lifetimeEarned + delta : child.lifetimeEarned,
      };
    });
  };

  const resetDaily = () => {
    setState((prev) => ({
      ...prev,
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
      extraChores: [],
      piggyBank: 0,
      lifetimeEarned: 0,
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
    setNewChoreReward('1');
    setAddChoreOpen(true);
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
        };
        return { ...child, dailyChores: [...child.dailyChores, newChore] };
      }
      const newChore: RewardWeeklyChore = {
        id: `weekly-${Date.now()}`,
        name: newChoreName.trim(),
        day: newChoreDay,
        isCompleted: false,
        reward,
      };
      return { ...child, weeklyChores: [...child.weeklyChores, newChore] };
    });

    setAddChoreOpen(false);
    toast({
      title: 'Chore added',
      description: `"${newChoreName}" added with ${money(reward)} reward.`,
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
        return { ...extra, isCompleted: true };
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
        title="Kids Chores"
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
          const todaysWeekly = child.weeklyChores.filter((chore) => chore.day === currentDay);

          return (
            <SectionCard
              key={child.id}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="rounded-md border border-border p-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <PiggyBank className="w-3.5 h-3.5" /> Piggy Bank
                    </p>
                    <p className="font-semibold">{money(child.piggyBank)}</p>
                  </div>
                  <div className="rounded-md border border-border p-2">
                    <p className="text-xs text-muted-foreground">Earned</p>
                    <p className="font-semibold text-primary">{money(child.lifetimeEarned)}</p>
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
                          <span className="text-xs text-primary font-medium">{money(chore.reward)}</span>
                          {chore.isCompleted && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {todaysWeekly.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Today's Weekly Chores</h4>
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
                          <span className="text-xs text-primary font-medium">{money(chore.reward)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {child.weeklyChores.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Weekly Schedule</h4>
                    <div className="flex flex-wrap gap-2">
                      {child.weeklyChores.map((chore) => (
                        <div
                          key={chore.id}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-xs',
                            chore.day === currentDay
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {dayLabels[chore.day].slice(0, 3)}: {chore.name} ({money(chore.reward)})
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
              <label className="text-sm font-medium">Type</label>
              <Select value={newChoreType} onValueChange={(value) => setNewChoreType(value as 'daily' | 'weekly')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
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
                      <SelectItem key={day} value={day}>
                        {dayLabels[day]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Reward amount ($)</label>
              <Input
                type="number"
                min={0}
                step="0.25"
                value={newChoreReward}
                onChange={(e) => setNewChoreReward(e.target.value)}
              />
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
