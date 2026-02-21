import { addWeeks, format, startOfWeek } from 'date-fns';
import type { DbPlannedMeal } from '@/lib/api/meals';
import type { DbRecipe } from '@/lib/api/recipes';
import { demoRecipesFull } from '@/data/demoRecipes';

const DEMO_RECIPES_KEY = 'hh_demo_recipes_v1';
const DEMO_MEALS_KEY = 'hh_demo_meals_v1';

const nowIso = () => new Date().toISOString();

const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getWeekOf(weekOffset: number): string {
  const ws = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  return format(ws, 'yyyy-MM-dd');
}

function initialMealsForWeek(weekOf: string, recipes: DbRecipe[]): DbPlannedMeal[] {
  return days.map((day, idx) => ({
    id: `demo-m-${weekOf}-${day}`,
    recipe_id: recipes[idx % recipes.length].id,
    day,
    week_of: weekOf,
    is_locked: false,
    is_skipped: false,
    created_at: nowIso(),
    recipes: recipes[idx % recipes.length],
  })) as DbPlannedMeal[];
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getDemoRecipes(): DbRecipe[] {
  const existing = readJson<DbRecipe[]>(DEMO_RECIPES_KEY, []);
  if (existing.length > 0) return existing;
  writeJson(DEMO_RECIPES_KEY, demoRecipesFull);
  return demoRecipesFull;
}

export function setDemoRecipes(recipes: DbRecipe[]) {
  writeJson(DEMO_RECIPES_KEY, recipes);
}

export function getDemoMeals(weekOffset: number): DbPlannedMeal[] {
  const weekOf = getWeekOf(weekOffset);
  const recipes = getDemoRecipes();
  const mealMap = readJson<Record<string, Omit<DbPlannedMeal, 'recipes'>[]>>(DEMO_MEALS_KEY, {});
  const weekMeals = mealMap[weekOf] || initialMealsForWeek(weekOf, recipes).map(({ recipes: _, ...rest }) => rest);
  mealMap[weekOf] = weekMeals;
  writeJson(DEMO_MEALS_KEY, mealMap);

  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  return weekMeals.map((m) => ({ ...m, recipes: recipeById.get(m.recipe_id) }));
}

export function setDemoMeals(weekOffset: number, meals: Omit<DbPlannedMeal, 'recipes'>[]) {
  const weekOf = getWeekOf(weekOffset);
  const mealMap = readJson<Record<string, Omit<DbPlannedMeal, 'recipes'>[]>>(DEMO_MEALS_KEY, {});
  mealMap[weekOf] = meals;
  writeJson(DEMO_MEALS_KEY, mealMap);
}

export function resetDemoStore() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DEMO_RECIPES_KEY);
  localStorage.removeItem(DEMO_MEALS_KEY);
}
