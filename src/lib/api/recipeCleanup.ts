import { supabase } from '@/integrations/supabase/client';
import { getSharedHouseholdOwnerId } from '@/lib/householdScope';
import { CleanupRecipe, CleanupChange } from '@/lib/recipeCleanup';

export async function readCleanupRecipes(): Promise<{ ownerId: string; recipes: CleanupRecipe[] }> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Sign in before cleaning up recipes.');
  const ownerId = getSharedHouseholdOwnerId() || auth.user.id;
  const recipes: CleanupRecipe[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from('recipes').select('*').eq('owner_id', ownerId).order('id').range(start, start + 499);
    if (error) throw error;
    recipes.push(...data as CleanupRecipe[]);
    if (data.length < 500) break;
  }
  return { ownerId, recipes };
}
export async function applyRecipeCleanup(ownerId: string, changes: CleanupChange[], progress: (completed: number) => void) {
  const current = await readCleanupRecipes();
  if (current.ownerId !== ownerId) throw new Error('Household changed. Run the scan again.');
  const byId = new Map(current.recipes.map(recipe => [recipe.id, recipe]));
  // Validate the entire review before starting. Row timestamps also protect each write.
  for (const change of changes) {
    if (change.recipe.owner_id !== ownerId || !change.recipe.updated_at || JSON.stringify(byId.get(change.recipe.id)) !== JSON.stringify(change.recipe)) throw new Error('A recipe changed since the scan. Close this review and scan again.');
  }
  const completed: string[] = [];
  for (const change of changes) {
    const mutation = change.action === 'delete'
      ? supabase.from('recipes').delete()
      : supabase.from('recipes').update({ ingredients: change.ingredients, ingredients_raw: change.ingredients.join('\n') });
    const { data, error } = await mutation.eq('owner_id', ownerId).eq('id', change.recipe.id).eq('updated_at', change.recipe.updated_at).select('id');
    if (error || data?.length !== 1) throw new Error(`${completed.length} changes completed. Stopped at ${change.recipe.name}: ${error?.message || 'recipe changed or access denied'}. Scan again before retrying.`);
    completed.push(change.recipe.id);
    progress(completed.length);
  }
  return completed;
}
