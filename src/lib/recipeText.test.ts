import { describe, expect, it } from 'vitest';
import { normalizeRecipeIngredients } from './recipeText';
describe('ingredient boundaries and quantities', () => {
  it('preserves literal whole quantities instead of guessing missing fractions', () => {
    expect(normalizeRecipeIngredients(['4 tbsp soy sauce', '4 cup rice', '4 tsp salt'])).toEqual(['4 tbsp soy sauce', '4 cup rice', '4 tsp salt']);
  });
  it('decodes an apostrophe before splitting and repairs the observed stored split', () => {
    expect(normalizeRecipeIngredients(['2 packs (7 oz each) Trader Joe&#39;s Thai Wheat Noodles'])).toEqual(["2 packs (7 oz each) Trader Joe's Thai Wheat Noodles"]);
    expect(normalizeRecipeIngredients(['2 packs (7 oz each) Trader Joe&#39', 'S Thai Wheat Noodles (see notes)'])).toEqual(["2 packs (7 oz each) Trader Joe'S Thai Wheat Noodles (see notes)"]);
  });
  it('keeps preparation notes with their ingredients', () => {
    expect(normalizeRecipeIngredients(['Fresh basil, chopped', 'Parmesan cheese, grated'])).toEqual(['Fresh basil, chopped', 'Parmesan cheese, grated']);
  });
  it('splits merged quantified ingredients without splitting alternate units', () => {
    expect(normalizeRecipeIngredients(['40g (1/3 cup) Parmesan cheese 30g (2 tbsp) olive oil'])).toEqual(['40g (1/3 cup) Parmesan cheese', '30g (2 tbsp) olive oil']);
  });
  it('honors explicit newlines inside imported array elements', () => {
    expect(normalizeRecipeIngredients(['1 tbsp olive oil\n2 tsp salt'])).toEqual(['1 tbsp olive oil', '2 tsp salt']);
  });
});
