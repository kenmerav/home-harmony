export type StarterDietPreference = 'Paleo' | 'Vegetarian' | 'Macro Friendly' | 'Organic';

type FlavorProfile =
  | 'American'
  | 'Mexican'
  | 'Mediterranean'
  | 'Italian'
  | 'Asian'
  | 'Comfort'
  | 'Curry';

type CostTier = 'budget' | 'standard' | 'premium';
type EffortTier = 'easy' | 'moderate';

export interface StarterDinnerRecipe {
  name: string;
  servings: number;
  ingredients: string[];
  instructions: string;
  macrosPerServing: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
  };
  tags: StarterDietPreference[];
  flavor: FlavorProfile;
  cost: CostTier;
  effort: EffortTier;
}

const STARTER_DINNER_CATALOG: StarterDinnerRecipe[] = [
  {
    name: 'Sheet Pan Lemon Herb Chicken',
    servings: 4,
    ingredients: ['2 lb chicken breast', '1 lb baby potatoes', '1 lb green beans', '2 tbsp olive oil', '1 lemon', '2 tsp garlic powder', '1 tsp dried oregano', 'Salt and pepper'],
    instructions: '1. Heat oven to 425F. 2. Toss potatoes with oil, garlic powder, oregano, salt, and pepper and roast for 15 minutes. 3. Add seasoned chicken and green beans to the same pan. 4. Roast 18-22 more minutes until chicken is cooked through. 5. Finish with lemon juice and zest before serving.',
    macrosPerServing: { calories: 430, protein_g: 43, carbs_g: 25, fat_g: 18, fiber_g: 5 },
    tags: ['Macro Friendly', 'Organic'],
    flavor: 'Mediterranean',
    cost: 'standard',
    effort: 'easy',
  },
  {
    name: 'Garlic Turkey Taco Bowls',
    servings: 5,
    ingredients: ['1.5 lb lean ground turkey', '1 cup dry rice', '1 can black beans', '1 cup salsa', '1 tsp cumin', '1 tsp paprika', '2 cups shredded lettuce', '1 avocado'],
    instructions: '1. Cook rice according to package. 2. Brown turkey in a skillet and season with cumin, paprika, salt, and pepper. 3. Stir in salsa and simmer 5 minutes. 4. Warm beans. 5. Build bowls with rice, turkey, beans, lettuce, and avocado.',
    macrosPerServing: { calories: 510, protein_g: 38, carbs_g: 47, fat_g: 19, fiber_g: 9 },
    tags: ['Macro Friendly'],
    flavor: 'Mexican',
    cost: 'budget',
    effort: 'easy',
  },
  {
    name: 'Slow Cooker Beef Sweet Potato Chili',
    servings: 6,
    ingredients: ['2 lb lean ground beef', '2 large sweet potatoes', '1 onion', '1 red bell pepper', '1 can diced tomatoes', '2 tbsp chili powder', '1 tsp smoked paprika', '2 cups beef broth'],
    instructions: '1. Brown beef, then add to slow cooker. 2. Add diced sweet potato, onion, pepper, tomatoes, broth, and spices. 3. Cook on low 6-7 hours or high 3-4 hours. 4. Stir and adjust salt before serving.',
    macrosPerServing: { calories: 460, protein_g: 37, carbs_g: 29, fat_g: 22, fiber_g: 7 },
    tags: ['Paleo', 'Macro Friendly'],
    flavor: 'Comfort',
    cost: 'budget',
    effort: 'easy',
  },
  {
    name: 'Creamy Tuscan Chickpea Pasta',
    servings: 4,
    ingredients: ['12 oz whole wheat pasta', '2 cans chickpeas', '3 cups spinach', '1 cup cherry tomatoes', '4 cloves garlic', '0.75 cup light cream', '0.25 cup grated parmesan', '1 tbsp olive oil'],
    instructions: '1. Cook pasta and reserve 0.5 cup pasta water. 2. Saute garlic, tomatoes, and chickpeas in olive oil. 3. Add spinach, cream, parmesan, and pasta water. 4. Fold in pasta and simmer 2 minutes.',
    macrosPerServing: { calories: 520, protein_g: 22, carbs_g: 70, fat_g: 15, fiber_g: 12 },
    tags: ['Vegetarian'],
    flavor: 'Italian',
    cost: 'budget',
    effort: 'easy',
  },
  {
    name: 'Ginger Sesame Salmon Bowls',
    servings: 4,
    ingredients: ['1.5 lb salmon', '1 cup dry jasmine rice', '2 cups broccoli florets', '2 tbsp low-sodium soy sauce', '1 tbsp sesame oil', '1 tbsp honey', '1 tbsp grated ginger', '2 green onions'],
    instructions: '1. Cook rice. 2. Roast salmon and broccoli at 425F for 12-15 minutes with soy, sesame oil, honey, and ginger. 3. Flake salmon and serve over rice with green onion.',
    macrosPerServing: { calories: 540, protein_g: 36, carbs_g: 44, fat_g: 24, fiber_g: 4 },
    tags: ['Macro Friendly', 'Organic'],
    flavor: 'Asian',
    cost: 'premium',
    effort: 'easy',
  },
  {
    name: 'Veggie Loaded Lentil Curry',
    servings: 6,
    ingredients: ['1.5 cups dry red lentils', '1 onion', '2 carrots', '1 zucchini', '1 can light coconut milk', '2 tbsp curry powder', '3 cups vegetable broth', '2 cups spinach'],
    instructions: '1. Saute onion and carrots for 5 minutes. 2. Add lentils, zucchini, curry powder, coconut milk, and broth. 3. Simmer 22-25 minutes until lentils soften. 4. Stir in spinach and season to taste.',
    macrosPerServing: { calories: 390, protein_g: 19, carbs_g: 49, fat_g: 12, fiber_g: 14 },
    tags: ['Vegetarian', 'Organic'],
    flavor: 'Curry',
    cost: 'budget',
    effort: 'easy',
  },
  {
    name: 'Balsamic Steak and Green Beans',
    servings: 4,
    ingredients: ['1.5 lb flank steak', '1 lb green beans', '1 lb baby potatoes', '2 tbsp balsamic vinegar', '1 tbsp Dijon mustard', '2 tsp garlic powder', '1 tbsp olive oil'],
    instructions: '1. Roast potatoes at 425F for 20 minutes. 2. Sear steak 4-5 minutes per side and rest. 3. Saute green beans until crisp tender. 4. Whisk balsamic and Dijon, then drizzle over sliced steak and vegetables.',
    macrosPerServing: { calories: 520, protein_g: 42, carbs_g: 31, fat_g: 24, fiber_g: 5 },
    tags: ['Paleo', 'Organic'],
    flavor: 'American',
    cost: 'premium',
    effort: 'moderate',
  },
  {
    name: 'Chicken Fajita Skillet',
    servings: 5,
    ingredients: ['2 lb chicken thighs', '3 bell peppers', '1 onion', '2 tsp chili powder', '1 tsp cumin', '1 tsp garlic powder', '10 corn tortillas', '1 lime'],
    instructions: '1. Slice chicken and vegetables. 2. Cook chicken in a hot skillet until browned. 3. Add peppers, onion, and seasonings; cook 8-10 minutes. 4. Finish with lime and serve with warm tortillas.',
    macrosPerServing: { calories: 470, protein_g: 36, carbs_g: 34, fat_g: 20, fiber_g: 6 },
    tags: ['Macro Friendly'],
    flavor: 'Mexican',
    cost: 'budget',
    effort: 'easy',
  },
  {
    name: 'Greek Chicken Orzo Bake',
    servings: 6,
    ingredients: ['1.75 lb chicken breast', '1.5 cups dry orzo', '1 pint cherry tomatoes', '4 cups spinach', '0.5 cup crumbled feta', '3 cups chicken broth', '2 tsp oregano', '2 tbsp olive oil'],
    instructions: '1. Heat oven to 400F. 2. Combine diced chicken, orzo, tomatoes, broth, oregano, and oil in a baking dish. 3. Cover and bake 30 minutes. 4. Stir in spinach and feta and bake uncovered 8 more minutes.',
    macrosPerServing: { calories: 500, protein_g: 41, carbs_g: 43, fat_g: 17, fiber_g: 4 },
    tags: ['Macro Friendly', 'Organic'],
    flavor: 'Mediterranean',
    cost: 'standard',
    effort: 'moderate',
  },
  {
    name: 'Cauliflower Fried Rice with Shrimp',
    servings: 4,
    ingredients: ['1.5 lb shrimp', '2 bags cauliflower rice', '2 eggs', '1 cup peas and carrots', '3 tbsp coconut aminos', '1 tsp sesame oil', '3 green onions', '2 cloves garlic'],
    instructions: '1. Cook shrimp in a skillet until pink, then remove. 2. Scramble eggs. 3. Saute garlic, cauliflower rice, and peas-carrots for 5 minutes. 4. Add shrimp, eggs, coconut aminos, and sesame oil; toss and serve.',
    macrosPerServing: { calories: 360, protein_g: 38, carbs_g: 16, fat_g: 15, fiber_g: 5 },
    tags: ['Paleo', 'Macro Friendly'],
    flavor: 'Asian',
    cost: 'standard',
    effort: 'easy',
  },
  {
    name: 'Mushroom Spinach Ravioli Skillet',
    servings: 4,
    ingredients: ['20 oz cheese ravioli', '8 oz mushrooms', '3 cups spinach', '1 cup marinara', '0.25 cup parmesan', '1 tbsp olive oil', '2 cloves garlic'],
    instructions: '1. Boil ravioli until tender. 2. Saute mushrooms and garlic in olive oil. 3. Add marinara and spinach until wilted. 4. Toss in ravioli and parmesan.',
    macrosPerServing: { calories: 560, protein_g: 21, carbs_g: 69, fat_g: 21, fiber_g: 6 },
    tags: ['Vegetarian'],
    flavor: 'Italian',
    cost: 'standard',
    effort: 'easy',
  },
  {
    name: 'Coconut Lime Chicken Curry',
    servings: 6,
    ingredients: ['2 lb chicken thighs', '1 can light coconut milk', '1 onion', '1 red bell pepper', '2 tbsp curry paste', '1 tbsp lime juice', '2 cups broccoli', '2 cups cooked rice'],
    instructions: '1. Brown chicken pieces in a pot. 2. Add onion and pepper, then stir in curry paste. 3. Add coconut milk and simmer 18 minutes. 4. Add broccoli until tender. 5. Finish with lime juice and serve over rice.',
    macrosPerServing: { calories: 490, protein_g: 35, carbs_g: 31, fat_g: 24, fiber_g: 4 },
    tags: ['Organic'],
    flavor: 'Curry',
    cost: 'standard',
    effort: 'moderate',
  },
  {
    name: 'Black Bean Sweet Potato Enchilada Bake',
    servings: 6,
    ingredients: ['2 medium sweet potatoes', '2 cans black beans', '10 corn tortillas', '2 cups red enchilada sauce', '1 cup shredded cheese', '1 tsp cumin', '1 tsp garlic powder'],
    instructions: '1. Roast diced sweet potatoes at 425F for 20 minutes. 2. Mix potatoes, beans, cumin, and garlic powder. 3. Layer tortillas, filling, and sauce in a baking dish. 4. Top with cheese and bake 20 minutes.',
    macrosPerServing: { calories: 430, protein_g: 18, carbs_g: 61, fat_g: 13, fiber_g: 13 },
    tags: ['Vegetarian', 'Organic'],
    flavor: 'Mexican',
    cost: 'budget',
    effort: 'moderate',
  },
  {
    name: 'Pesto Turkey Meatballs with Zoodles',
    servings: 5,
    ingredients: ['1.75 lb lean ground turkey', '1 egg', '0.5 cup breadcrumbs', '0.25 cup pesto', '4 zucchini', '2 cups marinara', '0.25 cup parmesan'],
    instructions: '1. Mix turkey, egg, breadcrumbs, and half the pesto; form meatballs. 2. Bake meatballs at 425F for 18 minutes. 3. Warm marinara with remaining pesto. 4. Saute zucchini noodles 2-3 minutes and top with meatballs and sauce.',
    macrosPerServing: { calories: 430, protein_g: 39, carbs_g: 17, fat_g: 23, fiber_g: 4 },
    tags: ['Macro Friendly', 'Paleo'],
    flavor: 'Italian',
    cost: 'standard',
    effort: 'moderate',
  },
  {
    name: 'Honey Mustard Pork Tenderloin',
    servings: 5,
    ingredients: ['2 lb pork tenderloin', '1.5 lb baby potatoes', '3 cups Brussels sprouts', '2 tbsp Dijon mustard', '1 tbsp honey', '1 tbsp olive oil', '1 tsp garlic powder'],
    instructions: '1. Heat oven to 425F. 2. Whisk Dijon, honey, garlic powder, and oil. 3. Coat pork and place on a sheet pan with potatoes and sprouts. 4. Roast 24-30 minutes, rest, and slice.',
    macrosPerServing: { calories: 470, protein_g: 40, carbs_g: 29, fat_g: 20, fiber_g: 5 },
    tags: ['Paleo'],
    flavor: 'American',
    cost: 'standard',
    effort: 'easy',
  },
  {
    name: 'Tofu Peanut Noodle Stir Fry',
    servings: 4,
    ingredients: ['14 oz extra-firm tofu', '8 oz rice noodles', '2 cups shredded cabbage', '1 red bell pepper', '2 tbsp peanut butter', '2 tbsp soy sauce', '1 tbsp rice vinegar', '1 tsp sesame oil'],
    instructions: '1. Press and cube tofu, then pan-sear until golden. 2. Cook noodles. 3. Whisk peanut butter, soy sauce, vinegar, and sesame oil. 4. Stir-fry cabbage and pepper, then toss with tofu, noodles, and sauce.',
    macrosPerServing: { calories: 510, protein_g: 21, carbs_g: 62, fat_g: 19, fiber_g: 6 },
    tags: ['Vegetarian'],
    flavor: 'Asian',
    cost: 'budget',
    effort: 'easy',
  },
  {
    name: 'One Pot Sausage and Pepper Rigatoni',
    servings: 6,
    ingredients: ['1.5 lb turkey sausage', '12 oz rigatoni', '1 onion', '2 bell peppers', '4 cups marinara', '2 cups water', '0.5 cup parmesan', '1 tsp Italian seasoning'],
    instructions: '1. Brown sausage in a pot and break apart. 2. Add onion and peppers for 4 minutes. 3. Add pasta, marinara, water, and seasoning. 4. Simmer covered 14-16 minutes until pasta is tender. 5. Finish with parmesan.',
    macrosPerServing: { calories: 560, protein_g: 31, carbs_g: 52, fat_g: 24, fiber_g: 5 },
    tags: ['Macro Friendly'],
    flavor: 'Comfort',
    cost: 'budget',
    effort: 'easy',
  },
  {
    name: 'Herb Roasted Cod and Potatoes',
    servings: 4,
    ingredients: ['1.5 lb cod fillets', '1.25 lb baby potatoes', '1 bunch asparagus', '2 tbsp olive oil', '1 lemon', '1 tsp dried dill', '1 tsp garlic powder'],
    instructions: '1. Roast potatoes at 425F for 20 minutes. 2. Add cod and asparagus to the tray and season with oil, dill, garlic powder, salt, pepper, and lemon. 3. Roast 12-15 minutes until cod flakes.',
    macrosPerServing: { calories: 410, protein_g: 37, carbs_g: 30, fat_g: 14, fiber_g: 5 },
    tags: ['Organic', 'Macro Friendly'],
    flavor: 'Mediterranean',
    cost: 'premium',
    effort: 'easy',
  },
  {
    name: 'BBQ Chicken Stuffed Potatoes',
    servings: 6,
    ingredients: ['2 lb chicken breast', '6 russet potatoes', '1 cup BBQ sauce', '1 cup shredded cheddar', '2 green onions', '1 tsp smoked paprika', 'Salt and pepper'],
    instructions: '1. Bake potatoes at 425F for 50-60 minutes. 2. Cook seasoned chicken, shred, and mix with BBQ sauce. 3. Split potatoes and fill with BBQ chicken. 4. Top with cheddar and broil 2 minutes. 5. Garnish with green onions.',
    macrosPerServing: { calories: 530, protein_g: 40, carbs_g: 53, fat_g: 17, fiber_g: 6 },
    tags: ['Macro Friendly'],
    flavor: 'American',
    cost: 'budget',
    effort: 'moderate',
  },
  {
    name: 'Mediterranean Quinoa Power Bowls',
    servings: 5,
    ingredients: ['1.5 cups dry quinoa', '1 can chickpeas', '1 cucumber', '1 cup cherry tomatoes', '0.5 cup kalamata olives', '0.5 cup feta', '3 tbsp olive oil', '2 tbsp lemon juice'],
    instructions: '1. Cook quinoa and cool slightly. 2. Drain chickpeas and chop vegetables. 3. Whisk olive oil, lemon juice, salt, and pepper. 4. Build bowls with quinoa, chickpeas, vegetables, olives, and feta, then drizzle dressing.',
    macrosPerServing: { calories: 450, protein_g: 17, carbs_g: 49, fat_g: 21, fiber_g: 9 },
    tags: ['Vegetarian', 'Organic', 'Macro Friendly'],
    flavor: 'Mediterranean',
    cost: 'standard',
    effort: 'easy',
  },
];

