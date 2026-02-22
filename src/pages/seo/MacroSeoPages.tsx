import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { macroPlanPages } from '@/data/seoContent';
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

export function MacroHubPage() {
  useSeoMeta({
    title: 'Macro Plan Frameworks | Family-Friendly Calorie and Protein Planning | Home Harmony',
    description: 'Macro planning pages with realistic family execution: fat loss, maintenance, and muscle gain structures.',
    keywords: ['macro meal plan', 'family macro planning', 'high protein macro plan'],
    image: '/seo/macro-plans.svg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Macro Plans', url: '/macro-plans' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Macro Plan Frameworks</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Operational macro guidance tied to daily meals, grocery behavior, and review cadence.</p>
      </div>
      <SeoHubPrimer
        title="How to Run Macro Plans That Actually Last"
        intro="Macro success depends less on perfect math and more on repeatable systems. Start with consistent meal templates and adjust only after enough trend data."
        items={[
          {
            title: 'Prioritize adherence over precision',
            description: 'Run stable meal patterns before making aggressive macro changes.',
          },
          {
            title: 'Track trend data weekly',
            description: 'Use weekly averages for body and intake trends, not isolated day-to-day fluctuations.',
          },
          {
            title: 'Coordinate with grocery workflow',
            description: 'Macro plans fail when shopping behavior and meal prep systems are disconnected.',
          },
          {
            title: 'Use phased adjustments',
            description: 'Modify calories and macro splits in small steps after consistency is validated.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {macroPlanPages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={page.heroImage} alt={page.heroAlt} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <Link to={`/macro-plans/${page.slug}`} className="mt-4 inline-block">
                <Button variant="outline">Open Plan</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function MacroDetailPage() {
  const { slug } = useParams();
  const page = macroPlanPages.find((item) => item.slug === slug);

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Macro Plans | Home Harmony',
    description: page?.description || 'Macro planning framework from Home Harmony.',
    keywords: ['macro targets', 'protein planning', 'calorie planning'],
    image: page?.heroImage,
    publishedTime: '2026-02-21',
    modifiedTime: '2026-02-21',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Macro Plans', url: '/macro-plans' },
          { name: page.title, url: `/macro-plans/${page.slug}` },
        ]
      : [],
    faq: page?.faq || [],
  });

  if (!page) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Macro plan not found</h1>
        <Link to="/macro-plans" className="mt-4 inline-block">
          <Button variant="outline">Back to Macro Plans</Button>
        </Link>
      </SeoShell>
    );
  }

  const actionPlanSteps = [
    `Set your baseline target first: ${page.macroTarget}`,
    `Run one repeatable day pattern: ${page.sampleDay[0]}`,
    `Apply one adjustment rule only after trend review: ${page.adjustmentRules[0]}`,
    `Maintain consistent logging behavior: ${page.loggingProtocol[0]}`,
  ].filter(Boolean);

  const successMetrics = [
    'Weekly adherence rate to planned meal and portion structure.',
    'Bodyweight and performance trend alignment with target direction.',
    'Decision-load reduction from repeatable meal templates.',
  ];

  return (
    <SeoShell>
      <SeoBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: 'Macro Plans', href: '/macro-plans' },
          { label: page.title },
        ]}
      />
      <h1 className="font-display text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{page.description}</p>
      <SeoFreshnessBar minutes={estimateReadMinutes([page.sampleDay, page.adjustmentRules, page.loggingProtocol])} />
      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Macro Target</h2>
            <p className="mt-2 text-sm text-muted-foreground">{page.macroTarget}</p>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Sample Day</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.sampleDay.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Adjustment Rules</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.adjustmentRules.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Logging Protocol</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.loggingProtocol.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <SeoActionPlan
            title="Macro Plan Execution Sequence"
            intro="Follow this order to keep your plan stable long enough for meaningful data-driven adjustments."
            steps={actionPlanSteps}
          />
          <SeoSuccessMetrics title="Macro Plan Success Signals" metrics={successMetrics} />
          <SeoRelatedGuides title="Related Macro Plans" items={macroPlanPages} basePath="/macro-plans" currentSlug={page.slug} />
          <SeoCrossClusterLinks title="Related Planning Systems" links={seoCrossLinks['/macro-plans'] || []} />
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
