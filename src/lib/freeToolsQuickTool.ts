import { freeToolPages } from '@/data/freeToolsContent';

export type ToolCategory = 'meals' | 'grocery' | 'nutrition' | 'chores' | 'tasks' | 'fitness' | 'routines';

export interface QuickToolInputs {
  householdSize: string;
  maxMinutes: string;
  weeklyBudget: string;
  dinnerTime: string;
  focus: string;
  listInput: string;
}

export interface QuickToolResult {
  summary: string;
  primary: string[];
  checklist: string[];
}

export type QuickToolField = keyof QuickToolInputs;

export interface QuickToolUiConfig {
  intro: string;
  fields: QuickToolField[];
  fieldLabels?: Partial<Record<QuickToolField, string>>;
  focusPlaceholder?: string;
  listLabel?: string;
  generateLabel?: string;
  sampleLabel?: string;
  outputTitle?: string;
}

export const DEFAULT_QUICK_FIELD_LABELS: Record<QuickToolField, string> = {
  householdSize: 'Household size',
  maxMinutes: 'Max minutes',
  weeklyBudget: 'Weekly budget ($)',
  dinnerTime: 'Dinner time',
  focus: 'Goal / focus',
  listInput: 'Ingredients / tasks / notes',
};

export const DEFAULT_QUICK_INPUTS: QuickToolInputs = {
  householdSize: '4',
  maxMinutes: '30',
  weeklyBudget: '180',
  dinnerTime: '18:00',
  focus: '',
  listInput: '',
};

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  meals: 'Meals',
  grocery: 'Grocery',
  nutrition: 'Nutrition',
  chores: 'Chores',
  tasks: 'Tasks',
  fitness: 'Fitness',
  routines: 'Routines',
};

export const QUICK_INPUT_SAMPLES: Record<string, string> = {
  'family-meal-plan-generator': 'Monday: sports night\nTuesday: taco night\nFriday: family movie night',
  'grocery-list-combiner': '1 cup milk\n2 cups milk\n1 lb ground beef\n2 lbs ground beef\n3 bell peppers',
  'macro-and-protein-calculator': 'Goal: fat loss, high protein, 180 lb',
  'chore-reward-calculator': 'Daily: dishes, tidy room\nExtra: vacuum, trash, fold laundry',
  'pantry-meal-finder': 'rice, black beans, eggs, frozen broccoli, salsa, tortillas, canned tuna',
  'dinner-start-time-calculator': 'Target dinner 6:15 PM on weekdays',
  'family-routine-builder': 'morning school prep\nafter school reset\nbedtime routine',
  'weekly-home-reset-checklist-generator': 'kitchen, bathrooms, laundry, living room, entryway',
  'shared-household-task-priority-planner': 'Book dentist appointment\nRenew car registration\nFix hallway light\nPlan school lunches',
  'family-workout-schedule-builder': 'Mon, Wed, Fri available\nhome + gym mix',
  'family-budget-dinner-planner': 'Need high protein and low takeout this week',
  'kids-lunchbox-rotation-builder': 'turkey wrap, strawberries, yogurt, carrots, cheese stick, crackers',
  '15-minute-school-night-dinner-filter': 'ground turkey, pasta, frozen veggies, eggs, tortillas, shredded cheese',
};

const DEFAULT_UI_CONFIG: Omit<QuickToolUiConfig, 'intro' | 'fields'> = {
  fieldLabels: {},
  focusPlaceholder: 'Example: high protein, low spend, kid-friendly',
  listLabel: 'Ingredients / tasks / notes',
  generateLabel: 'Generate output',
  sampleLabel: 'Use sample input',
  outputTitle: 'Your generated output',
};