function normalizePreference(value: string): StarterDietPreference | null {
  const cleaned = value.trim().toLowerCase();
  if (cleaned === 'paleo') return 'Paleo';
  if (cleaned === 'vegetarian') return 'Vegetarian';
  if (cleaned === 'macro friendly' || cleaned === 'macro-friendly' || cleaned === 'high protein') return 'Macro Friendly';
  if (cleaned === 'organic' || cleaned === 'organic first' || cleaned === 'organic-first') return 'Organic';
  return null;
}

export interface StarterRecipeProfile {
  dietPreferences?: string[];
  mealStylePreferences?: string[];
  foodRestrictions?: string[];
  avoidFoods?: string[];
  weeklyRhythm?: string[];
  kidsCount?: number;
}

interface StarterRecipeMeta {
  cookMinutes: number;
  kidFriendly: boolean;
  budgetFriendly: boolean;
  proteinForward: boolean;
  containsBeef: boolean;
  containsPork: boolean;
  containsFish: boolean;
  containsDairy: boolean;
  containsGluten: boolean;
  containsNuts: boolean;
  containsShellfish: boolean;
}

const COST_RANK: Record<CostTier, number> = {
  budget: 0,
  standard: 1,
  premium: 2,
};

const PREVIEW_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

const normalizeToken = (value: string): string =>
  value.trim().toLowerCase().replace(/[/-]/g, ' ').replace(/\s+/g, ' ');

