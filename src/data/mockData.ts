import { Recipe, PlannedMeal, Child, HouseTask, Profile, MealLog, GroceryItem, DayOfWeek } from '@/types';

// Mock Recipes
export const mockRecipes: Recipe[] = [
  {
    id: '1',
    name: 'Honey Garlic Salmon',
    servings: 4,
    ingredients: ['4 salmon fillets', '3 tbsp honey', '4 cloves garlic', '2 tbsp soy sauce', '1 tbsp olive oil', 'Rice for serving'],
    ingredientsRaw: '4 salmon fillets\n3 tbsp honey\n4 cloves garlic, minced\n2 tbsp soy sauce\n1 tbsp olive oil\nRice for serving',
    instructions: '1. Mix honey, garlic, and soy sauce\n2. Pan sear salmon in olive oil\n3. Add sauce and cook until glazed\n4. Serve over rice',
    macrosPerServing: { calories: 420, protein_g: 35, carbs_g: 28, fat_g: 18, fiber_g: 1 },
    defaultDay: 'monday',
    mealType: 'dinner',
    isAnchored: false,
    createdAt: new Date(),
  },
  {
    id: '2',
    name: 'Taco Tuesday Feast',
    servings: 6,
    ingredients: ['1.5 lbs ground beef', 'Taco seasoning', '12 taco shells', 'Lettuce', 'Tomatoes', 'Cheese', 'Sour cream', 'Salsa'],
    ingredientsRaw: '1.5 lbs ground beef\n1 packet taco seasoning\n12 hard taco shells\n1 head lettuce, shredded\n2 tomatoes, diced\n2 cups shredded cheese\nSour cream\nSalsa',
    instructions: '1. Brown beef and add seasoning\n2. Warm shells\n3. Set up taco bar with all toppings\n4. Let everyone build their own!',
    macrosPerServing: { calories: 480, protein_g: 28, carbs_g: 32, fat_g: 26, fiber_g: 3 },
    defaultDay: 'tuesday',
    mealType: 'dinner',
    isAnchored: true,
    createdAt: new Date(),
  },
  {
    id: '3',
    name: 'Lemon Herb Chicken',
    servings: 4,
    ingredients: ['4 chicken breasts', '2 lemons', 'Fresh rosemary', 'Fresh thyme', 'Garlic', 'Olive oil', 'Roasted vegetables'],
    ingredientsRaw: '4 chicken breasts\n2 lemons, juiced and zested\n2 sprigs fresh rosemary\n4 sprigs fresh thyme\n4 cloves garlic\n3 tbsp olive oil\nAssorted vegetables for roasting',
    instructions: '1. Marinate chicken in lemon, herbs, and oil\n2. Roast at 400°F for 25 minutes\n3. Serve with roasted vegetables',
    macrosPerServing: { calories: 380, protein_g: 42, carbs_g: 12, fat_g: 18, fiber_g: 4 },
    defaultDay: 'wednesday',
    mealType: 'dinner',
    isAnchored: false,
    createdAt: new Date(),
  },
  {
    id: '4',
    name: 'Beef Stir Fry',
    servings: 4,
    ingredients: ['1 lb flank steak', 'Broccoli', 'Bell peppers', 'Snap peas', 'Soy sauce', 'Ginger', 'Garlic', 'Rice'],
    ingredientsRaw: '1 lb flank steak, sliced thin\n2 cups broccoli florets\n2 bell peppers, sliced\n1 cup snap peas\n1/4 cup soy sauce\n1 inch fresh ginger\n3 cloves garlic\nRice for serving',
    instructions: '1. Stir fry beef until browned\n2. Add vegetables and aromatics\n3. Add sauce and toss\n4. Serve over rice',
    macrosPerServing: { calories: 410, protein_g: 32, carbs_g: 35, fat_g: 14, fiber_g: 5 },
    defaultDay: 'thursday',
    mealType: 'dinner',
    isAnchored: false,
    createdAt: new Date(),
  },
  {
    id: '5',
    name: 'Pizza Night',
    servings: 4,
    ingredients: ['Pizza dough', 'Marinara sauce', 'Mozzarella', 'Pepperoni', 'Italian sausage', 'Bell peppers', 'Onions'],
    ingredientsRaw: '1 lb pizza dough\n1 cup marinara sauce\n2 cups shredded mozzarella\n20 pepperoni slices\n1/2 lb Italian sausage\n1 bell pepper, sliced\n1/2 onion, sliced',
    instructions: '1. Roll out dough\n2. Add sauce and toppings\n3. Bake at 475°F for 12-15 minutes\n4. Let rest before slicing',
    macrosPerServing: { calories: 520, protein_g: 24, carbs_g: 48, fat_g: 26, fiber_g: 3 },
    defaultDay: 'friday',
    mealType: 'dinner',
    isAnchored: true,
    createdAt: new Date(),
  },
  {
    id: '6',
    name: 'Grilled Ribeye',
    servings: 4,
    ingredients: ['4 ribeye steaks', 'Salt', 'Pepper', 'Butter', 'Garlic', 'Baked potatoes', 'Asparagus'],
    ingredientsRaw: '4 ribeye steaks (12 oz each)\nCoarse salt\nFresh cracked pepper\n4 tbsp butter\n4 cloves garlic\n4 large potatoes\n1 bunch asparagus',
    instructions: '1. Season steaks generously\n2. Grill to desired doneness\n3. Top with garlic butter\n4. Serve with baked potato and asparagus',
    macrosPerServing: { calories: 680, protein_g: 52, carbs_g: 38, fat_g: 36, fiber_g: 6 },
    defaultDay: 'saturday',
    mealType: 'dinner',
    isAnchored: false,
    createdAt: new Date(),
  },
  {
    id: '7',
    name: 'Sunday Roast Chicken',
    servings: 6,
    ingredients: ['1 whole chicken', 'Butter', 'Lemon', 'Fresh herbs', 'Carrots', 'Potatoes', 'Onions'],
    ingredientsRaw: '1 whole chicken (5 lbs)\n4 tbsp butter, softened\n1 lemon\nFresh thyme, rosemary, sage\n4 carrots\n6 potatoes\n2 onions',
    instructions: '1. Rub chicken with herb butter\n2. Stuff with lemon and herbs\n3. Roast with vegetables at 425°F\n4. Rest 15 minutes before carving',
    macrosPerServing: { calories: 450, protein_g: 38, carbs_g: 28, fat_g: 22, fiber_g: 5 },
    defaultDay: 'sunday',
    mealType: 'dinner',
    isAnchored: true,
    createdAt: new Date(),
  },
];

