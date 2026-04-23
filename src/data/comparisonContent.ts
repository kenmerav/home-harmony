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
    slug: 'home-harmony-vs-mealime',
    competitor: 'Mealime',
    title: 'Best Mealime Alternative for Families | Home Harmony vs Mealime',
    description:
      'Looking for a Mealime alternative? Compare Home Harmony and Mealime for family meal planning, grocery automation, shared calendar coordination, chores, tasks, and household follow-through.',
    heroImage: '/seo/unique/meal-plans.jpg',
    heroAlt: 'Home Harmony and Mealime comparison for family meal planning and grocery workflows',
    bestForHomeHarmony: [
      'Families that need meal planning tied to grocery, calendar, chores, tasks, and shared household execution.',
      'Households where meals are only one part of the weekly coordination problem.',
    ],
    whereHomeHarmonyWins: [
      'Shared family workflow across meal planning, grocery rollups, chores, tasks, calendar, and reminders.',
      'Saved foods plus recipes, so real-life lunches, snacks, and leftovers fit the system.',
      'Personal dashboards for adults without breaking the shared family plan underneath.',
    ],
    whereCompetitorWins: [
      'Fast recipe-first setup for users who only want meal suggestions and a grocery list.',
      'Lower complexity if the household does not need shared chores, tasks, or calendar coordination.',
    ],
    switchChecklist: [
      'Keep your go-to recipes and saved foods, then rebuild the first week inside one shared family workspace.',
      'Set shared dinner timing and grocery preferences before adding chores and task ownership.',
      'Invite your spouse after the owner finishes household setup so the family system stays shared.',
      'Move calendar and recurring home tasks in after meals and grocery are steady.',
    ],
    faq: [
      {
        question: 'Is Home Harmony a Mealime replacement?',
        answer: 'It can be, especially for families who need meal planning connected to grocery, chores, tasks, and shared household execution.',
      },
      {
        question: 'Should I switch if Mealime already handles recipes well?',
        answer: 'Switch when your bottleneck is no longer recipe ideas, but getting the whole household to follow the plan week after week.',
      },
    ],
  },
  {
    slug: 'home-harmony-vs-cozi',
    competitor: 'Cozi',
    title: 'Best Cozi Alternative for Families | Home Harmony vs Cozi',
    description:
      'Looking for a Cozi alternative? Compare Home Harmony and Cozi for meal planning, grocery automation, chores, task ownership, calendar workflows, and fitness-nutrition routines.',
    heroImage: '/seo/unique/home-harmony-vs-cozi.jpg',
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
    title: 'Best AnyList Alternative for Families | Home Harmony vs AnyList',
    description:
      'Looking for an AnyList alternative? Compare Home Harmony and AnyList for grocery quality, weekly planning workflows, and household coordination beyond shopping.',
    heroImage: '/seo/unique/home-harmony-vs-anylist.jpg',
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
    slug: 'home-harmony-vs-familywall',
    competitor: 'FamilyWall',
    title: 'Best FamilyWall Alternative for Families | Home Harmony vs FamilyWall',
    description:
      'Looking for a FamilyWall alternative? Compare Home Harmony and FamilyWall for family calendar coordination, meal planning, grocery automation, chores, tasks, and household execution.',
    heroImage: '/seo/unique/family-routine-builder.jpg',
    heroAlt: 'Home Harmony and FamilyWall comparison for family organizer workflows',
    bestForHomeHarmony: [
      'Families who want meals, grocery, tasks, chores, and wellness in one shared system instead of a lighter family hub.',
      'Households where dinner planning and execution matter as much as the shared calendar.',
    ],
    whereHomeHarmonyWins: [
      'Meal planner and grocery rollups are built into the same system as chores, tasks, workouts, and reminders.',
      'Saved foods, macro tracking, and adult dashboards make food planning more realistic than a calendar-only workflow.',
      'One household setup with personal dashboards for each adult after invite acceptance.',
    ],
    whereCompetitorWins: [
      'Families who are primarily shopping for a shared calendar, messaging, and general family hub features.',
      'Lower setup expectations if meal automation and nutrition are not part of the decision.',
    ],
    switchChecklist: [
      'Move your shared calendar rhythm and top recurring events first so the household timeline stays familiar.',
      'Set dinner cadence, grocery preferences, and saved foods before migrating chores and task ownership.',
      'Invite the second adult after the owner finishes setup so family data stays shared under one household.',
      'Layer in workouts or nutrition only after calendar and meal routines feel steady.',
    ],
    faq: [
      {
        question: 'Is Home Harmony a FamilyWall replacement?',
        answer: 'It can be, especially for families who need the family calendar connected to meal planning, grocery, chores, tasks, and wellness routines.',
      },
      {
        question: 'Should I switch if FamilyWall already handles scheduling?',
        answer: 'Switch when your problem is no longer just seeing the family schedule, but actually getting dinner, shopping, chores, and routines to happen from that plan.',
      },
    ],
  },
  {
    slug: 'home-harmony-vs-famcal',
    competitor: 'FamCal',
    title: 'Best FamCal Alternative for Families | Home Harmony vs FamCal',
    description:
      'Looking for a FamCal alternative? Compare Home Harmony and FamCal for shared family calendar planning, shopping lists, meal workflows, chores, tasks, and daily follow-through.',
    heroImage: '/seo/unique/shared-household-task-priority-planner.jpg',
    heroAlt: 'Home Harmony and FamCal comparison for family scheduling and planning',
    bestForHomeHarmony: [
      'Families that want shared scheduling plus meal planning, grocery automation, chores, and task execution in one app.',
      'Households where a shared calendar is important but not enough on its own.',
    ],
    whereHomeHarmonyWins: [
      'Weekly meal planning, saved foods, and grocery generation sit inside the same household workflow as the calendar.',
      'Adult dashboards, nutrition goals, and kid chores/skills all connect to the same family system.',
      'Better fit for families who want one place to run the week instead of a calendar with attached lists.',
    ],
    whereCompetitorWins: [
      'Users who mainly want a shared family calendar with lists, notes, and light planning.',
      'A simpler option when the household does not need deeper meal/grocery execution or wellness tracking.',
    ],
    switchChecklist: [
      'Bring over the shared events and key recurring routines first so everyone lands in a familiar calendar flow.',
      'Set up meals, grocery stores, and saved foods next so the new system solves a second weekly bottleneck immediately.',
      'Move chores and family tasks in after your first full week runs successfully.',
      'Use leaderboards and personal dashboards only after the shared family system is adopted.',
    ],
    faq: [
      {
        question: 'Is Home Harmony a good FamCal alternative?',
        answer: 'Yes, especially if you like the shared family calendar idea but need a stronger system for meals, grocery, chores, and wellness routines too.',
      },
      {
        question: 'Can Home Harmony replace FamCal without making setup too heavy?',
        answer: 'Yes. The safest migration is calendar first, then meals and grocery, then chores and tasks once the first week feels stable.',
      },
    ],
  },
  {
    slug: 'home-harmony-vs-todoist-for-families',
    competitor: 'Todoist',
    title: 'Home Harmony vs Todoist for Family Task and Routine Systems',
    description:
      'Compare Home Harmony and Todoist for household task ownership, recurring routines, meal integration, and family engagement.',
    heroImage: '/seo/unique/home-harmony-vs-todoist-for-families.jpg',
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
