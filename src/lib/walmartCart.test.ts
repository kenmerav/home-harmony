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
