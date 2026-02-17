import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DayOfWeek } from '@/types';
import { Lock, Unlock, SkipForward, RefreshCw, ChevronLeft, ChevronRight, Shuffle } from 'lucide-react';
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
  toggleMealLock,
  toggleMealSkip,
  DbPlannedMeal,
} from '@/lib/api/meals';

const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const dayFullLabels: Record<DayOfWeek, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday',
  friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

export default function MealsPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [meals, setMeals] = useState<DbPlannedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [selectiveDialogOpen, setSelectiveDialogOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<DayOfWeek>>(new Set());
  const { toast } = useToast();

  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  const weekLabel = format(weekStart, 'MMM d') + ' – ' + format(addDays(weekStart, 6), 'MMM d');

  useEffect(() => {
    loadMeals();
  }, [weekOffset]);

  const loadMeals = async () => {
    try {
      setLoading(true);
      const data = await fetchMealsForWeek(weekOffset);
      setMeals(data);
    } catch (err) {
      console.error('Failed to load meals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (daysToRegen?: DayOfWeek[]) => {
    setRegenerating(true);
    try {
      const data = await generateMeals(weekOffset, daysToRegen);
      setMeals(data);
      toast({ title: 'Meals generated!', description: `${data.length} meals planned for the week` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to generate meals', variant: 'destructive' });
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

  const handleToggleLock = async (meal: DbPlannedMeal) => {
    const newVal = !meal.is_locked;
    setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, is_locked: newVal } : m));
    try {
      await toggleMealLock(meal.id, newVal);
    } catch {
      setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, is_locked: !newVal } : m));
    }
  };

  const handleToggleSkip = async (meal: DbPlannedMeal) => {
    const newVal = !meal.is_skipped;
    setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, is_skipped: newVal } : m));
    try {
      await toggleMealSkip(meal.id, newVal);
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
            const recipe = meal?.recipes as any;

            return (
              <div
                key={day}
                className={cn(
                  "bg-card rounded-xl border border-border p-4 transition-gentle",
                  isToday && "ring-2 ring-primary/20 border-primary/30",
                  meal?.is_skipped && "opacity-60"
                )}
              >
                <div className="flex items-start gap-4">
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSwap(meal)} title="Swap meal">
                        <Shuffle className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleLock(meal)}>
                        {meal.is_locked ? <Lock className="w-4 h-4 text-primary" /> : <Unlock className="w-4 h-4 text-muted-foreground" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleSkip(meal)}>
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
                    {meal && (meal.recipes as any)?.name && (
                      <p className="text-xs text-muted-foreground">
                        {(meal.recipes as any).name}
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
    </AppLayout>
  );
}
