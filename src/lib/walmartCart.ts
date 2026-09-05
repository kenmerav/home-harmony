import { mealProduct } from './walmartMealProducts';
export interface WalmartProduct { id: string; label: string; size?: string }
export interface CartIngredient { key: string; name: string; quantity: string; isChecked: boolean }
export const ingredientKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
export const isSeasoning = (name: string) => /^(coarse |kosher |sea )?salt$|^(ground )?(black )?pepper$|^(italian seasoning|garlic powder|onion powder|paprika|cumin|dried oregano|dried basil|cinnamon)$/.test(ingredientKey(name));
export const isWater = (name: string) => /^(?:[0-9 ]+ (?:cup|cups|tablespoon|tablespoons|tbsp|tsp) )?(water|cold water|warm water|hot water|boiling water)(?: to thin)?$/.test(ingredientKey(name));

// Exact ingredient matches only. Walmart confirms local availability and price at handoff.
export const suggestedProducts: Record<string, WalmartProduct> = {
  'ground beef': { id: '16322759490', label: 'Extra Lean Ground Beef, 96% lean, 1 lb', size: '1 lb' },
  'parmesan cheese': { id: '10307326', label: '4C Parmesan-Romano Grated Cheese, 6 oz', size: '6 oz' },
  'nutritional yeast': { id: '226488899', label: 'Great Value Nutritional Yeast Flakes, 5 oz', size: '5 oz' },
  'olive oil': { id: '10315102', label: 'Great Value Extra Virgin Olive Oil, 17 fl oz', size: '17 fl oz' },
  'tomato paste': { id: '10415519', label: 'Great Value Tomato Paste, 6 oz', size: '6 oz' },
  'sweet onions': { id: '44390992', label: 'Fresh Sweet Onion, each', size: '1 each' },
  'fresh basil': { id: '3757188318', label: 'Fresh Basil, 0.5 oz', size: '0.5 oz' },
};

// Product IDs verified against Walmart product pages. Availability is checked by Walmart.
Object.assign(suggestedProducts, {
  'bananas': { id: '44390948', label: 'Fresh Banana, each', size: '1 each' },
  'apples': { id: '44390953', label: 'Fresh Gala Apple, each', size: '1 each' },
  'blueberries': { id: '161115457', label: 'Fresh Blueberries, 18 oz container', size: '18 oz' },
  'raspberries': { id: '44390957', label: 'Fresh Raspberries, 12 oz container', size: '12 oz' },
  'whole milk': { id: '10450118', label: 'Great Value Whole Milk, half gallon', size: '64 fl oz' },
  'chocolate milk': { id: '44391121', label: 'Great Value 1% Low-fat Chocolate Milk, half gallon', size: '64 fl oz' },
  'great value light nonfat greek yogurt 5 3 oz cups 4 pack': { id: '34788349', label: 'Great Value Vanilla Light Nonfat Greek Yogurt, 4 × 5.3 oz cups', size: '21.2 oz' },
  'great value vanilla light nonfat greek yogurt 32oz tub': { id: '41972648', label: 'Great Value Vanilla Light Nonfat Greek Yogurt, 32 oz tub', size: '32 oz' },
  'great value pre sliced cinnamon raisin bagels': { id: '588263237', label: 'Great Value Cinnamon Raisin Bagels, 6 count', size: '20 oz' },
  'jimmy dean protein waffles': { id: '18375414744', label: 'Jimmy Dean Protein Buttermilk Waffles, 8 count', size: '11.28 oz' },
});
const aliases: Record<string, string> = {
  banana: 'bananas', apple: 'apples', 'gala apple': 'apples', 'gala apples': 'apples',
  rasberries: 'raspberries', raspberry: 'raspberries', blueberry: 'blueberries',
  'extra virgin olive oil': 'olive oil', 'grated parmesan cheese': 'parmesan cheese',
  'sweet onion': 'sweet onions',
  'great value vanilla light nonfat greek yogurt 32 oz tub': 'great value vanilla light nonfat greek yogurt 32oz tub',
};
export function automaticProduct(name: string): WalmartProduct | undefined {
  const key = ingredientKey(name);
  return suggestedProducts[key] || suggestedProducts[aliases[key]] || mealProduct(key);
}
export function bestPackageCount(required: string, size?: string): number {
  const raw = required.trim().toLowerCase();
  // A standalone grocery count is packages (or individual produce), not ounces.
  if (/^\d+(?:\.\d+)?(?:x)?$/.test(raw)) return Math.max(1, Math.ceil(parseFloat(raw)));
  const normalized = raw.replace(/^half gallon$/, '64 fl oz').replace(/^one gallon$/, '128 fl oz');
  return packageCount(normalized, size) || 1;
}