export const QUICK_TOOL_UI_CONFIG: Record<string, QuickToolUiConfig> = {
  'family-meal-plan-generator': {
    intro: 'Generate a 7-day family meal framework in under a minute.',
    fields: ['householdSize', 'maxMinutes', 'weeklyBudget', 'focus', 'listInput'],
    listLabel: 'Anchors or fixed nights',
    focusPlaceholder: 'Example: quick weeknights, kid-friendly, high protein',
  },
  'grocery-list-combiner': {
    intro: 'Paste multiple lists and get one clean combined grocery list.',
    fields: ['listInput'],
    listLabel: 'Grocery lines to combine',
    generateLabel: 'Combine lists',
    outputTitle: 'Combined grocery list',
  },
  'macro-and-protein-calculator': {
    intro: 'Generate starter calories and macros from your goal profile.',
    fields: ['focus', 'listInput'],
    focusPlaceholder: 'Example: fat loss, 180 lb, sedentary',
    listLabel: 'Profile details (optional)',
    generateLabel: 'Calculate targets',
    outputTitle: 'Starter macro targets',
  },
  'chore-reward-calculator': {
    intro: 'Build a simple points + payout model your family can run weekly.',
    fields: ['householdSize', 'weeklyBudget', 'listInput'],
    fieldLabels: { weeklyBudget: 'Weekly reward pool ($)' },
    listLabel: 'Daily and extra chores',
    generateLabel: 'Build reward model',
    outputTitle: 'Chore reward plan',
  },
  'pantry-meal-finder': {
    intro: 'Use what you already have to generate realistic meal options.',
    fields: ['maxMinutes', 'listInput'],
    listLabel: 'Pantry ingredients on hand',
    generateLabel: 'Find pantry meals',
    outputTitle: 'Pantry meal shortlist',
  },
  'dinner-start-time-calculator': {
    intro: 'Set a dinner time and get exact prep + start reminders.',
    fields: ['dinnerTime', 'maxMinutes'],
    generateLabel: 'Calculate start time',
    outputTitle: 'Dinner timing plan',
  },
  'family-routine-builder': {
    intro: 'Generate daily routine blocks with ownership and sequencing.',
    fields: ['householdSize', 'focus', 'listInput'],
    listLabel: 'Routine blocks or pain points',
    focusPlaceholder: 'Example: chaotic mornings, smoother bedtime',
    generateLabel: 'Build routine',
    outputTitle: 'Routine structure',
  },
  'weekly-home-reset-checklist-generator': {
    intro: 'Turn rooms/zones into a weekly home reset plan.',
    fields: ['householdSize', 'listInput'],
    listLabel: 'Rooms or reset zones',
    generateLabel: 'Generate reset checklist',
    outputTitle: 'Weekly reset checklist',
  },
  'shared-household-task-priority-planner': {
    intro: 'Rank your household tasks by priority and ownership.',
    fields: ['listInput'],
    listLabel: 'Tasks to prioritize',
    generateLabel: 'Prioritize tasks',
    outputTitle: 'Priority task queue',
  },
  'family-workout-schedule-builder': {
    intro: 'Build a weekly workout cadence that matches your real schedule.',
    fields: ['maxMinutes', 'focus', 'listInput'],
    listLabel: 'Availability, equipment, constraints',
    generateLabel: 'Build workout week',
    outputTitle: 'Workout schedule',
  },
  'family-budget-dinner-planner': {
    intro: 'Plan dinners around budget, time, and family size.',
    fields: ['householdSize', 'weeklyBudget', 'maxMinutes', 'focus'],
    focusPlaceholder: 'Example: lower spend, still high protein',
    generateLabel: 'Build budget dinner plan',
    outputTitle: 'Budget dinner framework',
  },
  'kids-lunchbox-rotation-builder': {
    intro: 'Generate a repeatable 5-day lunchbox rotation.',
    fields: ['householdSize', 'listInput'],
    listLabel: 'Foods kids will actually eat',
    generateLabel: 'Build lunch rotation',
    outputTitle: 'Lunchbox rotation',
  },
  '15-minute-school-night-dinner-filter': {
    intro: 'Get fallback dinners for high-chaos school nights.',
    fields: ['maxMinutes', 'dinnerTime', 'listInput'],
    listLabel: 'Fast ingredients on hand',
    generateLabel: 'Generate fast dinners',
    outputTitle: 'Quick dinner options',
  },
};

