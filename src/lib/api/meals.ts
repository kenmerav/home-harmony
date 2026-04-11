import { supabase } from '@/integrations/supabase/client';
import { DayOfWeek } from '@/types';
import { DbRecipe } from './recipes';
import { startOfWeek, addWeeks, format } from 'date-fns';
import { estimateCookMinutes } from '@/lib/recipeTime';
import { getFavoriteIds, getKidFriendlyOverrides } from '@/lib/mealPrefs';
import { inferKidFriendly } from '@/lib/kidFriendly';
import { isDemoModeEnabled } from '@/lib/demoMode';
import { getDemoMeals, getDemoRecipes, setDemoMeals } from '@/lib/demoStore';
import { normalizeRecipeIngredients } from '@/lib/recipeText';
import { syncScheduledMealsToCalendar } from '@/lib/calendarStore';

export interface DbPlannedMeal {
  id: string;
  recipe_id: string | null;
  day: string;
  week_of: string;
  is_locked: boolean;
  is_skipped: boolean;
  created_at: string;
  recipes?: DbRecipe;
}

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export interface MealGenerationOptions {
  preferFavorites?: boolean;
  preferKidFriendly?: boolean;
  favoritesOnly?: boolean;
  kidFriendlyOnly?: boolean;
  maxCookMinutes?: number | null;
  dayLocks?: Partial<Record<DayOfWeek, string>>;
}

export const NO_MEAL_NEEDED_LOCK = '__none__';

