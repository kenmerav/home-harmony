import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { mockChildren } from '@/data/mockData';
import { Child, DayOfWeek } from '@/types';
import { Plus, RotateCcw, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function ChoresPage() {
  const [children, setChildren] = useState(mockChildren);
  const currentDay = getCurrentDay();

  const toggleDailyChore = (childId: string, choreId: string) => {
    setChildren(prev => prev.map(child => {
      if (child.id !== childId) return child;
      return {
        ...child,
        dailyChores: child.dailyChores.map(chore =>
          chore.id === choreId ? { ...chore, isCompleted: !chore.isCompleted } : chore
        ),
      };
    }));
  };

  const toggleWeeklyChore = (childId: string, choreId: string) => {
    setChildren(prev => prev.map(child => {
      if (child.id !== childId) return child;
      return {
        ...child,
        weeklyChores: child.weeklyChores.map(chore =>
          chore.id === choreId ? { ...chore, isCompleted: !chore.isCompleted } : chore
        ),
      };
    }));
  };

  const resetDaily = () => {
    setChildren(prev => prev.map(child => ({
      ...child,
      dailyChores: child.dailyChores.map(chore => ({ ...chore, isCompleted: false })),
    })));
  };

  const totalDailyChores = children.reduce((sum, c) => sum + c.dailyChores.length, 0);
  const completedDailyChores = children.reduce(
    (sum, c) => sum + c.dailyChores.filter(ch => ch.isCompleted).length, 
    0
  );

  return (
    <AppLayout>
      <PageHeader 
        title="Kids Chores" 
        subtitle={`${completedDailyChores} of ${totalDailyChores} daily chores done`}
        action={
          <Button variant="outline" size="sm" onClick={resetDaily}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Daily
          </Button>
        }
      />

      <div className="space-y-6">
        {children.map(child => {
          const dailyCompleted = child.dailyChores.filter(c => c.isCompleted).length;
          const dailyTotal = child.dailyChores.length;
          const todaysWeekly = child.weeklyChores.filter(c => c.day === currentDay);
          
          return (
            <SectionCard 
              key={child.id} 
              title={child.name}
              subtitle={`${dailyCompleted}/${dailyTotal} daily chores complete`}
            >
              <div className="space-y-4">
                {/* Daily Chores */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Daily</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {child.dailyChores.map(chore => (
                      <label 
                        key={chore.id} 
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer transition-gentle",
                          "hover:bg-muted/50",
                          chore.isCompleted && "bg-primary/5 border-primary/20"
                        )}
                      >
                        <Checkbox 
                          checked={chore.isCompleted}
                          onCheckedChange={() => toggleDailyChore(child.id, chore.id)}
                        />
                        <span className={cn(
                          "flex-1 text-sm",
                          chore.isCompleted && "line-through text-muted-foreground"
                        )}>
                          {chore.name}
                        </span>
                        {chore.isCompleted && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Today's Weekly Chores */}
                {todaysWeekly.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      Today's Weekly Chore
                    </h4>
                    <div className="space-y-2">
                      {todaysWeekly.map(chore => (
                        <label 
                          key={chore.id} 
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border-2 border-dashed border-primary/30 cursor-pointer transition-gentle",
                            "hover:bg-primary/5",
                            chore.isCompleted && "bg-primary/10 border-primary/40"
                          )}
                        >
                          <Checkbox 
                            checked={chore.isCompleted}
                            onCheckedChange={() => toggleWeeklyChore(child.id, chore.id)}
                          />
                          <span className={cn(
                            "flex-1",
                            chore.isCompleted && "line-through text-muted-foreground"
                          )}>
                            {chore.name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Weekly Chores */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Weekly Schedule</h4>
                  <div className="flex flex-wrap gap-2">
                    {child.weeklyChores.map(chore => (
                      <div 
                        key={chore.id}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs",
                          chore.day === currentDay
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {dayLabels[chore.day].slice(0, 3)}: {chore.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          );
        })}
      </div>

      {/* Add Child placeholder */}
      <Button variant="outline" className="w-full mt-6">
        <Plus className="w-4 h-4 mr-2" />
        Add Child
      </Button>
    </AppLayout>
  );
}