function parseNumber(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toList(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeItemName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUnit(unit?: string): string {
  const raw = (unit || 'item').toLowerCase().trim();
  if (raw === 'cups' || raw === 'cup') return 'cup';
  if (raw === 'tablespoon' || raw === 'tablespoons' || raw === 'tbsp') return 'tbsp';
  if (raw === 'teaspoon' || raw === 'teaspoons' || raw === 'tsp') return 'tsp';
  if (raw === 'ounces' || raw === 'ounce' || raw === 'oz') return 'oz';
  if (raw === 'pounds' || raw === 'pound' || raw === 'lbs' || raw === 'lb') return 'lb';
  if (raw === 'grams' || raw === 'gram' || raw === 'g') return 'g';
  if (raw === 'kilograms' || raw === 'kilogram' || raw === 'kg') return 'kg';
  if (raw === 'milliliters' || raw === 'milliliter' || raw === 'ml') return 'ml';
  if (raw === 'liters' || raw === 'liter' || raw === 'l') return 'l';
  if (raw === 'items' || raw === 'item' || raw === 'x' || raw === 'ct') return 'item';
  return raw;
}

function shiftTime(time: string, minutesBack: number): string {
  const [hourRaw, minuteRaw] = time.split(':');
  const hour = Number.parseInt(hourRaw || '18', 10);
  const minute = Number.parseInt(minuteRaw || '0', 10);
  const total = ((hour * 60 + minute - minutesBack) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function combineGroceries(input: string): string[] {
  const lines = toList(input);
  const map = new Map<string, { qty: number; unit: string; name: string }>();

  for (const raw of lines) {
    const line = raw.toLowerCase();
    const match = line.match(/^([0-9]+(?:\.[0-9]+)?)\s*(cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l|items?|ct|x)?\s+(.+)$/i);
    const qty = match ? Number.parseFloat(match[1]) : 1;
    const unit = normalizeUnit(match?.[2]);
    const name = normalizeItemName(match?.[3] || raw);
    if (!name) continue;
    const key = `${name}|${unit}`;
    const current = map.get(key);
    if (current) {
      current.qty += qty;
    } else {
      map.set(key, { qty, unit, name });
    }
  }

  return Array.from(map.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => `${Number.isInteger(entry.qty) ? entry.qty : entry.qty.toFixed(1)} ${entry.unit} ${entry.name}`);
}

function pantryShortlist(items: string[]): string[] {
  const normalized = items.map((item) => normalizeItemName(item));
  const has = (term: string) => normalized.some((item) => item.includes(term));

  const options: string[] = [];
  if (has('egg') && (has('tortilla') || has('bread'))) options.push('Egg wraps + sauteed veggies');
  if (has('rice') && (has('bean') || has('chicken') || has('tuna'))) options.push('Rice bowl with protein + sauce');
  if (has('pasta') || has('noodle')) options.push('One-pan pasta with frozen veggies');
  if (has('potato') && has('egg')) options.push('Breakfast hash bowls');
  if (has('tuna') || has('salmon')) options.push('Protein patties + side salad');

  if (options.length === 0) {
    options.push('Protein + carb + veg bowl');
    options.push('Scramble + wraps');
    options.push('Soup or skillet using shelf staples');
  }

  while (options.length < 3) {
    options.push(`Quick pantry bowl variation ${options.length + 1}`);
  }

  return options.slice(0, 5);
}

export function getToolCategory(slug: string): ToolCategory {
  if (slug.includes('grocery') || slug.includes('pantry')) return 'grocery';
  if (slug.includes('macro') || slug.includes('protein')) return 'nutrition';
  if (slug.includes('chore')) return 'chores';
  if (slug.includes('task') || slug.includes('reset')) return 'tasks';
  if (slug.includes('workout')) return 'fitness';
  if (slug.includes('routine') || slug.includes('lunchbox')) return 'routines';
  return 'meals';
}

export function toolInputPlaceholder(slug: string): string {
  if (slug === 'grocery-list-combiner') return 'Paste grocery lines (one per line)';
  if (slug === 'pantry-meal-finder') return 'Paste pantry ingredients you have on hand';
  if (slug === 'shared-household-task-priority-planner') return 'Paste tasks that need prioritization';
  if (slug === 'weekly-home-reset-checklist-generator') return 'Paste rooms or reset zones';
  if (slug === 'kids-lunchbox-rotation-builder') return 'Paste lunch items your kids reliably eat';
  if (slug === 'family-routine-builder') return 'Paste routine blocks or pain points';
  if (slug === 'family-workout-schedule-builder') return 'Paste available days, equipment, or constraints';
  return 'Optional details or constraints';
}

function buildFamilyMealPlan(input: QuickToolInputs, familySize: number, maxMinutes: number, weeklyBudget: number): QuickToolResult {
  const focus = input.focus.trim() || 'balanced and easy';
  const anchors = toList(input.listInput);
  const themes = ['Taco/Wrap night', 'Sheet-pan protein + veg', 'One-pot pasta/skillet', 'Stir-fry bowls', 'Breakfast-for-dinner', 'Leftover remix', 'Soup/chili'];
  return {
    summary: `7-night meal framework built for ${familySize} people (${maxMinutes} min max, ${focus}).`,
    primary: themes.map((theme, index) => {
      const anchor = anchors[index] ? ` (${anchors[index]})` : '';
      return `Day ${index + 1}: ${theme}${anchor}`;
    }),
    checklist: [
      `Target weekly dinner spend: about $${weeklyBudget}.`,
      'Prep one base protein and one veggie base in advance.',
      'Lock 1-2 recurring nights to reduce meal decisions.',
    ],
  };
}

function buildGroceryMerge(input: QuickToolInputs): QuickToolResult {
  const merged = combineGroceries(input.listInput);
  return {
    summary: merged.length
      ? `Merged ${toList(input.listInput).length} lines into ${merged.length} cleaned grocery items.`
      : 'Paste two or more list lines and click Generate output.',
    primary: merged.slice(0, 12),
    checklist: ['Resolve any unit conflicts (cups vs oz).', 'Sort final list by aisle/store section.', 'Copy into pickup or delivery checkout.'],
  };
}

function buildMacroTarget(input: QuickToolInputs): QuickToolResult {
  const inferredWeight = parseNumber((input.focus.match(/\d+/)?.[0] || ''), 180);
  const calories = Math.round(inferredWeight * 14);
  const protein = Math.round(inferredWeight * 0.8);
  const fats = Math.round((calories * 0.3) / 9);
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fats * 9) / 4));

  return {
    summary: `Starter macro target generated from a baseline of ~${inferredWeight} lb.`,
    primary: [`${calories} calories/day`, `${protein}g protein/day`, `${carbs}g carbs/day`, `${fats}g fats/day`],
    checklist: ['Run targets for 14 days before changing.', 'If overwhelmed, track protein + calories first.', 'Adjust calories by +/-150 based on weekly trend.'],
  };
}

function buildChoreRewards(familySize: number): QuickToolResult {
  const weeklyRewardPool = Math.max(12, familySize * 8);
  return {
    summary: `Weekly chore reward framework generated for ${familySize} people.`,
    primary: ['Daily chore complete: +2 points', 'Extra chore complete: +3 points', 'Missed extra chore deadline: -2 points', `Suggested weekly reward pool: $${weeklyRewardPool}`],
    checklist: ['Require daily chores complete before extra chore pickup.', 'Set one clear weekly prize.', 'Close points and payouts on a fixed day.'],
  };
}

function buildPantryMeals(input: QuickToolInputs, maxMinutes: number): QuickToolResult {
  const items = toList(input.listInput);
  const shortlist = pantryShortlist(items);
  return {
    summary: `Pantry-first meal shortlist generated (${maxMinutes} minute max target).`,
    primary: shortlist.map((meal, index) => `Option ${index + 1}: ${meal}`),
    checklist: [
      'Buy only 2-4 missing high-impact ingredients.',
      'Cook near-expiration items first.',
      'Save this pantry snapshot for next week reuse.',
    ],
  };
}

function buildDinnerTiming(input: QuickToolInputs, maxMinutes: number): QuickToolResult {
  const dinnerTime = input.dinnerTime || '18:00';
  const startCooking = shiftTime(dinnerTime, maxMinutes);
  const prepReminder = shiftTime(startCooking, 15);

  return {
    summary: `To serve dinner at ${dinnerTime}, start cooking at ${startCooking}.`,
    primary: [`Prep reminder: ${prepReminder}`, `Start cooking: ${startCooking}`, `Serve target: ${dinnerTime}`],
    checklist: ['Set both prep and cook-start reminders.', `Use meals under ${maxMinutes} minutes on busy nights.`, 'Keep one backup fast meal stocked.'],
  };
}

function buildRoutine(input: QuickToolInputs): QuickToolResult {
  const blocks = toList(input.listInput);
  const routineBlocks = blocks.length ? blocks : ['Morning launch', 'After-school reset', 'Evening closeout'];
  return {
    summary: `Role-based routine built across ${routineBlocks.length} daily blocks.`,
    primary: routineBlocks.slice(0, 5).map((block, index) => `Block ${index + 1}: ${block} (owner + time window)`),
    checklist: ['Define must-do steps first, optional steps second.', 'Assign one owner per step.', 'Run 5 days before adding complexity.'],
  };
}

function buildWeeklyReset(input: QuickToolInputs): QuickToolResult {
  const zones = toList(input.listInput);
  const defaultZones = ['Kitchen', 'Bathrooms', 'Laundry', 'Living room', 'Entryway'];
  const effectiveZones = zones.length ? zones : defaultZones;
  return {
    summary: `Weekly reset plan generated for ${effectiveZones.length} home zones.`,
    primary: effectiveZones.slice(0, 7).map((zone, index) => `Day ${index + 1}: ${zone} reset block`),
    checklist: ['Start with a 15-minute quick-win cleanup.', 'Assign one owner per zone.', 'Carry forward no more than 2 unfinished items.'],
  };
}

function buildTaskPriority(input: QuickToolInputs): QuickToolResult {
  const tasks = toList(input.listInput);
  const effectiveTasks = tasks.length ? tasks : ['Pay utility bill', 'Book checkup', 'Meal prep block'];
  return {
    summary: `Prioritized ${effectiveTasks.length} tasks into a weekly action queue.`,
    primary: effectiveTasks.slice(0, 6).map((task, index) => `P${index < 2 ? 1 : index < 4 ? 2 : 3}: ${task}`),
    checklist: ['Assign one owner per task.', 'Cap P1 list to 2-3 items.', 'Review and rebalance at week close.'],
  };
}

function buildWorkoutSchedule(maxMinutes: number): QuickToolResult {
  return {
    summary: 'Weekly family workout cadence generated for consistency.',
    primary: [
      `Mon: Strength block (${maxMinutes + 5} min)`,
      `Wed: Cardio + core (${Math.max(20, maxMinutes - 5)} min)`,
      `Fri: Strength block (${maxMinutes + 5} min)`,
      'Sat: Family movement session (walk, bike, sport)',
    ],
    checklist: ['Lock workout times on calendar first.', 'Keep one fallback short workout template.', 'Adjust session volume based on sleep/recovery.'],
  };
}

function buildBudgetDinner(familySize: number, weeklyBudget: number): QuickToolResult {
  const perNight = Math.round((weeklyBudget / 7) * 100) / 100;
  return {
    summary: `Budget-focused dinner framework built for ${familySize} people at ~$${weeklyBudget}/week.`,
    primary: [`Per-night target: $${perNight.toFixed(2)}`, 'Anchor meals: tacos, pasta skillet, breakfast-for-dinner', 'Higher-protein nights: turkey skillet, sheet-pan chicken'],
    checklist: ['Reuse core ingredients on 3+ nights.', 'Batch one protein prep block.', 'Swap one expensive meal if weekly total runs high.'],
  };
}

function buildLunchRotation(input: QuickToolInputs): QuickToolResult {
  const ideas = toList(input.listInput);
  const base = ideas.length ? ideas : ['Turkey wraps', 'Greek yogurt', 'Berries', 'Cheese sticks', 'Crackers'];
  return {
    summary: '5-day lunchbox rotation generated with predictable variety.',
    primary: [
      `Mon: ${base[0] || 'Wrap'} + fruit + crunch`,
      `Tue: ${base[1] || 'Sandwich'} + veggie + protein`,
      `Wed: ${base[2] || 'Pasta box'} + fruit + snack`,
      `Thu: ${base[3] || 'Quesadilla'} + dip + veg`,
      `Fri: ${base[4] || 'Bento mix'} + fruit + treat`,
    ],
    checklist: ['Prep 2 components on Sunday.', 'Keep one emergency fallback lunch.', 'Remove low-acceptance items from next rotation.'],
  };
}

function buildFastDinnerFilter(input: QuickToolInputs, maxMinutes: number): QuickToolResult {
  const pantry = toList(input.listInput);
  const pantryLine = pantry.length ? pantry.slice(0, 6).join(', ') : 'eggs, wraps, frozen vegetables, pasta, pre-cooked protein';
  return {
    summary: `Fast dinner shortlist generated for <= ${maxMinutes} minute nights.`,
    primary: [
      `Pantry base: ${pantryLine}`,
      'Option 1: Egg + veggie wrap plates (12 min)',
      'Option 2: Protein pasta skillet (15 min)',
      'Option 3: Quesadilla + side veg (14 min)',
    ],
    checklist: ['Stock ingredients for 2 backup quick meals.', 'Avoid complex recipes on activity-heavy nights.', 'Set dinner reminder 20-30 min before target.'],
  };
}

export const QUICK_TOOL_GENERATORS: Record<string, (input: QuickToolInputs) => QuickToolResult> = {
  'family-meal-plan-generator': (input) => {
    const familySize = Math.max(1, Math.round(parseNumber(input.householdSize, 4)));
    const maxMinutes = Math.max(10, Math.round(parseNumber(input.maxMinutes, 30)));
    const weeklyBudget = Math.max(30, Math.round(parseNumber(input.weeklyBudget, 180)));
    return buildFamilyMealPlan(input, familySize, maxMinutes, weeklyBudget);
  },
  'grocery-list-combiner': (input) => buildGroceryMerge(input),
  'macro-and-protein-calculator': (input) => buildMacroTarget(input),
  'chore-reward-calculator': (input) => {
    const familySize = Math.max(1, Math.round(parseNumber(input.householdSize, 4)));
    return buildChoreRewards(familySize);
  },
  'pantry-meal-finder': (input) => {
    const maxMinutes = Math.max(10, Math.round(parseNumber(input.maxMinutes, 30)));
    return buildPantryMeals(input, maxMinutes);
  },
  'dinner-start-time-calculator': (input) => {
    const maxMinutes = Math.max(10, Math.round(parseNumber(input.maxMinutes, 30)));
    return buildDinnerTiming(input, maxMinutes);
  },
  'family-routine-builder': (input) => buildRoutine(input),
  'weekly-home-reset-checklist-generator': (input) => buildWeeklyReset(input),
  'shared-household-task-priority-planner': (input) => buildTaskPriority(input),
  'family-workout-schedule-builder': (input) => {
    const maxMinutes = Math.max(15, Math.round(parseNumber(input.maxMinutes, 30)));
    return buildWorkoutSchedule(maxMinutes);
  },
  'family-budget-dinner-planner': (input) => {
    const familySize = Math.max(1, Math.round(parseNumber(input.householdSize, 4)));
    const weeklyBudget = Math.max(30, Math.round(parseNumber(input.weeklyBudget, 180)));
    return buildBudgetDinner(familySize, weeklyBudget);
  },
  'kids-lunchbox-rotation-builder': (input) => buildLunchRotation(input),
  '15-minute-school-night-dinner-filter': (input) => {
    const maxMinutes = Math.max(10, Math.round(parseNumber(input.maxMinutes, 15)));
    return buildFastDinnerFilter(input, maxMinutes);
  },
};

export function generateQuickOutput(slug: string, input: QuickToolInputs): QuickToolResult {
  const generator = QUICK_TOOL_GENERATORS[slug];
  if (generator) return generator(input);

  const familySize = Math.max(1, Math.round(parseNumber(input.householdSize, 4)));
  const maxMinutes = Math.max(10, Math.round(parseNumber(input.maxMinutes, 30)));
  const weeklyBudget = Math.max(30, Math.round(parseNumber(input.weeklyBudget, 180)));
  return buildFamilyMealPlan(input, familySize, maxMinutes, weeklyBudget);
}

export function getMissingQuickToolCoverage(slugs = freeToolPages.map((tool) => tool.slug)): string[] {
  return slugs.filter((slug) => !QUICK_TOOL_GENERATORS[slug]);
}

export function getQuickToolUiConfig(slug: string): QuickToolUiConfig {
  const config = QUICK_TOOL_UI_CONFIG[slug];
  if (!config) {
    return {
      intro: 'Enter a few details and generate a practical output you can use right now.',
      fields: ['householdSize', 'maxMinutes', 'weeklyBudget', 'dinnerTime', 'focus', 'listInput'],
      ...DEFAULT_UI_CONFIG,
    };
  }

  return {
    ...DEFAULT_UI_CONFIG,
    ...config,
    fieldLabels: {
      ...DEFAULT_UI_CONFIG.fieldLabels,
      ...(config.fieldLabels || {}),
    },
  };
}

export function getMissingQuickToolUiCoverage(slugs = freeToolPages.map((tool) => tool.slug)): string[] {
  return slugs.filter((slug) => !QUICK_TOOL_UI_CONFIG[slug]);
}
