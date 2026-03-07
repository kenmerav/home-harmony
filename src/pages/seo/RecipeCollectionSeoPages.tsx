import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { recipeCollectionPages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import {
  SeoHubPrimer,
} from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';

const recipeNarrative: Record<string, { intro: string; closing: string }> = {
  'kid-friendly-slow-cooker-recipes': {
    intro: 'This collection is designed for set-and-forget dinners that avoid intense flavors and keep family compliance high.',
    closing: 'Use a mild base and optional toppings so one batch works for both kids and adults.',
  },
  'high-protein-meal-prep-recipes': {
    intro: 'This page centers on protein-forward recipes that reheat well and maintain structure across multiple days.',
    closing: 'Prioritize recipes with stable texture after storage to keep prep effort worth repeating.',
  },
  'under-30-minute-family-dinners': {
    intro: 'This collection is built for time-capped evenings where dinner speed determines whether plans are followed.',
    closing: 'Treat this set as your weekday default and reserve longer recipes for weekends.',
  },
  'family-breakfast-meal-prep-recipes': {
    intro: 'This guide supports smoother mornings by front-loading breakfast decisions and prep workload.',
    closing: 'Batch breakfast anchors first so weekday mornings run without last-minute improvisation.',
  },
  'freezer-friendly-family-recipes': {
    intro: 'This collection is optimized for freezer cycles that protect dinner consistency during chaotic weeks.',
    closing: 'Label, date, and portion every batch so freezer meals stay easy to deploy.',
  },
  'kid-friendly-one-pan-dinner-recipes': {
    intro: 'This page focuses on low-mess dinner options where cleanup simplicity increases weeknight adherence.',
    closing: 'Keep sheet-pan and skillet workflows standardized so prep and cleanup remain predictable.',
  },
  'low-mess-slow-cooker-freezer-dump-meals': {
    intro: 'This collection is aimed at low-effort deployment: prep once, freeze, and cook with minimal decision overhead.',
    closing: 'Use consistent bag labels and cook settings to reduce execution errors midweek.',
  },
  'kid-friendly-high-iron-dinner-recipes': {
    intro: 'This guide pairs iron-focused ingredients with familiar formats so nutrition goals are easier to sustain.',
    closing: 'Repeat the highest-acceptance iron meals weekly and rotate only supporting sides.',
  },
  'budget-meal-prep-bowl-recipe-collection': {
    intro: 'This collection uses bowl-style builds to keep ingredient overlap high and cost per serving low.',
    closing: 'Standardize base grains and proteins first, then vary sauces for flavor diversity.',
  },
  'dairy-free-family-dinner-recipe-collection': {
    intro: 'This page is built for dairy-free execution that still feels satisfying and practical for shared dinners.',
    closing: 'Lock dairy-free substitutes by recipe type so shopping and prep stay straightforward.',
  },
  'post-workout-family-dinner-recipe-collection': {
    intro: 'This collection supports recovery-focused dinners with enough flexibility for mixed family goals.',
    closing: 'Pair high-protein mains with easy carb sides to keep post-workout meals repeatable.',
  },
  'family-sunday-batch-cook-recipe-collection': {
    intro: 'This guide is structured around Sunday production blocks that reduce weekday cooking pressure.',
    closing: 'Choose a small set of high-yield batch recipes and run the same cadence for two weeks.',
  },
};

function buildRecipeCollectionFaq(page: (typeof recipeCollectionPages)[number]) {
  const narrative = recipeNarrative[page.slug];
  return [
    {
      question: `How do I choose recipes from "${page.title}" each week?`,
      answer: `${narrative.intro} Start with ${page.featuredRecipes[0].toLowerCase()} as your anchor recipe, then add one secondary option.`,
    },
    {
      question: 'How many recipes should I rotate before the collection gets too complex?',
      answer: `Use 3-4 repeatable recipes at a time and apply ${page.howToUseCollection[0].toLowerCase()} to keep execution stable.`,
    },
    {
      question: 'How can I keep this collection practical on high-chaos weeks?',
      answer: `${narrative.closing} Pair meals with quick add-ons like ${page.pairingIdeas[0].toLowerCase()} to protect completion.`,
    },
  ];
}

export function RecipeCollectionHubPage() {
  useSeoMeta({
    title: 'Recipe Collections | Kid-Friendly, High-Protein, and Fast Dinners | Home Harmony',
    description: 'Explore recipe collections organized by household use-case: kid-friendly, high-protein prep, and under-30-minute dinners.',
    keywords: ['recipe collections', 'kid friendly recipes', 'high protein recipes'],
    image: '/seo/recipe-collections.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Recipe Collections', url: '/recipe-collections' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Recipe Collections</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Curated recipe groups designed for specific operating goals, not random lists.</p>
      </div>
      <SeoHubPrimer
        title="How to Choose the Right Collection"
        intro="Pick collections based on execution constraints first, then flavor preferences. The highest-performing collection is the one your household can repeat."
        items={[
          {
            title: 'Match to weekly constraints',
            description: 'Use time, cleanup tolerance, and schedule volatility to decide collection type.',
          },
          {
            title: 'Prioritize repeatable wins',
            description: 'Start with recipes your household already accepts, then introduce new options gradually.',
          },
          {
            title: 'Batch strategically',
            description: 'Select collections with ingredient overlap to simplify prep and grocery output.',
          },
          {
            title: 'Pair with fallback options',
            description: 'Keep one emergency fast meal in each collection cycle for high-chaos days.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {recipeCollectionPages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={page.heroImage} alt={page.heroAlt} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {recipeNarrative[page.slug]?.intro || page.collectionAngle}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Outcome: {recipeNarrative[page.slug]?.closing || page.featuredRecipes[0]}
                </p>
              </div>
              <Link to={`/recipe-collections/${page.slug}`} className="mt-4 inline-block">
                <Button variant="outline">Open Collection</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function RecipeCollectionDetailPage() {
  const { slug } = useParams();
  const page = recipeCollectionPages.find((item) => item.slug === slug);
  const detailedFaq = page ? buildRecipeCollectionFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Recipe Collections | Home Harmony',
    description: page?.description || 'Recipe collection page from Home Harmony.',
    keywords: ['recipe hub', 'family dinner recipes', 'meal prep recipes'],
    image: page?.heroImage,
    publishedTime: '2026-02-21',
    modifiedTime: '2026-02-21',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Recipe Collections', url: '/recipe-collections' },
          { name: page.title, url: `/recipe-collections/${page.slug}` },
        ]
      : [],
    faq: detailedFaq,
  });

  if (!page) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Collection not found</h1>
        <Link to="/recipe-collections" className="mt-4 inline-block">
          <Button variant="outline">Back to Collections</Button>
        </Link>
      </SeoShell>
    );
  }

  const actionPlanSteps = [
    `Set your collection objective first: ${page.collectionAngle}`,
    `Pick your lead recipe path and schedule it early: ${page.featuredRecipes[0]}`,
    `Apply this usage framework consistently: ${page.howToUseCollection[0]}`,
    `Add one pairing for speed and completion: ${page.pairingIdeas[0]}`,
  ].filter(Boolean);
  const narrative = recipeNarrative[page.slug] || {
    intro: 'This collection is organized for reliable household execution, not one-off inspiration.',
    closing: 'Keep only recipes your household repeats and retire low-compliance options quickly.',
  };
  const editorialBlocks = [
    {
      title: 'Choose Collections by Execution Fit',
      intro: page.collectionAngle,
      paragraphs: [
        narrative.intro,
        `The right collection is the one your household can actually repeat. Start by selecting featured options like ${page.featuredRecipes[0].toLowerCase()} that match your weekly constraints.`,
        `This approach avoids random browsing and gives your week a stable recipe lane with fewer decision points.`,
      ],
      highlights: page.featuredRecipes,
    },
    {
      title: 'How to Run the Collection Week to Week',
      paragraphs: [
        `Use the collection with a fixed operating pattern: ${page.howToUseCollection[0].toLowerCase()}, then ${page.howToUseCollection[1].toLowerCase()}.`,
        `Consistency comes from repeatable sequencing, not adding more recipes every week.`,
      ],
      highlights: page.howToUseCollection,
    },
    {
      title: 'Pairing Logic and Swap Planning',
      paragraphs: [
        `Pairings keep meals complete without extra planning work. For this collection, use pairings such as ${page.pairingIdeas[0].toLowerCase()}.`,
        narrative.closing,
        `Treat pairings as optional speed boosters that help you maintain momentum when time or ingredients are limited.`,
      ],
      highlights: page.pairingIdeas,
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Recipe Collections', href: '/recipe-collections' },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([page.featuredRecipes, page.howToUseCollection, page.pairingIdeas]),
      }}
      bestFor={page.collectionAngle}
      primaryCta={{ label: 'Use This System', href: '/onboarding' }}
      outcomes={[page.featuredRecipes[0], page.howToUseCollection[0], page.pairingIdeas[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Pairing Swaps"
      flexibilityItems={page.pairingIdeas}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'Recipe Collections',
          links: recipeCollectionPages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `/recipe-collections/${item.slug}` })),
        },
        {
          title: 'Execution Guides',
          links: (seoCrossLinks['/recipe-collections'] || []).map((item) => ({
            title: item.title,
            href: item.href,
            description: item.description,
          })),
        },
      ]}
      quietCta={{
        title: 'Save This Collection Workflow',
        description: 'Keep your collection, grocery rollups, and weekly reminders connected in one system.',
        primary: { label: 'Start Free Trial', href: '/onboarding' },
        secondary: { label: 'More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'Featured recipe paths', items: page.featuredRecipes },
        { title: 'Collection usage details', items: page.howToUseCollection },
      ]}
    />
  );
}
