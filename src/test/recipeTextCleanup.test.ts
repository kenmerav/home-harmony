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

  it('repairs split lean-ratio meat lines and dropped quarter fractions', () => {
    const input = [
      '1 lb (16 oz) 93/',
      '7 Ground Turkey',
      '4 tsp Onion Powder',
      '4 tsp Black Pepper',
      '4 Cup Hoisin Sauce',
      '1 tsp Lemon Juice',
    ];

    expect(normalizeRecipeIngredients(input)).toEqual([
      '1 lb (16 oz) 93/7 Ground Turkey',
      '1/4 tsp Onion Powder',
      '1/4 tsp Black Pepper',
      '1/4 cup Hoisin Sauce',
      '1 tsp Lemon Juice',
    ]);
  });

  it('repairs split imported sauce lines from recipe URLs', () => {
    const input = [
      '1/4 C',
      '(60 g) Sweet Chili Sauce',
      '3 Tbsp 30',
      '(45 g) Sriracha, to spice preference',
    ];

    expect(normalizeRecipeIngredients(input)).toEqual([
      '1/4 C (60 g) Sweet Chili Sauce',
      '3 Tbsp (45 g) Sriracha',
    ]);
  });
});
