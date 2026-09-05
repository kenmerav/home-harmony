export type CleanupRecipe = { id: string; owner_id: string; name: string; ingredients: unknown; ingredients_raw: string | null; instructions: string | null; updated_at: string };
export type CleanupChange = { recipe: CleanupRecipe; action: 'delete' | 'repair'; reason: string; ingredients: string[] };

// Deliberately conservative: preserve quantities and preparation notes.
export function repairIngredientLines(value: unknown): string[] {
  const lines = (Array.isArray(value) ? value : typeof value === 'string' ? [value] : [])
    .filter((line): line is string => typeof line === 'string').flatMap(line => line.split(/\r?\n/)).map(line => line.trim()).filter(Boolean);
  const joined: string[] = [];
  for (const line of lines) {
    const previous = joined[joined.length - 1];
    if (previous && /&(?:#39|#x27|apos)$/i.test(previous) && /^s\b/i.test(line)) {
      joined[joined.length - 1] += `;${line.replace(/^S\b/, 's')}`;
    } else if (previous && /^\d+(?:\s+\d+\/\d+|\/\d+|\.\d+)?\s*(?:g|kg|oz|lb|lbs|cups?|tbsp|tsp|ml|l)$/i.test(previous) && /^[a-z]/i.test(line) && !/^(ingredients|instructions|sauce|garnish)\s*:/i.test(line)) {
      joined[joined.length - 1] += ` ${line}`;
    } else joined.push(line);
  }
  return joined.map(line => line.replace(/&#(?:39|x27);|&apos;/gi, "'").replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&nbsp;/gi, ' '));
}
function hasContent(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasContent);
  if (typeof value !== 'string') return false;
  const text = value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
  if (!text || /^(null|undefined|\[\s*\]|\{\s*\})$/i.test(text)) return false;
  if (text.startsWith('[')) { try { return hasContent(JSON.parse(text)); } catch { /* Plain text remains valid. */ } }
  return true;
}
export function planRecipeCleanup(recipes: CleanupRecipe[]): CleanupChange[] {
  return recipes.flatMap(recipe => {
    if (recipe.name === '__No Meal Needed Placeholder__') return [];
    const original = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    const ingredients = repairIngredientLines(hasContent(original) ? original : recipe.ingredients_raw);
    const missing = [!ingredients.length && 'ingredients', !hasContent(recipe.instructions) && 'instructions'].filter(Boolean);
    if (missing.length) return [{ recipe, action: 'delete' as const, reason: `Missing ${missing.join(' and ')}`, ingredients }];
    if (JSON.stringify(original) !== JSON.stringify(ingredients)) return [{ recipe, action: 'repair' as const, reason: 'Repair explicit line breaks, split names or encoded punctuation', ingredients }];
    return [];
  });
}
