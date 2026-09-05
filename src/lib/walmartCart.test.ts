import { describe, expect, it } from 'vitest';
import { buildWalmartCartUrl, isSeasoning, isWater, packageCount, parseWalmartId, walmartSearch } from './walmartCart';
describe('Walmart weekly cart', () => {
  it('accepts product links and rejects unrelated or deceptive URLs', () => {
    expect(parseWalmartId('https://www.walmart.com/ip/Spaghetti/12345678?foo=bar')).toBe('12345678');
    expect(parseWalmartId('https://walmart.com/ip/12345678')).toBe('12345678');
    for (const value of ['https://walmart.com.evil.test/ip/12345678', 'javascript:alert(1)', 'https://evil.test/ip/12345678', 'https://www.walmart.com/search?q=12345678', 'https://user@walmart.com/ip/12345678', '123_2']) expect(parseWalmartId(value)).toBeNull();
  });
  it('converts compatible recipe quantities and rounds up whole packages', () => {
    expect(packageCount('1360 g', '1 lb')).toBe(3);
    expect(packageCount('1 lb + 8 oz', '16 oz')).toBe(2);
    expect(packageCount('1 1/2 cups', '17 fl oz')).toBe(1);
    expect(packageCount('1/2 cup', '4 fl oz')).toBe(1);
    expect(packageCount('32 oz', '16 oz')).toBe(2);
  });
  it('requires manual review for incompatible or unspecified quantities', () => {
    for (const required of ['2x', '20 cloves', '40 g', 'to taste', '1 cup + 1 g', '1/0 cup']) expect(packageCount(required, '1 cup')).toBeNull();
    expect(packageCount('1 cup', '0 cup')).toBeNull();
  });
  it('combines duplicate products and constructs the documented bulk-cart URL', () => {
    expect(buildWalmartCartUrl([{ id: '12345678', quantity: 2 }, { id: '12345678', quantity: 3 }, { id: '87654321', quantity: 1 }])).toBe('https://www.walmart.com/sc/cart/addToCart?items=12345678_5,87654321_1');
    for (const quantity of [0, -1, 1.5, NaN, 1000]) expect(() => buildWalmartCartUrl([{ id: '12345678', quantity }])).toThrow();
    expect(() => buildWalmartCartUrl([])).toThrow();
  });
  it('skips seasonings and water without skipping actual garlic or baking soda', () => {
    expect(isSeasoning('Coarse salt')).toBe(true);
    expect(isSeasoning('garlic powder')).toBe(true);
    expect(isSeasoning('garlic')).toBe(false);
    expect(isSeasoning('baking soda')).toBe(false);
    expect(isWater('Water')).toBe(true);
    expect(decodeURIComponent(walmartSearch('milk'))).toContain('reduced fat');
    expect(decodeURIComponent(walmartSearch('ground beef'))).toContain('lean');
  });
});

import { automaticProduct, cartPackageCount } from './walmartCart';
it('matches next week meal ingredients despite imported preparation text', () => {
  const names = ['Thai Basil', 'handfuls Cilantro chopped', 'small Lime zest and juice', 'Baby Spinach chopped', 'lemons zest of 1, juice of both', '-2 Frozen Crushed Garlic Cubes or 1-2 cloves freshly crushed garlic', 'Black Pepper', 'bag 14 oz Frozen Fire Roasted Peppers and Onions', 'fresh ginger', 'Cherry Tomatoes halved', 'Shredded Lettuce', 'Extra Lean Ground Beef', 'Chicken Bone Broth', 'Boneless Skinless Chicken Breast', 'Ground Chicken or Turkey', '1/4 cup Beef Broth or Water', 'Fiesta cheese', 'can Reduced Fat Coconut Milk', 'taco seasoning', 'box hard shell tacos', 'Thai Red Curry Paste or another chili sauce/paste', '112g Roasted Salted Peanuts roughly chopped', '10 oz bags Frozen Steamed Jasmine Rice or 6 cups of cooked jasmine rice', 'dry Protein Pasta', '1/4 cup 72g Hoisin Sauce', 'Tortilla chips', 'Queso', '1/4 cup Coconut Aminos', '5 oz Grated Parmesan', '15 oz Artichoke Hearts drained and chopped', 'Coarse Dijon Mustard', '/2 cup 56g Roasted Cashew Halves'];
  for (const name of names) expect(automaticProduct(name), name).toBeDefined();
  for (const name of ['Trader Joe&#39', 'unknown food', 'peanut butter', 'beef broth powder', 'chicken flavored noodles']) expect(automaticProduct(name), name).toBeUndefined();
  expect(isWater('1/4 cup Water')).toBe(true);
  expect(isWater('1/4 cup Beef Broth or Water')).toBe(false);
});
it('covers meal quantities without confusing recipe occurrences with packages', () => {
  const count = (name: string, quantity: string) => cartPackageCount({ key: name, name, quantity, isChecked: false }, automaticProduct(name));
  expect(count('Extra Lean Ground Beef', '5 lb')).toBe(5);
  expect(count('Chicken Bone Broth', '6 cups')).toBe(2);
  expect(count('small Lime zest and juice', '2 items')).toBe(2);
  expect(count('lemons zest of 1, juice of both', '4 items')).toBe(4);
  expect(count('handfuls Cilantro chopped', '4 items')).toBe(2);
  expect(count('Black Pepper', '2x')).toBe(1);
  expect(count('taco seasoning', '2 packets')).toBe(2);
  expect(count('can Reduced Fat Coconut Milk', '28 oz')).toBe(3);
  expect(count('10 oz bags Frozen Steamed Jasmine Rice or 6 cups of cooked jasmine rice', '6 items')).toBe(7);
  expect(count('15 oz Artichoke Hearts drained and chopped', '2 cans')).toBe(3);
  expect(count('5 oz Grated Parmesan', '2.5 cups')).toBe(2);
  expect(count('1/4 cup Coconut Aminos', '2 items')).toBe(1);
  expect(count('dry Protein Pasta', '24 oz')).toBe(2);
});
