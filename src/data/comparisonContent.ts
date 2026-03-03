export interface ComparisonPage {
  slug: string;
  competitor: string;
  title: string;
  description: string;
  heroImage: string;
  heroAlt: string;
  bestForHomeHarmony: string[];
  whereHomeHarmonyWins: string[];
  whereCompetitorWins: string[];
  switchChecklist: string[];
  faq: Array<{ question: string; answer: string }>;
}

export const comparisonPages: ComparisonPage[] = [
  {
    slug: 'home-harmony-vs-cozi',
    competitor: 'Cozi',
    title: 'Home Harmony vs Cozi for Family Operations',
    description:
      'Compare Home Harmony and Cozi for meal planning, grocery automation, chores, task ownership, and fitness-nutrition workflows.',
    heroImage: '/seo/task-systems.svg',
    heroAlt: 'Comparison table of Home Harmony and Cozi features',
    bestForHomeHarmony: [
      'Families wanting meals, grocery, chores, and wellness in one connected workflow.',
      'Households needing combined ingredient quantities and adaptive meal swaps.',
    ],
    whereHomeHarmonyWins: [
      'Native meal-to-grocery automation with quantity rollups.',
      'Integrated macro/protein tracking and family leaderboard systems.',
      'Combined home operations stack across tasks, chores, meals, and workouts.',
    ],
    whereCompetitorWins: [
      'Mature family calendar familiarity for users already centered on calendar workflows.',
      'Lower setup complexity if a household only needs shared scheduling.',
    ],
    switchChecklist: [
      'Export key repeating events and recurring routines from your current system.',
      'Set household roles and reminder intensity in onboarding presets.',
      'Import your first week of meals and regenerate grocery list automatically.',
      'Migrate chores and top recurring tasks into shared dashboards.',
    ],
    faq: [
      {
        question: 'Is Home Harmony a calendar replacement?',
        answer: 'It is an operations layer first. It can complement calendar workflows while owning execution systems.',
      },
      {
        question: 'Can families migrate gradually?',
        answer: 'Yes. Most users move meals and grocery first, then chores and tasks in week two.',
      },
    ],
  },
  {
    slug: 'home-harmony-vs-anylist',
    competitor: 'AnyList',
    title: 'Home Harmony vs AnyList for Meal and Grocery Execution',
    description:
      'Compare Home Harmony and AnyList for grocery quality, weekly planning workflows, and household coordination beyond shopping.',
    heroImage: '/seo/grocery-lists.svg',
    heroAlt: 'Home Harmony and AnyList grocery planning comparison',
    bestForHomeHarmony: [
      'Families that want grocery planning tied to full weekly operations.',
      'Users who need chores/tasks/wellness linked to food planning decisions.',
    ],
    whereHomeHarmonyWins: [
      'Meal rules, day locks, and regen logic directly tied to grocery outputs.',
      'One workspace for chores, tasks, workouts, and nutrition goals.',
      'Onboarding-driven defaults for reminder style and household structure.',
    ],
    whereCompetitorWins: [
      'Simple shopping-list-first usage with minimal setup.',
      'Great fit for users who only want list sharing without broader home planning.',
    ],
    switchChecklist: [
      'Bring over your staple grocery categories and store preferences.',
      'Set dinner cadence and lock recurring meal themes by weekday.',
      'Enable grocery reminders and prep-time notifications.',
      'Activate family modules (tasks, chores) once food workflow is stable.',
    ],
    faq: [
      {
        question: 'Can I keep my store-specific shopping style?',
        answer: 'Yes. Store preferences and grouped list behavior can be preserved in your setup.',
      },
      {
        question: 'Will this add too much complexity?',
        answer: 'Not if rolled out in phases. Start with meals plus grocery, then layer in tasks.',
      },
    ],
  },
  {
    slug: 'home-harmony-vs-todoist-for-families',
    competitor: 'Todoist',
    title: 'Home Harmony vs Todoist for Family Task and Routine Systems',
    description:
      'Compare Home Harmony and Todoist for household task ownership, recurring routines, meal integration, and family engagement.',
    heroImage: '/seo/chore-systems.svg',
    heroAlt: 'Task and routine management comparison between Home Harmony and Todoist',
    bestForHomeHarmony: [
      'Families who need task systems integrated with food, chores, and wellness routines.',
      'Parents managing household load distribution with kid-friendly accountability.',
    ],
    whereHomeHarmonyWins: [
      'Family-specific chores models with rewards, piggy bank, and leaderboard support.',
      'Direct link between meal workflow changes and grocery/task implications.',
      'Shared home context instead of generic project/task abstraction.',
    ],
    whereCompetitorWins: [
      'Advanced productivity workflows for individual users and work projects.',
      'Broad third-party ecosystem for generic personal task automation.',
    ],
    switchChecklist: [
      'Move recurring household tasks first, not every project list.',
      'Assign family roles and reminders by module during onboarding.',
      'Set up weekly reset checklist and chore ownership in one pass.',
      'Connect tasks to meal and grocery rhythms for operational coherence.',
    ],
    faq: [
      {
        question: 'Should families keep Todoist and add Home Harmony?',
        answer: 'Many do. Use Home Harmony for household systems and keep Todoist for work/personal projects.',
      },
      {
        question: 'Does Home Harmony support recurring routines?',
        answer: 'Yes. Recurring tasks, chores cadence, and reminder profiles are core setup layers.',
      },
    ],
  },
];
