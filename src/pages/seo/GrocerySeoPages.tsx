import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { groceryListPages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import {
  SeoHubPrimer,
} from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';

const groceryNarrative: Record<string, { intro: string; closing: string }> = {
  'weekly-grocery-list-kid-friendly-dinners-family-of-4': {
    intro: 'This list logic is tuned for family-of-four dinner volume where kid acceptance and repeat purchases drive outcomes.',
    closing: 'Keep your core kid-approved items fixed and vary only one experimental item each week.',
  },
  'high-protein-meal-prep-shopping-list': {
    intro: 'This page prioritizes protein density per dollar while keeping prep flow straightforward for repeat use.',
    closing: 'Review protein-per-serving weekly and remove low-yield items that increase prep without impact.',
  },
  'budget-grocery-rollup-for-mixed-breakfast-and-dinner-plan': {
    intro: 'This framework merges breakfast and dinner planning into one basket so spend is managed at the household level.',
    closing: 'Use one shared ingredient spine across meals to lower both cost and planning friction.',
  },
  'gluten-free-weekly-shopping-list-with-substitutions': {
    intro: 'This list is built to reduce gluten-free substitution stress before checkout, not during weeknight cooking.',
    closing: 'Lock your gluten-free swaps in advance and preserve the same meal structure week to week.',
  },
  'double-recipe-grocery-list-for-large-batch-weeks': {
    intro: 'This page supports heavy batch weeks where quantity errors create waste, missed meals, or second trips.',
    closing: 'When doubling recipes, audit perishables first and freeze-ready items second to protect usage.',
  },
  'costco-weekly-grocery-list-for-family-meal-prep': {
    intro: 'This guide is structured for warehouse-store buying where pack size and storage planning matter as much as price.',
    closing: 'Buy bulk only where your household has proven weekly consumption and freezer capacity.',
  },
  'summer-no-cook-lunch-and-dinner-grocery-list': {
    intro: 'This list is designed for hot weeks when no-cook meals improve adherence and reduce evening energy load.',
    closing: 'Prioritize short shelf-life produce first in the week and stable proteins later.',
  },
  'instacart-family-grocery-list-with-substitution-logic': {
    intro: 'This framework is optimized for app-based ordering where substitution quality determines dinner reliability.',
    closing: 'Set preferred replacement rules once so your orders stay useful without manual correction.',
  },
  'minimal-fridge-space-weekly-grocery-list': {
    intro: 'This page fits households that need full-week coverage with limited refrigeration and strict storage turnover.',
    closing: 'Sequence your meals by perishability so nothing blocks fridge space midweek.',
  },
  'anti-waste-weekly-grocery-list-for-families': {
    intro: 'This guide is built to cut household food waste through quantity planning and leftover routing.',
    closing: 'Track what gets discarded each week and shrink only those categories first.',
  },
  'aldi-budget-grocery-list-for-7-family-dinners': {
    intro: 'This list strategy targets low-cost weekly dinner coverage using a limited but high-utility item set.',
    closing: 'Keep your Aldi core list fixed and rotate flavors, not entire ingredients.',
  },
  'postpartum-support-grocery-list-for-easy-family-meals': {
    intro: 'This page emphasizes low-lift meals and recovery-supportive staples during postpartum scheduling volatility.',
    closing: 'Choose convenience where it preserves rest, and simplify meal expectations for this season.',
  },
};

function buildGroceryFaq(page: (typeof groceryListPages)[number]) {
  const narrative = groceryNarrative[page.slug];
  return [
    {
      question: `How do I keep "${page.title}" accurate week to week?`,
      answer: `${narrative.intro} Lock meals first, then run your list consolidation pass using ${page.listStrategy[0].toLowerCase()}.`,
    },
    {
      question: 'What is the fastest way to lower total grocery spend with this guide?',
      answer: `Apply ${page.costControls[0].toLowerCase()} first, then layer ${page.costControls[1].toLowerCase()} only after your first full shopping cycle.`,
    },
    {
      question: 'How should I handle substitutions without breaking meal execution?',
      answer: `${narrative.closing} Start with fallback logic like ${page.substitutionRules[0].toLowerCase()} so swaps stay predictable.`,
    },
  ];
}

export function GroceryHubPage() {
  useSeoMeta({
    title: 'Weekly Grocery List Guides | Family Meal Planning | Home Harmony',
    description:
      'Find grocery list rollup strategies for kid-friendly dinners, high-protein prep, and mixed breakfast+dinner planning.',
    keywords: ['weekly grocery list', 'family grocery planning', 'meal prep shopping list'],
    image: '/seo/grocery-lists.svg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Grocery Lists', url: '/grocery-lists' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Grocery List Rollup Guides</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          These pages focus on quantity consolidation, basket control, and substitutions that keep plans practical.
        </p>
      </div>
      <SeoHubPrimer
        title="How to Use These Grocery Guides"
        intro="Strong grocery systems are built after meal decisions are final. Build your shopping logic from a stable plan, then optimize cost and substitutions."
        items={[
          {
            title: 'Finalize meals first',
            description: 'Lock weekly meals before generating your list so quantities are accurate and not constantly shifting.',
          },
          {
            title: 'Normalize ingredients',
            description: 'Merge ingredient names and units before checkout to prevent duplicate purchases.',
          },
          {
            title: 'Plan substitutions early',
            description: 'Document fallback items for frequently unavailable products to preserve execution speed.',
          },
          {
            title: 'Review basket quality weekly',
            description: 'Track overbuy categories, produce waste, and per-serving cost trends.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {groceryListPages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={page.heroImage} alt={page.heroAlt} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">{groceryNarrative[page.slug]?.intro || page.focus}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Outcome: {groceryNarrative[page.slug]?.closing || page.listStrategy[0]}
                </p>
              </div>
              <Link to={`/grocery-lists/${page.slug}`} className="mt-4 inline-block">
                <Button variant="outline">Open Guide</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function GroceryDetailPage() {
  const { slug } = useParams();
  const page = groceryListPages.find((item) => item.slug === slug);
  const detailedFaq = page ? buildGroceryFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Grocery Lists | Home Harmony',
    description: page?.description || 'Consolidated grocery rollup guide from Home Harmony.',
    keywords: ['grocery list by meal plan', 'shopping list rollup', 'consolidated ingredients'],
    image: page?.heroImage,
    publishedTime: '2026-02-21',
    modifiedTime: '2026-02-21',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Grocery Lists', url: '/grocery-lists' },
          { name: page.title, url: `/grocery-lists/${page.slug}` },
        ]
      : [],
    faq: detailedFaq,
  });

  if (!page) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Grocery guide not found</h1>
        <Link to="/grocery-lists" className="mt-4 inline-block">
          <Button variant="outline">Back to Grocery Guides</Button>
        </Link>
      </SeoShell>
    );
  }

  const actionPlanSteps = [
    `Clarify your weekly focus before shopping: ${page.focus}`,
    `Run the consolidation method first: ${page.listStrategy[0]}`,
    `Apply one cost-control lever this week: ${page.costControls[0]}`,
    `Set your primary substitution fallback ahead of checkout: ${page.substitutionRules[0]}`,
  ].filter(Boolean);
  const narrative = groceryNarrative[page.slug] || {
    intro: 'This page gives a practical shopping framework built for consistent weekly execution.',
    closing: 'Keep your list logic stable and iterate only one improvement at a time.',
  };
  const editorialBlocks = [
    {
      title: 'Start With a Clear Shopping Objective',
      intro: page.focus,
      paragraphs: [
        narrative.intro,
        `A clean grocery system starts with a single weekly focus. When focus is vague, basket sprawl and duplicate items increase.`,
        `This page is designed so your list logic supports the same outcome every week and avoids unnecessary midweek rework.`,
      ],
      highlights: [page.focus, ...page.listStrategy.slice(0, 2)],
    },
    {
      title: 'Consolidation and Cost Control Workflow',
      paragraphs: [
        `Before checkout, normalize the list using this sequence: ${page.listStrategy[0].toLowerCase()}, then ${page.listStrategy[1].toLowerCase()}.`,
        `After consolidation, apply budget controls in order: ${page.costControls[0].toLowerCase()} and ${page.costControls[1].toLowerCase()}.`,
      ],
      highlights: [...page.listStrategy, ...page.costControls],
    },
    {
      title: 'Substitution Rules That Keep the Plan Stable',
      paragraphs: [
        `Out-of-stock items should not break dinner execution. Pre-approved substitutions keep your meal plan usable without extra decision load.`,
        narrative.closing,
        `Use the swap rules below as your default fallback logic when availability changes.`,
      ],
      highlights: page.substitutionRules,
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Grocery Lists', href: '/grocery-lists' },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([page.listStrategy, page.costControls, page.substitutionRules]),
      }}
      bestFor={page.focus}
      primaryCta={{ label: 'Use This System', href: '/signin' }}
      outcomes={[page.listStrategy[0], page.costControls[0], page.substitutionRules[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Swaps"
      flexibilityItems={page.substitutionRules}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'Grocery Guides',
          links: groceryListPages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `/grocery-lists/${item.slug}` })),
        },
        {
          title: 'Connected Planning',
          links: (seoCrossLinks['/grocery-lists'] || []).map((item) => ({
            title: item.title,
            href: item.href,
            description: item.description,
          })),
        },
      ]}
      quietCta={{
        title: 'Keep Grocery Planning Consistent',
        description: 'Save this flow and keep list cleanup, reminders, and weekly planning in one place.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'List strategy details', items: page.listStrategy },
        { title: 'Cost control details', items: page.costControls },
      ]}
    />
  );
}
