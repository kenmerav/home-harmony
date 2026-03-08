import type { WorkoutTemplate } from '@/workouts/types/workout';

const STARTER_TEMPLATE_CREATED_AT = 1704067200000;

type TemplateExercise = WorkoutTemplate['exercises'][number];

function buildTemplate(
  id: string,
  name: string,
  labels: NonNullable<WorkoutTemplate['labels']>,
  exercises: TemplateExercise[],
): WorkoutTemplate {
  return {
    id,
    name,
    labels,
    exercises,
    createdAt: STARTER_TEMPLATE_CREATED_AT,
  };
}

export const STARTER_WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  buildTemplate(
    'starter-beginner-full-body-a',
    'Beginner Full Body A',
    {
      goals: ['Build consistency', 'General fitness'],
      equipment: ['Dumbbells', 'Bodyweight'],
      split: 'Full Body',
      level: 'Beginner',
    },
    [
      { name: 'Goblet Squat', targetSets: 3, targetReps: 10, restTimerDuration: 90 },
      { name: 'Dumbbell Press', targetSets: 3, targetReps: 10, restTimerDuration: 90 },
      { name: 'Dumbbell Row', targetSets: 3, targetReps: 12, restTimerDuration: 75 },
      { name: 'Romanian Deadlift', targetSets: 3, targetReps: 10, restTimerDuration: 90 },
      { name: 'Plank', targetSets: 3, restTimerDuration: 45 },
    ],
  ),
  buildTemplate(
    'starter-beginner-full-body-b',
    'Beginner Full Body B',
    {
      goals: ['Build consistency', 'Strength base'],
      equipment: ['Dumbbells', 'Bodyweight'],
      split: 'Full Body',
      level: 'Beginner',
    },
    [
      { name: 'Dumbbell Split Squat', targetSets: 3, targetReps: 10, restTimerDuration: 90 },
      { name: 'Incline Bench Press', targetSets: 3, targetReps: 10, restTimerDuration: 90 },
      { name: 'Lat Pulldown', targetSets: 3, targetReps: 10, restTimerDuration: 75 },
      { name: 'Hip Thrust', targetSets: 3, targetReps: 12, restTimerDuration: 90 },
      { name: 'Dead Bug', targetSets: 3, targetReps: 12, restTimerDuration: 45 },
    ],
  ),
  buildTemplate(
    'starter-fat-loss-circuit',
    'Fat Loss Circuit (35 min)',
    {
      goals: ['Fat loss', 'Conditioning'],
      equipment: ['Dumbbells', 'Bodyweight'],
      split: 'Full Body Circuit',
      level: 'Intermediate',
    },
    [
      { name: 'Goblet Squat', targetSets: 4, targetReps: 12, restTimerDuration: 45 },
      { name: 'Dumbbell Row', targetSets: 4, targetReps: 12, restTimerDuration: 45 },
      { name: 'Dumbbell Press', targetSets: 4, targetReps: 10, restTimerDuration: 45 },
      { name: 'Mountain Climbers', targetSets: 4, targetReps: 30, restTimerDuration: 30 },
      { name: 'Plank', targetSets: 3, restTimerDuration: 30 },
    ],
  ),
  buildTemplate(
    'starter-dumbbell-30-full-body',
    '30-Min Dumbbell Full Body',
    {
      goals: ['Time efficiency', 'General fitness'],
      equipment: ['Dumbbells'],
      split: 'Full Body',
      level: 'Beginner',
    },
    [
      { name: 'Dumbbell Press', targetSets: 3, targetReps: 10, restTimerDuration: 60 },
      { name: 'Dumbbell Row', targetSets: 3, targetReps: 10, restTimerDuration: 60 },
      { name: 'Lunges', targetSets: 3, targetReps: 10, restTimerDuration: 60 },
      { name: 'Romanian Deadlift', targetSets: 3, targetReps: 10, restTimerDuration: 60 },
      { name: 'Side Plank', targetSets: 2, restTimerDuration: 30 },
    ],
  ),
  buildTemplate(
    'starter-upper-strength-barbell',
    'Upper Strength (Barbell)',
    {
      goals: ['Strength', 'Progressive overload'],
      equipment: ['Barbell', 'Cable'],
      split: 'Upper/Lower',
      level: 'Intermediate',
    },
    [
      { name: 'Bench Press', targetSets: 5, targetReps: 5, restTimerDuration: 150 },
      { name: 'Barbell Row', targetSets: 5, targetReps: 5, restTimerDuration: 120 },
      { name: 'Overhead Press', targetSets: 4, targetReps: 6, restTimerDuration: 120 },
      { name: 'Lat Pulldown', targetSets: 4, targetReps: 8, restTimerDuration: 90 },
      { name: 'Face Pull', targetSets: 3, targetReps: 15, restTimerDuration: 60 },
    ],
  ),
  buildTemplate(
    'starter-lower-strength-barbell',
    'Lower Strength (Barbell)',
    {
      goals: ['Strength', 'Athletic base'],
      equipment: ['Barbell', 'Bodyweight'],
      split: 'Upper/Lower',
      level: 'Intermediate',
    },
    [
      { name: 'Squat', targetSets: 5, targetReps: 5, restTimerDuration: 150 },
      { name: 'Deadlift', targetSets: 4, targetReps: 4, restTimerDuration: 180 },
      { name: 'Romanian Deadlift', targetSets: 3, targetReps: 8, restTimerDuration: 120 },
      { name: 'Calf Raise', targetSets: 4, targetReps: 15, restTimerDuration: 60 },
      { name: 'Hanging Leg Raise', targetSets: 3, targetReps: 10, restTimerDuration: 60 },
    ],
  ),
  buildTemplate(
    'starter-push-hypertrophy',
    'Push Day Hypertrophy',
    {
      goals: ['Muscle gain', 'Upper body size'],
      equipment: ['Dumbbells', 'Cable'],
      split: 'Push/Pull/Legs',
      level: 'Intermediate',
    },
    [
      { name: 'Incline Bench Press', targetSets: 4, targetReps: 8, restTimerDuration: 120 },
      { name: 'Dumbbell Press', targetSets: 4, targetReps: 10, restTimerDuration: 90 },
      { name: 'Lateral Raise', targetSets: 4, targetReps: 15, restTimerDuration: 60 },
      { name: 'Cable Fly', targetSets: 3, targetReps: 12, restTimerDuration: 60 },
      { name: 'Skull Crushers', targetSets: 3, targetReps: 12, restTimerDuration: 60 },
    ],
  ),
  buildTemplate(
    'starter-pull-hypertrophy',
    'Pull Day Hypertrophy',
    {
      goals: ['Muscle gain', 'Back and arms'],
      equipment: ['Barbell', 'Cable'],
      split: 'Push/Pull/Legs',
      level: 'Intermediate',
    },
    [
      { name: 'Pull-ups', targetSets: 4, targetReps: 8, restTimerDuration: 120 },
      { name: 'Barbell Row', targetSets: 4, targetReps: 8, restTimerDuration: 120 },
      { name: 'Lat Pulldown', targetSets: 3, targetReps: 10, restTimerDuration: 90 },
      { name: 'Face Pull', targetSets: 3, targetReps: 15, restTimerDuration: 60 },
      { name: 'Hammer Curl', targetSets: 3, targetReps: 12, restTimerDuration: 60 },
    ],
  ),
  buildTemplate(
    'starter-legs-hypertrophy',
    'Leg Day Hypertrophy',
    {
      goals: ['Muscle gain', 'Leg development'],
      equipment: ['Barbell', 'Machines'],
      split: 'Push/Pull/Legs',
      level: 'Intermediate',
    },
    [
      { name: 'Squat', targetSets: 4, targetReps: 8, restTimerDuration: 150 },
      { name: 'Leg Press', targetSets: 4, targetReps: 12, restTimerDuration: 90 },
      { name: 'Leg Curl', targetSets: 3, targetReps: 12, restTimerDuration: 75 },
      { name: 'Leg Extension', targetSets: 3, targetReps: 12, restTimerDuration: 75 },
      { name: 'Calf Raise', targetSets: 4, targetReps: 15, restTimerDuration: 60 },
    ],
  ),
  buildTemplate(
    'starter-glute-ham-focus',
    'Glute + Hamstring Focus',
    {
      goals: ['Lower body tone', 'Posterior chain strength'],
      equipment: ['Barbell', 'Dumbbells'],
      split: 'Lower Body Focus',
      level: 'Beginner',
    },
    [
      { name: 'Hip Thrust', targetSets: 4, targetReps: 10, restTimerDuration: 120 },
      { name: 'Romanian Deadlift', targetSets: 4, targetReps: 10, restTimerDuration: 90 },
      { name: 'Lunges', targetSets: 3, targetReps: 12, restTimerDuration: 75 },
      { name: 'Leg Curl', targetSets: 3, targetReps: 12, restTimerDuration: 60 },
      { name: 'Glute Bridge', targetSets: 3, targetReps: 15, restTimerDuration: 45 },
    ],
  ),
  buildTemplate(
    'starter-athletic-power-speed',
    'Athletic Power + Speed',
    {
      goals: ['Athletic performance', 'Explosiveness'],
      equipment: ['Barbell', 'Bodyweight'],
      split: 'Performance',
      level: 'Advanced',
    },
    [
      { name: 'Deadlift', targetSets: 4, targetReps: 3, restTimerDuration: 180 },
      { name: 'Front Squat', targetSets: 4, targetReps: 4, restTimerDuration: 150 },
      { name: 'Push Press', targetSets: 4, targetReps: 4, restTimerDuration: 120 },
      { name: 'Farmer Walk', targetSets: 4, restTimerDuration: 90 },
      { name: 'Box Jump', targetSets: 4, targetReps: 6, restTimerDuration: 75 },
    ],
  ),
  buildTemplate(
    'starter-conditioning-core-hiit',
    'Conditioning + Core HIIT',
    {
      goals: ['Conditioning', 'Core strength'],
      equipment: ['Bodyweight'],
      split: 'HIIT',
      level: 'Intermediate',
    },
    [
      { name: 'Mountain Climbers', targetSets: 5, targetReps: 30, restTimerDuration: 30 },
      { name: 'Burpees', targetSets: 5, targetReps: 12, restTimerDuration: 30 },
      { name: 'Russian Twist', targetSets: 4, targetReps: 20, restTimerDuration: 30 },
      { name: 'Bicycle Crunch', targetSets: 4, targetReps: 20, restTimerDuration: 30 },
      { name: 'Plank', targetSets: 3, restTimerDuration: 30 },
    ],
  ),
  buildTemplate(
    'starter-kettlebell-full-body',
    'Kettlebell Full Body',
    {
      goals: ['Strength endurance', 'General fitness'],
      equipment: ['Kettlebell', 'Bodyweight'],
      split: 'Full Body',
      level: 'Intermediate',
    },
    [
      { name: 'Kettlebell Swing', targetSets: 4, targetReps: 15, restTimerDuration: 60 },
      { name: 'Goblet Squat', targetSets: 4, targetReps: 10, restTimerDuration: 60 },
      { name: 'Single Arm Press', targetSets: 3, targetReps: 8, restTimerDuration: 75 },
      { name: 'Single Arm Row', targetSets: 3, targetReps: 10, restTimerDuration: 60 },
      { name: 'Suitcase Carry', targetSets: 3, restTimerDuration: 45 },
    ],
  ),
  buildTemplate(
    'starter-home-bodyweight-strength',
    'Home Bodyweight Strength',
    {
      goals: ['General fitness', 'No gym required'],
      equipment: ['Bodyweight'],
      split: 'Full Body',
      level: 'Beginner',
    },
    [
      { name: 'Push-ups', targetSets: 4, targetReps: 10, restTimerDuration: 60 },
      { name: 'Bodyweight Squat', targetSets: 4, targetReps: 15, restTimerDuration: 60 },
      { name: 'Reverse Lunge', targetSets: 3, targetReps: 12, restTimerDuration: 60 },
      { name: 'Glute Bridge', targetSets: 3, targetReps: 15, restTimerDuration: 45 },
      { name: 'Side Plank', targetSets: 3, restTimerDuration: 30 },
    ],
  ),
  buildTemplate(
    'starter-low-impact-circuit',
    'Low Impact Beginner Circuit',
    {
      goals: ['Fat loss', 'Joint friendly'],
      equipment: ['Bodyweight', 'Dumbbells'],
      split: 'Circuit',
      level: 'Beginner',
    },
    [
      { name: 'Step-ups', targetSets: 3, targetReps: 12, restTimerDuration: 60 },
      { name: 'Dumbbell Row', targetSets: 3, targetReps: 12, restTimerDuration: 60 },
      { name: 'Dumbbell Press', targetSets: 3, targetReps: 10, restTimerDuration: 60 },
      { name: 'Dead Bug', targetSets: 3, targetReps: 12, restTimerDuration: 45 },
      { name: 'Bird Dog', targetSets: 3, targetReps: 12, restTimerDuration: 45 },
    ],
  ),
  buildTemplate(
    'starter-machine-upper',
    'Machine Upper Body',
    {
      goals: ['Muscle gain', 'Beginner-friendly strength'],
      equipment: ['Machines'],
      split: 'Upper/Lower',
      level: 'Beginner',
    },
    [
      { name: 'Chest Press Machine', targetSets: 4, targetReps: 10, restTimerDuration: 90 },
      { name: 'Seated Row Machine', targetSets: 4, targetReps: 10, restTimerDuration: 90 },
      { name: 'Shoulder Press Machine', targetSets: 3, targetReps: 10, restTimerDuration: 75 },
      { name: 'Lat Pulldown', targetSets: 3, targetReps: 10, restTimerDuration: 75 },
      { name: 'Cable Curl', targetSets: 3, targetReps: 12, restTimerDuration: 60 },
    ],
  ),
  buildTemplate(
    'starter-machine-lower',
    'Machine Lower Body',
    {
      goals: ['Muscle gain', 'Lower body strength'],
      equipment: ['Machines'],
      split: 'Upper/Lower',
      level: 'Beginner',
    },
    [
      { name: 'Leg Press', targetSets: 4, targetReps: 10, restTimerDuration: 90 },
      { name: 'Leg Curl', targetSets: 4, targetReps: 12, restTimerDuration: 75 },
      { name: 'Leg Extension', targetSets: 4, targetReps: 12, restTimerDuration: 75 },
      { name: 'Calf Raise', targetSets: 4, targetReps: 15, restTimerDuration: 60 },
      { name: 'Cable Crunch', targetSets: 3, targetReps: 15, restTimerDuration: 45 },
    ],
  ),
  buildTemplate(
    'starter-core-mobility-reset',
    'Core + Mobility Reset',
    {
      goals: ['Recovery', 'Core stability'],
      equipment: ['Bodyweight'],
      split: 'Recovery Day',
      level: 'All levels',
    },
    [
      { name: 'Dead Bug', targetSets: 3, targetReps: 10, restTimerDuration: 45 },
      { name: 'Bird Dog', targetSets: 3, targetReps: 10, restTimerDuration: 45 },
      { name: 'Side Plank', targetSets: 3, restTimerDuration: 30 },
      { name: 'Pallof Press', targetSets: 3, targetReps: 12, restTimerDuration: 45 },
      { name: 'Bear Crawl', targetSets: 3, targetReps: 20, restTimerDuration: 45 },
    ],
  ),
  buildTemplate(
    'starter-busy-parent-strength',
    'Busy Parent Strength (40 min)',
    {
      goals: ['Strength', 'Time efficiency'],
      equipment: ['Dumbbells', 'Bodyweight'],
      split: 'Full Body',
      level: 'Beginner',
    },
    [
      { name: 'Goblet Squat', targetSets: 4, targetReps: 8, restTimerDuration: 75 },
      { name: 'Dumbbell Press', targetSets: 4, targetReps: 8, restTimerDuration: 75 },
      { name: 'Single Arm Row', targetSets: 4, targetReps: 10, restTimerDuration: 60 },
      { name: 'Hip Thrust', targetSets: 3, targetReps: 10, restTimerDuration: 75 },
      { name: 'Plank', targetSets: 3, restTimerDuration: 30 },
    ],
  ),
  buildTemplate(
    'starter-walk-run-intervals',
    'Walk/Run Intervals + Strength',
    {
      goals: ['Fat loss', 'Cardio endurance'],
      equipment: ['Treadmill', 'Bodyweight'],
      split: 'Hybrid Conditioning',
      level: 'Beginner',
    },
    [
      { name: 'Treadmill Intervals', targetSets: 8, targetReps: 2, restTimerDuration: 60 },
      { name: 'Bodyweight Squat', targetSets: 3, targetReps: 15, restTimerDuration: 45 },
      { name: 'Push-ups', targetSets: 3, targetReps: 12, restTimerDuration: 45 },
      { name: 'Reverse Lunge', targetSets: 3, targetReps: 10, restTimerDuration: 45 },
      { name: 'Plank', targetSets: 3, restTimerDuration: 30 },
    ],
  ),
];

export function mergeStarterTemplates(templates: WorkoutTemplate[]): WorkoutTemplate[] {
  const existingIds = new Set(templates.map(template => template.id));
  const missingStarterTemplates = STARTER_WORKOUT_TEMPLATES.filter(
    template => !existingIds.has(template.id),
  );

  if (missingStarterTemplates.length === 0) {
    return templates;
  }

  return [...templates, ...missingStarterTemplates];
}
