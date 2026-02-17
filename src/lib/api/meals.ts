import { supabase } from '@/integrations/supabase/client';
import { DayOfWeek } from '@/types';
import { DbRecipe } from './recipes';
import { startOfWeek, addWeeks, format } from 'date-fns';

export interface DbPlannedMeal {
  id: string;
  recipe_id: string;
  day: string;
  week_of: string;
  is_locked: boolean;
  is_skipped: boolean;
  created_at: string;
  recipes?: DbRecipe;
}

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function getWeekOf(weekOffset: number): string {
  const ws = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  return format(ws, 'yyyy-MM-dd');
}

export async function fetchMealsForWeek(weekOffset: number): Promise<DbPlannedMeal[]> {
  const weekOf = getWeekOf(weekOffset);
  const { data, error } = await supabase
    .from('planned_meals')
    .select('*, recipes(*)')
    .eq('week_of', weekOf);

  if (error) throw error;
  return (data || []) as unknown as DbPlannedMeal[];
}

export async function generateMeals(
  weekOffset: number,
  daysToRegenerate?: DayOfWeek[]
): Promise<DbPlannedMeal[]> {
  const weekOf = getWeekOf(weekOffset);
  const targetDays = daysToRegenerate || DAYS;

  // Fetch all recipes
  const { data: allRecipes, error: recipeErr } = await supabase
    .from('recipes')
    .select('*');
  if (recipeErr) throw recipeErr;
  if (!allRecipes || allRecipes.length === 0) throw new Error('No recipes available');

  // Fetch existing meals for this week (to preserve locked ones)
  const { data: existing } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('week_of', weekOf);

  const existingMeals = existing || [];
  
  // Delete unlocked meals for target days
  const mealsToDelete = existingMeals.filter(
    m => targetDays.includes(m.day as DayOfWeek) && !m.is_locked
  );
  if (mealsToDelete.length > 0) {
    await supabase
      .from('planned_meals')
      .delete()
      .in('id', mealsToDelete.map(m => m.id));
  }

  // Keep locked meals' recipe IDs to avoid duplicates
  const lockedRecipeIds = new Set(
    existingMeals.filter(m => m.is_locked).map(m => m.recipe_id)
  );
  const keptDays = new Set(
    existingMeals.filter(m => !targetDays.includes(m.day as DayOfWeek) || m.is_locked).map(m => m.day)
  );

  // Days that need new meals
  const daysNeedingMeals = targetDays.filter(d => !keptDays.has(d));

  // Anchored recipes get priority
  const anchored = allRecipes.filter(r => r.is_anchored && r.default_day && !lockedRecipeIds.has(r.id));
  const flexible = allRecipes.filter(r => !r.is_anchored && !lockedRecipeIds.has(r.id));

  const newMeals: { recipe_id: string; day: string; week_of: string }[] = [];
  const usedRecipeIds = new Set(lockedRecipeIds);

  // Place anchored recipes first
  for (const recipe of anchored) {
    if (daysNeedingMeals.includes(recipe.default_day as DayOfWeek)) {
      newMeals.push({ recipe_id: recipe.id, day: recipe.default_day!, week_of: weekOf });
      usedRecipeIds.add(recipe.id);
      daysNeedingMeals.splice(daysNeedingMeals.indexOf(recipe.default_day as DayOfWeek), 1);
    }
  }

  // Fill remaining days with shuffled flexible recipes
  const shuffled = [...flexible].sort(() => Math.random() - 0.5);
  let idx = 0;
  for (const day of daysNeedingMeals) {
    // Cycle through if we run out of unique recipes
    const recipe = shuffled[idx % shuffled.length];
    if (recipe) {
      newMeals.push({ recipe_id: recipe.id, day, week_of: weekOf });
      idx++;
    }
  }

  if (newMeals.length > 0) {
    const { error } = await supabase
      .from('planned_meals')
      .insert(newMeals);
    if (error) throw error;
  }

  return fetchMealsForWeek(weekOffset);
}

export async function swapMeal(mealId: string, weekOf: string, day: string): Promise<DbPlannedMeal[]> {
  // Get current recipe to exclude it
  const { data: current } = await supabase
    .from('planned_meals')
    .select('recipe_id')
    .eq('id', mealId)
    .single();

  // Get all meals for the week to exclude their recipes
  const { data: weekMeals } = await supabase
    .from('planned_meals')
    .select('recipe_id')
    .eq('week_of', weekOf);

  const usedIds = new Set((weekMeals || []).map(m => m.recipe_id));

  // Get a random unused recipe
  const { data: allRecipes } = await supabase.from('recipes').select('id');
  const available = (allRecipes || []).filter(r => !usedIds.has(r.id));
  
  let newRecipeId: string;
  if (available.length > 0) {
    newRecipeId = available[Math.floor(Math.random() * available.length)].id;
  } else {
    // All recipes used, pick any except current
    const others = (allRecipes || []).filter(r => r.id !== current?.recipe_id);
    newRecipeId = others[Math.floor(Math.random() * others.length)]?.id || current?.recipe_id;
  }

  await supabase
    .from('planned_meals')
    .update({ recipe_id: newRecipeId })
    .eq('id', mealId);

  // Return updated week - determine weekOffset from weekOf
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const mealWeek = new Date(weekOf);
  const diffWeeks = Math.round((mealWeek.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return fetchMealsForWeek(diffWeeks);
}

export async function toggleMealLock(mealId: string, isLocked: boolean) {
  const { error } = await supabase
    .from('planned_meals')
    .update({ is_locked: isLocked })
    .eq('id', mealId);
  if (error) throw error;
}

export async function toggleMealSkip(mealId: string, isSkipped: boolean) {
  const { error } = await supabase
    .from('planned_meals')
    .update({ is_skipped: isSkipped })
    .eq('id', mealId);
  if (error) throw error;
}