// Generate current week's meal plan
const getWeekStart = (): string => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
};

const days: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export const mockMealPlan: PlannedMeal[] = mockRecipes.slice(0, 7).map((recipe, index) => ({
  id: `meal-${index + 1}`,
  recipeId: recipe.id,
  recipe,
  day: days[index],
  isLocked: false,
  isSkipped: false,
  weekOf: getWeekStart(),
}));

// Mock Children
export const mockChildren: Child[] = [
  {
    id: '1',
    name: 'Emma',
    dailyChores: [
      { id: 'd1', name: 'Make bed', isCompleted: true },
      { id: 'd2', name: 'Brush teeth (morning)', isCompleted: true },
      { id: 'd3', name: 'Brush teeth (night)', isCompleted: false },
      { id: 'd4', name: 'Put away toys', isCompleted: false },
    ],
    weeklyChores: [
      { id: 'w1', name: 'Clean room', day: 'saturday', isCompleted: false },
      { id: 'w2', name: 'Help with laundry', day: 'wednesday', isCompleted: false },
    ],
  },
  {
    id: '2',
    name: 'Jack',
    dailyChores: [
      { id: 'd1', name: 'Make bed', isCompleted: false },
      { id: 'd2', name: 'Brush teeth (morning)', isCompleted: true },
      { id: 'd3', name: 'Brush teeth (night)', isCompleted: false },
      { id: 'd4', name: 'Feed the dog', isCompleted: true },
    ],
    weeklyChores: [
      { id: 'w1', name: 'Take out trash', day: 'tuesday', isCompleted: false },
      { id: 'w2', name: 'Vacuum room', day: 'friday', isCompleted: false },
    ],
  },
];

