import { describe, expect, it } from 'vitest';
import { normalizeRecipeIngredients } from '@/lib/recipeText';

describe('normalizeRecipeIngredients', () => {
  it('repairs split quantity and descriptor lines from OCR imports', () => {
    const input = [
      '900g',
      '32 oz) chicken breast',
      '250g',
      '1 cup) plain',
      '0% Greek yogurt or Skyr',
      '30g',
      '2 Tbsp) butter',
    ];

    expect(normalizeRecipeIngredients(input)).toEqual([
      '900g (32 oz) chicken breast',
      '250g (1 cup) plain 0% Greek yogurt or Skyr',
      '30g (2 Tbsp) butter',
    ]);
  });
});
