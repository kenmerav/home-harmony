import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { mockMealPlan } from '@/data/mockData';
import { DayOfWeek, PlannedMeal } from '@/types';
import { UtensilsCrossed, Lock, Unlock, SkipForward, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { Link } from 'react-router-dom';

const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

export default function MealsPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [mealPlan, setMealPlan] = useState(mockMealPlan);
  
  const weekStart = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  const weekLabel = format(weekStart, 'MMM d') + ' - ' + format(addDays(weekStart, 6), 'MMM d');

  const toggleLock = (mealId: string) => {
    setMealPlan(prev => prev.map(meal => 
      meal.id === mealId ? { ...meal, isLocked: !meal.isLocked } : meal
    ));
  };

  const toggleSkip = (mealId: string) => {
    setMealPlan(prev => prev.map(meal => 
      meal.id === mealId ? { ...meal, isSkipped: !meal.isSkipped } : meal
    ));
  };

  const getMealForDay = (day: DayOfWeek): PlannedMeal | undefined => {
    return mealPlan.find(meal => meal.day === day);
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Weekly Meals" 
        subtitle="Dinner plan for the week"
        action={
          <Button size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Regenerate
          </Button>
        }
      />

      {/* Week Navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setWeekOffset(prev => prev - 1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-center">
          <p className="font-medium">{weekLabel}</p>
          {weekOffset === 0 && (
            <p className="text-xs text-muted-foreground">This Week</p>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setWeekOffset(prev => prev + 1)}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      <div className="space-y-3 stagger-children">
        {days.map((day, index) => {
          const meal = getMealForDay(day);
          const date = format(addDays(weekStart, index), 'd');
          const isToday = format(addDays(weekStart, index), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          
          return (
            <div 
              key={day}
              className={cn(
                "bg-card rounded-xl border border-border p-4 transition-gentle",
                isToday && "ring-2 ring-primary/20 border-primary/30",
                meal?.isSkipped && "opacity-60"
              )}
            >
              <div className="flex items-start gap-4">
                {/* Day indicator */}
                <div className={cn(
                  "w-12 text-center flex-shrink-0",
                  isToday && "text-primary"
                )}>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    {dayLabels[day]}
                  </p>
                  <p className={cn(
                    "text-2xl font-display font-semibold",
                    isToday ? "text-primary" : "text-foreground"
                  )}>
                    {date}
                  </p>
                </div>

                {/* Meal info */}
                <div className="flex-1 min-w-0">
                  {meal && !meal.isSkipped ? (
                    <Link to={`/recipes/${meal.recipeId}`} className="block group">
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-gentle">
                        {meal.recipe.name}
                      </h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span>{meal.recipe.macrosPerServing.calories} cal</span>
                        <span>•</span>
                        <span>{meal.recipe.macrosPerServing.protein_g}g protein</span>
                        {meal.recipe.isAnchored && (
                          <>
                            <span>•</span>
                            <span className="text-primary text-xs">Anchored</span>
                          </>
                        )}
                      </div>
                    </Link>
                  ) : meal?.isSkipped ? (
                    <div className="text-muted-foreground">
                      <p className="font-medium line-through">{meal.recipe.name}</p>
                      <p className="text-sm">Skipped</p>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">
                      <p className="text-sm">No meal planned</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {meal && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => toggleLock(meal.id)}
                    >
                      {meal.isLocked ? (
                        <Lock className="w-4 h-4 text-primary" />
                      ) : (
                        <Unlock className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleSkip(meal.id)}
                    >
                      <SkipForward className={cn(
                        "w-4 h-4",
                        meal.isSkipped ? "text-destructive" : "text-muted-foreground"
                      )} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6 text-xs text-muted-foreground">
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
    </AppLayout>
  );
}
