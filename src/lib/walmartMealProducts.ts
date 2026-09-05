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
  [/^baby spinach(?: chopped)?$/, { id: '13893738', label: 'Marketside Fresh Spinach, 10 oz', size: '10 oz' }],
  [/^(?:2 )?frozen crushed garlic cubes or 1 2 cloves freshly crushed garlic$/, { id: '367014931', label: 'Great Value Minced Garlic in Water, 8 oz — substitute for garlic cubes', size: '8 oz' }],
  [/^black pepper$/, { id: '44662573', label: 'Great Value Ground Black Pepper, 3 oz', size: '3 oz' }],
  [/^(?:bag 14 oz )?frozen fire roasted peppers and onions$/, { id: '539250805', label: 'Great Value Pepper & Onion Blend, 20 oz — unroasted substitute', size: '20 oz' }],
  [/^(?:fresh )?ginger$/, { id: '44391005', label: 'Fresh Ginger Root, each' }],
  [/^cherry tomatoes(?: halved)?$/, { id: '101293835', label: 'Fresh Cherry Tomatoes, 10 oz', size: '10 oz' }],
  [/^shredded lettuce$/, { id: '13893731', label: 'Marketside Shredded Iceberg Lettuce, 8 oz', size: '8 oz' }],
  [/^chicken bone broth$/, { id: '898309191', label: 'Kettle & Fire Chicken Bone Broth, 16.9 fl oz', size: '16.9 fl oz' }],
  [/^boneless skinless chicken breasts?$/, { id: '27935840', label: 'Freshness Guaranteed Boneless Skinless Chicken Breasts, variable 2.75–7 lb tray', size: '2.75 lb' }],
  [/^ground chicken or turkey$/, { id: '156783992', label: 'JENNIE-O Ground Turkey Breast, 99% lean, 1 lb', size: '1 lb' }],
  [/^(?:1 4 cup )?beef broth(?: or water)?$/, { id: '10899014', label: 'Great Value Beef Broth, 32 fl oz', size: '32 fl oz' }],
  [/^fiesta cheese$/, { id: '22057341', label: 'Great Value Reduced Fat Fiesta Cheese Blend, 7 oz', size: '7 oz' }],
  [/^(?:can )?(?:reduced fat|lite|light) coconut milk$/, { id: '47737969', label: 'GOYA Reduced Fat Coconut Milk, 13.5 fl oz', size: '13.5 fl oz' }],
  [/^taco seasoning$/, { id: '379517847', label: 'Great Value Taco Seasoning Mix, 1 oz packet', size: '1 oz' }],
  [/^(?:box )?hard shell tacos$/, { id: '10313122', label: 'Old El Paso Stand ’N Stuff Taco Shells, 10 count', size: '10 each' }],
  [/^thai red curry paste or another chili sauce paste$/, { id: '19685753820', label: 'Sky Valley Sambal Oelek Chili Paste, 7 oz — recipe-approved chili paste substitute', size: '7 oz' }],
  [/^thai red curry paste$/, { id: '5293673342', label: 'Thai Kitchen Red Curry Paste, 4 oz', size: '4 oz' }],
  [/^(?:112g )?roasted salted peanuts(?: roughly chopped)?$/, { id: '10448531', label: 'Great Value Dry Roasted Salted Peanuts, 16 oz', size: '16 oz' }],
  [/^(?:10 oz bags )?frozen steamed jasmine rice(?: or 6 cups of cooked jasmine rice)?$/, { id: '17382561917', label: 'Great Value Jasmine Rice 90 Second Pouch, 8.8 oz — cooked rice substitute', size: '8.8 oz' }],
  [/^(?:dry )?protein pasta$/, { id: '10309224', label: 'Barilla Protein+ Penne, 14.5 oz', size: '14.5 oz' }],
  [/^(?:1 4 cup 72g )?hoisin sauce$/, { id: '38438962', label: 'Lee Kum Kee Hoisin Sauce, 20 oz', size: '20 oz' }],
  [/^tortilla chips$/, { id: '14780722693', label: 'Bakery Heat and Serve Tortilla Chips' }],
  [/^queso$/, { id: '166847455', label: 'Great Value Queso Blanco, 15 oz (regular fat)', size: '15 oz' }],
  [/^(?:1 4 cup )?coconut aminos$/, { id: '784580921', label: 'Bragg Coconut Liquid Aminos, 10 fl oz', size: '10 fl oz' }],
  [/^(?:5 oz )?grated parmesan$/, { id: '10307326', label: '4C Parmesan-Romano Grated Cheese, 6 oz', size: '6 oz' }],
  [/^(?:15 oz )?artichoke hearts(?: drained and chopped)?$/, { id: '975471117', label: 'Del Monte Quartered Artichoke Hearts, 14 oz', size: '14 oz' }],
  [/^(?:coarse )?dijon mustard$/, { id: '10315545', label: 'Great Value Dijon Mustard, 12 oz — smooth substitute for coarse Dijon', size: '12 oz' }],
  [/^(?:2 cup 56g )?roasted cashew halves$/, { id: '238699391', label: 'Great Value Roasted Salted Cashew Halves & Pieces, 14 oz', size: '14 oz' }],
];
export function mealProduct(key: string): WalmartProduct | undefined {
  return products.find(([pattern]) => pattern.test(key))?.[1];
}
