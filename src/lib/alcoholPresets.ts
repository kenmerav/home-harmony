export type AlcoholPresetCategory = 'beer' | 'wine' | 'spirits' | 'cocktail' | 'seltzer' | 'premade';

export interface AlcoholPreset {
  id: string;
  name: string;
  serving: string;
  category: AlcoholPresetCategory;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export const ALCOHOL_PRESETS: AlcoholPreset[] = [
  { id: 'light-beer-12oz', name: 'Light Beer', serving: '12 oz', category: 'beer', calories: 103, protein_g: 1, carbs_g: 6, fat_g: 0 },
  { id: 'lager-beer-12oz', name: 'Lager Beer', serving: '12 oz', category: 'beer', calories: 153, protein_g: 2, carbs_g: 13, fat_g: 0 },
  { id: 'ipa-beer-12oz', name: 'IPA Beer', serving: '12 oz', category: 'beer', calories: 185, protein_g: 2, carbs_g: 16, fat_g: 0 },
  { id: 'stout-beer-12oz', name: 'Stout Beer', serving: '12 oz', category: 'beer', calories: 210, protein_g: 2, carbs_g: 18, fat_g: 0 },
  { id: 'wheat-beer-12oz', name: 'Wheat Beer', serving: '12 oz', category: 'beer', calories: 170, protein_g: 2, carbs_g: 14, fat_g: 0 },
  { id: 'hard-cider-12oz', name: 'Hard Cider', serving: '12 oz', category: 'beer', calories: 199, protein_g: 0, carbs_g: 22, fat_g: 0 },
  { id: 'guinness-draft-14-9oz', name: 'Guinness Draft', serving: '14.9 oz can', category: 'beer', calories: 210, protein_g: 2, carbs_g: 18, fat_g: 0 },
  { id: 'pilsner-12oz', name: 'Pilsner Beer', serving: '12 oz', category: 'beer', calories: 145, protein_g: 1, carbs_g: 12, fat_g: 0 },

  { id: 'red-wine-5oz', name: 'Red Wine', serving: '5 oz glass', category: 'wine', calories: 125, protein_g: 0, carbs_g: 4, fat_g: 0 },
  { id: 'white-wine-5oz', name: 'White Wine', serving: '5 oz glass', category: 'wine', calories: 121, protein_g: 0, carbs_g: 4, fat_g: 0 },
  { id: 'rose-wine-5oz', name: 'Rose Wine', serving: '5 oz glass', category: 'wine', calories: 125, protein_g: 0, carbs_g: 4, fat_g: 0 },
  { id: 'prosecco-5oz', name: 'Prosecco', serving: '5 oz flute', category: 'wine', calories: 98, protein_g: 0, carbs_g: 2, fat_g: 0 },
  { id: 'champagne-4oz', name: 'Champagne', serving: '4 oz flute', category: 'wine', calories: 84, protein_g: 0, carbs_g: 2, fat_g: 0 },
  { id: 'dessert-wine-3oz', name: 'Dessert Wine', serving: '3 oz', category: 'wine', calories: 160, protein_g: 0, carbs_g: 14, fat_g: 0 },
  { id: 'sangria-6oz', name: 'Sangria', serving: '6 oz', category: 'wine', calories: 170, protein_g: 0, carbs_g: 16, fat_g: 0 },

  { id: 'vodka-shot-1-5oz', name: 'Vodka Shot', serving: '1.5 oz', category: 'spirits', calories: 97, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { id: 'tequila-shot-1-5oz', name: 'Tequila Shot', serving: '1.5 oz', category: 'spirits', calories: 97, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { id: 'whiskey-shot-1-5oz', name: 'Whiskey Shot', serving: '1.5 oz', category: 'spirits', calories: 105, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { id: 'rum-shot-1-5oz', name: 'Rum Shot', serving: '1.5 oz', category: 'spirits', calories: 97, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { id: 'gin-shot-1-5oz', name: 'Gin Shot', serving: '1.5 oz', category: 'spirits', calories: 97, protein_g: 0, carbs_g: 0, fat_g: 0 },
  { id: 'brandy-shot-1-5oz', name: 'Brandy Shot', serving: '1.5 oz', category: 'spirits', calories: 98, protein_g: 0, carbs_g: 0, fat_g: 0 },

  { id: 'vodka-soda', name: 'Vodka Soda', serving: '1 mixed drink', category: 'cocktail', calories: 100, protein_g: 0, carbs_g: 2, fat_g: 0 },
  { id: 'gin-tonic', name: 'Gin and Tonic', serving: '1 mixed drink', category: 'cocktail', calories: 171, protein_g: 0, carbs_g: 14, fat_g: 0 },
  { id: 'rum-coke', name: 'Rum and Coke', serving: '1 mixed drink', category: 'cocktail', calories: 185, protein_g: 0, carbs_g: 18, fat_g: 0 },
  { id: 'whiskey-coke', name: 'Whiskey and Coke', serving: '1 mixed drink', category: 'cocktail', calories: 190, protein_g: 0, carbs_g: 19, fat_g: 0 },
  { id: 'margarita', name: 'Margarita', serving: '8 oz', category: 'cocktail', calories: 275, protein_g: 0, carbs_g: 30, fat_g: 0 },
  { id: 'skinny-margarita', name: 'Skinny Margarita', serving: '8 oz', category: 'cocktail', calories: 145, protein_g: 0, carbs_g: 8, fat_g: 0 },
  { id: 'mojito', name: 'Mojito', serving: '8 oz', category: 'cocktail', calories: 214, protein_g: 0, carbs_g: 24, fat_g: 0 },
  { id: 'old-fashioned', name: 'Old Fashioned', serving: '1 cocktail', category: 'cocktail', calories: 154, protein_g: 0, carbs_g: 5, fat_g: 0 },
  { id: 'manhattan', name: 'Manhattan', serving: '1 cocktail', category: 'cocktail', calories: 187, protein_g: 0, carbs_g: 4, fat_g: 0 },
  { id: 'martini', name: 'Martini', serving: '1 cocktail', category: 'cocktail', calories: 176, protein_g: 0, carbs_g: 2, fat_g: 0 },
  { id: 'cosmopolitan', name: 'Cosmopolitan', serving: '1 cocktail', category: 'cocktail', calories: 146, protein_g: 0, carbs_g: 8, fat_g: 0 },
  { id: 'paloma', name: 'Paloma', serving: '1 cocktail', category: 'cocktail', calories: 180, protein_g: 0, carbs_g: 16, fat_g: 0 },
  { id: 'mule', name: 'Moscow Mule', serving: '1 cocktail', category: 'cocktail', calories: 183, protein_g: 0, carbs_g: 16, fat_g: 0 },
  { id: 'espresso-martini', name: 'Espresso Martini', serving: '1 cocktail', category: 'cocktail', calories: 210, protein_g: 0, carbs_g: 16, fat_g: 0 },
  { id: 'pina-colada', name: 'Pina Colada', serving: '1 cocktail', category: 'cocktail', calories: 300, protein_g: 0, carbs_g: 32, fat_g: 0 },
  { id: 'bloody-mary', name: 'Bloody Mary', serving: '1 cocktail', category: 'cocktail', calories: 123, protein_g: 1, carbs_g: 8, fat_g: 0 },
  { id: 'aperol-spritz', name: 'Aperol Spritz', serving: '1 cocktail', category: 'cocktail', calories: 165, protein_g: 0, carbs_g: 12, fat_g: 0 },

  { id: 'white-claw', name: 'White Claw Hard Seltzer', serving: '12 oz can', category: 'seltzer', calories: 100, protein_g: 0, carbs_g: 2, fat_g: 0 },
  { id: 'truly', name: 'Truly Hard Seltzer', serving: '12 oz can', category: 'seltzer', calories: 100, protein_g: 0, carbs_g: 2, fat_g: 0 },
  { id: 'high-noon', name: 'High Noon Vodka Seltzer', serving: '12 oz can', category: 'seltzer', calories: 100, protein_g: 0, carbs_g: 2, fat_g: 0 },
  { id: 'vizzy', name: 'Vizzy Hard Seltzer', serving: '12 oz can', category: 'seltzer', calories: 100, protein_g: 0, carbs_g: 2, fat_g: 0 },
  { id: 'nutrl', name: 'NUTRL Vodka Seltzer', serving: '12 oz can', category: 'seltzer', calories: 100, protein_g: 0, carbs_g: 2, fat_g: 0 },

  { id: 'mikes-hard', name: "Mike's Hard Lemonade", serving: '11.2 oz bottle', category: 'premade', calories: 220, protein_g: 0, carbs_g: 32, fat_g: 0 },
  { id: 'smirnoff-ice', name: 'Smirnoff Ice', serving: '11.2 oz bottle', category: 'premade', calories: 228, protein_g: 0, carbs_g: 32, fat_g: 0 },
  { id: 'twisted-tea', name: 'Twisted Tea Original', serving: '12 oz can', category: 'premade', calories: 194, protein_g: 0, carbs_g: 25, fat_g: 0 },
  { id: 'cutwater-margarita', name: 'Cutwater Lime Margarita', serving: '12 oz can', category: 'premade', calories: 360, protein_g: 0, carbs_g: 27, fat_g: 0 },
  { id: 'canned-mojito', name: 'Canned Mojito (average)', serving: '12 oz can', category: 'premade', calories: 250, protein_g: 0, carbs_g: 24, fat_g: 0 },
  { id: 'canned-vodka-soda', name: 'Canned Vodka Soda (average)', serving: '12 oz can', category: 'premade', calories: 150, protein_g: 0, carbs_g: 7, fat_g: 0 },
];

export function findAlcoholPresetById(id: string): AlcoholPreset | undefined {
  return ALCOHOL_PRESETS.find((preset) => preset.id === id);
}

export function filterAlcoholPresets(query: string): AlcoholPreset[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return ALCOHOL_PRESETS;
  return ALCOHOL_PRESETS.filter((preset) => {
    const haystack = `${preset.name} ${preset.serving} ${preset.category}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

