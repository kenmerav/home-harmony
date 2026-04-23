import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { comparisonPages } from '@/data/comparisonContent';
import { useSeoMeta } from '@/lib/seo';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { SeoShell } from './SeoShell';
import {
  SeoHubPrimer,
} from './SeoDetailScaffold';
import { ResourcePageLayout } from './ResourcePageLayout';

const comparisonNarrative: Record<string, { intro: string; closing: string }> = {
  'home-harmony-vs-mealime': {
    intro: 'This comparison is for families looking for a Mealime alternative that goes beyond recipe suggestions and grocery basics.',
    closing: 'If meals are the entry point but follow-through is the real problem, test the fuller household workflow instead of only the recipe engine.',
  },
  'home-harmony-vs-cozi': {
    intro: 'This comparison focuses on households looking for a Cozi alternative that handles more than shared calendar coordination.',
    closing: 'Migrate one workflow first so you can test whether the broader operations system improves weekly follow-through.',
  },
  'home-harmony-vs-anylist': {
    intro: 'This page is for families looking for an AnyList alternative with more household coordination built in.',
    closing: 'If meal and grocery are your core bottleneck, pilot there first and then expand into chores and tasks.',
  },
  'home-harmony-vs-familywall': {
    intro: 'This comparison is for families looking for a FamilyWall alternative that reaches deeper into meals, grocery, and weekly execution.',
    closing: 'If the calendar is only one part of the family load, test the full operations stack before deciding.',
  },
  'home-harmony-vs-famcal': {
    intro: 'This comparison is for families looking for a FamCal alternative that does more than shared calendar and light list coordination.',
    closing: 'If your family needs one place to actually run the week, compare the whole system instead of the calendar alone.',
  },
  'home-harmony-vs-todoist-for-families': {
    intro: 'This comparison is built for households choosing between a productivity-first tool and family-specific workflows.',
    closing: 'Evaluate by weekly follow-through, not by how many features each app can technically support.',
  },
};

function buildComparisonFaq(page: (typeof comparisonPages)[number]) {
  const narrative = comparisonNarrative[page.slug];
  return [
    {
      question: `When should a family pick Home Harmony over ${page.competitor}?`,
      answer: `${narrative.intro} Home Harmony is the stronger fit when you need meal, grocery, and household execution connected in one workflow.`,
    },
    {
      question: `What is the safest migration approach from ${page.competitor}?`,
      answer: `Start with the first checklist step: ${page.switchChecklist[0].toLowerCase()}, then pilot one weekly workflow before expanding.`,
    },
    {
      question: `How do I decide if switching from ${page.competitor} is actually worth it?`,
      answer: `${narrative.closing} Compare weekly completion rates and planning friction, not just feature overlap.`,
    },
  ];
}