function weightedPick<T extends { id: string }>(
  pool: T[],
  usedIds: Set<string>,
  favoriteIds: Set<string>,
  kidFriendlyIds: Set<string>,
  preferFavorites: boolean,
  preferKidFriendly: boolean,
): T | null {
  const available = pool.filter((r) => !usedIds.has(r.id));
  if (available.length === 0) return null;
  const weighted = available.map((r) => ({
    recipe: r,
    weight:
      (preferFavorites && favoriteIds.has(r.id) ? 5 : 1) *
      (preferKidFriendly && kidFriendlyIds.has(r.id) ? 2 : 1),
  }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * total;
  for (const item of weighted) {
    random -= item.weight;
    if (random <= 0) return item.recipe;
  }
  return weighted[weighted.length - 1].recipe;
}

function normalizeLockToken(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isNoMealNeededLock(lockValue: string | undefined): boolean {
  return String(lockValue || '').trim() === NO_MEAL_NEEDED_LOCK;
}

function resolveDayLockRecipe<T extends { id: string; name: string }>(
  recipes: T[],
  lockValue: string | undefined,
): T | null {
  if (!lockValue) return null;
  const raw = String(lockValue).trim();
  if (!raw) return null;

  const byId = recipes.find((recipe) => recipe.id === raw);
  if (byId) return byId;

  const normalizedLock = normalizeLockToken(raw);
  if (!normalizedLock) return null;

  const byExactName = recipes.find((recipe) => normalizeLockToken(recipe.name) === normalizedLock);
  if (byExactName) return byExactName;

  const keywordGroups: Array<{ match: boolean; keywords: string[] }> = [
    { match: normalizedLock.includes('taco'), keywords: ['taco', 'fajita'] },
    { match: normalizedLock.includes('pizza'), keywords: ['pizza', 'flatbread'] },
    { match: normalizedLock.includes('pasta'), keywords: ['pasta', 'rigatoni', 'orzo', 'ravioli'] },
    { match: normalizedLock.includes('soup'), keywords: ['soup', 'chili', 'stew'] },
    { match: normalizedLock.includes('breakfast'), keywords: ['breakfast', 'egg', 'omelet', 'oats'] },
  ];

  const activeGroup = keywordGroups.find((group) => group.match);
  if (activeGroup) {
    const byKeyword = recipes.find((recipe) => {
      const name = normalizeLockToken(recipe.name);
      return activeGroup.keywords.some((keyword) => name.includes(keyword));
    });
    if (byKeyword) return byKeyword;
  }

  return recipes.find((recipe) => normalizeLockToken(recipe.name).includes(normalizedLock)) || null;
}

function getWeekOf(weekOffset: number): string {
  const ws = addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset);
  return format(ws, 'yyyy-MM-dd');
}

function getWeekOffsetFromWeekOf(weekOf: string): number {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const mealWeek = new Date(weekOf);
  return Math.round((mealWeek.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

async function syncMealCalendarSafely(meals: DbPlannedMeal[]) {
  try {
    await syncScheduledMealsToCalendar(meals);
  } catch (error) {
    console.error('Failed syncing meal schedule to calendar_events:', error);
  }
}

export async function fetchMealsForWeek(weekOffset: number): Promise<DbPlannedMeal[]> {
  if (isDemoModeEnabled()) {
    return getDemoMeals(weekOffset).map((meal) => ({
      ...meal,
      recipes: meal.recipes
        ? { ...meal.recipes, ingredients: normalizeRecipeIngredients(meal.recipes.ingredients) }
        : meal.recipes,
    }));
  }

  const weekOf = getWeekOf(weekOffset);
  const { data, error } = await supabase
    .from('planned_meals')
    .select('*, recipes(*)')
    .eq('week_of', weekOf);

  if (error) throw error;
  return ((data || []) as unknown as DbPlannedMeal[]).map((meal) => ({
    ...meal,
    recipes: meal.recipes
      ? { ...meal.recipes, ingredients: normalizeRecipeIngredients(meal.recipes.ingredients) }
      : meal.recipes,
  }));
}

export async function setMealForDay(
  weekOffset: number,
  day: DayOfWeek,
  recipeId: string,
): Promise<DbPlannedMeal[]> {
  if (isDemoModeEnabled()) {
    const weekOf = getWeekOf(weekOffset);
    const scoped = getDemoMeals(weekOffset);
    const existing = scoped.find((meal) => meal.day === day);
    const next = scoped.map(({ recipes: _, ...meal }) => meal);
    if (existing) {
      const updated = next.map((meal) =>
        meal.id === existing.id
          ? {
              ...meal,
              recipe_id: recipeId,
              is_skipped: false,
            }
          : meal,
      );
      setDemoMeals(weekOffset, updated);
    } else {
      next.push({
        id: `demo-m-${weekOf}-${day}`,
        recipe_id: recipeId,
        day,
        week_of: weekOf,
        is_locked: false,
        is_skipped: false,
        created_at: new Date().toISOString(),
      });
      setDemoMeals(weekOffset, next);
    }
    return getDemoMeals(weekOffset);
  }

  const weekOf = getWeekOf(weekOffset);
  const { data: existing, error: existingError } = await supabase
    .from('planned_meals')
    .select('id')
    .eq('day', day)
    .eq('week_of', weekOf)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('planned_meals')
      .update({ recipe_id: recipeId, is_skipped: false })
      .eq('id', existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from('planned_meals').insert({
      day,
      week_of: weekOf,
      recipe_id: recipeId,
      is_skipped: false,
    });
    if (insertError) throw insertError;
  }

  const refreshed = await fetchMealsForWeek(weekOffset);
  await syncMealCalendarSafely(refreshed);
  return refreshed;
}

export async function setNoMealNeededForDay(
  weekOffset: number,
  day: DayOfWeek,
): Promise<DbPlannedMeal[]> {
  if (isDemoModeEnabled()) {
    const weekOf = getWeekOf(weekOffset);
    const scoped = getDemoMeals(weekOffset);
    const existing = scoped.find((meal) => meal.day === day);
    const next = scoped.map(({ recipes: _, ...meal }) => meal);
    if (existing) {
      const updated = next.map((meal) =>
        meal.id === existing.id
          ? {
              ...meal,
              recipe_id: null,
              is_skipped: true,
            }
          : meal,
      );
      setDemoMeals(weekOffset, updated);
    } else {
      next.push({
        id: `demo-m-${weekOf}-${day}`,
        recipe_id: null,
        day,
        week_of: weekOf,
        is_locked: false,
        is_skipped: true,
        created_at: new Date().toISOString(),
      });
      setDemoMeals(weekOffset, next);
    }
    return getDemoMeals(weekOffset);
  }

  const weekOf = getWeekOf(weekOffset);
  const { data: existing, error: existingError } = await supabase
    .from('planned_meals')
    .select('id')
    .eq('day', day)
    .eq('week_of', weekOf)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.id) {
    const { error: updateError } = await supabase
      .from('planned_meals')
      .update({ recipe_id: null, is_skipped: true })
      .eq('id', existing.id);
    if (updateError) throw updateError;
  } else {
    const { error: insertError } = await supabase.from('planned_meals').insert({
      day,
      week_of: weekOf,
      recipe_id: null,
      is_skipped: true,
    });
    if (insertError) throw insertError;
  }

  const refreshed = await fetchMealsForWeek(weekOffset);
  await syncMealCalendarSafely(refreshed);
  return refreshed;
}

export async function generateMeals(
  weekOffset: number,
  daysToRegenerate?: DayOfWeek[],
  options?: MealGenerationOptions,
): Promise<DbPlannedMeal[]> {
  const favoriteIds = getFavoriteIds();
  const kidOverrides = getKidFriendlyOverrides();
  const preferKidFriendly = options?.preferKidFriendly ?? false;
  const preferFavorites = options?.preferFavorites ?? true;
  const favoritesOnly = options?.favoritesOnly ?? false;
  const kidFriendlyOnly = options?.kidFriendlyOnly ?? false;
  const maxCookMinutes = options?.maxCookMinutes ?? null;
  const dayLocks = options?.dayLocks ?? {};

  if (isDemoModeEnabled()) {
    const weekOfDemo = getWeekOf(weekOffset);
    const targetDays = daysToRegenerate || DAYS;
    const existing = getDemoMeals(weekOffset);
    const allDemoRecipes = getDemoRecipes();
    const kidFriendlyIds = new Set(
      allDemoRecipes
        .filter((recipe) => kidOverrides[recipe.id] ?? inferKidFriendly(recipe))
        .map((recipe) => recipe.id),
    );
    const recipes = allDemoRecipes.filter((recipe) => {
      if (maxCookMinutes && maxCookMinutes > 0) {
        const cookMinutes = estimateCookMinutes(recipe.instructions);
        if (cookMinutes !== null && cookMinutes > maxCookMinutes) return false;
      }
      if (favoritesOnly && !favoriteIds.has(recipe.id)) return false;
      if (kidFriendlyOnly && !kidFriendlyIds.has(recipe.id)) return false;
      return true;
    });
    if (recipes.length === 0) {
      throw new Error('No recipes match your regenerate filters.');
    }

    const byDay = new Map(existing.map((m) => [m.day, m]));
    const used = new Set(existing.filter((m) => m.is_locked).map((m) => m.recipe_id));
    const mutable = existing.filter((m) => !targetDays.includes(m.day as DayOfWeek) || m.is_locked).map(({ recipes: _, ...rest }) => rest);
    for (const day of targetDays) {
      const meal = byDay.get(day);
      if (meal?.is_locked) continue;
      if (isNoMealNeededLock(dayLocks[day])) {
        continue;
      }
      const forcedRecipe = resolveDayLockRecipe(recipes, dayLocks[day]);
      if (forcedRecipe) {
        used.add(forcedRecipe.id);
        mutable.push({
          id: meal?.id || `demo-m-${weekOfDemo}-${day}`,
          recipe_id: forcedRecipe.id,
          day,
          week_of: weekOfDemo,
          is_locked: false,
          is_skipped: false,
          created_at: meal?.created_at || new Date().toISOString(),
        });
        continue;
      }
      const uniqueAlternatives = recipes.filter((r) => !used.has(r.id) && r.id !== meal?.recipe_id);
      const anyAlternatives = recipes.filter((r) => r.id !== meal?.recipe_id);
      const pool =
        uniqueAlternatives.length > 0
          ? uniqueAlternatives
          : anyAlternatives.length > 0
          ? anyAlternatives
          : recipes;
      let candidate = weightedPick(
        pool,
        used,
        favoriteIds,
        kidFriendlyIds,
        preferFavorites,
        preferKidFriendly,
      );
      if (!candidate) {
        candidate = weightedPick(
          recipes,
          new Set<string>(),
          favoriteIds,
          kidFriendlyIds,
          preferFavorites,
          preferKidFriendly,
        );
      }
      if (!candidate) continue;
      used.add(candidate.id);
      mutable.push({
        id: meal?.id || `demo-m-${weekOfDemo}-${day}`,
        recipe_id: candidate.id,
        day,
        week_of: weekOfDemo,
        is_locked: false,
        is_skipped: false,
        created_at: meal?.created_at || new Date().toISOString(),
      });
    }
    setDemoMeals(weekOffset, mutable.sort((a, b) => DAYS.indexOf(a.day as DayOfWeek) - DAYS.indexOf(b.day as DayOfWeek)));
    return getDemoMeals(weekOffset);
  }

  const weekOf = getWeekOf(weekOffset);
  const targetDays = daysToRegenerate || DAYS;

  // Fetch all recipes
  const { data: allRecipes, error: recipeErr } = await supabase
    .from('recipes')
    .select('*');
  if (recipeErr) throw recipeErr;
  if (!allRecipes || allRecipes.length === 0) throw new Error('No recipes available');
  const kidFriendlyIds = new Set(
    allRecipes
      .filter((r) => kidOverrides[r.id] ?? inferKidFriendly(r))
      .map((r) => r.id),
  );
  let allRecipesFiltered = maxCookMinutes && maxCookMinutes > 0
    ? allRecipes.filter((r) => {
        const cookMinutes = estimateCookMinutes(r.instructions);
        return cookMinutes === null || cookMinutes <= maxCookMinutes;
      })
    : allRecipes;
  if (favoritesOnly) {
    allRecipesFiltered = allRecipesFiltered.filter((recipe) => favoriteIds.has(recipe.id));
  }
  if (kidFriendlyOnly) {
    allRecipesFiltered = allRecipesFiltered.filter((recipe) => kidFriendlyIds.has(recipe.id));
  }
  if (allRecipesFiltered.length === 0) throw new Error('No recipes match your regenerate filters.');

  // Fetch existing meals for this week (to preserve locked ones)
  const { data: existing } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('week_of', weekOf);

  const existingMeals = existing || [];
  const previousRecipeByDay = new Map(existingMeals.map((m) => [m.day, m.recipe_id]));
  
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
    existingMeals.filter((m) => m.is_locked && !!m.recipe_id).map((m) => m.recipe_id as string)
  );
  const keptDays = new Set(
    existingMeals.filter(m => !targetDays.includes(m.day as DayOfWeek) || m.is_locked).map(m => m.day)
  );

  // Days that need new meals
  const daysNeedingMeals = targetDays.filter(d => !keptDays.has(d));

  // Anchored recipes get priority
  const anchored = allRecipesFiltered.filter(r => r.is_anchored && r.default_day && !lockedRecipeIds.has(r.id));
  const flexible = allRecipesFiltered.filter(r => !r.is_anchored && !lockedRecipeIds.has(r.id));

  const newMeals: { recipe_id: string; day: string; week_of: string }[] = [];
  const usedRecipeIds = new Set(lockedRecipeIds);

  // Apply recurring day locks first (example: tacos every Tuesday).
  for (const day of daysNeedingMeals.slice()) {
    if (isNoMealNeededLock(dayLocks[day])) {
      daysNeedingMeals.splice(daysNeedingMeals.indexOf(day), 1);
      continue;
    }
    const forcedRecipe = resolveDayLockRecipe(allRecipesFiltered, dayLocks[day]);
    if (!forcedRecipe) continue;

    newMeals.push({ recipe_id: forcedRecipe.id, day, week_of: weekOf });
    usedRecipeIds.add(forcedRecipe.id);
    daysNeedingMeals.splice(daysNeedingMeals.indexOf(day), 1);
  }

  // Place anchored recipes first
  for (const recipe of anchored) {
    if (daysNeedingMeals.includes(recipe.default_day as DayOfWeek)) {
      newMeals.push({ recipe_id: recipe.id, day: recipe.default_day!, week_of: weekOf });
      usedRecipeIds.add(recipe.id);
      daysNeedingMeals.splice(daysNeedingMeals.indexOf(recipe.default_day as DayOfWeek), 1);
    }
  }

  // Fill remaining days with weighted picks; favorites can be prioritized.
  for (const day of daysNeedingMeals) {
    const previousRecipeId = previousRecipeByDay.get(day);
    const preferredPool = flexible.filter((r) => r.id !== previousRecipeId);
    const flexiblePool = preferredPool.length > 0 ? preferredPool : flexible;

    let recipe = weightedPick(
      flexiblePool,
      usedRecipeIds,
      favoriteIds,
      kidFriendlyIds,
      preferFavorites,
      preferKidFriendly,
    );
    if (!recipe) {
      const allPreferred = allRecipesFiltered.filter((r) => r.id !== previousRecipeId);
      const allPool = allPreferred.length > 0 ? allPreferred : allRecipesFiltered;
      // If we run out of unique options, allow reuse from full filtered pool.
      recipe = weightedPick(
        allPool,
        new Set<string>(),
        favoriteIds,
        kidFriendlyIds,
        preferFavorites,
        preferKidFriendly,
      );
    }
    if (recipe) {
      newMeals.push({ recipe_id: recipe.id, day, week_of: weekOf });
      usedRecipeIds.add(recipe.id);
    }
  }

  if (newMeals.length > 0) {
    const { error } = await supabase
      .from('planned_meals')
      .insert(newMeals);
    if (error) throw error;
  }

  const refreshed = await fetchMealsForWeek(weekOffset);
  await syncMealCalendarSafely(refreshed);
  return refreshed;
}

export async function swapMeal(mealId: string, weekOf: string, day: string): Promise<DbPlannedMeal[]> {
  if (isDemoModeEnabled()) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const mealWeek = new Date(weekOf);
    const diffWeeks = Math.round((mealWeek.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const meals = getDemoMeals(diffWeeks);
    const recipes = getDemoRecipes();
    const used = new Set(meals.map((m) => m.recipe_id));
    const current = meals.find((m) => m.id === mealId);
    const fallback = recipes.find((r) => r.id !== current?.recipe_id);
    const replacement = recipes.find((r) => !used.has(r.id) && r.id !== current?.recipe_id) || fallback || recipes[0];
    const next = meals.map(({ recipes: _, ...m }) =>
      m.id === mealId && replacement ? { ...m, recipe_id: replacement.id } : m,
    );
    setDemoMeals(diffWeeks, next);
    return getDemoMeals(diffWeeks);
  }

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

  const usedIds = new Set((weekMeals || []).map((m) => m.recipe_id).filter(Boolean));

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

  const diffWeeks = getWeekOffsetFromWeekOf(weekOf);
  const refreshed = await fetchMealsForWeek(diffWeeks);
  await syncMealCalendarSafely(refreshed);
  return refreshed;
}

export async function updateMealRecipe(mealId: string, recipeId: string, weekOf: string): Promise<DbPlannedMeal[]> {
  if (isDemoModeEnabled()) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const mealWeek = new Date(weekOf);
    const diffWeeks = Math.round((mealWeek.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const meals = getDemoMeals(diffWeeks);
    const next = meals.map(({ recipes: _, ...m }) => (m.id === mealId ? { ...m, recipe_id: recipeId } : m));
    setDemoMeals(diffWeeks, next);
    return getDemoMeals(diffWeeks);
  }

  const { error } = await supabase
    .from('planned_meals')
    .update({ recipe_id: recipeId })
    .eq('id', mealId);
  if (error) throw error;

  const diffWeeks = getWeekOffsetFromWeekOf(weekOf);
  const refreshed = await fetchMealsForWeek(diffWeeks);
  await syncMealCalendarSafely(refreshed);
  return refreshed;
}

export async function toggleMealLock(mealId: string, isLocked: boolean, weekOf?: string) {
  if (isDemoModeEnabled()) {
    if (!weekOf) return;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const mealWeek = new Date(weekOf);
    const diffWeeks = Math.round((mealWeek.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const scoped = getDemoMeals(diffWeeks);
    const next = scoped.map(({ recipes: _, ...m }) => (m.id === mealId ? { ...m, is_locked: isLocked } : m));
    setDemoMeals(diffWeeks, next);
    return;
  }

  const { error } = await supabase
    .from('planned_meals')
    .update({ is_locked: isLocked })
    .eq('id', mealId);
  if (error) throw error;
}

export async function toggleMealSkip(mealId: string, isSkipped: boolean, weekOf?: string) {
  if (isDemoModeEnabled()) {
    if (!weekOf) return;
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const mealWeek = new Date(weekOf);
    const diffWeeks = Math.round((mealWeek.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const scoped = getDemoMeals(diffWeeks);
    const next = scoped.map(({ recipes: _, ...m }) => (m.id === mealId ? { ...m, is_skipped: isSkipped } : m));
    setDemoMeals(diffWeeks, next);
    return;
  }

  const { error } = await supabase
    .from('planned_meals')
    .update({ is_skipped: isSkipped })
    .eq('id', mealId);
  if (error) throw error;

  if (weekOf) {
    const diffWeeks = getWeekOffsetFromWeekOf(weekOf);
    const refreshed = await fetchMealsForWeek(diffWeeks);
    await syncMealCalendarSafely(refreshed);
  }
}
