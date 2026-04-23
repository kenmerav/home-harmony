import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { alternativePages } from '@/data/comparisonContent';
import { useSeoMeta } from '@/lib/seo';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';
import { SeoHubPrimer } from './SeoDetailScaffold';
import { SeoShell } from './SeoShell';

export function AlternativesHubPage() {
  useSeoMeta({
    title: 'Best Family Organizer App Alternatives | Cozi, Nori, Ohai, and More | Home Harmony',
    description:
      'Looking for the best alternative to Cozi, Nori, or Ohai? Compare Home Harmony for family meals, grocery automation, calendar coordination, chores, tasks, and routines.',
    keywords: [
      'cozi alternative',
      'nori alternative',
      'ohai alternative',
      'family organizer alternative',
      'best family organizer app',
    ],
    image: '/seo/task-systems.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Alternatives', url: '/alternatives' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Alternatives</p>
        <h1 className="mt-2 font-display text-4xl">Best Alternatives to Popular Family Organizer Apps</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          If you are searching for a Cozi alternative, Nori alternative, or Ohai alternative, this cluster is built to
          help you compare the real weekly workflow tradeoffs.
        </p>
      </div>

      <SeoHubPrimer
        title="How to use these alternative guides"
        intro="Start with your real bottleneck. If your friction is meals, grocery, chores, or family execution, compare those workflows first."
        items={[
          {
            title: 'Match the guide to your current tool',
            description: 'Use the app-specific page first so the tradeoffs are easier to evaluate in context.',
          },
          {
            title: 'Look at the weekly workflow, not the feature list',
            description: 'The strongest family app is the one your household can actually use week after week.',
          },
          {
            title: 'Migrate in stages',
            description: 'Move calendar or meals first, then layer in grocery, chores, and tasks once the family adopts the new system.',
          },
          {
            title: 'Choose by follow-through',
            description: 'The right alternative is the one that reduces weekly chaos, not just the one with the most features.',
          },
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {alternativePages.map((page) => (
          <article key={page.path} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <img src={page.heroImage} alt={page.heroAlt} className="h-40 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">{page.bestFor}</p>
              </div>
              <Link to={page.path} className="mt-5 inline-block">
                <Button variant="outline">Read Guide</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function AlternativeDetailPage() {
  const { pathname } = useLocation();
  const page = alternativePages.find((item) => item.path === pathname);

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Alternative Guide | Home Harmony',
    description: page?.description || 'Family organizer alternative guide from Home Harmony.',
    keywords: page
      ? [
          `${page.competitor.toLowerCase()} alternative`,
          `${page.competitor.toLowerCase()} alternative for families`,
          `best ${page.competitor.toLowerCase()} alternative`,
          'family organizer alternative',
        ]
      : ['family organizer alternative'],
    image: page?.heroImage || '/seo/task-systems.jpg',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Alternatives', url: '/alternatives' },
          { name: page.title, url: page.path },
        ]
      : [],
    faq: page?.faq || [],
  });

  if (!page) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Alternative guide not found</h1>
        <Link to="/alternatives" className="mt-4 inline-block">
          <Button variant="outline">Back to Alternatives</Button>
        </Link>
      </SeoShell>
    );
  }

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Alternatives', href: '/alternatives' },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: 'April 23, 2026',
        updated: 'April 23, 2026',
        readMinutes: estimateReadMinutes([
          page.outcomes,
          page.whyFamiliesSwitch,
          page.whereHomeHarmonyWins,
          page.whereCompetitorStillFits,
          page.migrationPlan,
        ]),
      }}
      bestFor={page.bestFor}
      primaryCta={{ label: 'Start Free Trial', href: '/onboarding' }}
      outcomes={page.outcomes}
      howItWorks={page.migrationPlan}
      howItWorksIntro={`If you are actively searching for a ${page.competitor} alternative, the safest move is to migrate one weekly workflow at a time.`}
      editorialBlocks={[
        {
          title: `Why Families Search for a ${page.competitor} Alternative`,
          paragraphs: [
            `This page is written for families who are already looking for something better than ${page.competitor} and want to understand the tradeoffs quickly.`,
            `The real decision is rarely about features alone. It is usually about whether your family needs a better shared calendar, stronger meal and grocery execution, better chore ownership, or a calmer weekly system overall.`,
          ],
          highlights: page.whyFamiliesSwitch,
        },
        {
          title: `Where Home Harmony Fits Better`,
          paragraphs: [
            `Home Harmony is strongest when the family problem is not just seeing the plan, but actually carrying it out every week.`,
            `That usually means meals, grocery, chores, tasks, reminders, and family coordination all need to live in one place instead of being patched together.`,
          ],
          highlights: page.whereHomeHarmonyWins,
        },
        {
          title: `When ${page.competitor} May Still Be Enough`,
          paragraphs: [
            `A good alternative guide should also call out when switching may not be worth it yet.`,
            `If your family does not need a broader weekly operations system, the lighter tool can still be the right fit.`,
          ],
          highlights: page.whereCompetitorStillFits,
        },
      ]}
      flexibilityTitle={`When ${page.competitor} Still Fits`}
      flexibilityItems={page.whereCompetitorStillFits}
      faq={page.faq}
      relatedGroups={[
        {
          title: 'Alternative Guides',
          links: alternativePages
            .filter((item) => item.path !== page.path)
            .map((item) => ({ title: item.title, href: item.path })),
        },
        {
          title: 'Related Comparison Pages',
          links: [
            { title: 'Comparison Hub', href: '/compare' },
            { title: 'Family Meal Planner', href: '/family-meal-planner' },
            { title: 'Resources Library', href: '/resources' },
          ],
        },
      ]}
      quietCta={{
        title: `Try a calmer ${page.competitor} alternative`,
        description: 'Start with one workflow for a week, then expand once the whole household is actually using it.',
        primary: { label: 'Start Free Trial', href: '/onboarding' },
        secondary: { label: 'See All Alternatives', href: '/alternatives', variant: 'outline' },
      }}
      advancedSections={[
        { title: `Why ${page.competitor} users switch`, items: page.whyFamiliesSwitch },
        { title: 'Migration plan', items: page.migrationPlan },
      ]}
    />
  );
}
