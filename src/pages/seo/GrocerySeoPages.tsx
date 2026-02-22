import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { groceryListPages } from '@/data/seoContent';
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
    faq: page?.faq || [],
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

  const successMetrics = [
    'Total duplicate line items removed before checkout.',
    'Weekly grocery variance versus planned budget by category.',
    'Percent of purchased produce fully used by week end.',
  ];

  return (
    <SeoShell>
      <SeoBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: 'Grocery Lists', href: '/grocery-lists' },
          { label: page.title },
        ]}
      />
      <h1 className="font-display text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{page.description}</p>
      <SeoFreshnessBar minutes={estimateReadMinutes([page.listStrategy, page.costControls, page.substitutionRules])} />

      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Focus</h2>
            <p className="mt-2 text-sm text-muted-foreground">{page.focus}</p>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">List Strategy</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.listStrategy.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Cost Controls</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.costControls.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Substitution Rules</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.substitutionRules.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <SeoActionPlan
            title="7-Day Grocery Optimization Plan"
            intro="Run this exact order each week to reduce spend, improve list quality, and keep meal execution stable."
            steps={actionPlanSteps}
          />
          <SeoSuccessMetrics title="What to Track Weekly" metrics={successMetrics} />
          <SeoRelatedGuides title="Related Grocery Guides" items={groceryListPages} basePath="/grocery-lists" currentSlug={page.slug} />
          <SeoCrossClusterLinks title="Connected Planning Guides" links={seoCrossLinks['/grocery-lists'] || []} />
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
