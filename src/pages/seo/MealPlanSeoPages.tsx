import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { mealPlanPages } from '@/data/seoContent';
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
    faq: page?.faq || [],
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

  const successMetrics = [
    'Weekly adherence score: number of planned dinners actually executed.',
    'Grocery efficiency: reduction in duplicate purchases and ingredient waste.',
    'Household load balance: fewer last-minute dinner decision bottlenecks.',
  ];

  return (
    <SeoShell>
      <div className="grid gap-8 md:grid-cols-[1.3fr_1fr]">
        <div>
          <SeoBreadcrumbs
            items={[
              { label: 'Home', href: '/' },
              { label: 'Resources', href: '/resources' },
              { label: 'Meal Plans', href: '/meal-plans' },
              { label: page.title },
            ]}
          />
          <h1 className="font-display text-4xl">{page.title}</h1>
          <p className="mt-3 text-muted-foreground">{page.description}</p>
          <SeoFreshnessBar minutes={estimateReadMinutes([page.weeklyStructure, page.prepWorkflow, page.commonSwaps])} />
          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.15em] text-primary">Best For</p>
            <p className="mt-2 text-sm">{page.audience}</p>
          </div>

          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Weekly Structure</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.weeklyStructure.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>

          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Prep Workflow</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.prepWorkflow.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>

          <section className="mt-6 rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Common Swaps</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.commonSwaps.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>

          <SeoActionPlan
            title="7-Day Implementation Plan"
            intro="Use this simple rollout sequence to deploy the framework quickly without overwhelming your household."
            steps={actionPlanSteps}
          />
          <SeoSuccessMetrics title="What Success Looks Like" metrics={successMetrics} />

          <SeoRelatedGuides title="Related Meal Plans" items={mealPlanPages} basePath="/meal-plans" currentSlug={page.slug} />
          <SeoCrossClusterLinks title="Build the Full Home System" links={seoCrossLinks['/meal-plans'] || []} />
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
