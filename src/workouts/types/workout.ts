export interface WorkoutSet {
  id: string;
  reps: number;
  weight: number;
  rpe?: number;
  rir?: number;
  notes?: string;
  timestamp: number;
  restTime?: number; // seconds since previous set
  isCompleted: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  sets: WorkoutSet[];
  notes?: string;
  restTimerDuration?: number; // custom rest time for this exercise
}

export interface Workout {
  id: string;
  date: string; // ISO date string
  startTime: number;
  endTime?: number;
  exercises: Exercise[];
  notes?: string;
  templateId?: string;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: {
    name: string;
    targetSets: number;
    targetReps?: number;
    restTimerDuration?: number;
  }[];
  labels?: {
    goals?: string[];
    equipment?: string[];
    split?: string;
    level?: string;
  };
  createdAt: number;
  lastUsed?: number;
}

export interface ExerciseHistory {
  exerciseName: string;
  records: {
    date: string;
    sets: WorkoutSet[];
    maxWeight: number;
    maxReps: number;
    totalVolume: number;
  }[];
  personalRecords: {
    maxWeight: { value: number; date: string };
    maxReps: { value: number; weight: number; date: string };
    maxVolume: { value: number; date: string };
  };
}

export interface CardioSession {
  id: string;
  type: 'run' | 'walk' | 'bike' | 'other';
  date: string;
  distance: number; // miles or km
  duration: number; // minutes
  notes?: string;
}

export interface WeightLog {
  id: string;
  date: string; // YYYY-MM-DD
  weight: number;
  timeOfDay: 'morning' | 'evening';
}

export interface AppSettings {
  defaultRestTimer: number; // seconds
  weightUnit: 'lb' | 'kg';
  distanceUnit: 'mi' | 'km';
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export const DEFAULT_EXERCISES = [
  'Bench Press',
  'Squat',
  'Deadlift',
  'Overhead Press',
  'Barbell Row',
  'Pull-ups',
  'Chin-ups',
  'Dumbbell Curl',
  'Tricep Pushdown',
  'Lat Pulldown',
  'Leg Press',
  'Leg Curl',
  'Leg Extension',
  'Calf Raise',
  'Romanian Deadlift',
  'Hip Thrust',
  'Lunges',
  'Incline Bench Press',
  'Dumbbell Press',
  'Dumbbell Row',
  'Face Pull',
  'Lateral Raise',
  'Front Raise',
  'Rear Delt Fly',
  'Cable Fly',
  'Dips',
  'Skull Crushers',
  'Hammer Curl',
  'Preacher Curl',
  'Cable Crunch',
  'Plank',
  'Hanging Leg Raise',
];

export const CORE_EXERCISES = [
  'Plank',
  'Dead Bug',
  'Bird Dog',
  'Hollow Body Hold',
  'Ab Rollout',
  'Hanging Leg Raise',
  'Cable Crunch',
  'Russian Twist',
  'Bicycle Crunch',
  'Mountain Climbers',
  'V-Ups',
  'Flutter Kicks',
  'Toe Touches',
  'Reverse Crunch',
  'Side Plank',
  'Farmer Walk',
  'Suitcase Carry',
  'Pallof Press',
  'Woodchop',
  'Bear Crawl',
];