// Keep the original grocery key and checkmark. Interpret malformed imported quantities
// only for the cart, with an explicit estimate rather than rewriting saved groceries.
export function cartPackageCount(item: CartIngredient, product?: WalmartProduct): number {
  const key = ingredientKey(item.name);
  const qty = item.quantity.trim().toLowerCase();
  const n = parseFloat(qty) || 1;
  if (product?.id === '160597260' && key.startsWith('handful')) return Math.max(1, Math.ceil(n / 2));
  if (/^(?:small )?lime|^lemons?/.test(key) && /^\d+ items?$/.test(qty)) return packageCount(`${n} each`, product?.size) || 1;
  if (key === 'black pepper' && /x$/.test(qty)) return 1; // Unspecified seasoning occurrences, not jars.
  if (key === 'taco seasoning' && /packets?$/.test(qty)) return packageCount(`${n} oz`, product?.size) || 1;
  if (/^15 oz artichoke hearts/.test(key) && /cans?$/.test(qty)) return product?.id === '975471117' ? Math.ceil(n) : packageCount(`${n * 15} oz`, product?.size) || 1; // Recipe specifies standard cans.
  if (/^10 oz bags frozen steamed jasmine rice/.test(key) && /items?$/.test(qty)) return packageCount(`${n * 10} oz`, product?.size) || 1;
  if (/^(?:can )?reduced fat coconut milk$/.test(key) && / oz$/.test(qty)) return product?.id === '47737969' ? Math.ceil(n / 14) : packageCount(`${n} fl oz`, product?.size) || 1; // Recipe uses rounded 14 oz standard cans.
  // Grated Parmesan is approximately 4 oz per cup; the imported 5 oz is a second measurement.
  if (/grated parmesan$/.test(key) && /cups?$/.test(qty)) return packageCount(`${n * 4} oz`, product?.size) || 1;
  // A fraction left in the name belongs to each recipe occurrence, not a package count.
  const embedded = item.name.match(/^(\d+\/\d+)\s+(cups?|tbsp|tsp)\s/i);
  if (embedded && /^\d+ items?$/.test(qty)) {
    return packageCount(Array.from({ length: Math.min(999, Math.ceil(n)) }, () => `${embedded[1]} ${embedded[2]}`).join(' + '), product?.size) || 1;
  }
  return bestPackageCount(item.quantity, product?.size);
}

