import { expect, it } from 'vitest';
import { CleanupRecipe, planRecipeCleanup, repairIngredientLines } from './recipeCleanup';
const recipe: CleanupRecipe = { id: 'r1', owner_id: 'owner', name: 'Dinner', ingredients: ['4 tbsp olive oil'], ingredients_raw: null, instructions: 'Mix.', updated_at: '2026-09-05' };
it('deletes recipes missing either ingredients or instructions', () => {
  expect(planRecipeCleanup([{ ...recipe, instructions: '' }])[0].action).toBe('delete');
  expect(planRecipeCleanup([{ ...recipe, ingredients: [] }])[0].action).toBe('delete');
  expect(planRecipeCleanup([{ ...recipe, instructions: '["", " "]' }])[0].action).toBe('delete');
});
it('preserves system placeholders and recovers available raw ingredients', () => {
  expect(planRecipeCleanup([{ ...recipe, name: '__No Meal Needed Placeholder__', instructions: '' }])).toEqual([]);
  const plan = planRecipeCleanup([{ ...recipe, ingredients: [], ingredients_raw: '2 eggs\n1 tbsp oil' }]);
  expect(plan[0].action).toBe('repair');
  expect(plan[0].ingredients).toEqual(['2 eggs', '1 tbsp oil']);
});
it('repairs observed apostrophe splits and standalone quantity fragments', () => {
  expect(repairIngredientLines(['2 packs Trader Joe&#39', 'S noodles', '30 g', 'olive oil'])).toEqual(["2 packs Trader Joe's noodles", '30 g olive oil']);
});
it('preserves fractions, four tablespoons, and prep notes without merging ingredients', () => {
  const lines = ['4 tbsp olive oil', '1 1/2 cups milk', 'Fresh basil, chopped', 'Parmesan, grated'];
  expect(repairIngredientLines(lines)).toEqual(lines);
  expect(planRecipeCleanup([recipe])).toEqual([]);
});
