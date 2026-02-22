import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, TrendingUp, Calendar, Dumbbell, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWorkoutStore } from '@/workouts/hooks/useWorkoutStore';
import { ExerciseProgressChart } from '@/workouts/components/ExerciseProgressChart';
import { cn } from '@/lib/utils';

export default function ExerciseHistory() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { getExerciseHistory, settings } = useWorkoutStore();

  const exerciseName = decodeURIComponent(name || '');
  const history = getExerciseHistory(exerciseName);

  if (!history) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center h-14 px-4">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-3 font-semibold text-foreground">{exerciseName}</h1>
          </div>
        </header>
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          No history found for this exercise
        </div>
      </div>
    );
  }

  const { personalRecords, records } = history;

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center h-14 px-4">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-3 font-semibold text-foreground">{exerciseName}</h1>
        </div>
      </header>

      {/* Personal Records */}
      <div className="p-4">
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-accent" />
          Personal Records
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Max Weight</p>
            <p className="text-xl font-bold text-foreground">
              {personalRecords.maxWeight.value}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {settings.weightUnit}
              </span>
            </p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Max Reps</p>
            <p className="text-xl font-bold text-foreground">
              {personalRecords.maxReps.value}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                @ {personalRecords.maxReps.weight}
              </span>
            </p>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border text-center">
            <p className="text-xs text-muted-foreground mb-1">Best Volume</p>
            <p className="text-xl font-bold text-foreground">
              {personalRecords.maxVolume.value >= 1000
                ? `${(personalRecords.maxVolume.value / 1000).toFixed(1)}k`
                : personalRecords.maxVolume.value}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Charts */}
      <div className="px-4 mb-4">
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Progress Over Time
        </h2>
        <div className="bg-card rounded-xl border border-border p-4">
          <ExerciseProgressChart records={records} weightUnit={settings.weightUnit} />
        </div>
      </div>

      {/* Suggestion */}
      {records.length > 0 && records[0].sets.length > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Suggestion for next time</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Last session: {records[0].sets.length} sets × {records[0].sets[0].reps} reps @ {records[0].sets[0].weight}{settings.weightUnit}
                  {records[0].sets.every(s => s.reps >= 8) && (
                    <span className="block text-primary mt-1">
                      → Try {records[0].sets[0].weight + (settings.weightUnit === 'lb' ? 5 : 2.5)}{settings.weightUnit} next time!
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="px-4">
        <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          History
        </h2>
        <div className="space-y-3">
          {records.map((record, index) => (
            <div key={index} className="bg-card rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium text-foreground">
                  {new Date(`${record.date}T00:00:00`).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Dumbbell className="h-4 w-4" />
                  <span>{record.totalVolume.toLocaleString()} {settings.weightUnit}</span>
                </div>
              </div>
              <div className="space-y-1">
                {record.sets.map((set, setIndex) => (
                  <div key={setIndex} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground w-8">#{setIndex + 1}</span>
                    <span className="text-foreground font-medium">
                      {set.weight}{settings.weightUnit} × {set.reps}
                    </span>
                    {set.weight === personalRecords.maxWeight.value && (
                      <Trophy className="h-3 w-3 text-accent" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