export function parseWalmartId(input: string): string | null {
  const value = input.trim();
  if (/^\d{6,20}$/.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !['walmart.com', 'www.walmart.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
    return url.pathname.match(/^\/ip\/(?:[^/]+\/)?(\d{6,20})\/?$/)?.[1] ?? null;
  } catch { return null; }
}

const units: Record<string, [string, number]> = {
  g: ['mass', 1], gram: ['mass', 1], grams: ['mass', 1], kg: ['mass', 1000],
  oz: ['mass', 28.349523125], ounce: ['mass', 28.349523125], ounces: ['mass', 28.349523125],
  lb: ['mass', 453.59237], lbs: ['mass', 453.59237], pound: ['mass', 453.59237], pounds: ['mass', 453.59237],
  ml: ['volume', 1], l: ['volume', 1000], 'fl oz': ['volume', 29.5735295625],
  cup: ['volume', 236.5882365], cups: ['volume', 236.5882365], tbsp: ['volume', 14.78676478125], tsp: ['volume', 4.92892159375],
  each: ['count', 1], count: ['count', 1],
};
function amount(text: string): { dimension: string; value: number } | null {
  const match = text.trim().toLowerCase().match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s+([a-z ]+)$/);
  if (!match || !units[match[2]]) return null;
  const numbers = match[1].split(/\s+/).map(part => part.includes('/') ? Number(part.split('/')[0]) / Number(part.split('/')[1]) : Number(part));
  const value = numbers.reduce((a, b) => a + b, 0) * units[match[2]][1];
  return Number.isFinite(value) && value > 0 ? { dimension: units[match[2]][0], value } : null;
}
export function packageCount(required: string, size?: string): number | null {
  const pack = size ? amount(size) : null;
  const parts = required.split('+').map(amount);
  if (!pack || parts.some(part => !part || part.dimension !== pack.dimension)) return null;
  return Math.ceil(parts.reduce((sum, part) => sum + part!.value, 0) / pack.value - 1e-9);
}
export function walmartSearch(name: string): string {
  const preference = /beef|turkey|chicken|pork/i.test(name) ? 'lean' : /cheese|milk|yogurt|cream/i.test(name) ? 'Great Value reduced fat' : 'Great Value';
  return `https://www.walmart.com/search?q=${encodeURIComponent(`${preference} ${name}`)}`;
}
export function buildWalmartCartUrl(rows: Array<{ id: string; quantity: number }>): string {
  if (!rows.length) throw new Error('Choose at least one product.');
  const merged = new Map<string, number>();
  for (const row of rows) {
    if (!/^\d{6,20}$/.test(row.id) || !Number.isSafeInteger(row.quantity) || row.quantity < 1 || row.quantity > 999) throw new Error('Check product IDs and package quantities (1–999).');
    merged.set(row.id, (merged.get(row.id) ?? 0) + row.quantity);
  }
  if ([...merged.values()].some(qty => qty > 999)) throw new Error('Combined package quantity cannot exceed 999.');
  // Walmart public Add To Cart service: https://walmart.io/docs/atc/v1/add-to-cart
  const url = `https://www.walmart.com/sc/cart/addToCart?items=${[...merged].map(([id, qty]) => `${id}_${qty}`).join(',')}`;
  if (url.length > 7500) throw new Error('This list is too long for one link. Send it in smaller groups.');
  return url;
}

// Upgrade only known obsolete defaults; keep unrelated custom product choices.
const replacedDefaults: Record<string, string> = {
  '1732560925': '161115457', '44391666': '44390957', '34017490': '13893738',
  '39104764': '13893731', '749715014': '898309191', '50067993': '27935840',
  '23591412': '47737969', '1657981925': '10313122', '15094357071': '17382561917',
  '12329756': '14780722693', '41191893': '784580921', '10315402': '10307326',
  '5293673342': '19685753820', '10309835': '156783992', '940387142': '975471117',
};
export function preferredProduct(name: string, saved?: WalmartProduct): WalmartProduct | undefined {
  const current = automaticProduct(name);
  return !saved || (current && replacedDefaults[saved.id] === current.id) ? current : saved;
}

export type SentQuantities = Record<string, number>;
export function normalizeSent(value: unknown): SentQuantities {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([id, count]) => parseWalmartId(id) === id && Number.isSafeInteger(count) && Number(count) >= 0 && Number(count) <= 999));
}
export function pendingCartItems(rows: Array<{ id: string; quantity: number }>, sent: SentQuantities, retryIds: string[] = []) {
  const totals: SentQuantities = {};
  for (const row of rows) totals[row.id] = (totals[row.id] || 0) + row.quantity;
  return Object.entries(totals).map(([id, quantity]) => ({ id, quantity: retryIds.includes(id) ? quantity : Math.max(0, quantity - (sent[id] || 0)) })).filter(row => row.quantity > 0);
}
