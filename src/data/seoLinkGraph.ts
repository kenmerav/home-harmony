export interface SeoCrossLink {
  href: string;
  title: string;
  description: string;
}

export const seoCrossLinks: Record<string, SeoCrossLink[]> = {
  '/meal-plans': [
    {
      href: '/grocery-lists',
      title: 'Grocery List Rollups',
      description: 'Turn meal plans into consolidated shopping lists with cleaner quantity totals.',
    },
    {
      href: '/recipe-collections',
      title: 'Recipe Collections',
      description: 'Use purpose-built recipe sets to keep weekly meal execution consistent.',
    },
    {
      href: '/macro-plans',
      title: 'Macro Planning',
      description: 'Align family dinners with individual calorie and protein goals.',
    },
    {
      href: '/task-systems',
      title: 'Task Systems',
      description: 'Assign meal prep, shopping, and cleanup ownership without confusion.',
    },
  ],
  '/grocery-lists': [
    {
      href: '/meal-plans',
      title: 'Meal Plan Frameworks',
      description: 'Build predictable weekly menus before generating your cart.',
    },
    {
      href: '/pantry-meals',
      title: 'Pantry Meal Guides',
      description: 'Use what you already have and reduce emergency spend.',
    },
    {
      href: '/recipe-collections',
      title: 'Recipe Collections',
      description: 'Choose collections that share ingredients and cut waste.',
    },
    {
      href: '/task-systems',
      title: 'Task Systems',
      description: 'Coordinate shopping ownership, refill cadence, and admin handoffs.',
    },
  ],
  '/pantry-meals': [
    {
      href: '/meal-plans',
      title: 'Meal Plan Frameworks',
      description: 'Blend pantry fallback nights into your weekly planning structure.',
    },
    {
      href: '/grocery-lists',
      title: 'Grocery List Guides',
      description: 'Close ingredient gaps with minimal, high-impact shopping.',
    },
    {
      href: '/recipe-collections',
      title: 'Recipe Collections',
      description: 'Find recipe sets compatible with pantry-first meal execution.',
    },
    {
      href: '/lifestyle-tracking',
      title: 'Lifestyle Tracking',
      description: 'Use routine data to predict high-chaos days and pantry fallback needs.',
    },
  ],
  '/recipe-collections': [
    {
      href: '/meal-plans',
      title: 'Meal Plan Frameworks',
      description: 'Slot recipe groups into week structures built for real family constraints.',
    },
    {
      href: '/grocery-lists',
      title: 'Grocery List Guides',
      description: 'Roll recipe ingredients into cleaner shopping outputs.',
    },
    {
      href: '/macro-plans',
      title: 'Macro Plan Frameworks',
      description: 'Adapt recipe collections to calorie and protein targets per person.',
    },
    {
      href: '/workout-tracking',
      title: 'Workout Tracking',
      description: 'Pair recipe selections with training-day fueling needs.',
    },
  ],
  '/household-templates': [
    {
      href: '/chore-systems',
      title: 'Chore Systems',
      description: 'Turn household templates into enforceable ownership systems.',
    },
    {
      href: '/task-systems',
      title: 'Task Systems',
      description: 'Run household admin and logistics with priority lanes.',
    },
    {
      href: '/meal-plans',
      title: 'Meal Planning',
      description: 'Sync dinner ownership and cleanup responsibilities with weekly planning.',
    },
    {
      href: '/lifestyle-tracking',
      title: 'Lifestyle Tracking',
      description: 'Use sleep and routine trends to tune template load by week.',
    },
  ],
  '/macro-plans': [
    {
      href: '/meal-plans',
      title: 'Meal Plan Frameworks',
      description: 'Use one family dinner base with individualized portion strategy.',
    },
    {
      href: '/recipe-collections',
      title: 'Recipe Collections',
      description: 'Select collections that support high adherence and better macro consistency.',
    },
    {
      href: '/workout-tracking',
      title: 'Workout Tracking',
      description: 'Pair macro targets with training progress and recovery markers.',
    },
    {
      href: '/grocery-lists',
      title: 'Grocery Guides',
      description: 'Convert macro plans into realistic weekly shopping behavior.',
    },
  ],
  '/chore-systems': [
    {
      href: '/household-templates',
      title: 'Household Templates',
      description: 'Start with operational templates and convert them into chore systems.',
    },
    {
      href: '/task-systems',
      title: 'Task Systems',
      description: 'Track recurring chores and one-off household admin tasks together.',
    },
    {
      href: '/meal-plans',
      title: 'Meal Planning',
      description: 'Balance cooking, cleanup, and routine chores across the week.',
    },
    {
      href: '/lifestyle-tracking',
      title: 'Lifestyle Tracking',
      description: 'Adjust chore load using sleep and recovery trend signals.',
    },
  ],
  '/task-systems': [
    {
      href: '/chore-systems',
      title: 'Chore Systems',
      description: 'Coordinate recurring chores inside your broader household task engine.',
    },
    {
      href: '/household-templates',
      title: 'Household Templates',
      description: 'Use template defaults for repeat weekly planning.',
    },
    {
      href: '/grocery-lists',
      title: 'Grocery List Guides',
      description: 'Track shopping and refill tasks directly from meal changes.',
    },
    {
      href: '/workout-tracking',
      title: 'Workout Tracking',
      description: 'Schedule training blocks around admin and family operational tasks.',
    },
  ],
  '/workout-tracking': [
    {
      href: '/macro-plans',
      title: 'Macro Planning',
      description: 'Align workout progression with calorie and protein strategy.',
    },
    {
      href: '/lifestyle-tracking',
      title: 'Lifestyle Tracking',
      description: 'Use sleep and habit trends to adjust training load decisions.',
    },
    {
      href: '/recipe-collections',
      title: 'Recipe Collections',
      description: 'Build recovery-friendly meal rotations for training weeks.',
    },
    {
      href: '/task-systems',
      title: 'Task Systems',
      description: 'Protect workout consistency with better weekly planning lanes.',
    },
  ],
  '/lifestyle-tracking': [
    {
      href: '/workout-tracking',
      title: 'Workout Tracking',
      description: 'Connect sleep and stress trends to workout progression decisions.',
    },
    {
      href: '/macro-plans',
      title: 'Macro Planning',
      description: 'Adjust intake and timing patterns based on lifestyle signals.',
    },
    {
      href: '/household-templates',
      title: 'Household Templates',
      description: 'Use routine templates that reflect realistic energy availability.',
    },
    {
      href: '/meal-plans',
      title: 'Meal Planning',
      description: 'Tune meal complexity to fit sleep quality and weekly rhythm.',
    },
  ],
  '/free-tools': [
    {
      href: '/meal-plans',
      title: 'Meal Plan Frameworks',
      description: 'Use structured weekly dinner systems to turn tool outputs into a live meal cadence.',
    },
    {
      href: '/grocery-lists',
      title: 'Grocery List Guides',
      description: 'Convert free-tool outputs into cleaner rollups and lower-waste shopping execution.',
    },
    {
      href: '/task-systems',
      title: 'Task Systems',
      description: 'Assign ownership and reminders so plans do not stall after setup.',
    },
    {
      href: '/workout-tracking',
      title: 'Workout Tracking',
      description: 'Connect nutrition, routines, and schedule tools with consistent fitness execution.',
    },
  ],
};
