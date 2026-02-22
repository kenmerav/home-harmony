import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, TrendingUp, Calendar, Dumbbell, Flame, Scale, Plus } from 'lucide-react';
import { useWorkoutStore } from '@/workouts/hooks/useWorkoutStore';
import { AddWeightModal } from '@/workouts/components/AddWeightModal';
import { WeightChart } from '@/workouts/components/WeightChart';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type TimeRange = 'week' | 'month' | 'all';

export default function Progress() {
  const { workouts, settings, weightLogs, addWeightLog, isLoaded } = useWorkoutStore();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [showWeightModal, setShowWeightModal] = useState(false);

  const stats = useMemo(() => {
    if (!isLoaded) return null;

    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0);
    }

    const filteredWorkouts = workouts.filter(w => new Date(`${w.date}T00:00:00`) >= startDate);
    
    const totalSets = filteredWorkouts.reduce((sum, w) => 
      sum + w.exercises.reduce((eSum, e) => eSum + e.sets.filter(s => s.isCompleted).length, 0), 0
    );
    
    const totalVolume = filteredWorkouts.reduce((sum, w) =>
      sum + w.exercises.reduce((eSum, e) => 
        eSum + e.sets.filter(s => s.isCompleted).reduce((sSum, s) => sSum + s.weight * s.reps, 0), 0
      ), 0
    );

    const totalReps = filteredWorkouts.reduce((sum, w) =>
      sum + w.exercises.reduce((eSum, e) => 
        eSum + e.sets.filter(s => s.isCompleted).reduce((sSum, s) => sSum + s.reps, 0), 0
      ), 0
    );

    // Exercise frequency
    const exerciseCounts: Record<string, number> = {};
    filteredWorkouts.forEach(w => {
      w.exercises.forEach(e => {
        exerciseCounts[e.name] = (exerciseCounts[e.name] || 0) + 1;
      });
    });

    const topExercises = Object.entries(exerciseCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      workoutCount: filteredWorkouts.length,
      totalSets,
      totalVolume,
      totalReps,
      topExercises,
    };
  }, [workouts, isLoaded, timeRange]);

  const latestWeight = useMemo(() => {
    if (weightLogs.length === 0) return null;
    return [...weightLogs].sort((a, b) => 
      new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime()
    )[0];
  }, [weightLogs]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="px-4 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-foreground">Progress</h1>
        <p className="text-muted-foreground mt-1">Track your training journey</p>
      </header>

      {/* Time range selector */}
      <div className="px-4 mb-6">
        <div className="flex bg-muted rounded-xl p-1">
          {(['week', 'month', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all",
                timeRange === range
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range === 'week' ? '7 Days' : range === 'month' ? '30 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Body Weight Section */}
      <div className="px-4 mb-6">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Body Weight</h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowWeightModal(true)}
              className="h-8"
            >
              <Plus className="h-4 w-4 mr-1" />
              Log
            </Button>
          </div>
          
          {latestWeight && (
            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-2xl font-bold text-foreground">
                {latestWeight.weight}
              </span>
              <span className="text-muted-foreground">{settings.weightUnit}</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {new Date(`${latestWeight.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          )}
          
          <WeightChart weightLogs={weightLogs} weightUnit={settings.weightUnit} />
        </div>
      </div>

      {stats && (
        <>
          {/* Stats Grid */}
          <div className="px-4 mb-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Workouts</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.workoutCount}</p>
              </div>

              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Dumbbell className="h-4 w-4 text-success" />
                  <span className="text-xs font-medium">Total Sets</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalSets}</p>
              </div>

              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">Volume</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalVolume >= 1000 
                    ? `${(stats.totalVolume / 1000).toFixed(1)}k` 
                    : stats.totalVolume
                  }
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    {settings.weightUnit}
                  </span>
                </p>
              </div>

              <div className="bg-card rounded-xl p-4 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Flame className="h-4 w-4 text-accent" />
                  <span className="text-xs font-medium">Total Reps</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalReps}</p>
              </div>
            </div>
          </div>

          {/* Top Exercises */}
          {stats.topExercises.length > 0 && (
            <div className="px-4 mb-6">
              <h2 className="font-semibold text-foreground mb-3">Most Trained</h2>
              <div className="space-y-2">
                {stats.topExercises.map(([name, count]) => (
                  <Link
                    key={name}
                    to={`/workouts/exercise/${encodeURIComponent(name)}`}
                    className={cn(
                      "flex items-center justify-between p-4 rounded-xl bg-card border border-border",
                      "hover:bg-card/80 transition-colors"
                    )}
                  >
                    <div>
                      <p className="font-medium text-foreground">{name}</p>
                      <p className="text-sm text-muted-foreground">{count} sessions</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recent Workouts */}
          <div className="px-4">
            <h2 className="font-semibold text-foreground mb-3">Workout History</h2>
            {workouts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No workouts recorded yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {workouts.slice(0, 10).map(workout => {
                  const volume = workout.exercises.reduce((sum, e) =>
                    sum + e.sets.filter(s => s.isCompleted).reduce((sSum, s) => sSum + s.weight * s.reps, 0), 0
                  );
                  const sets = workout.exercises.reduce((sum, e) => 
                    sum + e.sets.filter(s => s.isCompleted).length, 0
                  );

                  return (
                    <Link
                      key={workout.id}
                      to={`/workouts/${workout.id}`}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl bg-card border border-border",
                        "hover:bg-card/80 transition-colors"
                      )}
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {new Date(`${workout.date}T00:00:00`).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {workout.exercises.length} exercises • {sets} sets • {volume.toLocaleString()} {settings.weightUnit}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <AddWeightModal
        open={showWeightModal}
        onClose={() => setShowWeightModal(false)}
        onSave={(log) => addWeightLog({ ...log, id: crypto.randomUUID() })}
        weightUnit={settings.weightUnit}
        lastWeight={latestWeight?.weight}
      />
    </div>
  );
}
