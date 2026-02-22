import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  choreSystemPages,
  lifestyleTrackingPages,
  OperationsGuideSeoPage,
  taskSystemPages,
  workoutTrackingPages,
} from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
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

interface OperationsConfig {
  hubTitle: string;
  hubDescription: string;
  hubKeywords: string[];
  hubPath: string;
  hubLabel: string;
  notFoundLabel: string;
  pages: OperationsGuideSeoPage[];
  heroImage: string;
}

function OperationsHub({ config }: { config: OperationsConfig }) {
  useSeoMeta({
    title: `${config.hubTitle} | Home Harmony`,
    description: config.hubDescription,
    keywords: config.hubKeywords,
    image: config.heroImage,
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: config.hubLabel, url: config.hubPath },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">{config.hubTitle}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{config.hubDescription}</p>
      </div>
      <SeoHubPrimer
        title={`How to Use ${config.hubLabel}`}
        intro="These operational guides are designed to be implemented in sequence. Start with one high-impact workflow, run it consistently, then layer additional complexity."
        items={[
          {
            title: 'Start with one operating lane',
            description: 'Pick one workflow that reduces the most daily friction and launch that first.',
          },
          {
            title: 'Define ownership and checkpoints',
            description: 'Every system needs clear ownership and review windows to remain reliable.',
          },
          {
            title: 'Measure execution weekly',
            description: 'Use weekly review to identify bottlenecks and remove low-value complexity.',
          },
          {
            title: 'Connect adjacent systems',
            description: 'Link task, routine, nutrition, and wellness systems so your household runs as one operating model.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {config.pages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={page.heroImage} alt={page.heroAlt} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <Link to={`${config.hubPath}/${page.slug}`} className="mt-4 inline-block">
                <Button variant="outline">Open Guide</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

function OperationsDetail({ config }: { config: OperationsConfig }) {
  const { slug } = useParams();
  const page = config.pages.find((item) => item.slug === slug);

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : `${config.hubLabel} | Home Harmony`,
    description: page?.description || `${config.hubLabel} guide from Home Harmony.`,
    keywords: config.hubKeywords,
    image: page?.heroImage || config.heroImage,
    publishedTime: '2026-02-21',
    modifiedTime: '2026-02-21',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: config.hubLabel, url: config.hubPath },
          { name: page.title, url: `${config.hubPath}/${page.slug}` },
        ]
      : [],
    faq: page?.faq || [],
  });

  if (!page) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">{config.notFoundLabel} not found</h1>
        <Link to={config.hubPath} className="mt-4 inline-block">
          <Button variant="outline">Back to {config.hubLabel}</Button>
        </Link>
      </SeoShell>
    );
  }

  const actionPlanSteps = [
    `Confirm fit for your household context: ${page.bestFor}`,
    `Activate the first design principle: ${page.systemDesign[0]}`,
    `Run your first implementation checkpoint: ${page.implementationSteps[0]}`,
    `Preempt one execution risk immediately: ${page.commonPitfalls[0]}`,
  ].filter(Boolean);

  const successMetrics = [
    'Execution consistency of the system for at least two consecutive weeks.',
    'Reduction in repeat friction events tied to this workflow.',
    'Improved role clarity and lower reminder dependency.',
  ];

  return (
    <SeoShell>
      <SeoBreadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'Resources', href: '/resources' },
          { label: config.hubLabel, href: config.hubPath },
          { label: page.title },
        ]}
      />
      <h1 className="font-display text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{page.description}</p>
      <SeoFreshnessBar minutes={estimateReadMinutes([page.systemDesign, page.implementationSteps, page.commonPitfalls])} />
      <div className="mt-6 grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Best For</h2>
            <p className="mt-2 text-sm text-muted-foreground">{page.bestFor}</p>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">System Design</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.systemDesign.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Implementation Steps</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.implementationSteps.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-2xl">Common Pitfalls</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {page.commonPitfalls.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
          <SeoActionPlan
            title="Execution Rollout Plan"
            intro="Deploy the system in controlled phases to increase adoption and avoid overload."
            steps={actionPlanSteps}
          />
          <SeoSuccessMetrics title="Operational Success Metrics" metrics={successMetrics} />
          <SeoRelatedGuides title={`Related ${config.hubLabel}`} items={config.pages} basePath={config.hubPath} currentSlug={page.slug} />
          <SeoCrossClusterLinks title="Related Operational Systems" links={seoCrossLinks[config.hubPath] || []} />
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

const choreConfig: OperationsConfig = {
  hubTitle: 'Family Chore System Guides',
  hubDescription: 'Structured chore systems for real households, with ownership design, routines, and accountability loops.',
  hubKeywords: ['family chore system', 'chore chart app', 'shared chore tracker'],
  hubPath: '/chore-systems',
  hubLabel: 'Chore Systems',
  notFoundLabel: 'Chore guide',
  pages: choreSystemPages,
  heroImage: '/seo/chore-systems.svg',
};

const taskConfig: OperationsConfig = {
  hubTitle: 'Family Task System Guides',
  hubDescription: 'Household task management frameworks to reduce mental load and keep the right work moving.',
  hubKeywords: ['family task management', 'household task tracker', 'shared family to do app'],
  hubPath: '/task-systems',
  hubLabel: 'Task Systems',
  notFoundLabel: 'Task guide',
  pages: taskSystemPages,
  heroImage: '/seo/task-systems.svg',
};

const workoutConfig: OperationsConfig = {
  hubTitle: 'Workout Tracking Guides',
  hubDescription: 'Workout planning and tracking systems that fit family schedules and support long-term consistency.',
  hubKeywords: ['workout tracker app', 'fitness planner', 'strength training tracker'],
  hubPath: '/workout-tracking',
  hubLabel: 'Workout Tracking',
  notFoundLabel: 'Workout guide',
  pages: workoutTrackingPages,
  heroImage: '/seo/workout-tracking.svg',
};

const lifestyleConfig: OperationsConfig = {
  hubTitle: 'Lifestyle Tracking Guides',
  hubDescription: 'Practical tracking systems for sleep, cycle awareness, alcohol habits, and family wellness routines.',
  hubKeywords: ['sleep tracker', 'period tracking planner', 'lifestyle habit tracker'],
  hubPath: '/lifestyle-tracking',
  hubLabel: 'Lifestyle Tracking',
  notFoundLabel: 'Lifestyle guide',
  pages: lifestyleTrackingPages,
  heroImage: '/seo/lifestyle-tracking.svg',
};

export function ChoreSystemsHubPage() {
  return <OperationsHub config={choreConfig} />;
}

export function ChoreSystemsDetailPage() {
  return <OperationsDetail config={choreConfig} />;
}

export function TaskSystemsHubPage() {
  return <OperationsHub config={taskConfig} />;
}

export function TaskSystemsDetailPage() {
  return <OperationsDetail config={taskConfig} />;
}

export function WorkoutTrackingHubPage() {
  return <OperationsHub config={workoutConfig} />;
}

export function WorkoutTrackingDetailPage() {
  return <OperationsDetail config={workoutConfig} />;
}

export function LifestyleTrackingHubPage() {
  return <OperationsHub config={lifestyleConfig} />;
}

export function LifestyleTrackingDetailPage() {
  return <OperationsDetail config={lifestyleConfig} />;
}
