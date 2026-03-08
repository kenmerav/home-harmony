export interface TutorialSection {
  title: string;
  steps: string[];
  screenshot: {
    src: string;
    alt: string;
    caption: string;
  };
}

export interface FeatureTutorial {
  slug: string;
  title: string;
  summary: string;
  audience: string;
  timeToComplete: string;
  primaryRoute: string;
  primaryCta: string;
  heroImage: string;
  heroAlt: string;
  outcomes: string[];
  sections: TutorialSection[];
  checklist: string[];
  troubleshooting: Array<{ question: string; answer: string }>;
}

export const FEATURE_TUTORIALS: FeatureTutorial[] = [
  {
    slug: 'onboarding-and-home-plan',
    title: 'Onboarding + your first Home Plan',
    summary:
      'Set up your household profile so Home Harmony can generate a realistic first week with meals, reminders, and routines.',
    audience: 'New households',
    timeToComplete: '8 to 12 min',
    primaryRoute: '/onboarding?force=1',
    primaryCta: 'Run onboarding',
    heroImage: '/landing/hero-family.jpg',
    heroAlt: 'Family reviewing a weekly home plan together',
    outcomes: [
      'Personalized week rhythm based on your real schedule',
      'Meal style and diet preferences saved for recommendations',
      'First set of reminders and routines pre-configured',
    ],
    sections: [
      {
        title: 'Answer setup questions with real weekly constraints',
        steps: [
          'Choose your biggest pressure point first so the setup prioritizes what matters most.',
          'Enter household size, kids age ranges, and weekly rhythm to avoid unrealistic plans.',
          'Add food restrictions, favorite meal styles, and avoid foods to shape recipe matching.',
        ],
        screenshot: {
          src: '/seo/household-templates.jpg',
          alt: 'Onboarding-style family planning view with a calm setup flow',
          caption: 'Use real week constraints, not ideal-week assumptions.',
        },
      },
      {
        title: 'Define fixed weekly anchors',
        steps: [
          'Set recurring anchors like Taco Tuesday or Pizza Friday.',
          'Add preferred grocery stores and shopping mode for better grocery routing.',
          'Choose reminder style so notifications fit your household pace.',
        ],
        screenshot: {
          src: '/seo/meal-plans.jpg',
          alt: 'Sample weekly family meal plan with consistent dinner anchors',
          caption: 'Anchors reduce last-minute decision fatigue every week.',
        },
      },
      {
        title: 'Review and lock your personalized preview',
        steps: [
          'Read the mirror summary to confirm the app captured your household correctly.',
          'Review the generated sample week and grocery preview.',
          'Finish account creation so the plan is saved to your profile.',
        ],
        screenshot: {
          src: '/landing/usecase-family.jpg',
          alt: 'Family viewing a personalized weekly plan',
          caption: 'This is the first real value moment before you enter the app.',
        },
      },
    ],
    checklist: [
      'Household members entered',
      'Meal preferences selected',
      'Weekly anchors saved',
      'Account created at the end of onboarding',
    ],
    troubleshooting: [
      {
        question: 'I got interrupted during onboarding. Do I lose progress?',
        answer: 'No. Re-open onboarding and continue; draft answers are retained and merged when possible.',
      },
      {
        question: 'My preview week does not match what I selected.',
        answer: 'Re-run onboarding with force mode and confirm rhythm, meal preferences, and fixed-day anchors before finishing.',
      },
    ],
  },
  {
    slug: 'recipes-import-and-cleanup',
    title: 'Import recipes from links, PDFs, and manual entry',
    summary:
      'Build your recipe library quickly and clean ingredient formatting so grocery rollups stay accurate.',
    audience: 'Anyone building a recipe base',
    timeToComplete: '10 to 20 min',
    primaryRoute: '/recipes',
    primaryCta: 'Open Recipes',
    heroImage: '/seo/recipe-collections.jpg',
    heroAlt: 'Recipe collection planning board with structured meal options',
    outcomes: [
      'Recipe library ready for swaps and weekly planning',
      'Instructions and cook times visible across Meals and Recipes views',
      'Cleaner ingredient lines for combined grocery totals',
    ],
    sections: [
      {
        title: 'Use the import menu for the right source type',
        steps: [
          'Use link import for web recipes and public recipe pages.',
          'Use PDF import for cookbooks or meal prep documents.',
          'Use manual recipe input for quick entry or cleanup corrections.',
        ],
        screenshot: {
          src: '/landing/usecase-mealprep.jpg',
          alt: 'Recipe import workflow with multiple input options',
          caption: 'Pick the import method that matches your source.',
        },
      },
      {
        title: 'Review parsed recipes before final save',
        steps: [
          'Confirm title, servings, and meal type before importing in bulk.',
          'Review ingredient splits so units and names are clean for grocery math.',
          'Fix odd lines immediately with manual edit while context is fresh.',
        ],
        screenshot: {
          src: '/seo/meal-plans.jpg',
          alt: 'Recipe review panel showing parsed ingredients and metadata',
          caption: 'Two minutes of review prevents ongoing grocery errors.',
        },
      },
      {
        title: 'Use cleanup and edit tools to normalize data',
        steps: [
          'Run cleanup on imported recipes to normalize measurement text.',
          'Open edit to correct ingredient case, spacing, and split problems.',
          'Save changes and re-check grocery output on the Grocery page.',
        ],
        screenshot: {
          src: '/seo/grocery-lists.jpg',
          alt: 'Grocery list output reflecting clean ingredient formatting',
          caption: 'Clean ingredients drive reliable grocery consolidation.',
        },
      },
    ],
    checklist: ['Recipe title and servings verified', 'Ingredient lines normalized', 'Instructions present', 'Meal type set'],
    troubleshooting: [
      {
        question: 'Import succeeded but save failed.',
        answer: 'Re-open the import modal and retry with smaller batches. Keep each batch to a practical size and confirm network status.',
      },
      {
        question: 'Ingredients still look broken in grocery list.',
        answer: 'Open the recipe editor and split combined lines into one ingredient per line with quantity + unit + item.',
      },
    ],
  },
  {
    slug: 'weekly-meal-planning-and-swaps',
    title: 'Build, swap, and lock weekly meals',
    summary:
      'Plan dinners (and optional breakfast/lunch/snacks), then swap recipes quickly without losing your weekly structure.',
    audience: 'Weekly meal planners',
    timeToComplete: '7 to 12 min per week',
    primaryRoute: '/meals',
    primaryCta: 'Open Meals',
    heroImage: '/seo/meal-plans.jpg',
    heroAlt: 'Weekly meal schedule with recipe swaps and day locks',
    outcomes: [
      'Full weekly dinner plan with easy swap controls',
      'Day locks for recurring meal anchors',
      'Macro budget projection synced with planned meals',
    ],
    sections: [
      {
        title: 'Generate or build your week manually',
        steps: [
          'Use regenerate for a fast draft week.',
          'Use manual add for specific meals you already know you want.',
          'Choose recipes from the full dropdown list or type to search quickly.',
        ],
        screenshot: {
          src: '/landing/usecase-mealprep.jpg',
          alt: 'Weekly meal planning view with generated dinner cards',
          caption: 'Draft fast, then refine based on your family schedule.',
        },
      },
      {
        title: 'Swap meals without breaking the week',
        steps: [
          'Click swap on the day card to open random, choose, or request options.',
          'Use title search to find a recipe quickly from the full library.',
          'Save the swap and verify tonight dinner updates automatically.',
        ],
        screenshot: {
          src: '/seo/meal-plans.jpg',
          alt: 'Meal swap dialog with recipe search and selection options',
          caption: 'Swap flows keep the plan flexible without restarting.',
        },
      },
      {
        title: 'Set locks and meal-grid views',
        steps: [
          'Lock recurring dinners for specific weekdays.',
          'Use weekly meal grid view to map breakfast, lunch, snacks, and dinner.',
          'Confirm meal types save to the correct slot (not dinner by default).',
        ],
        screenshot: {
          src: '/landing/usecase-family.jpg',
          alt: 'Meal grid layout showing weekly meal slots by day and meal type',
          caption: 'Grid view keeps all meal types visible in one pass.',
        },
      },
    ],
    checklist: ['Week generated or manually built', 'Required day locks set', 'Swaps tested', 'Meal grid reviewed'],
    troubleshooting: [
      {
        question: 'Swap dropdown is missing recipes.',
        answer: 'Check that recipes are imported and not filtered out by current meal-type or preference filters.',
      },
      {
        question: 'A breakfast saved under dinner.',
        answer: 'Confirm meal type before saving. If already saved wrong, edit the entry and move it to the correct meal slot.',
      },
    ],
  },
  {
    slug: 'grocery-rollup-and-store-flow',
    title: 'Grocery rollup, ordering, and weekly ad links',
    summary:
      'Turn meal plans into one combined grocery list, route by preferred stores, and mark order completion.',
    audience: 'Shoppers and order coordinators',
    timeToComplete: '5 to 10 min',
    primaryRoute: '/grocery',
    primaryCta: 'Open Grocery',
    heroImage: '/seo/grocery-lists.jpg',
    heroAlt: 'Consolidated family grocery list grouped for efficient shopping',
    outcomes: [
      'Duplicate ingredients merged into practical quantities',
      'Store preference and zip-code ad links applied',
      'Ordered state tracked to avoid duplicate orders',
    ],
    sections: [
      {
        title: 'Review the merged list before ordering',
        steps: [
          'Open Grocery after meals are scheduled.',
          'Scan consolidated quantities and remove anything already at home.',
          'Check ingredient wording for any remaining import artifacts.',
        ],
        screenshot: {
          src: '/seo/grocery-lists.jpg',
          alt: 'Grocery view showing combined item quantities from multiple meals',
          caption: 'This page is your single source of truth before checkout.',
        },
      },
      {
        title: 'Use preferred-store routing and ad links',
        steps: [
          'Save zip code once so ad links stay tied to your area.',
          'Select stores such as Frys/Kroger, Safeway, and Whole Foods.',
          'Expand weekly ads only when needed to keep the page clean.',
        ],
        screenshot: {
          src: '/seo/pantry-meals.jpg',
          alt: 'Store planning panel with saved zip and linked weekly ads',
          caption: 'Store context helps reduce spend without extra planning.',
        },
      },
      {
        title: 'Close the loop for reminders',
        steps: [
          'Mark the grocery order complete after checkout.',
          'If not complete, reminder texts can prompt action and auto-plan next steps.',
          'Use reply flows to trigger meal generation when needed.',
        ],
        screenshot: {
          src: '/landing/usecase-family.jpg',
          alt: 'Household task completion flow tied to shopping status',
          caption: 'Completion tracking prevents repeat reminder noise.',
        },
      },
    ],
    checklist: ['List reviewed', 'Store zip saved', 'Ads checked (optional)', 'Order marked complete'],
    troubleshooting: [
      {
        question: 'Weekly ad links keep asking for zip code.',
        answer: 'Save zip in grocery preferences first, then use links generated from that stored value.',
      },
      {
        question: 'Grocery list did not update after meal changes.',
        answer: 'Re-open Grocery after meal save completes. If needed, refresh once to pull latest merged data.',
      },
    ],
  },
  {
    slug: 'calendar-filters-and-reminders',
    title: 'Calendar planner, filters, and reminder routing',
    summary:
      'Use planner view to organize events by layer, assign reminder recipients, and keep each day clear.',
    audience: 'Schedule managers',
    timeToComplete: '10 min setup + daily use',
    primaryRoute: '/calendar',
    primaryCta: 'Open Calendar',
    heroImage: '/seo/task-systems.jpg',
    heroAlt: 'Family planner calendar with color-coded filters and reminders',
    outcomes: [
      'Planner view as default weekly control center',
      'Editable filters with custom labels and colors',
      'Reminder recipients tied to each filter',
    ],
    sections: [
      {
        title: 'Use planner day pop-out for detail checks',
        steps: [
          'Click a day to open the pop-out and review everything in one list.',
          'Add event title, time, and location directly from planner.',
          'Save and verify reminders appear in the correct layer.',
        ],
        screenshot: {
          src: '/seo/task-systems.jpg',
          alt: 'Planner day pop-out showing grouped daily events',
          caption: 'Day pop-out helps avoid missing same-day collisions.',
        },
      },
      {
        title: 'Create and edit filters inline',
        steps: [
          'Use Add Filter in the filter card to create a new event layer.',
          'Set custom label and color in the pop-up modal.',
          'Edit existing filters directly from the list when your setup changes.',
        ],
        screenshot: {
          src: '/seo/lifestyle-tracking.jpg',
          alt: 'Filter setup panel with custom tags and color choices',
          caption: 'Filters should match your real household roles and lanes.',
        },
      },
      {
        title: 'Route reminder texts by filter',
        steps: [
          'Assign one or more phone numbers per filter.',
          'Choose reminder timing windows (for example 30 minutes or 1 hour before).',
          'Confirm recipients receive test reminders before relying on live events.',
        ],
        screenshot: {
          src: '/seo/chore-systems.jpg',
          alt: 'Reminder routing setup with multiple recipients',
          caption: 'Per-filter routing prevents over-notifying everyone.',
        },
      },
    ],
    checklist: ['Planner view active', 'Filters configured', 'Reminder recipients added', 'Day pop-out tested'],
    troubleshooting: [
      {
        question: 'Refresh sends me to onboarding briefly.',
        answer: 'That is an auth/profile bootstrap race. Ensure profile completion state is persisted, then re-open calendar.',
      },
      {
        question: 'A filter does not appear with the others.',
        answer: 'Re-open the filter modal and save label + color. Filters only show when successfully saved to the active list.',
      },
    ],
  },
  {
    slug: 'apple-calendar-readonly-sync',
    title: 'Connect Apple Calendar (read-only feed)',
    summary:
      'Publish your Home Harmony calendar as a secure ICS subscription so Apple Calendar mirrors updates automatically.',
    audience: 'Apple Calendar users',
    timeToComplete: '4 to 6 min',
    primaryRoute: '/calendar/connect-apple',
    primaryCta: 'Connect Apple Calendar',
    heroImage: '/seo/task-systems.svg',
    heroAlt: 'Calendar sync concept showing one-way subscription from Home Harmony',
    outcomes: [
      'Secure private feed URL per household',
      'All-events feed and per-layer feeds available',
      'Token regeneration to revoke old links instantly',
    ],
    sections: [
      {
        title: 'Copy your private feed URL',
        steps: [
          'Open Apple Calendar Connect page in Home Harmony.',
          'Choose all-events feed or a layer-specific feed.',
          'Copy URL and keep it private; anyone with the URL can view that feed.',
        ],
        screenshot: {
          src: '/seo/task-systems.svg',
          alt: 'Apple calendar connect page with secure tokenized feed URLs',
          caption: 'Use separate feeds when you want cleaner calendars.',
        },
      },
      {
        title: 'Subscribe on iPhone or Mac',
        steps: [
          'Go to Settings > Calendar > Accounts > Add Account > Other > Add Subscribed Calendar.',
          'Paste URL and save.',
          'Name the calendar so family members know it is read-only from Home Harmony.',
        ],
        screenshot: {
          src: '/landing/usecase-family.jpg',
          alt: 'Family schedule view synced into an external calendar client',
          caption: 'Edits stay in Home Harmony; Apple reflects updates.',
        },
      },
      {
        title: 'Regenerate token when needed',
        steps: [
          'Use regenerate if a URL was shared accidentally.',
          'Re-subscribe using the new URL.',
          'Old URLs stop working immediately after regeneration.',
        ],
        screenshot: {
          src: '/seo/task-systems.jpg',
          alt: 'Security settings concept for rotating feed access tokens',
          caption: 'Token rotation is the fast way to revoke old calendar access.',
        },
      },
    ],
    checklist: ['Feed copied', 'Subscribed on Apple device', 'Layer selection confirmed', 'Token rotation understood'],
    troubleshooting: [
      {
        question: 'I expected two-way sync and edits are not writing back.',
        answer: 'This v1 is intentionally one-way: plan in Home Harmony, display in Apple Calendar.',
      },
      {
        question: 'Apple does not refresh instantly.',
        answer: 'Feed updates are immediate on Home Harmony; Apple controls polling intervals for subscribed calendars.',
      },
    ],
  },
  {
    slug: 'chores-kids-and-rewards',
    title: 'Chores, extra jobs, and family accountability',
    summary:
      'Assign chores clearly, unlock extra chores after daily completion, and keep family progress visible.',
    audience: 'Families with shared chores',
    timeToComplete: '8 to 15 min setup',
    primaryRoute: '/chores',
    primaryCta: 'Open Chores',
    heroImage: '/seo/chore-systems.jpg',
    heroAlt: 'Family chore board with assignments and completion tracking',
    outcomes: [
      'Clear daily assignments with ownership',
      'Extra chore board visible to kids after daily chores are done',
      'Progress tracking that reduces repeated reminders',
    ],
    sections: [
      {
        title: 'Set daily chores first',
        steps: [
          'Create recurring daily chores by person.',
          'Keep wording concrete so done/not-done is obvious.',
          'Check completion behavior on mobile to match kid usage.',
        ],
        screenshot: {
          src: '/seo/chore-systems.jpg',
          alt: 'Daily family chore schedule with clear assignees',
          caption: 'Simple task wording makes accountability smoother.',
        },
      },
      {
        title: 'Add extra chores as a shared grab list',
        steps: [
          'Create extra chores open to anyone.',
          'Require daily completion before extra chores unlock.',
          'Set reward and deadline rules where appropriate.',
        ],
        screenshot: {
          src: '/landing/usecase-family.jpg',
          alt: 'Shared extra chore list with eligibility rules',
          caption: 'Extra chores work best when unlock rules are explicit.',
        },
      },
      {
        title: 'Use leaderboard and weekly prize motivation',
        steps: [
          'Set a weekly family prize.',
          'Track points from chores and related household goals.',
          'Review winner at end of week to keep engagement high.',
        ],
        screenshot: {
          src: '/seo/lifestyle-tracking.jpg',
          alt: 'Family leaderboard with weekly points and prize',
          caption: 'Small weekly rewards keep the system active.',
        },
      },
    ],
    checklist: ['Daily chores assigned', 'Extra chore board enabled', 'Unlock rule set', 'Weekly reward set'],
    troubleshooting: [
      {
        question: 'Kids can take extra chores too early.',
        answer: 'Verify daily-complete gate is enabled in extra chore rules and test with a child profile.',
      },
      {
        question: 'Too many reminder texts are sent.',
        answer: 'Reduce reminder timing or limit recipients to the responsible adults for chore-specific filters.',
      },
    ],
  },
  {
    slug: 'tasks-and-reminders',
    title: 'Tasks, reminders, and follow-through',
    summary:
      'Capture tasks quickly, set realistic due times, and automate reminder pacing so key items do not slip.',
    audience: 'Households managing many moving parts',
    timeToComplete: '5 to 10 min',
    primaryRoute: '/tasks',
    primaryCta: 'Open Tasks',
    heroImage: '/seo/task-systems.jpg',
    heroAlt: 'Task management board for a busy family week',
    outcomes: [
      'Priority tasks visible at a glance',
      'Reminder cadence tuned by urgency',
      'Less re-planning each day',
    ],
    sections: [
      {
        title: 'Capture and categorize fast',
        steps: [
          'Create tasks as soon as they appear to avoid memory load.',
          'Assign owner and due date during creation.',
          'Use concise titles that describe completion clearly.',
        ],
        screenshot: {
          src: '/seo/task-systems.jpg',
          alt: 'Task creation panel with owner and due date fields',
          caption: 'Capture now, organize once, complete faster.',
        },
      },
      {
        title: 'Set reminder intensity by task type',
        steps: [
          'Use minimal reminders for low-pressure tasks.',
          'Use normal reminders for routine household follow-through.',
          'Use persistent reminders only for high-stakes items.',
        ],
        screenshot: {
          src: '/seo/lifestyle-tracking.jpg',
          alt: 'Reminder settings with multiple intensity options',
          caption: 'Right reminder intensity reduces alert fatigue.',
        },
      },
      {
        title: 'Review open tasks in daily flow',
        steps: [
          'Open Today to review what is due now.',
          'Complete or defer tasks before adding new ones.',
          'Close each day with a quick next-day check.',
        ],
        screenshot: {
          src: '/landing/usecase-family.jpg',
          alt: 'Daily household dashboard with key tasks highlighted',
          caption: 'Daily review keeps backlog from expanding.',
        },
      },
    ],
    checklist: ['Owners assigned', 'Due times set', 'Reminder profile selected', 'Daily review habit started'],
    troubleshooting: [
      {
        question: 'Tasks feel noisy and overwhelming.',
        answer: 'Reduce persistent reminders and archive low-value tasks. Keep only actionable items visible.',
      },
      {
        question: 'Family members miss their tasks.',
        answer: 'Use filter-based reminder recipients and assign tasks to specific dashboards, not shared ambiguity.',
      },
    ],
  },
  {
    slug: 'workouts-and-goal-tracking',
    title: 'Workout templates and progress tracking',
    summary:
      'Launch quickly with starter templates, log sessions, and track progress without overcomplicating the process.',
    audience: 'Users adding fitness to weekly planning',
    timeToComplete: '10 to 15 min setup',
    primaryRoute: '/workouts',
    primaryCta: 'Open Workouts',
    heroImage: '/seo/workout-tracking.jpg',
    heroAlt: 'Workout planner dashboard with templates and progress tracking',
    outcomes: [
      'Templates matched to goal and available equipment',
      'Consistent workout logging per user profile',
      'Progress views for adherence and trends',
    ],
    sections: [
      {
        title: 'Pick a template that matches your goal',
        steps: [
          'Start from template library by goal, split, and equipment.',
          'Choose a manageable weekly frequency first.',
          'Edit sets and exercise selection to your current level.',
        ],
        screenshot: {
          src: '/seo/workout-tracking.jpg',
          alt: 'Workout template gallery with goal labels',
          caption: 'Start with a realistic template, then customize.',
        },
      },
      {
        title: 'Log workouts consistently',
        steps: [
          'Open session view and log sets as completed.',
          'Use quick-adjust controls for small load changes.',
          'Save each session before leaving to preserve progress history.',
        ],
        screenshot: {
          src: '/seo/workout-tracking.jpg',
          alt: 'Workout session logging view with set rows',
          caption: 'Consistency beats complexity in long-term tracking.',
        },
      },
      {
        title: 'Review progress weekly',
        steps: [
          'Check trend charts for key lifts and session completion.',
          'Adjust next week volume based on adherence.',
          'Keep progression conservative to avoid burnout.',
        ],
        screenshot: {
          src: '/seo/workout-tracking.svg',
          alt: 'Workout progress chart showing trend lines over time',
          caption: 'Weekly trend review keeps goals measurable.',
        },
      },
    ],
    checklist: ['Template selected', 'First workout logged', 'Progress chart reviewed', 'Next week schedule set'],
    troubleshooting: [
      {
        question: 'Workout logs do not appear after sign-in.',
        answer: 'Ensure you are on the same account/profile dashboard where the workout was logged.',
      },
      {
        question: 'Templates feel too advanced.',
        answer: 'Duplicate a template, reduce exercise count, and lower weekly frequency before scaling up.',
      },
    ],
  },
  {
    slug: 'macro-budget-and-meal-tracking',
    title: 'Macro budget planner and daily target tracking',
    summary:
      'Set targets, plan meals by serving size, include alcohol/snacks, and monitor projected totals before the day starts.',
    audience: 'Nutrition and body-composition tracking',
    timeToComplete: '8 to 14 min',
    primaryRoute: '/meals',
    primaryCta: 'Open macro planner',
    heroImage: '/seo/macro-plans.jpg',
    heroAlt: 'Macro planner with calorie and macro target visualization',
    outcomes: [
      'Personalized calorie and macro targets',
      'Projected daily totals from planned meals',
      'Visual progress against budget with quick adjustments',
    ],
    sections: [
      {
        title: 'Set targets in macro calculator',
        steps: [
          'Open macro calculator and answer goal, activity, and body-data prompts.',
          'Review final targets for calories, protein, carbs, and fats.',
          'Edit targets manually if needed for practical adherence.',
        ],
        screenshot: {
          src: '/seo/macro-plans.jpg',
          alt: 'Macro calculator screen with editable final targets',
          caption: 'Targets should be realistic and sustainable for your week.',
        },
      },
      {
        title: 'Plan meals by slot and portion',
        steps: [
          'Use daily or weekly meal views for breakfast, lunch, snacks, and dinner.',
          'Select recipes or custom foods with auto-suggest while typing.',
          'Set portion sizes like 0.75 or 1.5 servings for accurate math.',
        ],
        screenshot: {
          src: '/seo/macro-plans.jpg',
          alt: 'Meal slot planner with recipe search and portion selection',
          caption: 'Portion-level planning improves projection accuracy.',
        },
      },
      {
        title: 'Track extras and use suggestions',
        steps: [
          'Add snacks, desserts, and alcohol presets to reflect real intake.',
          'Use AI suggestions for meals that fit your remaining macros.',
          'Review bar/pie progress and adjust before the day ends over budget.',
        ],
        screenshot: {
          src: '/seo/lifestyle-tracking.jpg',
          alt: 'Daily macro progress view with remaining-budget indicator',
          caption: 'Use remaining-macro suggestions to recover the day quickly.',
        },
      },
    ],
    checklist: ['Targets saved', 'Meal slots planned', 'Alcohol/snack entries tested', 'Daily projection reviewed'],
    troubleshooting: [
      {
        question: 'Search dropdown stays open after selecting a recipe.',
        answer: 'Select a result once and wait for field update; if it persists, refresh and retry with the latest UI state.',
      },
      {
        question: 'Calories look off after edits.',
        answer: 'Re-check serving size, meal slot, and whether duplicate entries were added for the same time period.',
      },
    ],
  },
  {
    slug: 'family-members-and-permissions',
    title: 'Family members, dashboards, and role clarity',
    summary:
      'Add spouse and kids, create named dashboards, and keep sensitive tracking scoped to the right person.',
    audience: 'Multi-user households',
    timeToComplete: '6 to 10 min',
    primaryRoute: '/family',
    primaryCta: 'Open Family',
    heroImage: '/seo/household-templates.jpg',
    heroAlt: 'Family account setup showing multiple member profiles',
    outcomes: [
      'Clear person-level dashboards',
      'Family invites sent and accepted',
      'Better privacy boundaries for sensitive details',
    ],
    sections: [
      {
        title: 'Add members and assign role context',
        steps: [
          'Use Add Family Member to create each profile.',
          'Assign each person to practical role lanes (parent, kid, manager).',
          'Confirm each member sees only relevant sections.',
        ],
        screenshot: {
          src: '/seo/household-templates.jpg',
          alt: 'Family management page with member list and invite controls',
          caption: 'Role clarity keeps household workflows cleaner.',
        },
      },
      {
        title: 'Create and rename dashboards',
        steps: [
          'Use dashboard controls to add named household dashboards.',
          'Rename dashboards as family structure changes.',
          'Switch dashboards to validate data is scoped correctly.',
        ],
        screenshot: {
          src: '/landing/usecase-family.jpg',
          alt: 'Dashboard switcher showing multiple family profiles',
          caption: 'Separate dashboards reduce cross-person confusion.',
        },
      },
      {
        title: 'Finalize invite and reminder defaults',
        steps: [
          'Send invite emails from Family setup.',
          'Set default reminder recipients for shared events.',
          'Run a quick test reminder to verify phone numbers.',
        ],
        screenshot: {
          src: '/seo/task-systems.jpg',
          alt: 'Household reminder setup with invite confirmations',
          caption: 'One test now avoids missed reminders later.',
        },
      },
    ],
    checklist: ['Members added', 'Dashboards named', 'Invites sent', 'Reminder defaults tested'],
    troubleshooting: [
      {
        question: 'A member cannot access expected features.',
        answer: 'Review role-level visibility and ensure the invited user completed account setup from the invite link.',
      },
      {
        question: 'Admin-only items appear for wrong account.',
        answer: 'Verify admin checks are tied to the configured admin email and the user is signed into the correct account.',
      },
    ],
  },
];

export function getFeatureTutorial(slug: string): FeatureTutorial | undefined {
  return FEATURE_TUTORIALS.find((tutorial) => tutorial.slug === slug);
}
