import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { recipeCollectionPages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import {
  SeoActionPlan,
  SeoBreadcrumbs,
  SeoCrossClusterLinks,
  SeoFreshnessBar,
  SeoHubPrimer,
  SeoRelatedGuides,
  SeoSuccessMetrics,
} from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';

export function RecipeCollectionHubPage() {
  useSeoMeta({
    title: 'Recipe Collections | Kid-Friendly, High-Protein, and Fast Dinners | Home Harmony',
    description: 'Explore recipe collections organized by household use-case: kid-friendly, high-protein prep, and under-30-minute dinners.',
    keywords: ['recipe collections', 'kid friendly recipes', 'high protein recipes'],
    image: '/seo/recipe-collections.svg',
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
    faq: page?.faq || [],
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

  const successMetrics = [
    'Collection adherence: how many selected recipes were executed.',
    'Family acceptance score by recipe format and flavor profile.',
    'Prep efficiency gains from ingredient overlap and repeated workflow.',
  ];

  return (
    <SeoShell>
      <SeoBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: 'Recipe Collections', href: '/recipe-collections' },
          { label: page.title },
        ]}
      />
      <h1 className="font-display text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{page.description}</p>
      <SeoFreshnessBar minutes={estimateReadMinutes([page.featuredRecipes, page.howToUseCollection, page.pairingIdeas])} />
      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Collection Angle</h2>
            <p className="mt-2 text-sm text-muted-foreground">{page.collectionAngle}</p>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Featured Recipe Paths</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.featuredRecipes.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">How to Use This Collection</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.howToUseCollection.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Pairing Ideas</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.pairingIdeas.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <SeoActionPlan
            title="Collection Rollout Plan"
            intro="Run each collection in a controlled weekly cycle so you can identify high-performing recipes and remove low-compliance options quickly."
            steps={actionPlanSteps}
          />
          <SeoSuccessMetrics title="How to Measure Collection Quality" metrics={successMetrics} />
          <SeoRelatedGuides
            title="Related Recipe Collections"
            items={recipeCollectionPages}
            basePath="/recipe-collections"
            currentSlug={page.slug}
          />
          <SeoCrossClusterLinks title="Next Best Guides for Execution" links={seoCrossLinks['/recipe-collections'] || []} />
        </div>
        <aside className="space-y-4">
          <img src={page.heroImage} alt={page.heroAlt} className="w-full rounded-xl border border-border object-cover" />
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-xl">FAQ</h3>
            <div className="mt-3 space-y-3">
              {page.faq.map((item) => (
                <div key={item.question}>
                  <p className="text-sm font-semibold">{item.question}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </SeoShell>
  );
}
