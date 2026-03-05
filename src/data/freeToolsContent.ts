export interface FreeToolPage {
  slug: string;
  title: string;
  description: string;
  heroImage: string;
  heroAlt: string;
  searchIntent: string[];
  whatItDoes: string[];
  bestFor: string[];
  workflow: string[];
  output: string[];
  faq: Array<{ question: string; answer: string }>;
}

export const freeToolPages: FreeToolPage[] = [
  {
    slug: 'family-meal-plan-generator',
    title: 'Free Family Meal Plan Generator',
    description: 'Build a weekly family meal structure in minutes based on household size, prep time, and nutrition priorities.',
    heroImage: '/seo/unique/family-meal-plan-generator.jpg',
    heroAlt: 'Family meal plan generator interface with weekly schedule',
    searchIntent: ['weekly meal plan for family', 'family meal planner app', 'kid friendly dinner plan'],
    whatItDoes: [
      'Generates a 7-day dinner structure without copyrighted recipe content.',
      'Lets users set prep-time limits, budget focus, and family size.',
      'Outputs a reusable weekly format users can plug their own recipes into.',
    ],
    bestFor: [
      'Parents who want a repeatable meal cadence instead of random nightly decisions.',
      'Families trying to reduce takeout by planning ahead in one session.',
    ],
    workflow: [
      'Set household profile: adults, kids, and weeknight schedule.',
      'Select planning style: budget-first, protein-first, or fastest prep.',
      'Generate and edit the weekly structure before saving.',
    ],
    output: ['Weekly meal framework', 'Prep day checklist', 'Shopping category starter list'],
    faq: [
      {
        question: 'Does this include copyrighted recipes?',
        answer: 'No. It outputs planning frameworks and meal slots so users can add their own recipes.',
      },
      {
        question: 'Can users regenerate week-to-week?',
        answer: 'Yes. The framework can rotate themes and keep fixed nights like taco night.',
      },
    ],
  },
  {
    slug: 'grocery-list-combiner',
    title: 'Free Grocery List Combiner',
    description: 'Merge multiple grocery lists into one clean list with duplicates removed and quantities rolled up.',
    heroImage: '/seo/unique/grocery-list-combiner.jpg',
    heroAlt: 'Combined grocery list with deduplicated ingredients and quantities',
    searchIntent: ['combine grocery lists', 'shared grocery list app', 'grocery list from meal plan'],
    whatItDoes: [
      'Combines pasted lists from multiple people into one unified output.',
      'Groups by store sections for faster shopping.',
      'Highlights ambiguous items for quick cleanup before ordering.',
    ],
    bestFor: [
      'Households where two adults shop from separate note apps.',
      'Anyone trying to avoid duplicate purchases.',
    ],
    workflow: [
      'Paste list A and list B (or more).',
      'Normalize names and units.',
      'Review merged quantity and export.',
    ],
    output: ['Merged grocery list', 'Category-grouped view', 'Share-ready checklist'],
    faq: [
      {
        question: 'Can this merge duplicate quantities?',
        answer: 'Yes, when units match. It also flags unit conflicts for review.',
      },
      {
        question: 'Can it be used for pickup orders?',
        answer: 'Yes, users can copy the grouped output into their store app.',
      },
    ],
  },
  {
    slug: 'macro-and-protein-calculator',
    title: 'Free Macro and Protein Calculator',
    description: 'A goal-based calorie and macro calculator with protein-only mode for simpler tracking.',
    heroImage: '/seo/unique/macro-and-protein-calculator.jpg',
    heroAlt: 'Macro and protein calculator showing calorie and macro targets',
    searchIntent: ['macro calculator', 'protein goal calculator', 'calorie and macro tracker'],
    whatItDoes: [
      'Calculates calorie and macro targets from questionnaire inputs.',
      'Offers a protein-first mode for users who do not want full macro tracking.',
      'Supports editable final targets before saving.',
    ],
    bestFor: ['Users starting nutrition tracking for fat loss, maintenance, or gain.', 'Families with different goals per person.'],
    workflow: ['Answer body and activity questions.', 'Apply recommendation or edit targets manually.', 'Save and track progress daily.'],
    output: ['Daily calories', 'Protein/carbs/fat targets', 'Water and alcohol target suggestions'],
    faq: [
      {
        question: 'Can users adjust numbers after calculation?',
        answer: 'Yes. Final targets are editable and saved per person.',
      },
      {
        question: 'Does it support imperial units?',
        answer: 'Yes. Height/weight can be entered as ft/in and lb.',
      },
    ],
  },
  {
    slug: 'chore-reward-calculator',
    title: 'Free Chore Reward Calculator',
    description: 'Set chore payouts, penalties, and weekly prize structures with built-in fairness rules.',
    heroImage: '/seo/unique/chore-reward-calculator.jpg',
    heroAlt: 'Chore reward calculator with point and payout settings',
    searchIntent: ['chore chart with rewards', 'kids chore app', 'family chore points system'],
    whatItDoes: [
      'Creates a simple earnings model tied to completed chores.',
      'Includes optional late-completion penalties.',
      'Supports weekly winner prizes to increase motivation.',
    ],
    bestFor: ['Parents running chore systems with multiple kids.', 'Households that want a piggy-bank style reward loop.'],
    workflow: ['Define baseline chores.', 'Set reward and penalty values.', 'Publish weekly prize and track standings.'],
    output: ['Kid-specific reward plan', 'Weekly leaderboard format', 'Parent control settings'],
    faq: [
      {
        question: 'Can chores be first-come-first-serve?',
        answer: 'Yes. Extra chores can be posted as open tasks once daily chores are complete.',
      },
      {
        question: 'Can parents keep manual control?',
        answer: 'Yes. Parents can approve completion before points are finalized.',
      },
    ],
  },
  {
    slug: 'pantry-meal-finder',
    title: 'Free Pantry Meal Finder',
    description: 'Input what you already have and get a realistic meal framework with minimal fill-in items.',
    heroImage: '/seo/unique/pantry-meal-finder.jpg',
    heroAlt: 'Pantry meal finder suggesting meals from available ingredients',
    searchIntent: ['what can i make with these ingredients', 'pantry meal ideas', 'cook from pantry'],
    whatItDoes: [
      'Matches pantry staples to meal archetypes.',
      'Identifies only the highest-impact missing ingredients.',
      'Prioritizes low-waste meal ordering.',
    ],
    bestFor: ['End-of-week pantry cleanout.', 'Households cutting grocery trips between main shops.'],
    workflow: ['Paste pantry items.', 'Select time and skill constraints.', 'Generate meal possibilities and missing list.'],
    output: ['Pantry-first meal shortlist', 'Missing item mini-list', 'Leftover utilization plan'],
    faq: [
      {
        question: 'Does this rely on recipe copyright content?',
        answer: 'No. It uses ingredient logic and generic meal patterns.',
      },
      {
        question: 'Can users save pantry snapshots?',
        answer: 'Yes. Pantry inputs can be reused for faster weekly planning.',
      },
    ],
  },
  {
    slug: 'dinner-start-time-calculator',
    title: 'Free Dinner Start Time Calculator',
    description: 'Set your preferred dinner time and meal duration to get exact prep start reminders.',
    heroImage: '/seo/unique/dinner-start-time-calculator.jpg',
    heroAlt: 'Dinner start time calculator with prep reminders',
    searchIntent: ['when to start dinner', 'dinner prep reminder app', 'meal prep timing calculator'],
    whatItDoes: [
      'Calculates the start time needed to hit your dinner target.',
      'Accounts for prep, active cook, and buffer windows.',
      'Creates daily reminder timing suggestions.',
    ],
    bestFor: ['Busy weeknights with hard stop times.', 'Families juggling sports and activities before dinner.'],
    workflow: ['Pick preferred dinner time.', 'Input meal duration.', 'Generate start reminder schedule.'],
    output: ['Start-cooking time', 'Prep reminder window', 'Weekly dinner timing plan'],
    faq: [
      {
        question: 'Can this be personalized by day?',
        answer: 'Yes. Users can set different dinner targets for weekdays vs weekends.',
      },
      {
        question: 'Can it trigger reminders?',
        answer: 'In app mode, yes. On free pages it provides suggested reminder times.',
      },
    ],
  },
  {
    slug: 'family-routine-builder',
    title: 'Free Family Routine Builder',
    description: 'Build morning, after-school, and evening routines with clear ownership and reminders.',
    heroImage: '/seo/unique/family-routine-builder.jpg',
    heroAlt: 'Family routine builder with morning and evening checklists',
    searchIntent: ['family routine planner', 'morning routine checklist for kids', 'household routine app'],
    whatItDoes: [
      'Creates role-based routine blocks for each part of the day.',
      'Separates must-do tasks from optional tasks.',
      'Sets realistic sequence timing to reduce bottlenecks.',
    ],
    bestFor: ['Households struggling with chaotic mornings.', 'Families onboarding kids into consistent routines.'],
    workflow: ['Choose routine type.', 'Assign owners and time blocks.', 'Export routine cards.'],
    output: ['Daily routine cards', 'Ownership map', 'Reminder cadence'],
    faq: [
      {
        question: 'Can routines be different by weekday?',
        answer: 'Yes. School days and weekend routines can be configured separately.',
      },
      {
        question: 'Can this integrate with chores?',
        answer: 'Yes. Routine blocks can include chore checkpoints and completion tracking.',
      },
    ],
  },
  {
    slug: 'weekly-home-reset-checklist-generator',
    title: 'Free Weekly Home Reset Checklist Generator',
    description: 'Generate a weekly home reset checklist tailored to household size, pets, and schedule.',
    heroImage: '/seo/unique/weekly-home-reset-checklist-generator.jpg',
    heroAlt: 'Weekly home reset checklist organized by room and priority',
    searchIntent: ['weekly house reset checklist', 'home maintenance checklist', 'family home organization planner'],
    whatItDoes: [
      'Builds a practical weekly reset list that prevents backlog.',
      'Groups work by room and effort level.',
      'Schedules high-effort tasks across the week.',
    ],
    bestFor: ['Families who feel behind on house tasks.', 'Homes needing a repeatable reset routine.'],
    workflow: ['Select household profile.', 'Pick reset day and available time.', 'Generate and assign the checklist.'],
    output: ['Room-by-room reset tasks', 'Weekly sequence', 'Ownership assignments'],
    faq: [
      {
        question: 'Is this different from daily chores?',
        answer: 'Yes. Weekly reset covers bigger maintenance items and backlog prevention.',
      },
      {
        question: 'Can kids be included?',
        answer: 'Yes. Tasks can be filtered by age-appropriate complexity.',
      },
    ],
  },
  {
    slug: 'shared-household-task-priority-planner',
    title: 'Free Shared Household Task Priority Planner',
    description: 'Turn scattered household tasks into a ranked weekly priority board with clear ownership.',
    heroImage: '/seo/unique/shared-household-task-priority-planner.jpg',
    heroAlt: 'Shared household task priority planner with priority lanes',
    searchIntent: ['household task management', 'shared family to do list', 'family organizer tasks'],
    whatItDoes: [
      'Ranks tasks by urgency and impact.',
      'Assigns each task to one owner to reduce diffusion.',
      'Creates a realistic weekly execution queue.',
    ],
    bestFor: ['Couples who keep duplicate task lists.', 'Families managing many parallel responsibilities.'],
    workflow: ['Capture all tasks.', 'Score urgency/impact.', 'Assign owners and deadlines.'],
    output: ['Priority-ranked board', 'Owner list', 'Weekly execution queue'],
    faq: [
      {
        question: 'Can this reduce reminders?',
        answer: 'Yes. Clear ownership and ranking removes most back-and-forth reminders.',
      },
      {
        question: 'Can tasks repeat automatically?',
        answer: 'In app mode, recurring tasks are supported by frequency settings.',
      },
    ],
  },
  {
    slug: 'family-workout-schedule-builder',
    title: 'Free Family Workout Schedule Builder',
    description: 'Create a realistic weekly workout schedule that fits school, work, and meal timing constraints.',
    heroImage: '/seo/unique/family-workout-schedule-builder.jpg',
    heroAlt: 'Family workout schedule builder with days and session types',
    searchIntent: ['workout planner app', 'family fitness schedule', 'weekly workout plan generator'],
    whatItDoes: [
      'Builds a week-by-week workout layout by available days.',
      'Balances training intensity with home schedule load.',
      'Supports home, gym, or mixed-location plans.',
    ],
    bestFor: ['Families trying to stay consistent with exercise.', 'Users who need structure, not random workouts.'],
    workflow: ['Set weekly availability.', 'Pick goal and location.', 'Generate plan and session split.'],
    output: ['Weekly workout split', 'Session templates', 'Progress tracking checkpoints'],
    faq: [
      {
        question: 'Can this work for beginners?',
        answer: 'Yes. It can output lower-volume plans for 0-2 days per week.',
      },
      {
        question: 'Does it sync with nutrition goals?',
        answer: 'Yes. In app mode, workout targets can align with macro and protein tracking.',
      },
    ],
  },
  {
    slug: 'family-budget-dinner-planner',
    title: 'Free Family Budget Dinner Planner',
    description: 'Plan a full week of family dinners around a target budget without sacrificing nutrition or prep speed.',
    heroImage: '/seo/unique/family-budget-dinner-planner.jpg',
    heroAlt: 'Family budget dinner planner with weekly cost targets',
    searchIntent: ['family dinner budget planner', 'cheap healthy family dinners', 'weekly dinner budget calculator'],
    whatItDoes: [
      'Builds a dinner framework around a fixed weekly spend target.',
      'Balances lower-cost anchor meals with higher-protein nights.',
      'Highlights where substitutions reduce cost without breaking the plan.',
    ],
    bestFor: ['Families trying to control grocery spend week to week.', 'Households reducing takeout while staying on budget.'],
    workflow: ['Set target weekly budget.', 'Choose prep-time range and family size.', 'Generate budget-balanced dinner structure.'],
    output: ['Budget-first dinner schedule', 'Cost hotspot substitutions', 'Weekly grocery budget guardrails'],
    faq: [
      {
        question: 'Does this require exact local store pricing?',
        answer: 'No. It starts with practical budget ranges and supports adjustments based on your store prices.',
      },
      {
        question: 'Can this work with high-protein goals?',
        answer: 'Yes. It can keep protein-focused nights while balancing the total weekly budget.',
      },
    ],
  },
  {
    slug: 'kids-lunchbox-rotation-builder',
    title: 'Free Kids Lunchbox Rotation Builder',
    description: 'Create a repeatable, kid-friendly lunchbox rotation to reduce weekday decision fatigue.',
    heroImage: '/seo/unique/kids-lunchbox-rotation-builder.jpg',
    heroAlt: 'Kids lunchbox rotation builder with weekday lunch themes',
    searchIntent: ['kids lunchbox planner', 'school lunch rotation', 'easy kid lunch ideas weekly'],
    whatItDoes: [
      'Generates a simple weekly lunchbox rotation with minimal morning prep.',
      'Balances familiar options to reduce food waste and lunchbox returns.',
      'Builds variety rules without requiring a brand-new menu every day.',
    ],
    bestFor: ['Parents packing weekday school lunches.', 'Families with picky eaters who need consistency.'],
    workflow: ['Select kid preferences and exclusions.', 'Choose prep style and repeat cadence.', 'Generate lunch rotation and shopping starter list.'],
    output: ['5-day lunchbox rotation', 'Prep-ahead checklist', 'Lunch-specific grocery starter list'],
    faq: [
      {
        question: 'Will this force new meals every day?',
        answer: 'No. It is built around controlled variety so mornings stay predictable.',
      },
      {
        question: 'Can I keep allergy-friendly options?',
        answer: 'Yes. Exclusions can be applied before the rotation is generated.',
      },
    ],
  },
  {
    slug: '15-minute-school-night-dinner-filter',
    title: 'Free 15-Minute School Night Dinner Filter',
    description: 'Find realistic dinner options for high-chaos school nights with tight time windows.',
    heroImage: '/seo/unique/15-minute-school-night-dinner-filter.jpg',
    heroAlt: '15-minute school night dinner filter with fast dinner options',
    searchIntent: ['15 minute family dinners', 'quick school night meals', 'fast dinners for busy families'],
    whatItDoes: [
      'Filters dinner frameworks to meals that fit strict prep and cook limits.',
      'Prioritizes low-cleanup and kid-friendly flavor profiles.',
      'Creates fallback options for nights when schedule slips.',
    ],
    bestFor: ['Families with sports-heavy weeknights.', 'Households needing fast dinners with low decision load.'],
    workflow: ['Set max dinner time limit.', 'Choose preferred ingredients and household constraints.', 'Generate fast dinner shortlist and backup swaps.'],
    output: ['School-night quick dinner shortlist', 'Backup meal swap list', 'Fast-prep grocery starter list'],
    faq: [
      {
        question: 'Can this include slow cooker fallback plans?',
        answer: 'Yes. It can include earlier-prep options as backups for late evenings.',
      },
      {
        question: 'Is this only for families with kids?',
        answer: 'No. It works for any household needing fast weeknight execution.',
      },
    ],
  },
];
