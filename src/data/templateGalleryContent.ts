export type TemplateCategory = 'Meals' | 'Grocery' | 'Chores' | 'Tasks' | 'Fitness' | 'Lifestyle';

export interface TemplatePack {
  slug: string;
  title: string;
  category: TemplateCategory;
  description: string;
  highlights: string[];
  payload: Record<string, unknown>;
}

export const templatePacks: TemplatePack[] = [
  {
    slug: 'busy-family-weeknight-system',
    title: 'Busy Family Weeknight System',
    category: 'Meals',
    description: 'A weeknight-first setup with quick dinners, grocery guardrails, and prep reminders.',
    highlights: ['Weeknight-only meal cadence', 'Dinner start-time reminders', 'Kid-friendly preference enabled'],
    payload: {
      module: 'meals',
      mealPreference: 'Plan weeknights only',
      maxCookMinutes: 30,
      preferKidFriendly: true,
      reminderStyle: 'Normal',
    },
  },
  {
    slug: 'lean-grocery-budget-mode',
    title: 'Lean Grocery Budget Mode',
    category: 'Grocery',
    description: 'A budget-first shopping setup with consolidation, substitutions, and duplicate prevention.',
    highlights: ['Store-priority setup', 'Budget substitution rules', 'Weekly staple checklist'],
    payload: {
      module: 'groceries',
      groceryMode: 'Pickup',
      groceryStore: 'Walmart',
      optimization: 'budget-first',
    },
  },
  {
    slug: 'kids-chores-points-loop',
    title: 'Kids Chores Points Loop',
    category: 'Chores',
    description: 'Recurring chores with rewards, extra chore queue unlocks, and weekly prize cadence.',
    highlights: ['Daily chores gate before extras', 'Weekly reward loop', 'Parent approval checkpoint'],
    payload: {
      module: 'chores',
      choreStyle: 'Rotating schedule',
      rewardsEnabled: true,
      weeklyPrize: true,
    },
  },
  {
    slug: 'family-weekly-reset-board',
    title: 'Family Weekly Reset Board',
    category: 'Tasks',
    description: 'A simple room-by-room reset sequence with owner assignments and priority lanes.',
    highlights: ['Room-based reset list', 'Sunday planning block', 'Top-5 weekly priorities'],
    payload: {
      module: 'tasks',
      checklistType: 'weekly-reset',
      planningCadence: 'weekly',
      reminderStyle: 'Persistent (keep nudging me)',
    },
  },
  {
    slug: 'three-day-family-fitness',
    title: '3-Day Family Fitness Starter',
    category: 'Fitness',
    description: 'A realistic workout baseline that fits school/work schedules and recovery needs.',
    highlights: ['3 workouts per week default', 'Home + gym compatible', 'Progress checkpoint prompts'],
    payload: {
      module: 'workouts',
      workoutFrequency: '3-5',
      workoutLocation: 'Both',
      fitnessLevel: 'Beginner',
    },
  },
  {
    slug: 'protein-water-consistency',
    title: 'Protein + Water Consistency',
    category: 'Lifestyle',
    description: 'Simple nutrition adherence mode focused on protein goals and hydration streaks.',
    highlights: ['Protein-first tracking mode', 'Daily water target', 'Light touch reminders'],
    payload: {
      module: 'lifestyle',
      nutritionTracking: 'Track protein only',
      hydrationTracking: 'Daily water goal',
      reminderStyle: 'Minimal',
    },
  },
];