const parseAvoidFoods = (items: string[] = []): string[] =>
  items.map(normalizeToken).filter((value) => value.length > 1);

const hasAnyToken = (source: string, tokens: string[]): boolean =>
  tokens.some((token) => source.includes(token));

const inferRecipeMeta = (recipe: StarterDinnerRecipe): StarterRecipeMeta => {
  const ingredientsText = recipe.ingredients.join(' ').toLowerCase();
  const nameText = recipe.name.toLowerCase();
  const source = `${nameText} ${ingredientsText}`;

  return {
    cookMinutes: recipe.effort === 'easy' ? 30 : 45,
    kidFriendly:
      !hasAnyToken(source, ['curry paste', 'chili powder']) &&
      !hasAnyToken(nameText, ['curry']),
    budgetFriendly: recipe.cost === 'budget',
    proteinForward: recipe.macrosPerServing.protein_g >= 35 || recipe.tags.includes('Macro Friendly'),
    containsBeef: hasAnyToken(source, ['beef', 'steak']),
    containsPork: hasAnyToken(source, ['pork', 'sausage', 'bacon']),
    containsFish: hasAnyToken(source, ['salmon', 'cod', 'fish']),
    containsDairy: hasAnyToken(source, ['milk', 'cheese', 'cream', 'feta', 'parmesan', 'yogurt', 'butter']),
    containsGluten: hasAnyToken(source, ['pasta', 'rigatoni', 'ravioli', 'orzo', 'breadcrumbs']),
    containsNuts: hasAnyToken(source, ['peanut', 'almond', 'cashew']),
    containsShellfish: hasAnyToken(source, ['shrimp']),
  };
};

