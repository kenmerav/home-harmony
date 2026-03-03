import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { mealPlanPages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import {
  SeoHubPrimer,
} from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';

const mealPlanNarrative: Record<string, { intro: string; closing: string }> = {
  'high-protein-kid-friendly-family-of-4-under-30-minutes': {
    intro: 'This page is built for households trying to raise protein without turning dinner into a separate meal for every person.',
    closing: 'If a night gets chaotic, keep the protein anchor and simplify sides so consistency stays intact.',
  },
  'budget-family-dinner-plan-under-45-minutes': {
    intro: 'This plan focuses on cost control first, then speed, so the weekly total stays predictable without takeout creep.',
    closing: 'Track cost per dinner for two weeks and keep only swaps that lower spend without hurting completion.',
  },
  'slow-cooker-weeknight-plan-for-busy-parents': {
    intro: 'This workflow is for parents who need dinner progressing while work, pickups, and evening logistics are still moving.',
    closing: 'Treat morning setup as the non-negotiable step and evenings become assembly, not decision-making.',
  },
  'gluten-free-family-meal-plan-with-macro-balance': {
    intro: 'This page balances gluten-free constraints with macro consistency so you do not have to choose between compliance and results.',
    closing: 'Lock 2-3 repeatable gluten-free base meals and rotate sauces to keep variety without extra complexity.',
  },
  'athlete-family-meal-plan-with-double-recipe-flow': {
    intro: 'This guide supports mixed intake needs in one home by using double-batch logic instead of separate cooking tracks.',
    closing: 'Keep your high-volume athlete portions tied to the same base meals to avoid doubling prep effort.',
  },
  'dairy-free-family-meal-plan-under-35-minutes': {
    intro: 'This structure keeps weeknight execution fast while removing dairy friction from shopping, prep, and substitutions.',
    closing: 'Document your top dairy-free replacements once and reuse them weekly to preserve speed.',
  },
  'picky-eater-family-meal-plan-with-hidden-veggie-swaps': {
    intro: 'This plan is written for households that need nutrition progress without repeated dinner conflicts at the table.',
    closing: 'Use familiar formats first and increase vegetable exposure in small, repeatable increments.',
  },
  'mediterranean-family-meal-plan-for-busy-weeknights': {
    intro: 'This page uses Mediterranean-style building blocks in a weeknight-friendly format that avoids long prep windows.',
    closing: 'Keep pantry staples ready so Mediterranean meals stay realistic on your busiest days.',
  },
  'low-carb-family-dinner-plan-with-shared-base-meals': {
    intro: 'This framework helps low-carb eaters and non-low-carb family members share one dinner base without extra cooking lanes.',
    closing: 'Anchor every night around one protein and split sides only at plating to keep prep simple.',
  },
  'air-fryer-family-meal-plan-under-25-minutes': {
    intro: 'This plan is designed for short evenings where cleanup and cook time matter as much as nutrition.',
    closing: 'Batch your seasoning and cutting prep once so air-fryer nights stay under your time cap.',
  },
  'high-iron-family-meal-plan-for-growing-kids': {
    intro: 'This guide prioritizes iron-rich dinner patterns for families supporting growth, energy, and appetite swings.',
    closing: 'Pair iron-focused proteins with repeatable side combinations so your grocery list stays stable.',
  },
  'family-meal-plan-for-sports-practice-nights': {
    intro: 'This structure is built around practice-night timing where pre- and post-activity meals need to be predictable.',
    closing: 'Protect your practice-day meal slot first, then fit the rest of the week around that anchor.',
  },
};

function buildMealPlanFaq(page: (typeof mealPlanPages)[number]) {
  const narrative = mealPlanNarrative[page.slug];
  return [
    {
      question: `How should I start "${page.title}" without changing everything at once?`,
      answer: `${narrative.intro} Start by implementing ${page.weeklyStructure[0].toLowerCase()} and keep the rest of your current routine for the first week.`,
    },
    {
      question: `What prep steps matter most for ${page.title.toLowerCase()}?`,
      answer: `Focus on ${page.prepWorkflow[0].toLowerCase()} plus ${page.prepWorkflow[1].toLowerCase()}. These two actions remove the largest weeknight friction points.`,
    },
    {
      question: 'How do I adapt this plan when schedule or ingredients change?',
      answer: `${narrative.closing} Use swap rules such as ${page.commonSwaps[0].toLowerCase()} so dinner stays on plan without rebuilding the week.`,
    },
  ];
}

export function MealPlanHubPage() {
  useSeoMeta({
    title: 'Family Meal Plan Ideas | High Protein, Budget, Slow Cooker | Home Harmony',
    description:
      'Browse practical family meal plan frameworks: high-protein kid-friendly plans, budget dinner plans, and slow-cooker weeknight systems.',
    keywords: ['family meal plan', 'high protein meal plan', 'budget meal plan', 'slow cooker meal plan'],
    image: '/seo/meal-plans.svg',
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
        <h1 className="font-display text-4xl">Meal Plan Frameworks</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Each plan below has a different operating model, so you can choose one that matches your household constraints.
        </p>
      </div>
      <SeoHubPrimer
        title="How to Use These Meal Plan Guides"
        intro="Choose one framework that fits your current season of life, run it for two full weeks, then optimize. Switching plans too fast usually lowers adherence."
        items={[
          {
            title: 'Start with schedule reality',
            description: 'Pick a plan based on your busiest weeknight, not your ideal week. Systems that survive chaos are the ones that stick.',
          },
          {
            title: 'Lock prep windows first',
            description: 'Reserve prep blocks in your calendar before selecting recipes so execution stays predictable.',
          },
          {
            title: 'Build swap rules upfront',
            description: 'Pre-decide substitutions for cost, time, and dietary shifts so weekly adjustments are fast.',
          },
          {
            title: 'Track one outcome metric',
            description: 'Measure adherence, takeout reduction, or grocery waste weekly so the plan improves over time.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {mealPlanPages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={page.heroImage} alt={page.heroAlt} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {mealPlanNarrative[page.slug]?.intro || page.audience}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Outcome: {mealPlanNarrative[page.slug]?.closing || page.weeklyStructure[0]}
                </p>
              </div>
              <Link to={`/meal-plans/${page.slug}`} className="mt-4 inline-block">
                <Button variant="outline">Open Plan</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function MealPlanDetailPage() {
  const { slug } = useParams();
  const page = mealPlanPages.find((item) => item.slug === slug);
  const detailedFaq = page ? buildMealPlanFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Meal Plan | Home Harmony',
    description: page?.description || 'Family meal plan framework from Home Harmony.',
    keywords: ['weekly meal plan', 'family dinner plan', 'home meal planning'],
    image: page?.heroImage,
    publishedTime: '2026-02-21',
    modifiedTime: '2026-02-21',
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

  if (!page) {
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
    'Run the plan for 14 days before making major structural changes.',
  ].filter(Boolean);
  const narrative = mealPlanNarrative[page.slug] || {
    intro: 'This page focuses on practical weekly execution for real family schedules.',
    closing: 'Use this structure for two weeks, then keep only changes that improve consistency.',
  };
  const editorialBlocks = [
    {
      title: 'Why This Plan Works in Real Households',
      intro: `This framework is built for ${page.audience.toLowerCase()}`,
      paragraphs: [
        narrative.intro,
        `Most families fail meal plans because the weekly structure does not match how their week actually moves. In this guide, ${page.weeklyStructure[0].toLowerCase()} and ${page.weeklyStructure[1].toLowerCase()}.`,
        `That structure reduces decision fatigue by giving each night a clear execution lane. It also creates a built-in buffer using ${page.weeklyStructure[2].toLowerCase()}.`,
      ],
      highlights: page.weeklyStructure,
    },
    {
      title: 'Execution Playbook for Weeknights',
      paragraphs: [
        `Your prep plan should remove friction before the workweek starts. For this page, the core pattern is ${page.prepWorkflow[0].toLowerCase()}.`,
        `Then stack one repeatable base workflow with ${page.prepWorkflow[1].toLowerCase()}, followed by ${page.prepWorkflow[2].toLowerCase()}.`,
      ],
      highlights: page.prepWorkflow,
    },
    {
      title: 'Smart Swaps Without Breaking the Plan',
      paragraphs: [
        `A strong weekly plan includes approved substitutions so you can pivot quickly when budget, inventory, or preferences change.`,
        narrative.closing,
        `Use these swap rules to keep momentum while protecting your weekly targets and dinner completion rate.`,
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
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([page.weeklyStructure, page.prepWorkflow, page.commonSwaps]),
      }}
      bestFor={page.audience}
      primaryCta={{ label: 'Use This System', href: '/signin' }}
      outcomes={[page.weeklyStructure[0], page.prepWorkflow[0], page.commonSwaps[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Swaps"
      flexibilityItems={page.commonSwaps}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'Meal Plan Frameworks',
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
        description: 'Store this framework in your dashboard, add reminders, and keep dinners, grocery, and tasks aligned.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'Browse More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'Weekly structure details', items: page.weeklyStructure },
        { title: 'Prep workflow details', items: page.prepWorkflow },
      ]}
    />
  );
}
