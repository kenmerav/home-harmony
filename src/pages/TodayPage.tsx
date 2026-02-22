import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { MacroBar } from '@/components/ui/MacroBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockMealPlan, mockChildren, mockHouseTasks } from '@/data/mockData';
import { DayOfWeek, MealLog } from '@/types';
import {
  UtensilsCrossed,
  Check,
  SkipForward,
  Plus,
  User,
  Users,
  Droplets,
  Wine,
  Trophy,
  Flame,
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
import {
  addAlcohol,
  addMealLog,
  addWater,
  getDailyScore,
  getFamilyLeaderboard,
  getMealLogs,
  getProfiles,
  getCurrentStreak,
} from '@/lib/macroGame';

const getCurrentDay = (): DayOfWeek => {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()] as DayOfWeek;
};

export default function TodayPage() {
  const todayLabel = format(new Date(), 'EEEE, MMMM d');
  const currentDay = getCurrentDay();
  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todaysMeal = mockMealPlan.find((m) => m.day === currentDay);
  const { toast } = useToast();

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddData, setQuickAddData] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    person: 'both' as 'me' | 'wife' | 'both',
  });
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = () => setRefreshTick((prev) => prev + 1);
  const profiles = useMemo(() => getProfiles(), [refreshTick]);
  const mealLogs = useMemo(() => getMealLogs(), [refreshTick]);
  const todaysLogs = mealLogs.filter((log) => log.date === todayKey);
  const myLogs = todaysLogs.filter((log) => log.person === 'me');
  const wifeLogs = todaysLogs.filter((log) => log.person === 'wife');

  const myScore = useMemo(() => getDailyScore('me', todayKey), [refreshTick, todayKey]);
  const wifeScore = useMemo(() => getDailyScore('wife', todayKey), [refreshTick, todayKey]);
  const myStreak = useMemo(() => getCurrentStreak('me'), [refreshTick]);
  const wifeStreak = useMemo(() => getCurrentStreak('wife'), [refreshTick]);
  const leaderboard = useMemo(() => getFamilyLeaderboard(), [refreshTick]);

  const todaysTasks = mockHouseTasks
    .filter((task) => task.frequency === 'once' || task.day === currentDay)
    .slice(0, 4);

  const logMeal = (person: 'me' | 'wife' | 'both') => {
    if (!todaysMeal) return;

    const createLog = (target: 'me' | 'wife'): MealLog => ({
      id: `log-${Date.now()}-${target}`,
      recipeId: todaysMeal.recipeId,
      recipeName: todaysMeal.recipe.name,
      date: todayKey,
      person: target,
      servings: 1,
      macros: { ...todaysMeal.recipe.macrosPerServing },
      isQuickAdd: false,
      createdAt: new Date(),
    });

    if (person === 'both') {
      addMealLog(createLog('me'));
      addMealLog(createLog('wife'));
      toast({ title: 'Logged for both', description: todaysMeal.recipe.name });
    } else {
      addMealLog(createLog(person));
      toast({ title: `Logged for ${person === 'me' ? profiles.me.name : profiles.wife.name}`, description: todaysMeal.recipe.name });
    }
    refresh();
  };

  const handleQuickAdd = () => {
    const calories = Number.parseInt(quickAddData.calories, 10) || 0;
    const protein = Number.parseInt(quickAddData.protein, 10) || 0;
    const carbs = Number.parseInt(quickAddData.carbs, 10) || 0;
    const fat = Number.parseInt(quickAddData.fat, 10) || 0;

    if (calories <= 0) {
      toast({ title: 'Please enter calories', variant: 'destructive' });
      return;
    }

    const createLog = (target: 'me' | 'wife'): MealLog => ({
      id: `quickadd-${Date.now()}-${target}`,
      recipeName: quickAddData.name || 'Quick Add',
      date: todayKey,
      person: target,
      servings: 1,
      macros: { calories, protein_g: protein, carbs_g: carbs, fat_g: fat },
      isQuickAdd: true,
      createdAt: new Date(),
    });

    if (quickAddData.person === 'both') {
      addMealLog(createLog('me'));
      addMealLog(createLog('wife'));
    } else {
      addMealLog(createLog(quickAddData.person));
    }

    toast({
      title: 'Added',
      description: `${calories} cal${quickAddData.name ? ` - ${quickAddData.name}` : ''}`,
    });

    setQuickAddOpen(false);
    setQuickAddData({ name: '', calories: '', protein: '', carbs: '', fat: '', person: 'both' });
    refresh();
  };

  const adjustWater = (person: 'me' | 'wife', deltaOz: number) => {
    addWater(person, deltaOz, todayKey);
    refresh();
  };

  const adjustAlcohol = (person: 'me' | 'wife', deltaDrinks: number) => {
    addAlcohol(person, deltaDrinks, todayKey);
    refresh();
  };

  return (
    <AppLayout>
      <PageHeader title="Today" subtitle={todayLabel} />

      <div className="space-y-6 stagger-children">
        <SectionCard
          title="Tonight's Dinner"
          action={
            <Link to="/meals">
              <Button variant="ghost" size="sm">View Week</Button>
            </Link>
          }
        >
          {todaysMeal && !todaysMeal.isSkipped ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UtensilsCrossed className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-lg font-semibold text-foreground">{todaysMeal.recipe.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {todaysMeal.recipe.servings} servings • {todaysMeal.recipe.macrosPerServing.calories} cal/serving
                  </p>
                  <MacroBar current={todaysMeal.recipe.macrosPerServing} compact />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1" onClick={() => logMeal('both')}>
                  <Check className="w-4 h-4 mr-2" />
                  Log for Both (+points)
                </Button>
                <Button size="sm" variant="outline" onClick={() => logMeal('me')}>
                  <User className="w-4 h-4 mr-1" />
                  Me
                </Button>
                <Button size="sm" variant="outline" onClick={() => logMeal('wife')}>
                  <Users className="w-4 h-4 mr-1" />
                  Wife
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <SkipForward className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No dinner planned for tonight</p>
            </div>
          )}
        </SectionCard>

        <SectionCard title="Macro Game">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { id: 'me' as const, label: profiles.me.name, score: myScore, streak: myStreak },
              { id: 'wife' as const, label: profiles.wife.name, score: wifeScore, streak: wifeStreak },
            ]).map((entry) => (
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
        </SectionCard>

        <SectionCard
          title="Family Leaderboard"
          subtitle="Weekly points across nutrition + chores"
          action={
            <Link to="/family">
              <Button size="sm" variant="ghost">Family Hub</Button>
            </Link>
          }
        >
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

        <div className="grid grid-cols-2 gap-4">
          <Link to="/me" className="block">
            <SectionCard className="card-hover">
              <div className="text-center mb-3">
                <p className="text-sm text-muted-foreground">{profiles.me.name}</p>
                <p className="text-2xl font-display font-semibold">{Math.round(myScore.calories)}</p>
                <p className="text-xs text-muted-foreground">calories today</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Protein</span>
                  <span className="font-medium">{Math.round(myScore.protein_g)}g</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min((myScore.protein_g / profiles.me.macroPlan.protein_g) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </SectionCard>
          </Link>

          <Link to="/wife" className="block">
            <SectionCard className="card-hover">
              <div className="text-center mb-3">
                <p className="text-sm text-muted-foreground">{profiles.wife.name}</p>
                <p className="text-2xl font-display font-semibold">{Math.round(wifeScore.calories)}</p>
                <p className="text-xs text-muted-foreground">calories today</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Protein</span>
                  <span className="font-medium">{Math.round(wifeScore.protein_g)}g</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min((wifeScore.protein_g / profiles.wife.macroPlan.protein_g) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </SectionCard>
          </Link>
        </div>

        <SectionCard
          title="Kids Chores"
          action={
            <Link to="/chores">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockChildren.map((child) => {
              const completed = child.dailyChores.filter((c) => c.isCompleted).length;
              const total = child.dailyChores.length;
              return (
                <div key={child.id}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{child.name}</span>
                    <span className="text-sm text-muted-foreground">{completed}/{total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="House Manager"
          action={
            <Link to="/tasks">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {todaysTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <StatusBadge type={task.type} />
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    {task.notes && <p className="text-xs text-muted-foreground">{task.notes}</p>}
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        </SectionCard>

        <Button variant="outline" className="w-full" onClick={() => setQuickAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Quick Add Meal
        </Button>
      </div>

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Quick Add</DialogTitle>
            <DialogDescription>Log an unplanned meal or snack</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
              <div className="flex gap-2">
                {(['both', 'me', 'wife'] as const).map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={quickAddData.person === option ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setQuickAddData((prev) => ({ ...prev, person: option }))}
                  >
                    {option === 'both' ? 'Both' : option === 'me' ? 'Me' : 'Wife'}
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
    </AppLayout>
  );
}

function BadgeLine({ label, hit }: { label: string; hit: boolean }) {
  return (
    <div className={cn('rounded-md px-2 py-1 text-center text-xs border', hit ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted/30 border-border text-muted-foreground')}>
      {label} {hit ? '✓' : '•'}
    </div>
  );
}