function recipeMatchesProfile(recipe: StarterDinnerRecipe, profile: StarterRecipeProfile): boolean {
  const meta = inferRecipeMeta(recipe);
  const dietPrefs = new Set((profile.dietPreferences || []).map(normalizeToken));
  const restrictions = new Set((profile.foodRestrictions || []).map(normalizeToken));
  const avoidFoods = parseAvoidFoods(profile.avoidFoods || []);
  const recipeText = `${recipe.name} ${recipe.ingredients.join(' ')}`.toLowerCase();

  if (avoidFoods.some((token) => recipeText.includes(token))) return false;

  if (restrictions.has('no pork') && meta.containsPork) return false;
  if (restrictions.has('no beef') && meta.containsBeef) return false;
  if ((restrictions.has('vegetarian') || dietPrefs.has('vegetarian')) && (meta.containsBeef || meta.containsPork || meta.containsFish || meta.containsShellfish)) return false;
  if (dietPrefs.has('pescatarian') && (meta.containsBeef || meta.containsPork)) return false;
  if ((restrictions.has('dairy free') || dietPrefs.has('dairy free')) && meta.containsDairy) return false;
  if ((restrictions.has('gluten free') || dietPrefs.has('gluten free')) && meta.containsGluten) return false;
  if ((restrictions.has('low carb') || dietPrefs.has('low carb')) && recipe.macrosPerServing.carbs_g > 35) return false;
  if ((dietPrefs.has('paleo') || restrictions.has('paleo')) && !recipe.tags.includes('Paleo')) return false;

  if (restrictions.has('allergy aware') && (meta.containsNuts || meta.containsShellfish)) return false;

  return true;
}

