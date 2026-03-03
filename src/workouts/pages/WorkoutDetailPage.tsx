import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Dumbbell, Trash2, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkoutsBottomNav } from '@/workouts/components/WorkoutsBottomNav';
import { useWorkoutStore } from '@/workouts/hooks/useWorkoutStore';

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workouts, deleteWorkout, settings } = useWorkoutStore();

  const workout = workouts.find(w => w.id === id);

  if (!workout) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="flex items-center h-14 px-4">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-3 font-semibold text-foreground">Workout Not Found</h1>
          </div>
        </header>
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          This workout doesn't exist
        </div>
      </div>
    );
  }

  const duration = workout.endTime 
    ? Math.floor((workout.endTime - workout.startTime) / 1000 / 60)
    : 0;

  const totalSets = workout.exercises.reduce((sum, e) => 
    sum + e.sets.filter(s => s.isCompleted).length, 0
  );

  const totalVolume = workout.exercises.reduce((sum, e) =>
    sum + e.sets.filter(s => s.isCompleted).reduce((sSum, s) => sSum + s.weight * s.reps, 0), 0
  );

  const handleDelete = () => {
    if (confirm('Delete this workout?')) {
      deleteWorkout(workout.id);
      navigate('/workouts/progress');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-3 font-semibold text-foreground">Workout Details</h1>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={handleDelete}>
            <Trash2 className="h-5 w-5 text-destructive" />
          </Button>
        </div>
      </header>

      {/* Summary */}
      <div className="p-4">
        <div className="bg-card rounded-xl border border-border p-4 mb-4">
          <p className="text-lg font-semibold text-foreground mb-2">
            {new Date(`${workout.date}T00:00:00`).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{duration} min</span>
            </div>
            <div className="flex items-center gap-1">
              <Dumbbell className="h-4 w-4" />
              <span>{totalSets} sets</span>
            </div>
            <span>{totalVolume.toLocaleString()} {settings.weightUnit}</span>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-4">
          {workout.exercises.map((exercise) => {
            const completedSets = exercise.sets.filter(s => s.isCompleted);
            if (completedSets.length === 0) return null;

            return (
              <div key={exercise.id} className="bg-card rounded-xl border border-border p-4">
                <h3 className="font-semibold text-foreground mb-3">{exercise.name}</h3>
                <div className="space-y-2">
                  {completedSets.map((set, index) => (
                    <div key={set.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Set {index + 1}</span>
                      <span className="font-medium text-foreground">
                        {set.weight}{settings.weightUnit} × {set.reps} reps
                      </span>
                    </div>
                  ))}
                </div>
                {exercise.notes && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <StickyNote className="h-3 w-3" />
                      <span>Note:</span>
                    </div>
                    <p className="text-sm text-foreground">{exercise.notes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <WorkoutsBottomNav />
    </div>
  );
}
