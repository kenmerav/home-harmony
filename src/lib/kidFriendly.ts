import { DbRecipe } from '@/lib/api/recipes';

const notKidFriendlyTerms = [
  'spicy', 'buffalo', 'harissa', 'chipotle', 'jalapeno', 'jalapeño', 'curry', 'thai', 'korean',
  'miso', 'birria', 'carnitas', 'tinga', 'enchilada', 'chorizo', 'gochujang', 'wasabi',
];

const kidFriendlyTerms = [
  'mac', 'mac n', 'mac and cheese', 'alfredo', 'pizza', 'pasta', 'queso', 'burger', 'sandwich',
  'burrito', 'rice bowl', 'chicken and rice', 'meatball', 'cheesy', 'parmesan', 'fried rice',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function inferKidFriendly(recipe: Pick<DbRecipe, 'name' | 'ingredients' | 'instructions'>): boolean {
  const text = normalize(
    `${recipe.name} ${(recipe.ingredients || []).join(' ')} ${recipe.instructions || ''}`,
  );

  if (notKidFriendlyTerms.some((term) => text.includes(term))) return false;
  if (kidFriendlyTerms.some((term) => text.includes(term))) return true;

  // Mild defaults that are usually kid-safe.
  if (text.includes('chicken') && text.includes('rice')) return true;
  if (text.includes('beef') && text.includes('pasta')) return true;

  return false;
}
