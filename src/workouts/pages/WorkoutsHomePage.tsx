import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Flame, TrendingUp, Calendar, ChevronRight, Dumbbell, Shuffle, Footprints, Bike, PersonStanding, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddCardioModal } from '@/workouts/components/AddCardioModal';
import { WorkoutsBottomNav } from '@/workouts/components/WorkoutsBottomNav';
import { useWorkoutStore } from '@/workouts/hooks/useWorkoutStore';
import { cn } from '@/lib/utils';
import { CORE_EXERCISES, type CardioSession } from '@/workouts/types/workout';

const CARDIO_ICONS: Record<CardioSession['type'], React.ElementType> = {
  run: Footprints,
  walk: PersonStanding,
  bike: Bike,
  other: Activity,
};

export default function Index() {
  const navigate = useNavigate();
  const { workouts, templates, settings, isLoaded, addTemplate, cardioSessions, addCardioSession } = useWorkoutStore();
  const [showCardioModal, setShowCardioModal] = useState(false);

  const stats = useMemo(() => {
    if (!isLoaded) return null;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weekWorkouts = workouts.filter(w => new Date(`${w.date}T00:00:00`) >= weekAgo);
    const totalSets = weekWorkouts.reduce((sum, w) => 
      sum + w.exercises.reduce((eSum, e) => eSum + e.sets.filter(s => s.isCompleted).length, 0), 0
    );
    const totalVolume = weekWorkouts.reduce((sum, w) =>
      sum + w.exercises.reduce((eSum, e) => 
        eSum + e.sets.filter(s => s.isCompleted).reduce((sSum, s) => sSum + s.weight * s.reps, 0), 0
      ), 0
    );

    // Calculate streak (Sundays don't count - only Mon-Sat matter)
    let streak = 0;
    const workoutDates = new Set(workouts.map(w => w.date));
    const today = new Date();
    
    // Check backwards from today, skipping Sundays
    const checkDate = new Date(today);
    let foundFirstWorkout = false;
    
    // First, find the most recent workout day (could be today or earlier)
    while (!foundFirstWorkout && checkDate >= new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)) {
      const dateStr = checkDate.toLocaleDateString('en-CA');
      const dayOfWeek = checkDate.getDay(); // 0 = Sunday
      
      if (workoutDates.has(dateStr)) {
        foundFirstWorkout = true;
        break;
      } else if (dayOfWeek !== 0) {
        // Missed a Mon-Sat day, no streak
        break;
      }
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    if (foundFirstWorkout) {
      // Count backwards from the first workout day
      while (checkDate >= new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000)) {
        const dateStr = checkDate.toLocaleDateString('en-CA');
        const dayOfWeek = checkDate.getDay(); // 0 = Sunday
        
        if (dayOfWeek === 0) {
          // Sunday - skip it, doesn't affect streak
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        
        if (workoutDates.has(dateStr)) {
          streak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          // Missed a Mon-Sat day, streak ends
          break;
        }
      }
    }

    return {
      weekWorkouts: weekWorkouts.length,
      totalSets,
      totalVolume,
      streak,
    };
  }, [workouts, isLoaded]);

  const recentWorkouts = workouts.slice(0, 3);

  const handleRandomCoreWorkout = () => {
    // Shuffle and pick 4-6 random core exercises
    const shuffled = [...CORE_EXERCISES].sort(() => Math.random() - 0.5);
    const numExercises = 4 + Math.floor(Math.random() * 3); // 4-6 exercises
    const selectedExercises = shuffled.slice(0, numExercises);
    
    // Create a temporary template
    const templateId = `random-core-${Date.now()}`;
    addTemplate({
      id: templateId,
      name: 'Random Core Workout',
      exercises: selectedExercises.map(name => ({
        name,
        targetSets: 3,
        targetReps: name.includes('Plank') || name.includes('Hold') || name.includes('Carry') || name.includes('Walk') ? undefined : 12,
      })),
      createdAt: Date.now(),
    });
    
    navigate(`/workouts/new?template=${templateId}`);
  };

  const handleSaveCardio = (session: Omit<CardioSession, 'id'>) => {
    addCardioSession({
      ...session,
      id: `cardio-${Date.now()}`,
    });
  };

  const recentCardio = cardioSessions.slice(0, 3);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-40">
      {/* Header */}
      <header className="px-4 pt-8 pb-6">
        <h1 className="text-3xl font-bold text-foreground">LiftLog</h1>
        <p className="text-muted-foreground mt-1">Track your gains</p>
      </header>

      {/* Quick Start */}
      <div className="px-4 mb-6 space-y-3">
        <Link to="/workouts/new">
          <Button className="w-full h-16 text-lg" size="xl">
            <Plus className="h-6 w-6 mr-2" />
            Start Workout
          </Button>
        </Link>
        <div className="flex gap-3">
          <Button 
            variant="secondary" 
            className="flex-1 h-12" 
            onClick={handleRandomCoreWorkout}
          >
            <Shuffle className="h-5 w-5 mr-2" />
            Random Core
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 h-12" 
            onClick={() => setShowCardioModal(true)}
          >
            <Footprints className="h-5 w-5 mr-2" />
            Add Cardio
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="px-4 mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Flame className="h-4 w-4 text-accent" />
                <span className="text-xs font-medium">Streak</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.streak} <span className="text-sm font-normal text-muted-foreground">days</span>
              </p>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">This Week</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.weekWorkouts} <span className="text-sm font-normal text-muted-foreground">workouts</span>
              </p>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Dumbbell className="h-4 w-4 text-success" />
                <span className="text-xs font-medium">Sets</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalSets}
              </p>
            </div>

            <div className="bg-card rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium">Volume</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {(stats.totalVolume / 1000).toFixed(1)}k <span className="text-sm font-normal text-muted-foreground">{settings.weightUnit}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Templates Quick Access */}
      {templates.length > 0 && (
        <div className="px-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-foreground">Quick Start</h2>
            <Link to="/workouts/templates" className="text-sm text-primary">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {templates.slice(0, 4).map(template => (
              <Link
                key={template.id}
                to={`/workouts/new?template=${template.id}`}
                className={cn(
                  "min-w-0 p-4 rounded-xl bg-secondary border border-border",
                  "hover:bg-secondary/80 transition-colors"
                )}
              >
                <h3 className="font-medium text-foreground truncate">{template.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {template.exercises.length} exercises
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Workouts */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">Recent Activity</h2>
          <Link to="/workouts/progress" className="text-sm text-primary">View all</Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Dumbbell className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No workouts yet</p>
            <p className="text-sm">Start your first workout to see it here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentWorkouts.map(workout => (
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
                    {workout.exercises.length} exercises • {
                      workout.exercises.reduce((sum, e) => sum + e.sets.filter(s => s.isCompleted).length, 0)
                    } sets
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recent Cardio */}
      {recentCardio.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="font-semibold text-foreground mb-3">Recent Cardio</h2>
          <div className="space-y-2">
            {recentCardio.map(session => {
              const Icon = CARDIO_ICONS[session.type];
              return (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-card border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground capitalize">{session.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(`${session.date}T00:00:00`).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">{session.duration} min</p>
                    {session.distance > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {session.distance} {settings.distanceUnit}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AddCardioModal
        isOpen={showCardioModal}
        onClose={() => setShowCardioModal(false)}
        onSave={handleSaveCardio}
        distanceUnit={settings.distanceUnit}
      />
      <WorkoutsBottomNav />
    </div>
  );
}
