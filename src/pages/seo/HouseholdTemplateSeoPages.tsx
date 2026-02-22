import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { householdTemplatePages } from '@/data/seoContent';
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

export function HouseholdTemplateHubPage() {
  useSeoMeta({
    title: 'Household Templates | Chores, Routines, and Family Operations | Home Harmony',
    description: 'Actionable templates for family chore systems, routines, and household task coordination.',
    keywords: ['household template', 'chore chart', 'family routine template'],
    image: '/seo/household-templates.svg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Household Templates', url: '/household-templates' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Household Templates</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Operational templates for daily execution, weekly cadence, and ownership clarity.</p>
      </div>
      <SeoHubPrimer
        title="How to Implement Household Templates"
        intro="These templates are operational frameworks, not static checklists. The goal is to reduce decision fatigue and improve role clarity week after week."
        items={[
          {
            title: 'Start with minimum viable routine',
            description: 'Launch only the highest-impact daily and weekly actions first, then expand when consistency is stable.',
          },
          {
            title: 'Assign visible ownership',
            description: 'Every template element needs an owner and backup so execution does not rely on reminders.',
          },
          {
            title: 'Use weekly review rhythm',
            description: 'Template quality improves when households adjust load based on real bottlenecks.',
          },
          {
            title: 'Tie templates to meal flow',
            description: 'Dinner planning, cleanup, and admin tasks should be coordinated inside the same routine system.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {householdTemplatePages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={page.heroImage} alt={page.heroAlt} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <Link to={`/household-templates/${page.slug}`} className="mt-4 inline-block">
                <Button variant="outline">Open Template</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function HouseholdTemplateDetailPage() {
  const { slug } = useParams();
  const page = householdTemplatePages.find((item) => item.slug === slug);

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Household Templates | Home Harmony',
    description: page?.description || 'Household operations template from Home Harmony.',
    keywords: ['family household system', 'task template', 'house routine'],
    image: page?.heroImage,
    publishedTime: '2026-02-21',
    modifiedTime: '2026-02-21',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Household Templates', url: '/household-templates' },
          { name: page.title, url: `/household-templates/${page.slug}` },
        ]
      : [],
    faq: page?.faq || [],
  });

  if (!page) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Template not found</h1>
        <Link to="/household-templates" className="mt-4 inline-block">
          <Button variant="outline">Back to Templates</Button>
        </Link>
      </SeoShell>
    );
  }

  const actionPlanSteps = [
    `Confirm your operating context: ${page.householdProfile}`,
    `Launch with one repeatable daily anchor: ${page.dailyTemplate[0]}`,
    `Lock one weekly structure block: ${page.weeklyTemplate[0]}`,
    `Run your review ritual each week: ${page.reviewRitual[0]}`,
  ].filter(Boolean);

  const successMetrics = [
    'Reduction in task ambiguity and repeated reminder loops.',
    'Completion rate for daily baseline routines.',
    'Weekly carry-over volume of unfinished high-priority tasks.',
  ];

  return (
    <SeoShell>
      <SeoBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: 'Household Templates', href: '/household-templates' },
          { label: page.title },
        ]}
      />
      <h1 className="font-display text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{page.description}</p>
      <SeoFreshnessBar minutes={estimateReadMinutes([page.dailyTemplate, page.weeklyTemplate, page.reviewRitual])} />
      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Household Profile</h2>
            <p className="mt-2 text-sm text-muted-foreground">{page.householdProfile}</p>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Daily Template</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.dailyTemplate.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Weekly Template</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.weeklyTemplate.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Review Ritual</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.reviewRitual.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <SeoActionPlan
            title="Template Activation Plan"
            intro="Deploy the template in a staged sequence so your household adopts it without overload."
            steps={actionPlanSteps}
          />
          <SeoSuccessMetrics title="Template Performance Indicators" metrics={successMetrics} />
          <SeoRelatedGuides
            title="Related Household Templates"
            items={householdTemplatePages}
            basePath="/household-templates"
            currentSlug={page.slug}
          />
          <SeoCrossClusterLinks title="Connected System Guides" links={seoCrossLinks['/household-templates'] || []} />
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