// Mock House Tasks
export const mockHouseTasks: HouseTask[] = [
  { id: '1', title: 'Pay electric bill', type: 'do', status: 'not_started', frequency: 'once', dueDate: '2026-02-05', createdAt: new Date() },
  { id: '2', title: 'Schedule HVAC maintenance', type: 'do', status: 'in_progress', frequency: 'once', notes: 'Called ABC HVAC, waiting for callback', createdAt: new Date() },
  { id: '3', title: 'Water plants', type: 'maintain', status: 'done', frequency: 'weekly', day: 'monday', createdAt: new Date() },
  { id: '4', title: 'Check smoke detectors', type: 'maintain', status: 'not_started', frequency: 'weekly', day: 'sunday', createdAt: new Date() },
  { id: '5', title: 'Trash day tomorrow', type: 'notice', status: 'not_started', frequency: 'weekly', day: 'tuesday', createdAt: new Date() },
  { id: '6', title: 'Amazon package expected', type: 'notice', status: 'not_started', frequency: 'once', notes: 'New air filters', createdAt: new Date() },
];

// Mock Profiles
export const mockProfiles: Profile[] = [
  {
    id: 'me',
    name: 'Me',
    defaultServings: 1,
    dailyTargets: { calories: 2200, protein_g: 180, carbs_g: 220, fat_g: 75 },
  },
  {
    id: 'wife',
    name: 'Wife',
    defaultServings: 1,
    dailyTargets: { calories: 1800, protein_g: 120, carbs_g: 180, fat_g: 60 },
  },
];

// Mock Meal Logs
export const mockMealLogs: MealLog[] = [
  {
    id: '1',
    recipeId: '1',
    recipeName: 'Honey Garlic Salmon',
    date: new Date().toISOString().split('T')[0],
    person: 'me',
    servings: 1,
    macros: { calories: 420, protein_g: 35, carbs_g: 28, fat_g: 18 },
    isQuickAdd: false,
    createdAt: new Date(),
  },
  {
    id: '2',
    recipeId: '1',
    recipeName: 'Honey Garlic Salmon',
    date: new Date().toISOString().split('T')[0],
    person: 'wife',
    servings: 1,
    macros: { calories: 420, protein_g: 35, carbs_g: 28, fat_g: 18 },
    isQuickAdd: false,
    createdAt: new Date(),
  },
  {
    id: '3',
    recipeName: 'Protein Shake',
    date: new Date().toISOString().split('T')[0],
    person: 'me',
    servings: 1,
    macros: { calories: 200, protein_g: 30, carbs_g: 10, fat_g: 5 },
    isQuickAdd: true,
    createdAt: new Date(),
  },
];

// Mock Grocery Items
export const mockGroceryItems: GroceryItem[] = [
  { id: '1', name: 'Salmon fillets (4)', quantity: '4', category: 'meat', isChecked: false, sourceRecipes: ['Honey Garlic Salmon'] },
  { id: '2', name: 'Ground beef', quantity: '1.5 lbs', category: 'meat', isChecked: false, sourceRecipes: ['Taco Tuesday Feast'] },
  { id: '3', name: 'Chicken breasts', quantity: '4', category: 'meat', isChecked: true, sourceRecipes: ['Lemon Herb Chicken'] },
  { id: '4', name: 'Broccoli', quantity: '2 cups', category: 'produce', isChecked: false, sourceRecipes: ['Beef Stir Fry'] },
  { id: '5', name: 'Bell peppers', quantity: '3', category: 'produce', isChecked: false, sourceRecipes: ['Beef Stir Fry', 'Pizza Night'] },
  { id: '6', name: 'Lemons', quantity: '2', category: 'produce', isChecked: false, sourceRecipes: ['Lemon Herb Chicken'] },
  { id: '7', name: 'Shredded cheese', quantity: '2 cups', category: 'dairy', isChecked: false, sourceRecipes: ['Taco Tuesday Feast'] },
  { id: '8', name: 'Mozzarella', quantity: '2 cups', category: 'dairy', isChecked: false, sourceRecipes: ['Pizza Night'] },
  { id: '9', name: 'Soy sauce', quantity: '1 bottle', category: 'pantry', isChecked: true, sourceRecipes: ['Honey Garlic Salmon', 'Beef Stir Fry'] },
  { id: '10', name: 'Taco seasoning', quantity: '1 packet', category: 'pantry', isChecked: false, sourceRecipes: ['Taco Tuesday Feast'] },
];
