import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Workout, WorkoutTemplate, AppSettings, ExerciseHistory, CardioSession, WeightLog } from '@/workouts/types/workout';
import { mergeStarterTemplates } from '@/workouts/data/starterTemplates';

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

type PersistedWorkoutState = {
  schemaVersion: number;
  workouts: Workout[];
  templates: WorkoutTemplate[];
  settings: AppSettings;
  customExercises: string[];
  cardioSessions: CardioSession[];
  weightLogs: WeightLog[];
};

const STATE_SCHEMA_VERSION = 1;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function fromLocalStorage(): PersistedWorkoutState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    workouts: readJson<Workout[]>(STORAGE_KEYS.workouts, []),
    templates: readJson<WorkoutTemplate[]>(STORAGE_KEYS.templates, []),
    settings: { ...DEFAULT_SETTINGS, ...readJson<Partial<AppSettings>>(STORAGE_KEYS.settings, {}) },
    customExercises: readJson<string[]>(STORAGE_KEYS.customExercises, []),
    cardioSessions: readJson<CardioSession[]>(STORAGE_KEYS.cardioSessions, []),
    weightLogs: readJson<WeightLog[]>(STORAGE_KEYS.weightLogs, []),
  };
}

function toLocalStorage(state: PersistedWorkoutState) {
  writeJson(STORAGE_KEYS.workouts, state.workouts);
  writeJson(STORAGE_KEYS.templates, state.templates);
  writeJson(STORAGE_KEYS.settings, state.settings);
  writeJson(STORAGE_KEYS.customExercises, state.customExercises);
  writeJson(STORAGE_KEYS.cardioSessions, state.cardioSessions);
  writeJson(STORAGE_KEYS.weightLogs, state.weightLogs);
}

function hasAnyWorkoutData(state: PersistedWorkoutState): boolean {
  return (
    state.workouts.length > 0 ||
    state.templates.length > 0 ||
    state.customExercises.length > 0 ||
    state.cardioSessions.length > 0 ||
    state.weightLogs.length > 0
  );
}

function coerceRemoteState(raw: unknown): PersistedWorkoutState | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<PersistedWorkoutState>;

  return {
    schemaVersion:
      typeof value.schemaVersion === 'number' && Number.isFinite(value.schemaVersion)
        ? Math.round(value.schemaVersion)
        : STATE_SCHEMA_VERSION,
    workouts: Array.isArray(value.workouts) ? (value.workouts as Workout[]) : [],
    templates: Array.isArray(value.templates) ? (value.templates as WorkoutTemplate[]) : [],
    settings: {
      ...DEFAULT_SETTINGS,
      ...(value.settings && typeof value.settings === 'object' ? (value.settings as Partial<AppSettings>) : {}),
    },
    customExercises: Array.isArray(value.customExercises) ? (value.customExercises as string[]) : [],
    cardioSessions: Array.isArray(value.cardioSessions) ? (value.cardioSessions as CardioSession[]) : [],
    weightLogs: Array.isArray(value.weightLogs) ? (value.weightLogs as WeightLog[]) : [],
  };
}

function useWorkoutStoreInternal() {
  const { user, isDemoUser } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [customExercises, setCustomExercises] = useState<string[]>([]);
  const [cardioSessions, setCardioSessions] = useState<CardioSession[]>([]);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const persistTimerRef = useRef<number | null>(null);

  const applyState = useCallback((state: PersistedWorkoutState) => {
    const hydratedTemplates = mergeStarterTemplates(state.templates);
    setWorkouts(state.workouts);
    setTemplates(hydratedTemplates);
    setSettings(state.settings);
    setCustomExercises(state.customExercises);
    setCardioSessions(state.cardioSessions);
    setWeightLogs(state.weightLogs);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoaded(false);
      const localState = fromLocalStorage();

      if (!user || isDemoUser) {
        if (cancelled) return;
        applyState(localState);
        setIsLoaded(true);
        return;
      }

      const db = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            eq: (column: string, value: string) => {
              maybeSingle: () => Promise<{
                data: { state?: unknown } | null;
                error: { message?: string } | null;
              }>;
            };
          };
          upsert: (
            values: Record<string, unknown>,
            options?: { onConflict?: string },
          ) => Promise<{ error: { message?: string } | null }>;
        };
      };

      try {
        const { data, error } = await db
          .from('workout_state')
          .select('state')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;

        if (error) {
          console.error('Failed loading workout state from Supabase:', error.message || error);
          applyState(localState);
          setIsLoaded(true);
          return;
        }

        const remoteState = coerceRemoteState(data?.state);
        if (remoteState) {
          applyState(remoteState);
          toLocalStorage(remoteState);
          setIsLoaded(true);
          return;
        }

        applyState(localState);
        setIsLoaded(true);

        if (hasAnyWorkoutData(localState)) {
          const { error: saveError } = await db.from('workout_state').upsert(
            {
              user_id: user.id,
              state: localState,
            },
            { onConflict: 'user_id' },
          );
          if (saveError) {
            console.error('Failed seeding workout state in Supabase:', saveError.message || saveError);
          }
        }
      } catch (error) {
        console.error('Unexpected workout state load error:', error);
        if (cancelled) return;
        applyState(localState);
        setIsLoaded(true);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [applyState, isDemoUser, user?.id]);

  const persistedState = useMemo<PersistedWorkoutState>(
    () => ({
      schemaVersion: STATE_SCHEMA_VERSION,
      workouts,
      templates,
      settings,
      customExercises,
      cardioSessions,
      weightLogs,
    }),
    [cardioSessions, customExercises, settings, templates, weightLogs, workouts],
  );

  useEffect(() => {
    if (!isLoaded) return;
    toLocalStorage(persistedState);
  }, [isLoaded, persistedState]);

  useEffect(() => {
    if (!isLoaded || !user || isDemoUser) return;

    const db = supabase as unknown as {
      from: (table: string) => {
        upsert: (
          values: Record<string, unknown>,
          options?: { onConflict?: string },
        ) => Promise<{ error: { message?: string } | null }>;
      };
    };

    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = window.setTimeout(() => {
      void db
        .from('workout_state')
        .upsert(
          {
            user_id: user.id,
            state: persistedState,
          },
          { onConflict: 'user_id' },
        )
        .then(({ error }) => {
          if (error) {
            console.error('Failed saving workout state to Supabase:', error.message || error);
          }
        })
        .catch((error) => {
          console.error('Unexpected workout save error:', error);
        });
    }, 800);

    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [isDemoUser, isLoaded, persistedState, user?.id]);

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
