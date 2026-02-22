import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import type { Workout, WorkoutTemplate, AppSettings, ExerciseHistory, CardioSession, WeightLog } from '@/workouts/types/workout';

const STORAGE_KEYS = {
  workouts: 'liftlog_workouts',
  templates: 'liftlog_templates',
  settings: 'liftlog_settings',
  exerciseHistory: 'liftlog_exercise_history',
  customExercises: 'liftlog_custom_exercises',
  cardioSessions: 'liftlog_cardio_sessions',
  weightLogs: 'liftlog_weight_logs',
};

const DEFAULT_SETTINGS: AppSettings = {
  defaultRestTimer: 90,
  weightUnit: 'lb',
  distanceUnit: 'mi',
  soundEnabled: true,
  vibrationEnabled: true,
};

function useWorkoutStoreInternal() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [customExercises, setCustomExercises] = useState<string[]>([]);
  const [cardioSessions, setCardioSessions] = useState<CardioSession[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const loadedWorkouts = localStorage.getItem(STORAGE_KEYS.workouts);
    const loadedTemplates = localStorage.getItem(STORAGE_KEYS.templates);
    const loadedSettings = localStorage.getItem(STORAGE_KEYS.settings);
    const loadedCustomExercises = localStorage.getItem(STORAGE_KEYS.customExercises);
    const loadedCardioSessions = localStorage.getItem(STORAGE_KEYS.cardioSessions);
    const loadedWeightLogs = localStorage.getItem(STORAGE_KEYS.weightLogs);

    if (loadedWorkouts) setWorkouts(JSON.parse(loadedWorkouts));
    if (loadedTemplates) setTemplates(JSON.parse(loadedTemplates));
    if (loadedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(loadedSettings) });
    if (loadedCustomExercises) setCustomExercises(JSON.parse(loadedCustomExercises));
    if (loadedCardioSessions) setCardioSessions(JSON.parse(loadedCardioSessions));
    if (loadedWeightLogs) setWeightLogs(JSON.parse(loadedWeightLogs));

    setIsLoaded(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEYS.workouts, JSON.stringify(workouts));
  }, [workouts, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
  }, [templates, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEYS.customExercises, JSON.stringify(customExercises));
  }, [customExercises, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEYS.cardioSessions, JSON.stringify(cardioSessions));
  }, [cardioSessions, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    localStorage.setItem(STORAGE_KEYS.weightLogs, JSON.stringify(weightLogs));
  }, [weightLogs, isLoaded]);

  const addWorkout = useCallback((workout: Workout) => {
    setWorkouts(prev => [workout, ...prev]);
  }, []);

  const updateWorkout = useCallback((id: string, updates: Partial<Workout>) => {
    setWorkouts(prev => prev.map(w => (w.id === id ? { ...w, ...updates } : w)));
  }, []);

  const deleteWorkout = useCallback((id: string) => {
    setWorkouts(prev => prev.filter(w => w.id !== id));
  }, []);

  const addTemplate = useCallback((template: WorkoutTemplate) => {
    setTemplates(prev => [template, ...prev]);
  }, []);

  const updateTemplate = useCallback((id: string, updates: Partial<WorkoutTemplate>) => {
    setTemplates(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const addCustomExercise = useCallback((name: string) => {
    setCustomExercises(prev => [...new Set([...prev, name])]);
  }, []);

  const addCardioSession = useCallback((session: CardioSession) => {
    setCardioSessions(prev => [session, ...prev]);
  }, []);

  const deleteCardioSession = useCallback((id: string) => {
    setCardioSessions(prev => prev.filter(s => s.id !== id));
  }, []);

  const addWeightLog = useCallback((log: WeightLog) => {
    setWeightLogs(prev => {
      // Replace if same date exists, otherwise add
      const filtered = prev.filter(l => l.date !== log.date);
      return [log, ...filtered];
    });
  }, []);

  const deleteWeightLog = useCallback((id: string) => {
    setWeightLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  const getExerciseHistory = useCallback(
    (exerciseName: string): ExerciseHistory | null => {
      const records = workouts
        .flatMap(w =>
          w.exercises
            .filter(e => e.name.toLowerCase() === exerciseName.toLowerCase())
            .map(e => ({
              date: w.date,
              sets: e.sets.filter(s => s.isCompleted),
              maxWeight: Math.max(...e.sets.filter(s => s.isCompleted).map(s => s.weight), 0),
              maxReps: Math.max(...e.sets.filter(s => s.isCompleted).map(s => s.reps), 0),
              totalVolume: e.sets
                .filter(s => s.isCompleted)
                .reduce((sum, s) => sum + s.weight * s.reps, 0),
            })),
        )
        .filter(r => r.sets.length > 0)
        .sort((a, b) => new Date(`${b.date}T00:00:00`).getTime() - new Date(`${a.date}T00:00:00`).getTime());

      if (records.length === 0) return null;

      const allSets = records.flatMap(r => r.sets.map(s => ({ ...s, date: r.date })));

      const maxWeightSet = allSets.reduce(
        (max, s) => (s.weight > max.weight ? s : max),
        allSets[0],
      );
      const maxRepsSet = allSets.reduce((max, s) => (s.reps > max.reps ? s : max), allSets[0]);
      const maxVolumeRecord = records.reduce(
        (max, r) => (r.totalVolume > max.totalVolume ? r : max),
        records[0],
      );

      return {
        exerciseName,
        records,
        personalRecords: {
          maxWeight: { value: maxWeightSet.weight, date: (maxWeightSet as any).date },
          maxReps: {
            value: maxRepsSet.reps,
            weight: maxRepsSet.weight,
            date: (maxRepsSet as any).date,
          },
          maxVolume: { value: maxVolumeRecord.totalVolume, date: maxVolumeRecord.date },
        },
      };
    },
    [workouts],
  );

  const getLastExerciseData = useCallback(
    (exerciseName: string) => {
      for (const workout of workouts) {
        const exercise = workout.exercises.find(e => e.name.toLowerCase() === exerciseName.toLowerCase());
        if (exercise && exercise.sets.some(s => s.isCompleted)) {
          const completedSets = exercise.sets.filter(s => s.isCompleted);
          return {
            weight: completedSets[0]?.weight || 0,
            reps: completedSets[0]?.reps || 0,
            sets: completedSets.length,
            notes: exercise.notes,
          };
        }
      }
      return null;
    },
    [workouts],
  );

  return {
    workouts,
    templates,
    settings,
    customExercises,
    cardioSessions,
    weightLogs,
    isLoaded,
    addWorkout,
    updateWorkout,
    deleteWorkout,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    updateSettings,
    addCustomExercise,
    addCardioSession,
    deleteCardioSession,
    addWeightLog,
    deleteWeightLog,
    getExerciseHistory,
    getLastExerciseData,
  };
}

type WorkoutStoreValue = ReturnType<typeof useWorkoutStoreInternal>;

const WorkoutStoreContext = createContext<WorkoutStoreValue | null>(null);

export function WorkoutStoreProvider({ children }: { children: ReactNode }) {
  const store = useWorkoutStoreInternal();
  return <WorkoutStoreContext.Provider value={store}>{children}</WorkoutStoreContext.Provider>;
}

export function useWorkoutStore(): WorkoutStoreValue {
  const ctx = useContext(WorkoutStoreContext);
  if (!ctx) throw new Error('useWorkoutStore must be used within a WorkoutStoreProvider');
  return ctx;
}

