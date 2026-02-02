import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { MacroBar } from '@/components/ui/MacroBar';
import { Button } from '@/components/ui/button';
import { mockMealLogs, mockProfiles } from '@/data/mockData';
import { Macros } from '@/types';
import { Plus, TrendingUp, Target } from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function WifeDashboardPage() {
  const profile = mockProfiles.find(p => p.id === 'wife')!;
  const today = new Date().toISOString().split('T')[0];
  
  const todaysLogs = mockMealLogs.filter(log => log.date === today && log.person === 'wife');
  
  const sumMacros = (logs: typeof todaysLogs): Macros => ({
    calories: logs.reduce((sum, log) => sum + log.macros.calories, 0),
    protein_g: logs.reduce((sum, log) => sum + log.macros.protein_g, 0),
    carbs_g: logs.reduce((sum, log) => sum + log.macros.carbs_g, 0),
    fat_g: logs.reduce((sum, log) => sum + log.macros.fat_g, 0),
  });

  const todaysTotals = sumMacros(todaysLogs);

  // Generate mock week data
  const weekData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayLogs = mockMealLogs.filter(log => log.date === dateStr && log.person === 'wife');
    return {
      day: format(date, 'EEE'),
      date: dateStr,
      totals: sumMacros(dayLogs),
      isToday: dateStr === today,
    };
  });

  return (
    <AppLayout>
      <PageHeader 
        title={profile.name}
        subtitle="Daily macro tracking"
        action={
          <Button size="sm">
            <Target className="w-4 h-4 mr-2" />
            Set Goals
          </Button>
        }
      />

      <div className="space-y-6">
        {/* Today's Progress */}
        <SectionCard title="Today's Progress">
          <MacroBar current={todaysTotals} target={profile.dailyTargets} />
        </SectionCard>

        {/* Today's Meals */}
        <SectionCard 
          title="Today's Meals" 
          action={
            <Button variant="ghost" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          }
        >
          {todaysLogs.length > 0 ? (
            <div className="space-y-3">
              {todaysLogs.map(log => (
                <div 
                  key={log.id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-sm">{log.recipeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.servings} serving{log.servings !== 1 ? 's' : ''} 
                      {log.isQuickAdd && ' • Quick Add'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{log.macros.calories} cal</p>
                    <p className="text-xs text-muted-foreground">{log.macros.protein_g}g protein</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-muted-foreground">No meals logged today</p>
          )}
        </SectionCard>

        {/* Weekly Overview */}
        <SectionCard title="This Week" subtitle="Daily calorie intake">
          <div className="flex items-end justify-between gap-2 h-32">
            {weekData.map(day => {
              const maxCal = profile.dailyTargets?.calories || 1800;
              const percentage = Math.min((day.totals.calories / maxCal) * 100, 100);
              const barHeight = Math.max(percentage, 5); // Minimum 5% for visibility
              
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-24">
                    <span className="text-xs text-muted-foreground mb-1">
                      {day.totals.calories > 0 ? day.totals.calories : ''}
                    </span>
                    <div 
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        day.isToday ? 'bg-accent' : 'bg-accent/40'
                      }`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className={`text-xs ${day.isToday ? 'font-medium text-accent' : 'text-muted-foreground'}`}>
                    {day.day}
                  </span>
                </div>
              );
            })}
          </div>
          
          {/* Target line indicator */}
          {profile.dailyTargets && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <div className="w-4 h-0.5 bg-accent/40" />
              <span className="text-xs text-muted-foreground">
                Target: {profile.dailyTargets.calories} cal/day
              </span>
            </div>
          )}
        </SectionCard>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <SectionCard>
            <div className="text-center">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-accent" />
              <p className="text-2xl font-display font-semibold">
                {Math.round(weekData.reduce((sum, d) => sum + d.totals.protein_g, 0) / 7)}g
              </p>
              <p className="text-xs text-muted-foreground">Avg Daily Protein</p>
            </div>
          </SectionCard>
          <SectionCard>
            <div className="text-center">
              <Target className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-display font-semibold">
                {Math.round(weekData.reduce((sum, d) => sum + d.totals.calories, 0) / 7)}
              </p>
              <p className="text-xs text-muted-foreground">Avg Daily Calories</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </AppLayout>
  );
}
