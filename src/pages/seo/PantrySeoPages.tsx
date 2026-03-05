import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { pantryMealPages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import {
  SeoHubPrimer,
} from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';

const pantryNarrative: Record<string, { intro: string; closing: string }> = {
  'meals-with-chicken-rice-onion': {
    intro: 'This page is for the classic emergency combo that most homes can pull together without extra shopping.',
    closing: 'Use sauce and texture swaps to keep this base from feeling repetitive across the month.',
  },
  'meals-with-ground-beef-pasta': {
    intro: 'This guide focuses on one of the most flexible pantry dinner bases for fast, high-completion weeknights.',
    closing: 'Pre-portion cooked beef once and rotate pasta formats to reduce daily prep work.',
  },
  'meals-with-eggs-potatoes-yogurt': {
    intro: 'This framework supports low-cost, high-satiety meals using staples that work across breakfast and dinner.',
    closing: 'Keep cooked potatoes ready and use eggs as the fast protein bridge for short nights.',
  },
  'meals-with-turkey-rice-frozen-veggies': {
    intro: 'This lane is built for fast, macro-friendly dinners with minimal spoilage risk.',
    closing: 'Batch the turkey base and season by serving style so one prep cycle covers multiple dinners.',
  },
  'meals-with-chicken-pasta-yogurt': {
    intro: 'This page helps you turn a simple trio into higher-protein comfort meals without heavy cleanup.',
    closing: 'Keep yogurt sauces pre-mixed so chicken-pasta nights stay under your time limit.',
  },
  'meals-with-canned-tuna-rice-frozen-peas': {
    intro: 'This guide is designed for shelf-stable reliability when fresh protein options are limited.',
    closing: 'Use strong acid and herb add-ons to keep tuna bowls fresh and repeatable.',
  },
  'meals-with-black-beans-corn-tortillas-salsa': {
    intro: 'This page supports low-cost, high-speed dinner assembly with pantry items that store well.',
    closing: 'Treat this set as your no-fail fallback when the week runs off schedule.',
  },
  'meals-with-rotisserie-chicken-bagged-salad-wraps': {
    intro: 'This workflow prioritizes low-cook assembly for nights where prep bandwidth is close to zero.',
    closing: 'Portion rotisserie chicken immediately so leftovers are ready for the next quick meal.',
  },
  'meals-with-oats-eggs-banana-peanut-butter': {
    intro: 'This guide turns breakfast staples into all-day meal options when pantry flexibility is the goal.',
    closing: 'Use this combo to bridge tight-budget weeks while keeping protein and satiety steady.',
  },
  'meals-with-frozen-shrimp-rice-broccoli': {
    intro: 'This page gives you a rapid seafood lane with frozen inventory that is easy to keep on hand.',
    closing: 'Defrost only what you need and keep seasoning profiles distinct to avoid flavor fatigue.',
  },
  'meals-with-chickpeas-tomatoes-spinach-pasta': {
    intro: 'This plan is built for plant-forward dinners that still feel complete and practical on weeknights.',
    closing: 'Cook chickpeas and pasta with complementary textures to keep these meals satisfying.',
  },
  'meals-with-ground-turkey-potatoes-frozen-corn': {
    intro: 'This setup balances convenience and volume, making it useful for families with larger appetite swings.',
    closing: 'Pre-cook turkey and potato components so final meals become quick skillet assemblies.',
  },
};

function buildPantryFaq(page: (typeof pantryMealPages)[number]) {
  const narrative = pantryNarrative[page.slug];
  return [
    {
      question: `How do I use "${page.title}" on a busy night?`,
      answer: `${narrative.intro} Start with ${page.fastMeals[0].toLowerCase()} and avoid adding new ingredients unless they unlock multiple meals.`,
    },
    {
      question: 'What should I restock first when pantry options run low?',
      answer: `Restock your base lane in this order: ${page.pantryBase[0].toLowerCase()}, then ${page.pantryBase[1].toLowerCase()}. That keeps fallback meals available.`,
    },
    {
      question: 'How do I prevent pantry meals from feeling repetitive?',
      answer: `${narrative.closing} Rotate one fill-in from this list each week, starting with ${page.fillInItems[0].toLowerCase()}.`,
    },
  ];
}

export function PantryHubPage() {
  useSeoMeta({
    title: 'Pantry Meal Ideas | What Can I Make With What I Have? | Home Harmony',
    description: 'Practical pantry meal pages that map common ingredient sets to usable meals and quick fill-in items.',
    keywords: ['pantry meal ideas', 'what can i make', 'cook with what i have'],
    image: '/seo/pantry-meals.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Pantry Meals', url: '/pantry-meals' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Pantry Meal Guides</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Start with ingredients you already have, then add only what closes the gap.</p>
      </div>
      <SeoHubPrimer
        title="How to Use Pantry Guides Effectively"
        intro="These pages work best when you treat pantry meals as a strategic fallback lane, not random improvisation. Keep your base inventory visible and decision-ready."
        items={[
          {
            title: 'Inventory before planning',
            description: 'Check what is already available before adding grocery items. Pantry-first decisions cut both waste and spend.',
          },
          {
            title: 'Use a fixed fallback framework',
            description: 'Pair a protein, carb, and quick vegetable option to make meal assembly faster on high-chaos days.',
          },
          {
            title: 'Keep fill-in list short',
            description: 'Use small, high-impact add-ons that increase variety without rebuilding your full shopping list.',
          },
          {
            title: 'Rotate pantry anchors weekly',
            description: 'Shift one staple each week to avoid flavor fatigue while keeping execution predictable.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {pantryMealPages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={page.heroImage} alt={page.heroAlt} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pantryNarrative[page.slug]?.intro || page.pantryBase[0]}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Outcome: {pantryNarrative[page.slug]?.closing || page.fastMeals[0]}
                </p>
              </div>
              <Link to={`/pantry-meals/${page.slug}`} className="mt-4 inline-block">
                <Button variant="outline">Open Guide</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function PantryDetailPage() {
  const { slug } = useParams();
  const page = pantryMealPages.find((item) => item.slug === slug);
  const detailedFaq = page ? buildPantryFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Pantry Meals | Home Harmony',
    description: page?.description || 'Pantry ingredient-to-meal strategy from Home Harmony.',
    keywords: ['pantry meals', 'ingredient matching meals', 'fast pantry dinner'],
    image: page?.heroImage,
    publishedTime: '2026-02-21',
    modifiedTime: '2026-02-21',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Pantry Meals', url: '/pantry-meals' },
          { name: page.title, url: `/pantry-meals/${page.slug}` },
        ]
      : [],
    faq: detailedFaq,
  });

  if (!page) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Pantry guide not found</h1>
        <Link to="/pantry-meals" className="mt-4 inline-block">
          <Button variant="outline">Back to Pantry Guides</Button>
        </Link>
      </SeoShell>
    );
  }

  const actionPlanSteps = [
    `Confirm pantry base ingredients are in stock: ${page.pantryBase[0]}`,
    `Select your fastest meal path first: ${page.fastMeals[0]}`,
    `Buy only the highest-impact fill-in item: ${page.fillInItems[0]}`,
    `Apply one fail-safe method for consistency: ${page.failSafeTips[0]}`,
  ].filter(Boolean);
  const narrative = pantryNarrative[page.slug] || {
    intro: 'This page is designed for practical pantry execution with minimal additional shopping.',
    closing: 'Keep one reliable pantry fallback lane active every week to reduce dinner misses.',
  };
  const editorialBlocks = [
    {
      title: 'Pantry-First Planning Strategy',
      intro: 'This guide is built to reduce spending and friction by using what is already in your kitchen.',
      paragraphs: [
        narrative.intro,
        `Your pantry base determines how quickly you can execute meals on high-chaos days. Start with ${page.pantryBase[0].toLowerCase()} and keep the same core anchors visible.`,
        `When base inventory is stable, dinner decisions become assembly problems instead of full planning sessions.`,
      ],
      highlights: page.pantryBase,
    },
    {
      title: 'Fast Meal Paths for Busy Nights',
      paragraphs: [
        `Use one primary speed lane each week: ${page.fastMeals[0].toLowerCase()}. Then rotate a second option like ${page.fastMeals[1].toLowerCase()}.`,
        `The goal is to keep dinner completion high with predictable formats you can repeat without extra cognitive load.`,
      ],
      highlights: page.fastMeals,
    },
    {
      title: 'Fill-In Buying and Fail-Safe Rules',
      paragraphs: [
        `Only buy fill-in items that unlock multiple meals. For this framework, ${page.fillInItems[0].toLowerCase()} is a high-impact example.`,
        narrative.closing,
        `Then protect execution using fail-safe rules like ${page.failSafeTips[0].toLowerCase()}. This keeps your week resilient even when time is tight.`,
      ],
      highlights: [...page.fillInItems, ...page.failSafeTips],
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Pantry Meals', href: '/pantry-meals' },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([page.fastMeals, page.fillInItems, page.failSafeTips]),
      }}
      bestFor="Households trying to make dinner from what is already on hand."
      primaryCta={{ label: 'Use This System', href: '/signin' }}
      outcomes={[page.fastMeals[0], page.fillInItems[0], page.failSafeTips[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Fill-In Swaps"
      flexibilityItems={page.fillInItems}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'Pantry Guides',
          links: pantryMealPages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `/pantry-meals/${item.slug}` })),
        },
        {
          title: 'Connected Home Systems',
          links: (seoCrossLinks['/pantry-meals'] || []).map((item) => ({
            title: item.title,
            href: item.href,
            description: item.description,
          })),
        },
      ]}
      quietCta={{
        title: 'Run Pantry Planning Every Week',
        description: 'Save this structure and coordinate pantry meals with your grocery and dinner schedule.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'Pantry base ideas', items: page.pantryBase },
        { title: 'Fast meal paths', items: page.fastMeals },
      ]}
    />
  );
}
