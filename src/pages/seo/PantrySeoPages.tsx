import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { pantryMealPages } from '@/data/seoContent';
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

export function PantryHubPage() {
  useSeoMeta({
    title: 'Pantry Meal Ideas | What Can I Make With What I Have? | Home Harmony',
    description: 'Practical pantry meal pages that map common ingredient sets to usable meals and quick fill-in items.',
    keywords: ['pantry meal ideas', 'what can i make', 'cook with what i have'],
    image: '/seo/pantry-meals.svg',
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
    faq: page?.faq || [],
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

  const successMetrics = [
    'Number of dinners executed without a full grocery run.',
    'Reduction in emergency takeout on unplanned nights.',
    'Pantry item turnover speed and reduced expiration waste.',
  ];

  return (
    <SeoShell>
      <SeoBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: 'Pantry Meals', href: '/pantry-meals' },
          { label: page.title },
        ]}
      />
      <h1 className="font-display text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{page.description}</p>
      <SeoFreshnessBar minutes={estimateReadMinutes([page.fastMeals, page.fillInItems, page.failSafeTips])} />
      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Pantry Base</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {page.pantryBase.map((item) => (
                <li key={item} className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">{item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Fast Meal Paths</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.fastMeals.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Small Fill-In Items</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.fillInItems.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Fail-Safe Tips</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.failSafeTips.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <SeoActionPlan
            title="Rapid Pantry Execution Plan"
            intro="Use this workflow when schedule changes threaten your normal meal plan. The goal is reliable dinner execution with minimal extra shopping."
            steps={actionPlanSteps}
          />
          <SeoSuccessMetrics title="Performance Metrics to Watch" metrics={successMetrics} />
          <SeoRelatedGuides title="Related Pantry Guides" items={pantryMealPages} basePath="/pantry-meals" currentSlug={page.slug} />
          <SeoCrossClusterLinks title="Related Home Operations Guides" links={seoCrossLinks['/pantry-meals'] || []} />
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