function scoreRecipe(recipe: StarterDinnerRecipe, profile: StarterRecipeProfile): number {
  const dietPrefs = new Set((profile.dietPreferences || []).map(normalizeToken));
  const mealStyles = new Set((profile.mealStylePreferences || []).map(normalizeToken));
  const rhythms = new Set((profile.weeklyRhythm || []).map(normalizeToken));
  const meta = inferRecipeMeta(recipe);

  let score = 0;

  for (const tag of recipe.tags) {
    if (dietPrefs.has(normalizeToken(tag))) score += 3;
  }
  if (dietPrefs.has('mix of everything')) score += 1;
  if (dietPrefs.has('organic first') && recipe.tags.includes('Organic')) score += 2;
  if (mealStyles.has('high protein') && meta.proteinForward) score += 3;
  if ((mealStyles.has('family friendly') || mealStyles.has('kid friendly')) && meta.kidFriendly) score += 3;
  if (mealStyles.has('quick meals') && meta.cookMinutes <= 30) score += 3;
  if (mealStyles.has('healthy and easy') && meta.cookMinutes <= 30) score += 2;
  if (mealStyles.has('healthy and easy') && recipe.tags.includes('Organic')) score += 2;
  if (mealStyles.has('budget friendly') && meta.budgetFriendly) score += 3;
  if (mealStyles.has('healthy clean eating') && recipe.tags.includes('Organic')) score += 2;
  if (mealStyles.has('comfort food') && (recipe.flavor === 'Comfort' || recipe.flavor === 'Italian' || recipe.flavor === 'American')) score += 2;

  if (rhythms.has('sports heavy week') || rhythms.has('fast paced work week') || rhythms.has('unpredictable schedule')) {
    score += meta.cookMinutes <= 30 ? 2 : 0;
  }

  if ((profile.kidsCount || 0) > 0 && meta.kidFriendly) score += 2;

  return score;
}

