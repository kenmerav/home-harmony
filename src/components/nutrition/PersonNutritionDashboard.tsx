import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { MacroBar } from '@/components/ui/MacroBar';
import { Button } from '@/components/ui/button';
import { AdultId, getCurrentStreak, getDailyScore, getMealLogs, getProfiles, getWeekPoints } from '@/lib/macroGame';
import { Flame, Plus, Target, Trophy, TrendingUp } from 'lucide-react';
import { MacroGoalDialog } from './MacroGoalDialog';

interface PersonNutritionDashboardProps {
  personId: AdultId;
  accent: 'primary' | 'accent';
}

export function PersonNutritionDashboard({ personId, accent }: PersonNutritionDashboardProps) {
  const [, setRefreshTick] = useState(0);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const todayKey = format(new Date(), 'yyyy-MM-dd');

  const profile = getProfiles()[personId];
  const allLogs = getMealLogs();
  const todaysLogs = allLogs.filter((log) => log.date === todayKey && log.person === personId);
  const todayScore = getDailyScore(personId, todayKey);
  const currentStreak = getCurrentStreak(personId);
  const weekPoints = getWeekPoints(personId);
  const targetCalories = profile.macroPlan.calories || 2000;

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'yyyy-MM-dd');
    const score = getDailyScore(personId, dateStr);
    return {
      day: format(date, 'EEE'),
      date: dateStr,
      calories: score.calories,
      protein_g: score.protein_g,
      isToday: dateStr === todayKey,
    };
  });

  const averageProtein = Math.round(weekData.reduce((sum, day) => sum + day.protein_g, 0) / weekData.length);
  const averageCalories = Math.round(weekData.reduce((sum, day) => sum + day.calories, 0) / weekData.length);
  const accentBar = accent === 'primary' ? 'bg-primary' : 'bg-accent';
  const accentBarMuted = accent === 'primary' ? 'bg-primary/40' : 'bg-accent/40';
  const accentText = accent === 'primary' ? 'text-primary' : 'text-accent';

  return (
    <AppLayout>
      <PageHeader
        title={profile.name}
        subtitle="Daily macro tracking and habit streaks"
        action={
          <Button size="sm" onClick={() => setGoalDialogOpen(true)}>
            <Target className="w-4 h-4 mr-2" />
            Set Goals
          </Button>
        }
      />

      <div className="space-y-6">
        <SectionCard title="Today's Progress">
          <MacroBar
            current={{
              calories: todayScore.calories,
              protein_g: todayScore.protein_g,
              carbs_g: todayScore.carbs_g,
              fat_g: todayScore.fat_g,
            }}
            target={{
              calories: profile.macroPlan.calories,
              protein_g: profile.macroPlan.protein_g,
              carbs_g: profile.macroPlan.carbs_g,
              fat_g: profile.macroPlan.fat_g,
            }}
          />
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <MetricPill label="Points" value={`${todayScore.points}`} highlight />
            <MetricPill label="Streak" value={`${currentStreak} days`} />
            <MetricPill label="Water" value={`${todayScore.waterOz}/${profile.macroPlan.waterTargetOz} oz`} />
            <MetricPill label="Alcohol" value={`${todayScore.alcoholDrinks}/${profile.macroPlan.alcoholLimitDrinks}`} />
          </div>
        </SectionCard>

        <SectionCard
          title="Today's Meals"
          action={
            <Link to="/app">
              <Button variant="ghost" size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Quick Add
              </Button>
            </Link>
          }
        >
          {todaysLogs.length > 0 ? (
            <div className="space-y-3">
              {todaysLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium text-sm">{log.recipeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.servings} serving{log.servings !== 1 ? 's' : ''}
                      {log.isQuickAdd && ' • Quick Add'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">{Math.round(log.macros.calories)} cal</p>
                    <p className="text-xs text-muted-foreground">{Math.round(log.macros.protein_g)}g protein</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-6 text-muted-foreground">No meals logged today.</p>
          )}
        </SectionCard>

        <SectionCard title="This Week" subtitle="Calories vs target">
          <div className="flex items-end justify-between gap-2 h-32">
            {weekData.map((day) => {
              const percentage = Math.min((day.calories / targetCalories) * 100, 100);
              const barHeight = Math.max(percentage, 5);

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-24">
                    <span className="text-xs text-muted-foreground mb-1">{day.calories > 0 ? day.calories : ''}</span>
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${day.isToday ? accentBar : accentBarMuted}`}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <span className={`text-xs ${day.isToday ? `font-medium ${accentText}` : 'text-muted-foreground'}`}>
                    {day.day}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
            <div className={`w-4 h-0.5 ${accentBarMuted}`} />
            <span className="text-xs text-muted-foreground">Target: {targetCalories} cal/day</span>
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SectionCard>
            <div className="text-center">
              <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${accentText}`} />
              <p className="text-2xl font-display font-semibold">{averageProtein}g</p>
              <p className="text-xs text-muted-foreground">Avg Daily Protein</p>
            </div>
          </SectionCard>
          <SectionCard>
            <div className="text-center">
              <Target className={`w-6 h-6 mx-auto mb-2 ${accentText}`} />
              <p className="text-2xl font-display font-semibold">{averageCalories}</p>
              <p className="text-xs text-muted-foreground">Avg Daily Calories</p>
            </div>
          </SectionCard>
          <SectionCard>
            <div className="text-center">
              <Trophy className={`w-6 h-6 mx-auto mb-2 ${accentText}`} />
              <p className="text-2xl font-display font-semibold">{weekPoints}</p>
              <p className="text-xs text-muted-foreground">Week Points</p>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Game Mode">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-border px-3 py-1">
              {profile.macroPlan.proteinOnlyMode ? 'Protein-only mode' : 'Full macro mode'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1">
              <Flame className="w-4 h-4 text-orange-500" />
              {currentStreak} day streak
            </span>
            <span className="rounded-full border border-border px-3 py-1">
              Goal: {profile.macroPlan.questionnaire.goal.replace('_', ' ')}
            </span>
          </div>
        </SectionCard>
      </div>

      <MacroGoalDialog
        personId={personId}
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        onSaved={() => setRefreshTick((prev) => prev + 1)}
      />
    </AppLayout>
  );
}

function MetricPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${highlight ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground'}`}
    >
      <p className="uppercase tracking-wide text-[10px]">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}
