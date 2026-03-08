import type { DbRecipe } from '@/lib/api/recipes';
import type { PlannedMealType } from '@/lib/mealBudgetPlanner';

export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MacroMealSuggestion {
  recipeId: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  mealType: string;
  score: number;
  reason: string;
}

interface SuggestMealsInput {
  recipes: DbRecipe[];
  target: MacroTargets;
  projected: MacroTargets;
  desiredMealType?: PlannedMealType;
  limit?: number;
}

const MIN_CALORIE_SCALE = 150;
const MIN_MACRO_SCALE = 25;

const MEAL_TYPE_ALIASES: Record<PlannedMealType, string[]> = {
  breakfast: ['breakfast', 'am', 'morning'],
  lunch: ['lunch', 'midday'],
  dinner: ['dinner', 'supper', 'evening'],
  snack: ['snack'],
  dessert: ['dessert', 'sweet'],
  alcohol: ['alcohol', 'drink', 'cocktail'],
};

function normalize(value: string | null | undefined): string {
  return (value || '').toLowerCase().trim();
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function scoreDistance(current: number, target: number, scale: number): number {
  const delta = Math.abs(current - target);
  return delta / Math.max(scale, target);
}

function getRemaining(target: MacroTargets, projected: MacroTargets): MacroTargets {
  return {
    calories: target.calories - projected.calories,
    protein_g: target.protein_g - projected.protein_g,
    carbs_g: target.carbs_g - projected.carbs_g,
    fat_g: target.fat_g - projected.fat_g,
  };
}

function clampToPositive(macros: MacroTargets): MacroTargets {
  return {
    calories: Math.max(0, macros.calories),
    protein_g: Math.max(0, macros.protein_g),
    carbs_g: Math.max(0, macros.carbs_g),
    fat_g: Math.max(0, macros.fat_g),
  };
}

function mealTypePenalty(recipe: DbRecipe, desiredMealType?: PlannedMealType): number {
  if (!desiredMealType) return 0;
  const haystack = `${normalize(recipe.meal_type)} ${normalize(recipe.name)}`;
  const aliases = MEAL_TYPE_ALIASES[desiredMealType];
  const matches = aliases.some((alias) => haystack.includes(alias));
  return matches ? 0 : 0.22;
}

function reasonForMatch(remaining: MacroTargets, recipe: DbRecipe): string {
  const needs = [
    { key: 'protein_g', label: 'protein', value: Math.max(0, remaining.protein_g), recipeValue: recipe.protein_g },
    { key: 'carbs_g', label: 'carbs', value: Math.max(0, remaining.carbs_g), recipeValue: recipe.carbs_g },
    { key: 'fat_g', label: 'fat', value: Math.max(0, remaining.fat_g), recipeValue: recipe.fat_g },
  ].sort((a, b) => b.value - a.value);

  if (remaining.calories <= 0) {
    return 'Lower-calorie option because you are already near or above calorie target.';
  }
  if (needs[0].value > 0 && needs[0].recipeValue > 0) {
    return `Good match for remaining ${needs[0].label}.`;
  }
  return 'Balanced fit for remaining macros.';
}

export function suggestMealsForRemainingMacros({
  recipes,
  target,
  projected,
  desiredMealType,
  limit = 6,
}: SuggestMealsInput): MacroMealSuggestion[] {
  const validRecipes = recipes.filter((recipe) => recipe.id && recipe.name);
  if (!validRecipes.length) return [];

  const remainingRaw = getRemaining(target, projected);
  const remaining = clampToPositive(remainingRaw);
  const overCalories = remainingRaw.calories <= 0;

  const ranked = validRecipes
    .map((recipe) => {
      const calories = Math.max(0, Math.round(finiteNumber(recipe.calories)));
      const protein = Math.max(0, Math.round(finiteNumber(recipe.protein_g)));
      const carbs = Math.max(0, Math.round(finiteNumber(recipe.carbs_g)));
      const fat = Math.max(0, Math.round(finiteNumber(recipe.fat_g)));

      let distance = 0;
      if (overCalories) {
        distance += calories / Math.max(MIN_CALORIE_SCALE, target.calories * 0.2);
        distance += (carbs + fat) / 100;
      } else {
        distance += scoreDistance(calories, remaining.calories, MIN_CALORIE_SCALE) * 0.45;
        distance += scoreDistance(protein, remaining.protein_g, MIN_MACRO_SCALE) * 0.3;
        distance += scoreDistance(carbs, remaining.carbs_g, MIN_MACRO_SCALE) * 0.15;
        distance += scoreDistance(fat, remaining.fat_g, MIN_MACRO_SCALE) * 0.1;
      }

      distance += mealTypePenalty(recipe, desiredMealType);
      const score = Math.max(0, Math.min(100, Math.round((1 - Math.min(distance, 2)) * 100)));

      return {
        recipeId: recipe.id,
        name: recipe.name,
        calories,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        mealType: recipe.meal_type || 'unspecified',
        score,
        reason: reasonForMatch(remainingRaw, recipe),
      } satisfies MacroMealSuggestion;
    })
    .sort((a, b) => b.score - a.score || a.calories - b.calories || a.name.localeCompare(b.name));

  return ranked.slice(0, Math.max(1, limit));
}