function pickWithVariety(pool: StarterDinnerRecipe[], targetCount: number): StarterDinnerRecipe[] {
  const selected: StarterDinnerRecipe[] = [];
  const flavorCounts = new Map<FlavorProfile, number>();
  const maxPerFlavor = 3;

  for (const recipe of pool) {
    if (selected.length >= targetCount) break;
    const current = flavorCounts.get(recipe.flavor) || 0;
    if (current >= maxPerFlavor) continue;
    selected.push(recipe);
    flavorCounts.set(recipe.flavor, current + 1);
  }

  if (selected.length < targetCount) {
    for (const recipe of pool) {
      if (selected.length >= targetCount) break;
      if (selected.some((item) => item.name === recipe.name)) continue;
      selected.push(recipe);
    }
  }

  return selected;
}

export function buildStarterDinnerRecipes(preferences: string[] = [], targetCount = 18): StarterDinnerRecipe[] {
  const normalizedPrefs = new Set(
    preferences
      .map(normalizePreference)
      .filter((value): value is StarterDietPreference => value !== null),
  );

  const profile: StarterRecipeProfile = {
    dietPreferences: Array.from(normalizedPrefs),
    mealStylePreferences: normalizedPrefs.has('Macro Friendly') ? ['High Protein'] : [],
    foodRestrictions: [],
    avoidFoods: [],
    weeklyRhythm: [],
    kidsCount: 0,
  };

  return buildPersonalizedStarterRecipes(profile, targetCount);
}