export function ComparisonHubPage() {
  useSeoMeta({
    title: 'Best Cozi, FamilyWall, FamCal, AnyList, and Mealime Alternatives | Home Harmony',
    description:
      'Looking for the best Cozi, FamilyWall, FamCal, AnyList, or Mealime alternative? Compare Home Harmony for family operations, meal planning, grocery automation, chores, and routines.',
    keywords: [
      'cozi alternative',
      'familywall alternative',
      'famcal alternative',
      'anylist alternative',
      'mealime alternative',
      'home harmony vs mealime',
      'home harmony vs cozi',
      'home harmony vs anylist',
      'best family organizer app',
    ],
    image: '/seo/task-systems.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Comparisons', url: '/compare' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Comparisons</p>
        <h1 className="mt-2 font-display text-4xl">Best Alternatives to Popular Family Organizer Apps</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Honest, implementation-focused comparison articles for families considering alternatives to Cozi, FamilyWall,
          FamCal, AnyList, Mealime, and other household planning tools.
        </p>
      </div>

      <SeoHubPrimer
        title="How to Evaluate Family App Comparisons"
        intro="Start from your bottleneck. If dinner execution and household coordination are your friction points, evaluate workflow depth over feature checklists."
        items={[
          {
            title: 'Map your core weekly bottleneck',
            description: 'Prioritize the system that solves your biggest recurring failure point first.',
          },
          {
            title: 'Compare execution layers, not only features',
            description: 'Meal-to-grocery and task ownership depth usually determines real adoption.',
          },
          {
            title: 'Assess migration overhead honestly',
            description: 'The best tool is the one your household can adopt in 1-2 weeks.',
          },
          {
            title: 'Run one trial week before deciding',
            description: 'Short practical pilots produce better decisions than static feature reading.',
          },
        ]}
      />

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {comparisonPages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <img src={page.heroImage} alt={page.heroAlt} className="h-40 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {comparisonNarrative[page.slug]?.intro || page.bestForHomeHarmony[0]}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Outcome: {comparisonNarrative[page.slug]?.closing || page.switchChecklist[0]}
                </p>
              </div>
              <Link to={`/compare/${page.slug}`} className="mt-5 inline-block">
                <Button variant="outline">Read Comparison</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function ComparisonDetailPage() {
  const { slug } = useParams();
  const page = comparisonPages.find((item) => item.slug === slug);
  const detailedFaq = page ? buildComparisonFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Comparison | Home Harmony',
    description: page?.description || 'Family software comparison guide from Home Harmony.',
    keywords: page ? [page.title.toLowerCase(), 'family app comparison', 'home management app comparison'] : ['family app comparison'],
    image: page?.heroImage || '/seo/task-systems.jpg',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Comparisons', url: '/compare' },
          { name: page.title, url: `/compare/${page.slug}` },
        ]
      : [],
    faq: detailedFaq,
  });

  if (!page) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Comparison not found</h1>
        <Link to="/compare" className="mt-4 inline-block">
          <Button variant="outline">Back to Comparisons</Button>
        </Link>
      </SeoShell>
    );
  }
  const narrative = comparisonNarrative[page.slug] || {
    intro: 'This comparison evaluates real household execution tradeoffs between tool options.',
    closing: 'Use a short pilot period to confirm practical fit before migrating everything.',
  };

  const editorialBlocks = [
    {
      title: `Where Home Harmony Fits Better Than ${page.competitor}`,
      intro: page.bestForHomeHarmony[0] || 'Best for families running meals, grocery, tasks, and routines in one system.',
      paragraphs: [
        narrative.intro,
        `This comparison focuses on real weekly execution, not feature count. Home Harmony wins when your household needs one operational flow across planning, reminders, and follow-through.`,
        `If your current setup struggles with fragmented tools, use this page to decide whether consolidating into one system will improve adoption.`,
      ],
      highlights: page.whereHomeHarmonyWins,
    },
    {
      title: `Where ${page.competitor} May Still Be Stronger`,
      paragraphs: [
        `A good comparison should include tradeoffs. ${page.competitor} can still be the better fit for certain use cases, team styles, or legacy workflows.`,
        `Use this section to decide whether those strengths matter for your household before switching systems.`,
      ],
      highlights: page.whereCompetitorWins,
    },
    {
      title: 'Migration Plan for a Low-Risk Trial',
      paragraphs: [
        `Do not migrate everything on day one. Run a one-week pilot focused on your highest-friction workflow, then expand only after completion rates improve.`,
        narrative.closing,
        `The switch checklist below is sequenced to reduce adoption risk and preserve household momentum.`,
      ],
      highlights: page.switchChecklist,
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Comparisons', href: '/compare' },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([
          page.bestForHomeHarmony,
          page.whereHomeHarmonyWins,
          page.whereCompetitorWins,
          page.switchChecklist,
        ]),
      }}
      bestFor={page.bestForHomeHarmony[0] || `Families evaluating ${page.competitor} alternatives.`}
      primaryCta={{ label: 'Use This System', href: '/onboarding' }}
      outcomes={[page.whereHomeHarmonyWins[0], page.whereHomeHarmonyWins[1], page.whereCompetitorWins[0]]}
      howItWorks={page.switchChecklist}
      editorialBlocks={editorialBlocks}
      flexibilityTitle={`Where ${page.competitor} Still Wins`}
      flexibilityItems={page.whereCompetitorWins}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'Comparison Guides',
          links: comparisonPages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `/compare/${item.slug}` })),
        },
        {
          title: 'Core Resources',
          links: [
            { title: 'Meal Plan Frameworks', href: '/meal-plans' },
            { title: 'Grocery List Guides', href: '/grocery-lists' },
            { title: 'Task Systems', href: '/task-systems' },
          ],
        },
      ]}
      quietCta={{
        title: 'Migrate One Workflow at a Time',
        description: 'Start with meals and grocery, then layer chores and tasks once week one is stable.',
        primary: { label: 'Start Free Trial', href: '/onboarding' },
        secondary: { label: 'More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: `Why families search for a ${page.competitor} alternative`, items: detailedFaq.map((item) => item.answer) },
        { title: 'Best fit for Home Harmony', items: page.bestForHomeHarmony },
        { title: 'Where Home Harmony wins', items: page.whereHomeHarmonyWins },
      ]}
    />
  );
}
