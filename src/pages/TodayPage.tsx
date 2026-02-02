import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { MacroBar } from '@/components/ui/MacroBar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { mockMealPlan, mockChildren, mockHouseTasks, mockMealLogs, mockProfiles } from '@/data/mockData';
import { Macros, DayOfWeek } from '@/types';
import { UtensilsCrossed, Check, SkipForward, Lock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const dayNames: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const getCurrentDay = (): DayOfWeek => {
  const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[new Date().getDay()] as DayOfWeek;
};

export default function TodayPage() {
  const today = format(new Date(), 'EEEE, MMMM d');
  const currentDay = getCurrentDay();
  const todaysMeal = mockMealPlan.find(m => m.day === currentDay);
  
  // Calculate today's totals
  const todaysLogs = mockMealLogs.filter(log => log.date === new Date().toISOString().split('T')[0]);
  const myLogs = todaysLogs.filter(log => log.person === 'me');
  const wifeLogs = todaysLogs.filter(log => log.person === 'wife');
  
  const sumMacros = (logs: typeof todaysLogs): Macros => ({
    calories: logs.reduce((sum, log) => sum + log.macros.calories, 0),
    protein_g: logs.reduce((sum, log) => sum + log.macros.protein_g, 0),
    carbs_g: logs.reduce((sum, log) => sum + log.macros.carbs_g, 0),
    fat_g: logs.reduce((sum, log) => sum + log.macros.fat_g, 0),
  });

  const myTotals = sumMacros(myLogs);
  const wifeTotals = sumMacros(wifeLogs);
  const myProfile = mockProfiles.find(p => p.id === 'me')!;
  const wifeProfile = mockProfiles.find(p => p.id === 'wife')!;

  // Today's tasks
  const todaysTasks = mockHouseTasks.filter(task => 
    task.frequency === 'once' || task.day === currentDay
  ).slice(0, 4);

  const [chores, setChores] = useState(mockChildren);

  const toggleChore = (childId: string, choreId: string) => {
    setChores(prev => prev.map(child => {
      if (child.id !== childId) return child;
      return {
        ...child,
        dailyChores: child.dailyChores.map(chore =>
          chore.id === choreId ? { ...chore, isCompleted: !chore.isCompleted } : chore
        ),
      };
    }));
  };

  return (
    <AppLayout>
      <PageHeader title="Today" subtitle={today} />

      <div className="space-y-6 stagger-children">
        {/* Tonight's Dinner */}
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
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {todaysMeal.recipe.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {todaysMeal.recipe.servings} servings • {todaysMeal.recipe.macrosPerServing.calories} cal/serving
                  </p>
                  <MacroBar current={todaysMeal.recipe.macrosPerServing} compact />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1">
                  <Check className="w-4 h-4 mr-2" />
                  Log for Both
                </Button>
                <Button size="sm" variant="outline">Log Me</Button>
                <Button size="sm" variant="outline">Log Wife</Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <SkipForward className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No dinner planned for tonight</p>
            </div>
          )}
        </SectionCard>

        {/* Quick Macro Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/me" className="block">
            <SectionCard className="card-hover">
              <div className="text-center mb-3">
                <p className="text-sm text-muted-foreground">{myProfile.name}</p>
                <p className="text-2xl font-display font-semibold">{Math.round(myTotals.calories)}</p>
                <p className="text-xs text-muted-foreground">calories today</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Protein</span>
                  <span className="font-medium">{Math.round(myTotals.protein_g)}g</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: `${Math.min((myTotals.protein_g / (myProfile.dailyTargets?.protein_g || 150)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </SectionCard>
          </Link>

          <Link to="/wife" className="block">
            <SectionCard className="card-hover">
              <div className="text-center mb-3">
                <p className="text-sm text-muted-foreground">{wifeProfile.name}</p>
                <p className="text-2xl font-display font-semibold">{Math.round(wifeTotals.calories)}</p>
                <p className="text-xs text-muted-foreground">calories today</p>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Protein</span>
                  <span className="font-medium">{Math.round(wifeTotals.protein_g)}g</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full" 
                    style={{ width: `${Math.min((wifeTotals.protein_g / (wifeProfile.dailyTargets?.protein_g || 120)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </SectionCard>
          </Link>
        </div>

        {/* Kids Chores */}
        <SectionCard 
          title="Kids Chores" 
          action={
            <Link to="/chores">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chores.map(child => {
              const completed = child.dailyChores.filter(c => c.isCompleted).length;
              const total = child.dailyChores.length;
              
              return (
                <div key={child.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{child.name}</span>
                    <span className="text-sm text-muted-foreground">{completed}/{total}</span>
                  </div>
                  <div className="space-y-1">
                    {child.dailyChores.slice(0, 3).map(chore => (
                      <label 
                        key={chore.id} 
                        className="flex items-center gap-2 text-sm cursor-pointer group"
                      >
                        <Checkbox 
                          checked={chore.isCompleted}
                          onCheckedChange={() => toggleChore(child.id, chore.id)}
                        />
                        <span className={cn(
                          "transition-gentle group-hover:text-foreground",
                          chore.isCompleted && "line-through text-muted-foreground"
                        )}>
                          {chore.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* House Tasks */}
        <SectionCard 
          title="House Manager" 
          action={
            <Link to="/tasks">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          }
        >
          <div className="space-y-3">
            {todaysTasks.map(task => (
              <div 
                key={task.id} 
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge type={task.type} />
                  <div>
                    <p className="font-medium text-sm">{task.title}</p>
                    {task.notes && (
                      <p className="text-xs text-muted-foreground">{task.notes}</p>
                    )}
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Quick Add */}
        <Button variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Quick Add Meal
        </Button>
      </div>
    </AppLayout>
  );
}
