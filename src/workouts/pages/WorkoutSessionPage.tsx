import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkoutHeader } from '@/workouts/components/WorkoutHeader';
import { ExerciseCard } from '@/workouts/components/ExerciseCard';
import { ExerciseSearch } from '@/workouts/components/ExerciseSearch';
import { RestTimer } from '@/workouts/components/RestTimer';
import { WorkoutsBottomNav } from '@/workouts/components/WorkoutsBottomNav';
import { useWorkoutStore } from '@/workouts/hooks/useWorkoutStore';
import { useRestTimer } from '@/workouts/hooks/useRestTimer';
import type { Workout, Exercise, WorkoutSet } from '@/workouts/types/workout';
import { CORE_EXERCISES } from '@/workouts/types/workout';

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function getLocalISODate() {
  // YYYY-MM-DD in the user's locale (stable for sorting + display)
  return new Date().toLocaleDateString('en-CA');
}

export default function WorkoutSession() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  const {
    templates,
    settings,
    customExercises,
    addWorkout,
    addCustomExercise,
    getLastExerciseData,
    getExerciseHistory,
  } = useWorkoutStore();

  const [workout, setWorkout] = useState<Workout>(() => {
    const template = templates.find(t => t.id === templateId);
    const exercises: Exercise[] = template
      ? template.exercises.map(te => ({
          id: generateId(),
          name: te.name,
          sets: Array.from({ length: te.targetSets }, () => ({
            id: generateId(),
            reps: te.targetReps || 0,
            weight: 0,
            timestamp: 0,
            isCompleted: false,
          })),
          restTimerDuration: te.restTimerDuration,
        }))
      : [];

    return {
      id: generateId(),
      date: getLocalISODate(),
      startTime: Date.now(),
      exercises,
      templateId: templateId || undefined,
    };
  });

  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [lastSetTimestamp, setLastSetTimestamp] = useState<number | null>(null);

  const restTimer = useRestTimer({
    defaultDuration: settings.defaultRestTimer,
    soundEnabled: settings.soundEnabled,
    vibrationEnabled: settings.vibrationEnabled,
    onComplete: () => {
      // Timer completed
    },
  });

  // Pre-populate weights from last workout
  useEffect(() => {
    if (workout.exercises.length > 0) {
      const updatedExercises = workout.exercises.map(exercise => {
        const lastData = getLastExerciseData(exercise.name);
        if (lastData && exercise.sets.every(s => !s.isCompleted && s.weight === 0)) {
          return {
            ...exercise,
            sets: exercise.sets.map(set => ({
              ...set,
              weight: lastData.weight,
              reps: set.reps || lastData.reps,
            })),
          };
        }
        return exercise;
      });

      if (JSON.stringify(updatedExercises) !== JSON.stringify(workout.exercises)) {
        setWorkout(prev => ({ ...prev, exercises: updatedExercises }));
      }
    }
  }, []);

  const handleAddExercise = useCallback(
    (exerciseName: string) => {
      const lastData = getLastExerciseData(exerciseName);

      const newExercise: Exercise = {
        id: generateId(),
        name: exerciseName,
        sets: [
          {
            id: generateId(),
            reps: lastData?.reps || 0,
            weight: lastData?.weight || 0,
            timestamp: 0,
            isCompleted: false,
          },
        ],
      };

      setWorkout(prev => ({
        ...prev,
        exercises: [...prev.exercises, newExercise],
      }));
      setShowExerciseSearch(false);
    },
    [getLastExerciseData],
  );

  const handleUpdateSet = useCallback((exerciseId: string, setId: string, updates: Partial<WorkoutSet>) => {
    setWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.map(e =>
        e.id === exerciseId
          ? {
              ...e,
              sets: e.sets.map(s => (s.id === setId ? { ...s, ...updates } : s)),
            }
          : e,
      ),
    }));
  }, []);

  const handleCompleteSet = useCallback(
    (exerciseId: string, setId: string) => {
      const now = Date.now();
      const restTime = lastSetTimestamp ? Math.floor((now - lastSetTimestamp) / 1000) : undefined;

      setWorkout(prev => ({
        ...prev,
        exercises: prev.exercises.map(e =>
          e.id === exerciseId
            ? {
                ...e,
                sets: e.sets.map(s => (s.id === setId ? { ...s, isCompleted: true, timestamp: now, restTime } : s)),
              }
            : e,
        ),
      }));

      setLastSetTimestamp(now);

      // Find the exercise to get custom rest duration
      const exercise = workout.exercises.find(e => e.id === exerciseId);
      const restDuration = exercise?.restTimerDuration || settings.defaultRestTimer;

      restTimer.start(restDuration);
      setShowRestTimer(true);
    },
    [lastSetTimestamp, settings.defaultRestTimer, restTimer, workout.exercises],
  );

  const handleAddSet = useCallback(
    (exerciseId: string) => {
      const exercise = workout.exercises.find(e => e.id === exerciseId);
      const lastSet = exercise?.sets[exercise.sets.length - 1];

      const newSet: WorkoutSet = {
        id: generateId(),
        reps: lastSet?.reps || 0,
        weight: lastSet?.weight || 0,
        timestamp: 0,
        isCompleted: false,
      };

      setWorkout(prev => ({
        ...prev,
        exercises: prev.exercises.map(e => (e.id === exerciseId ? { ...e, sets: [...e.sets, newSet] } : e)),
      }));
    },
    [workout.exercises],
  );

  const handleDeleteSet = useCallback((exerciseId: string, setId: string) => {
    setWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.map(e => (e.id === exerciseId ? { ...e, sets: e.sets.filter(s => s.id !== setId) } : e)),
    }));
  }, []);

  const handleDeleteExercise = useCallback((exerciseId: string) => {
    setWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.filter(e => e.id !== exerciseId),
    }));
  }, []);

  const handleUpdateExerciseNotes = useCallback((exerciseId: string, notes: string) => {
    setWorkout(prev => ({
      ...prev,
      exercises: prev.exercises.map(e =>
        e.id === exerciseId ? { ...e, notes } : e,
      ),
    }));
  }, []);

  const handleAddRandomCore = useCallback(() => {
    // Shuffle and pick 3 random core exercises
    const shuffled = [...CORE_EXERCISES].sort(() => Math.random() - 0.5);
    const selectedExercises = shuffled.slice(0, 3);

    const newExercises: Exercise[] = selectedExercises.map(name => {
      const lastData = getLastExerciseData(name);
      const isTimeBased = name.includes('Plank') || name.includes('Hold') || name.includes('Carry') || name.includes('Walk');
      
      return {
        id: generateId(),
        name,
        sets: Array.from({ length: 3 }, () => ({
          id: generateId(),
          reps: isTimeBased ? 0 : (lastData?.reps || 12),
          weight: lastData?.weight || 0,
          timestamp: 0,
          isCompleted: false,
        })),
      };
    });

    setWorkout(prev => ({
      ...prev,
      exercises: [...prev.exercises, ...newExercises],
    }));
  }, [getLastExerciseData]);

  const handleFinish = useCallback(() => {
    const finishedWorkout: Workout = {
      ...workout,
      date: workout.date || getLocalISODate(),
      endTime: Date.now(),
    };
    addWorkout(finishedWorkout);
    navigate('/workouts');
  }, [workout, addWorkout, navigate]);

  const handleDiscard = useCallback(() => {
    if (confirm('Discard this workout? All progress will be lost.')) {
      navigate('/workouts');
    }
  }, [navigate]);

  const handleBack = useCallback(() => {
    if (workout.exercises.some(e => e.sets.some(s => s.isCompleted))) {
      if (confirm('Leave workout? Your progress will be saved.')) {
        handleFinish();
      }
    } else {
      handleDiscard();
    }
  }, [workout.exercises, handleFinish, handleDiscard]);

  const handleSkipTimer = useCallback(() => {
    restTimer.skip();
    setShowRestTimer(false);
  }, [restTimer]);

  return (
    <div className="min-h-screen bg-background pb-40">
      <WorkoutHeader
        title={templates.find(t => t.id === templateId)?.name || 'Workout'}
        startTime={workout.startTime}
        onBack={handleBack}
        onFinish={handleFinish}
        onDiscard={handleDiscard}
      />

      <div className="p-4 space-y-4">
        {workout.exercises.map(exercise => {
          const history = getExerciseHistory(exercise.name);
          const lastData = getLastExerciseData(exercise.name);
          const maxWeight = history?.personalRecords.maxWeight.value || 0;
          const isPR = exercise.sets.some(s => s.isCompleted && s.weight > maxWeight);

          return (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              previousData={lastData}
              onUpdateSet={(setId, updates) => handleUpdateSet(exercise.id, setId, updates)}
              onUpdateNotes={(notes) => handleUpdateExerciseNotes(exercise.id, notes)}
              onAddSet={() => handleAddSet(exercise.id)}
              onDeleteSet={setId => handleDeleteSet(exercise.id, setId)}
              onCompleteSet={setId => handleCompleteSet(exercise.id, setId)}
              onDeleteExercise={() => handleDeleteExercise(exercise.id)}
              onViewHistory={() => navigate(`/workouts/exercise/${encodeURIComponent(exercise.name)}`)}
              weightUnit={settings.weightUnit}
              isPR={isPR}
            />
          );
        })}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-14" onClick={() => setShowExerciseSearch(true)}>
            <Plus className="h-5 w-5 mr-2" />
            Add Exercise
          </Button>
          <Button variant="secondary" className="h-14 px-4" onClick={handleAddRandomCore}>
            <Shuffle className="h-5 w-5 mr-2" />
            Random Core
          </Button>
        </div>
      </div>

      {showExerciseSearch && (
        <ExerciseSearch
          customExercises={customExercises}
          onSelect={handleAddExercise}
          onClose={() => setShowExerciseSearch(false)}
          onAddCustom={addCustomExercise}
        />
      )}

      {showRestTimer && (restTimer.isRunning || restTimer.timeRemaining === 0) && (
        <RestTimer
          isRunning={restTimer.isRunning}
          timeRemaining={restTimer.timeRemaining}
          totalDuration={restTimer.totalDuration}
          progress={restTimer.progress}
          onPause={restTimer.pause}
          onResume={restTimer.resume}
          onSkip={handleSkipTimer}
          onAddTime={restTimer.addTime}
        />
      )}
      <WorkoutsBottomNav />
    </div>
  );
}