export function buildPersonalizedStarterRecipes(
  profile: StarterRecipeProfile,
  targetCount = 18,
): StarterDinnerRecipe[] {
  const matched = STARTER_DINNER_CATALOG.filter((recipe) => recipeMatchesProfile(recipe, profile));
  const pool = matched.length > 0 ? matched : STARTER_DINNER_CATALOG;

  const scored = [...pool].sort((a, b) => {
    const diff = scoreRecipe(b, profile) - scoreRecipe(a, profile);
    if (diff !== 0) return diff;
    if (a.cost !== b.cost) return COST_RANK[a.cost] - COST_RANK[b.cost];
    return a.name.localeCompare(b.name);
  });

  const selected = pickWithVariety(scored, Math.min(targetCount, STARTER_DINNER_CATALOG.length));
  return selected.slice(0, Math.min(targetCount, STARTER_DINNER_CATALOG.length));
}

export function buildPersonalizedDinnerWeek(
  profile: StarterRecipeProfile,
  dayCount = 5,
): Array<{ day: string; recipe: StarterDinnerRecipe; cookMinutes: number }> {
  const recipes = buildPersonalizedStarterRecipes(profile, Math.max(dayCount, 7));
  const picked = recipes.slice(0, Math.max(1, Math.min(dayCount, 7)));

  return picked.map((recipe, index) => ({
    day: PREVIEW_DAYS[index],
    recipe,
    cookMinutes: inferRecipeMeta(recipe).cookMinutes,
  }));
}

export function buildPersonalizedGroceryPreview(
  recipes: StarterDinnerRecipe[],
  limit = 12,
): string[] {
  const counts = new Map<string, number>();

  for (const recipe of recipes) {
    for (const ingredient of recipe.ingredients) {
      const cleaned = ingredient
        .toLowerCase()
        .replace(/^\d+([./]\d+)?\s*(lb|oz|cups?|cup|tbsp|tsp)?\s*/g, '')
        .replace(/[()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleaned) continue;
      counts.set(cleaned, (counts.get(cleaned) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name]) => name.replace(/\b\w/g, (char) => char.toUpperCase()));
}
