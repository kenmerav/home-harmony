import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { mealPlanPages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import { SeoHubPrimer } from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';

// Per-page metadata
// Each entry provides:
// keywords    - unique, intent-matched search terms for the detail page
// publishedAt - ISO date string (update modifiedAt whenever content changes)
// modifiedAt  - ISO date string
// hubTeaser   - short card description shown on the hub (different from
//               the detail-page intro so search engines see distinct copy)
// hubOutcome  - single outcome sentence shown on hub card
// faqUnique   - one page-specific FAQ question+answer that could not apply
//               to any other plan in the collection

const mealPlanMeta: Record<
  string,
  {
    keywords: string[];
    publishedAt: string;
    modifiedAt: string;
    hubTeaser: string;
    hubOutcome: string;
    intro: string;
    closing: string;
    faqUnique: { question: string; answer: string };
  }
> = {
  'high-protein-kid-friendly-family-of-4-under-30-minutes': {
    keywords: [
      'high protein family meal plan',
      'kid friendly high protein dinners',
      'family of 4 meal plan under 30 minutes',
      'protein meal plan for picky kids',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Raises household protein without splitting dinner into separate plates for adults and kids.',
    hubOutcome:
      'Keep the protein anchor on chaotic nights and simplify the sides - consistency stays intact.',
    intro:
      'This page is built for households trying to raise protein without turning dinner into a separate meal for every person. The plan solves the two-track problem by using flexible formats like bowls and sheet-pan meals where kids eat the same base with milder seasoning.',
    closing:
      'If a night gets chaotic, keep the protein anchor and simplify sides so consistency stays intact. Two weeks of adherence matters more than one perfect week.',
    faqUnique: {
      question: 'How do I keep spice levels kid-friendly without bland food for adults?',
      answer:
        'Build a mild shared base - seasoned protein, simple starch, plain vegetable - and add heat or bold sauces at the table for adults only. Kids get acceptable food, adults get a complete meal.',
    },
  },

  'budget-family-dinner-plan-under-45-minutes': {
    keywords: [
      'budget family dinner plan',
      'cheap family meals under 45 minutes',
      'low cost weekly dinner plan family',
      'affordable weeknight dinners for families',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Controls weekly grocery spend first, then execution speed - so takeout stays out of the budget.',
    hubOutcome:
      'Track cost per dinner for two weeks and keep only swaps that lower spend without hurting completion.',
    intro:
      'This plan focuses on cost control first, then speed, so the weekly total stays predictable without takeout creep. It uses one protein family per week and a shared pantry-sauce system to reduce basket complexity.',
    closing:
      'Track cost per dinner for two weeks and keep only swaps that lower spend without hurting completion. The goal is a repeatable weekly budget, not a single cheap night.',
    faqUnique: {
      question: 'How do I prevent budget meals from triggering takeout on hard nights?',
      answer:
        'Front-load prep on Sunday for your two highest-risk weeknights. When dinner is 80% done before the workweek starts, the friction that causes takeout decisions mostly disappears.',
    },
  },

  'slow-cooker-weeknight-plan-for-busy-parents': {
    keywords: [
      'slow cooker weeknight meal plan',
      'busy parent slow cooker dinners',
      'set and forget family meals',
      'slow cooker family meal plan weekly',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Dinner progresses in the background while school pickups, work, and evening logistics are still happening.',
    hubOutcome:
      'Treat morning setup as the non-negotiable step and evenings become assembly, not decision-making.',
    intro:
      'This workflow is for parents who need dinner progressing while work, pickups, and evening logistics are still moving. The model is morning setup, not evening cooking - which changes the entire stress profile of weeknight dinners.',
    closing:
      'Treat morning setup as the non-negotiable step and evenings become assembly, not decision-making. Protect that morning window first.',
    faqUnique: {
      question: 'How do I use a slow cooker if I leave the house before 7 a.m.?',
      answer:
        'Use freezer-to-cooker dump bags prepped on Sunday. In the morning, pull the bag from the freezer the night before to thaw in the fridge, then drop it in the cooker before leaving. A programmable cooker with a warm setting handles the rest.',
    },
  },

  'gluten-free-family-meal-plan-with-macro-balance': {
    keywords: [
      'gluten free family meal plan',
      'gluten free weekly dinners for families',
      'gluten free macro balanced meal plan',
      'family gluten free dinner plan',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Balances gluten-free compliance with practical macro targets - no separate cooking tracks needed.',
    hubOutcome:
      'Lock 2-3 repeatable gluten-free base meals and rotate sauces to keep variety without extra complexity.',
    intro:
      'This page balances gluten-free constraints with macro consistency so you do not have to choose between compliance and results. It uses bowl-format dinners and shared protein bases to keep one cooking lane for the whole family.',
    closing:
      'Lock 2-3 repeatable gluten-free base meals and rotate sauces to keep variety without extra complexity. Substitution decisions made once prevent ad-hoc mistakes midweek.',
    faqUnique: {
      question: 'How do I prevent gluten cross-contact without running a fully separate kitchen?',
      answer:
        'Assign dedicated utensils and cutting boards to gluten-free prep and keep them visually distinct. Use tamari instead of soy sauce as the default, and choose naturally gluten-free starches - rice, potatoes, corn tortillas - as your weekly base so the workaround is built in, not bolted on.',
    },
  },

  'athlete-family-meal-plan-with-double-recipe-flow': {
    keywords: [
      'athlete family meal plan',
      'high calorie family meal plan',
      'double recipe meal prep for athletes',
      'family meal plan athlete and non athlete',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Uses double-batch logic so one household can serve different intake levels without two separate cooking tracks.',
    hubOutcome:
      'Keep high-volume athlete portions tied to the same base meals to avoid doubling prep effort.',
    intro:
      'This guide supports mixed intake needs in one home by using double-batch logic instead of separate cooking tracks. The athlete gets more - more carbs, more protein, more total volume - from the same dinner base, scaled at the container stage.',
    closing:
      'Keep your high-volume athlete portions tied to the same base meals to avoid doubling prep effort. Separate prep lanes are the most common reason this type of plan collapses.',
    faqUnique: {
      question: 'What should I eat between training and a shared family dinner when timing is off?',
      answer:
        'Use a structured bridge snack - protein shake, Greek yogurt with fruit, or a pre-portioned rice and chicken container - to hit your post-workout window without waiting for the family dinner. Then eat a standard portion at dinner to stay in the shared routine.',
    },
  },

  'dairy-free-family-meal-plan-under-35-minutes': {
    keywords: [
      'dairy free family meal plan',
      'dairy free weeknight dinners under 35 minutes',
      'quick dairy free family dinners',
      'dairy free family dinner plan',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Removes dairy friction from shopping, prep, and substitutions while keeping weeknight execution fast.',
    hubOutcome:
      'Document your top dairy-free replacements once and reuse them weekly to preserve speed.',
    intro:
      'This structure keeps weeknight execution fast while removing dairy friction from shopping, prep, and substitutions. The key is a small substitution library built once - tahini-lemon, coconut milk light, blended white beans - that replaces cream and cheese across all your rotating meals.',
    closing:
      'Document your top dairy-free replacements once and reuse them weekly to preserve speed. Ad-hoc substitution mid-recipe is what slows dairy-free cooking down, not the cooking itself.',
    faqUnique: {
      question: 'How do I get creamy textures in dairy-free sauces without specialty products?',
      answer:
        'Blended white beans or soaked cashews add body and richness. Coconut milk (light) works in tomato-based and curry-style sauces. Tahini whisked with lemon juice and garlic covers the creamy-tangy role that yogurt sauces often play. All are grocery-store staples.',
    },
  },

  'picky-eater-family-meal-plan-with-hidden-veggie-swaps': {
    keywords: [
      'picky eater family meal plan',
      'hidden vegetables family dinner',
      'meal plan for selective eaters kids',
      'family dinner plan for picky kids',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Maintains nutrition progress without dinner conflict - one shared meal, not two separate cooking tracks.',
    hubOutcome:
      'Use familiar formats first and increase vegetable exposure in small, repeatable increments.',
    intro:
      'This plan is written for households that need nutrition progress without repeated dinner conflicts at the table. The strategy is familiarity first: keep the same formats kids already accept - pasta, bowls, tacos - and change only what is inside the sauce.',
    closing:
      'Use familiar formats first and increase vegetable exposure in small, repeatable increments. Consistent mild exposure outperforms forced variety every time.',
    faqUnique: {
      question: 'How do I stop making two separate dinners for adults and picky kids?',
      answer:
        'Use a shared base with customizable toppings at the table. A taco night where kids build their own plate, a bowl where the protein and starch are plain with optional toppings, or a pasta where the sauce is mild and add-ons are served separately - these formats serve everyone from one prep session.',
    },
  },

  'mediterranean-family-meal-plan-for-busy-weeknights': {
    keywords: [
      'mediterranean family meal plan',
      'mediterranean weeknight dinners for families',
      'easy mediterranean dinner plan family',
      'heart healthy family meal plan weeknights',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Brings Mediterranean eating patterns into weeknight reality without complicated prep or specialty ingredients.',
    hubOutcome:
      'Keep pantry staples like olive oil, legumes, and lemon stocked so Mediterranean meals stay realistic on your busiest days.',
    intro:
      'This page uses Mediterranean-style building blocks in a weeknight-friendly format that avoids long prep windows. The pantry-first approach - olive oil, canned legumes, lemon, whole grains - means shopping stays simple and meals come together fast.',
    closing:
      'Keep pantry staples ready so Mediterranean meals stay realistic on your busiest days. The cuisine is inherently batch-friendly when you lead with whole grains and shared sauces.',
    faqUnique: {
      question: 'Does Mediterranean meal planning require expensive fish every week?',
      answer:
        'No. Canned fish - sardines, tuna, salmon - counts and is far cheaper than fresh. Legumes like chickpeas and lentils are strong protein anchors that fit the pattern at minimal cost. Reserve higher-cost fish like salmon for one night and anchor the rest of the week with beans, poultry, and eggs.',
    },
  },

  'low-carb-family-dinner-plan-with-shared-base-meals': {
    keywords: [
      'low carb family dinner plan',
      'low carb meals for families',
      'shared dinner plan low carb and regular',
      'family meal plan one low carb member',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'One dinner base serves both low-carb and standard-carb family members - no separate cooking lanes.',
    hubOutcome:
      'Anchor every night around one protein and split sides only at plating to keep prep simple.',
    intro:
      'This framework helps low-carb eaters and non-low-carb family members share one dinner base without extra cooking lanes. The split happens at the side dish, not the main - which keeps prep fast and prevents the household from running two separate meal tracks.',
    closing:
      'Anchor every night around one protein and split sides only at plating to keep prep simple. One protein, two side options, one prep session.',
    faqUnique: {
      question: 'How do I make sure kids still get enough carbohydrates if the adult lane is low-carb?',
      answer:
        'Keep a standard carb side - rice, potato, corn tortillas - as the default option at every meal. The low-carb adult skips or minimizes it; kids eat it normally. The shared protein and vegetable cover the rest. No one eats an incomplete meal.',
    },
  },

  'air-fryer-family-meal-plan-under-25-minutes': {
    keywords: [
      'air fryer family meal plan',
      'air fryer weeknight dinners for families',
      'family dinners under 25 minutes air fryer',
      'quick air fryer family dinner plan',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Speed-first plan built around air fryer mains, fast sides, and minimal dishes - designed for short evenings.',
    hubOutcome:
      'Batch seasoning and cutting prep once so air-fryer nights stay under your time cap.',
    intro:
      'This plan is designed for short evenings where cleanup and cook time matter as much as nutrition. The air fryer is treated as the primary cooking tool, not a supplementary gadget - which means the rest of the workflow is built around its speed and cleanup profile.',
    closing:
      'Batch your seasoning and cutting prep once so air-fryer nights stay under your time cap. Pre-portioned dry-rub containers cut the actual cook-night prep down to under five minutes.',
    faqUnique: {
      question: 'Can one air fryer feed a family of 4 without meals taking longer than 25 minutes?',
      answer:
        'Yes, with staggered batching. Cook proteins first in two short rounds, then hold warm while quick sides finish. Pre-cut vegetables and pre-portioned proteins are essential - the cook time is fast, but the clock starts when ingredients are already prepped and ready.',
    },
  },

  'high-iron-family-meal-plan-for-growing-kids': {
    keywords: [
      'high iron family meal plan',
      'iron rich dinners for kids',
      'family meal plan for iron deficiency',
      'iron rich weekly dinner plan kids',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Builds iron-rich dinners into normal family formats - no supplements required to see meaningful weekly intake.',
    hubOutcome:
      'Pair iron-focused proteins with repeatable side combinations so your grocery list stays stable.',
    intro:
      'This guide prioritizes iron-rich dinner patterns for families supporting growth, energy, and appetite swings. It uses familiar dinner formats - tacos, pasta, bowls - with iron-dense proteins and vitamin-C pairings already built in to support absorption.',
    closing:
      'Pair iron-focused proteins with repeatable side combinations so your grocery list stays stable. A consistent iron pattern across four nights per week is more effective than occasional high-iron meals.',
    faqUnique: {
      question: 'Which everyday dinner format makes it easiest to hit iron targets for kids?',
      answer:
        'Taco and bowl formats are the most effective because they naturally combine an iron-rich protein (beef, turkey, lentils) with a vitamin-C source (salsa, tomatoes, peppers) in one meal. The absorption pairing is built into the format - you do not have to plan it separately.',
    },
  },

  'family-meal-plan-for-sports-practice-nights': {
    keywords: [
      'family meal plan sports practice nights',
      'dinner ideas for sports practice nights',
      'family meal plan school sports schedule',
      'quick dinners for busy sports family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Built around practice-night timing so pre- and post-activity meals are predictable, not improvised.',
    hubOutcome:
      'Protect your practice-day meal slot first, then fit the rest of the week around that anchor.',
    intro:
      'This structure is built around practice-night timing where pre- and post-activity meals need to be predictable. The plan identifies your three or four most constrained evenings upfront and assigns warm-hold or reheat-ready meals to those nights by default.',
    closing:
      'Protect your practice-day meal slot first, then fit the rest of the week around that anchor. Once the hardest nights are covered, the rest of the week plans itself.',
    faqUnique: {
      question: 'What should kids eat in the 60-minute window between school and evening practice?',
      answer:
        'A snack plate with easy carbs and moderate protein works best: rice cakes and turkey, a small wrap, or yogurt and fruit. Keep it light enough to avoid practice discomfort but substantial enough that performance and focus do not drop. Pre-stage these in labeled containers so kids can grab them independently.',
    },
  },
};

function buildMealPlanFaq(page: (typeof mealPlanPages)[number]) {
  const meta = mealPlanMeta[page.slug];
  return [
    {
      question: `How should I start "${page.title}" without overhauling everything at once?`,
      answer: `${meta.intro} Begin by locking in ${page.weeklyStructure[0].toLowerCase()} and leave the rest of your current routine unchanged for the first week. One anchor change per week prevents system collapse.`,
    },
    {
      question: `What are the two prep steps that matter most for ${page.title.toLowerCase()}?`,
      answer: `Prioritize ${page.prepWorkflow[0].toLowerCase()} and ${page.prepWorkflow[1].toLowerCase()}. These two actions remove the largest weeknight friction points and cover the majority of execution risk.`,
    },
    {
      question: 'How do I adapt this plan when the schedule or available ingredients change mid-week?',
      answer: `${meta.closing} Pre-approve a substitution rule like "${page.commonSwaps[0].toLowerCase()}" so dinner stays on plan without rebuilding the full week from scratch.`,
    },
    meta.faqUnique,
  ];
}

export function MealPlanHubPage() {
  useSeoMeta({
    title: 'Family Meal Plan Frameworks | High-Protein, Budget & Slow Cooker | Home Harmony',
    description:
      'Stop winging weeknight dinners. Browse 12 practical family meal plan frameworks - high-protein kid-friendly plans, budget dinner plans, slow cooker systems, and more - each built for real household constraints.',
    keywords: [
      'family meal plan',
      'weekly meal plan for families',
      'high protein family meal plan',
      'budget family dinner plan',
      'slow cooker meal plan families',
      'meal plan frameworks',
    ],
    image: '/seo/meal-plans.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Meal Plans', url: '/meal-plans' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Family Meal Plan Frameworks</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Each plan below runs on a different operating model - pick the one that matches your household&apos;s biggest constraint: time, budget, dietary needs, or schedule chaos.
        </p>
      </div>
      <SeoHubPrimer
        title="How to Use These Meal Plan Guides"
        intro="Choose one framework that fits your current season of life, run it for two full weeks, then optimize. Switching plans too fast usually lowers adherence more than the plan itself."
        items={[
          {
            title: 'Start with schedule reality',
            description:
              'Pick a plan based on your busiest weeknight, not your ideal week. Systems that survive chaos are the ones that actually stick.',
          },
          {
            title: 'Lock prep windows first',
            description:
              'Reserve prep blocks in your calendar before selecting recipes so execution stays predictable regardless of how the week goes.',
          },
          {
            title: 'Build swap rules upfront',
            description:
              'Pre-decide substitutions for cost, time, and dietary shifts so weekly adjustments take minutes, not another planning session.',
          },
          {
            title: 'Track one outcome metric',
            description:
              'Measure adherence, takeout reduction, or grocery waste weekly so the plan improves based on real data over time.',
          },
        ]}
      />
      <section className="mb-10 rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Start Here</p>
            <h2 className="mt-2 font-display text-3xl leading-tight">Looking for a family meal planner app, not just meal ideas?</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              If your real problem is coordinating meals, grocery lists, calendar timing, and household ownership in one place,
              start with the dedicated family meal planner page first. It is the clearest overview of how Home Harmony works as a full family system.
            </p>
          </div>
          <Link to="/family-meal-planner" className="shrink-0">
            <Button variant="outline">View Family Meal Planner</Button>
          </Link>
        </div>
      </section>
      <div className="grid gap-5 md:grid-cols-2">
        {mealPlanPages.map((page) => {
          const meta = mealPlanMeta[page.slug];
          return (
            <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
              <img
                src={page.heroImage}
                alt={page.heroAlt}
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="p-5">
                <h2 className="font-display text-2xl">{page.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{meta?.hubTeaser || page.description}</p>
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Best fit
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{page.audience}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Key outcome: {meta?.hubOutcome || page.weeklyStructure[0]}
                  </p>
                </div>
                <Link to={`/meal-plans/${page.slug}`} className="mt-4 inline-block">
                  <Button variant="outline">Open Plan</Button>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </SeoShell>
  );
}

export function MealPlanDetailPage() {
  const { slug } = useParams();
  const page = mealPlanPages.find((item) => item.slug === slug);
  const meta = page ? mealPlanMeta[page.slug] : null;
  const detailedFaq = page && meta ? buildMealPlanFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Meal Plan | Home Harmony',
    description: page?.description || 'Family meal plan framework from Home Harmony.',
    keywords: meta?.keywords || ['weekly meal plan', 'family dinner plan', 'meal planning for families'],
    image: page?.heroImage || '/seo/meal-plans.jpg',
    publishedTime: meta?.publishedAt || '2026-02-21',
    modifiedTime: meta?.modifiedAt || '2026-02-21',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Meal Plans', url: '/meal-plans' },
          { name: page.title, url: `/meal-plans/${page.slug}` },
        ]
      : [],
    faq: detailedFaq,
  });

  if (!page || !meta) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Meal plan not found</h1>
        <Link to="/meal-plans" className="mt-4 inline-block">
          <Button variant="outline">Back to Meal Plans</Button>
        </Link>
      </SeoShell>
    );
  }

  const actionPlanSteps = [
    `Set your weekly structure and calendar anchor: ${page.weeklyStructure[0]}`,
    `Build your prep workflow around one repeatable block: ${page.prepWorkflow[0]}`,
    `Pre-approve your top substitution rule before shopping: ${page.commonSwaps[0]}`,
    'Run the plan for 14 days before making any major structural changes.',
  ];

  const editorialBlocks = [
    {
      title: 'Why This Plan Works in Real Households',
      intro: `This framework is built for ${page.audience.toLowerCase()}.`,
      paragraphs: [
        meta.intro,
        `Most families fail meal plans because the weekly structure does not match how their week actually moves. In this guide, ${page.weeklyStructure[0].toLowerCase()} and ${page.weeklyStructure[1].toLowerCase()}.`,
        `That structure reduces decision fatigue by giving each night a clear execution lane. It also creates a built-in buffer using ${page.weeklyStructure[2].toLowerCase()}.`,
      ],
      highlights: page.weeklyStructure,
    },
    {
      title: 'Execution Playbook for Weeknights',
      paragraphs: [
        `Your prep plan should remove friction before the workweek starts. For this plan, the core pattern is ${page.prepWorkflow[0].toLowerCase()}.`,
        `Stack one repeatable base workflow with ${page.prepWorkflow[1].toLowerCase()}, followed by ${page.prepWorkflow[2].toLowerCase()}. Completing these steps before Monday eliminates the most common weeknight failure points.`,
        'When the week goes sideways, return to this prep sequence first. Execution problems are almost always upstream prep problems in disguise.',
      ],
      highlights: page.prepWorkflow,
    },
    {
      title: 'Smart Swaps Without Breaking the Plan',
      paragraphs: [
        'A strong weekly plan includes approved substitutions so you can pivot quickly when budget, inventory, or preferences change mid-week.',
        meta.closing,
        'Use these swap rules to keep momentum while protecting your weekly targets and dinner completion rate. The goal is never a perfect week - it is a consistent month.',
      ],
      highlights: page.commonSwaps,
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Meal Plans', href: '/meal-plans' },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: new Date(meta.publishedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        updated: new Date(meta.modifiedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        readMinutes: estimateReadMinutes([page.weeklyStructure, page.prepWorkflow, page.commonSwaps]),
      }}
      bestFor={page.audience}
      primaryCta={{ label: 'Use This System', href: '/onboarding' }}
      outcomes={[page.weeklyStructure[0], page.prepWorkflow[0], page.commonSwaps[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Swaps"
      flexibilityItems={page.commonSwaps}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'More Meal Plan Frameworks',
          links: mealPlanPages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `/meal-plans/${item.slug}` })),
        },
        {
          title: 'Connected Systems',
          links: (seoCrossLinks['/meal-plans'] || []).map((item) => ({
            title: item.title,
            href: item.href,
            description: item.description,
          })),
        },
      ]}
      quietCta={{
        title: 'Save This Plan to Run Weekly',
        description:
          'Store this framework in your dashboard, set reminders, and keep dinners, grocery lists, and tasks aligned in one place.',
        primary: { label: 'Start Free Trial', href: '/onboarding' },
        secondary: { label: 'Browse More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'Weekly structure details', items: page.weeklyStructure },
        { title: 'Prep workflow details', items: page.prepWorkflow },
      ]}
    />
  );
}
