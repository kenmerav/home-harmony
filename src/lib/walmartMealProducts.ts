import type { WalmartProduct } from './walmartCart';

// Verified Walmart product pages: https://www.walmart.com/ip/{id} (September 2026).
// Match ingredient names, including preparation notes from imported recipes.
// Substitutions are named explicitly so the household can change them before sending.
const products: Array<[RegExp, WalmartProduct]> = [
  [/^(?:extra )?lean ground beef$/, { id: '16322759490', label: 'Extra Lean Ground Beef, 96% lean, 1 lb', size: '1 lb' }],
  [/^thai basil$/, { id: '3757188318', label: 'Fresh Basil, 0.5 oz — substitute for Thai basil', size: '0.5 oz' }],
  [/^(?:handfuls? )?(?:fresh )?cilantro(?: chopped)?$/, { id: '160597260', label: 'Fresh Cilantro, 1 bunch' }],
  [/^(?:small )?lime(?:s| zest and juice)?$/, { id: '44391008', label: 'Fresh Lime, each', size: '1 each' }],
  [/^lemons?(?: zest of 1 juice of both)?$/, { id: '41752773', label: 'Fresh Lemon, each', size: '1 each' }],
  [/^baby spinach(?: chopped)?$/, { id: '34017490', label: 'Marketside Baby Spinach, 6 oz', size: '6 oz' }],
  [/^(?:2 )?frozen crushed garlic cubes or 1 2 cloves freshly crushed garlic$/, { id: '367014931', label: 'Great Value Minced Garlic in Water, 8 oz — substitute for garlic cubes', size: '8 oz' }],
  [/^black pepper$/, { id: '44662573', label: 'Great Value Ground Black Pepper, 3 oz', size: '3 oz' }],
  [/^(?:bag 14 oz )?frozen fire roasted peppers and onions$/, { id: '539250805', label: 'Great Value Pepper & Onion Blend, 20 oz — unroasted substitute', size: '20 oz' }],
  [/^(?:fresh )?ginger$/, { id: '44391005', label: 'Fresh Ginger Root, each' }],
  [/^cherry tomatoes(?: halved)?$/, { id: '101293835', label: 'Fresh Cherry Tomatoes, 10 oz', size: '10 oz' }],
  [/^shredded lettuce$/, { id: '39104764', label: 'Marketside Shredded Iceberg Lettuce, 16 oz', size: '16 oz' }],
  [/^chicken bone broth$/, { id: '749715014', label: 'Zoup! Chicken Bone Broth, 32 fl oz', size: '32 fl oz' }],
  [/^boneless skinless chicken breasts?$/, { id: '50067993', label: 'Tyson Boneless Skinless Chicken Breasts, variable 1–3.3 lb tray', size: '1 lb' }],
  [/^ground chicken or turkey$/, { id: '10309835', label: 'Honeysuckle White Ground Turkey, 93% lean, 1 lb', size: '1 lb' }],
  [/^(?:1 4 cup )?beef broth(?: or water)?$/, { id: '10899014', label: 'Great Value Beef Broth, 32 fl oz', size: '32 fl oz' }],
  [/^fiesta cheese$/, { id: '22057341', label: 'Great Value Reduced Fat Fiesta Cheese Blend, 7 oz', size: '7 oz' }],
  [/^(?:can )?(?:reduced fat|lite|light) coconut milk$/, { id: '23591412', label: 'Thai Kitchen Lite Coconut Milk, 13.66 fl oz', size: '13.66 fl oz' }],
  [/^taco seasoning$/, { id: '379517847', label: 'Great Value Taco Seasoning Mix, 1 oz packet', size: '1 oz' }],
  [/^(?:box )?hard shell tacos$/, { id: '1657981925', label: 'Great Value Taco Shells, 12 count', size: '12 each' }],
  [/^thai red curry paste(?: or another chili sauce paste)?$/, { id: '5293673342', label: 'Thai Kitchen Red Curry Paste, 4 oz', size: '4 oz' }],
  [/^(?:112g )?roasted salted peanuts(?: roughly chopped)?$/, { id: '10448531', label: 'Great Value Dry Roasted Salted Peanuts, 16 oz', size: '16 oz' }],
  [/^(?:10 oz bags )?frozen steamed jasmine rice(?: or 6 cups of cooked jasmine rice)?$/, { id: '15094357071', label: 'Great Value Ready-to-Heat Jasmine Rice, 8.8 oz total, 2 cups — cooked rice substitute', size: '8.8 oz' }],
  [/^(?:dry )?protein pasta$/, { id: '10309224', label: 'Barilla Protein+ Penne, 14.5 oz', size: '14.5 oz' }],
  [/^(?:1 4 cup 72g )?hoisin sauce$/, { id: '38438962', label: 'Lee Kum Kee Hoisin Sauce, 20 oz', size: '20 oz' }],
  [/^tortilla chips$/, { id: '12329756', label: 'Great Value Bite Size Tortilla Chips, 13 oz', size: '13 oz' }],
  [/^queso$/, { id: '166847455', label: 'Great Value Queso Blanco, 15 oz (regular fat)', size: '15 oz' }],
  [/^(?:1 4 cup )?coconut aminos$/, { id: '41191893', label: 'Coconut Secret / Nutiva Coconut Aminos, 8 fl oz', size: '8 fl oz' }],
  [/^(?:5 oz )?grated parmesan$/, { id: '10315402', label: 'Great Value Grated Parmesan, 8 oz (regular fat)', size: '8 oz' }],
  [/^(?:15 oz )?artichoke hearts(?: drained and chopped)?$/, { id: '940387142', label: 'Great Value Quartered Artichoke Hearts, 13.75 oz', size: '13.75 oz' }],
  [/^(?:coarse )?dijon mustard$/, { id: '10315545', label: 'Great Value Dijon Mustard, 12 oz — smooth substitute for coarse Dijon', size: '12 oz' }],
  [/^(?:2 cup 56g )?roasted cashew halves$/, { id: '238699391', label: 'Great Value Roasted Salted Cashew Halves & Pieces, 14 oz', size: '14 oz' }],
];
export function mealProduct(key: string): WalmartProduct | undefined {
  return products.find(([pattern]) => pattern.test(key))?.[1];
}
