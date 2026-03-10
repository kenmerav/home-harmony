// Recipe & Meals Types
export interface Recipe {
  id: string;
  name: string;
  servings: number;
  estimatedCookMinutes?: number;
  imageUrl?: string;
  isFavorite?: boolean;
  isKidFriendly?: boolean;
  isMealPrep?: boolean;
  ingredients: string[];
  ingredientsRaw: string;
  instructions: string;
  macrosPerServing: Macros;
  defaultDay?: DayOfWeek;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  isAnchored: boolean;
  sourceFile?: string;
  createdAt: Date;
}

export interface Macros {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface PlannedMeal {
  id: string;
  recipeId: string;
  recipe: Recipe;
  day: DayOfWeek;
  isLocked: boolean;
  isSkipped: boolean;
  weekOf: string; // ISO date string of week start
}

export interface MealLog {
  id: string;
  recipeId?: string;
  recipeName: string;
  date: string; // ISO date string
  person: string;
  servings: number;
  macros: Macros; // Snapshot at time of logging
  isQuickAdd: boolean;
  createdAt: Date;
}

// Grocery Types
export type GroceryCategory = 'produce' | 'meat' | 'dairy' | 'pantry' | 'other';

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: GroceryCategory;
  isChecked: boolean;
  sourceRecipes: string[];
}

// Profile Types
export interface Profile {
  id: string;
  name: string;
  defaultServings: number;
  dailyTargets?: Macros;
}

// Kids Chores Types
export interface Child {
  id: string;
  name: string;
  dailyChores: Chore[];
  weeklyChores: WeeklyChore[];
}

export interface Chore {
  id: string;
  name: string;
  isCompleted: boolean;
}

export interface WeeklyChore {
  id: string;
  name: string;
  day?: DayOfWeek;
  days?: DayOfWeek[];
  isCompleted: boolean;
}

// House Manager Types
export type TaskType = 'do' | 'maintain' | 'notice';
export type TaskStatus = 'not_started' | 'in_progress' | 'done';
export type TaskFrequency =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'every_3_months'
  | 'every_6_months'
  | 'yearly'
  | 'once';

export interface HouseTask {
  id: string;
  title: string;
  notes?: string;
  type: TaskType;
  status: TaskStatus;
  frequency: TaskFrequency;
  dueDate?: string;
  day?: DayOfWeek;
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderLeadMinutes?: number;
  createdAt: Date;
}
