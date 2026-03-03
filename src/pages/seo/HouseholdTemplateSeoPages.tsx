import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { householdTemplatePages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import {
  SeoHubPrimer,
} from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';

const householdNarrative: Record<string, { intro: string; closing: string }> = {
  'family-of-4-weekly-chore-chart-template': {
    intro: 'This template targets standard family-of-four dynamics where uneven chore load creates weekly friction.',
    closing: 'Keep the chart visible and reset assignments on the same day each week.',
  },
  'two-working-parents-night-routine-template': {
    intro: 'This system is built for dual-working-parent evenings where transitions determine whether the night feels controlled.',
    closing: 'Protect the first 60 minutes after arrival as a fixed routine block.',
  },
  'meal-planning-and-chore-sync-template': {
    intro: 'This page combines dinner planning and cleanup ownership so those two workflows stop competing with each other.',
    closing: 'Tie cleanup standards directly to meal nights so follow-through improves automatically.',
  },
  'newborn-and-toddler-household-routine-template': {
    intro: 'This template is designed for high-volatility schedules where sleep disruption and care demands shift by the hour.',
    closing: 'Keep routines intentionally small and repeatable until family energy stabilizes.',
  },
  'teen-and-parent-shared-task-template': {
    intro: 'This framework helps households define shared accountability without constant renegotiation of expectations.',
    closing: 'Use weekly checkpoints to adjust responsibility based on reliability and schedule changes.',
  },
  'blended-family-household-routine-template': {
    intro: 'This page supports blended-home rhythms where consistency and role clarity matter more than strict sameness.',
    closing: 'Document handoff rules across homes so routine drift does not build weekly stress.',
  },
  'adhd-friendly-household-task-template': {
    intro: 'This template focuses on reduced cognitive load, clear sequencing, and visible prompts for ADHD-friendly execution.',
    closing: 'Limit active tasks and emphasize completion signals over long lists.',
  },
  'small-apartment-family-routine-template': {
    intro: 'This system is tuned for compact spaces where shared zones and timing coordination are the main challenge.',
    closing: 'Use short reset windows to keep common areas functional throughout the day.',
  },
  'single-parent-weekly-household-system-template': {
    intro: 'This template prioritizes workload triage and energy protection for single-parent household management.',
    closing: 'Keep a clear must-do list and intentionally defer low-impact tasks without guilt.',
  },
  'homeschool-family-daily-routine-template': {
    intro: 'This page aligns education blocks with home operations so the day stays structured but flexible.',
    closing: 'Anchor the day with start and shutdown rituals to separate school from home mode.',
  },
  'travel-heavy-family-home-reset-template': {
    intro: 'This template is built for irregular home presence where reset routines must be fast and repeatable.',
    closing: 'Use arrival-day reset checklists to prevent backlog from compounding.',
  },
  'multigenerational-household-roles-template': {
    intro: 'This guide supports multigenerational homes where role boundaries and support expectations need explicit structure.',
    closing: 'Review roles monthly and rebalance effort as capacity changes across generations.',
  },
};

function buildHouseholdFaq(page: (typeof householdTemplatePages)[number]) {
  const narrative = householdNarrative[page.slug];
  return [
    {
      question: `How do I roll out "${page.title}" without resistance?`,
      answer: `${narrative.intro} Start with ${page.dailyTemplate[0].toLowerCase()} for one week before expanding the template.`,
    },
    {
      question: 'What is the most important weekly checkpoint for this template?',
      answer: `Run ${page.reviewRitual[0].toLowerCase()} on the same day each week and only change one routine rule at a time.`,
    },
    {
      question: 'How do I keep this system from fading after a few weeks?',
      answer: `${narrative.closing} Reuse weekly structure blocks like ${page.weeklyTemplate[0].toLowerCase()} so the model stays predictable.`,
    },
  ];
}

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
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {householdNarrative[page.slug]?.intro || page.householdProfile}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Outcome: {householdNarrative[page.slug]?.closing || page.dailyTemplate[0]}
                </p>
              </div>
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
  const detailedFaq = page ? buildHouseholdFaq(page) : [];

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
    faq: detailedFaq,
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
  const narrative = householdNarrative[page.slug] || {
    intro: 'This template gives a practical starting point for consistent household operations.',
    closing: 'Keep the routine simple first, then scale only what the household can sustain.',
  };
  const editorialBlocks = [
    {
      title: 'Operating Model for This Household Type',
      intro: page.householdProfile,
      paragraphs: [
        narrative.intro,
        `This template is designed to reduce coordination friction by making daily and weekly ownership visible.`,
        `Start with one stable daily anchor before expanding the system. Reliability at small scale makes the full template sustainable.`,
      ],
      highlights: page.dailyTemplate,
    },
    {
      title: 'Weekly Cadence and Workload Balance',
      paragraphs: [
        `Your weekly system should protect capacity, not just list tasks. Use structure blocks like ${page.weeklyTemplate[0].toLowerCase()} to keep rhythm predictable.`,
        `Then layer in additional responsibilities only after completion rates and handoff clarity are stable.`,
      ],
      highlights: page.weeklyTemplate,
    },
    {
      title: 'Review Loop That Prevents Drift',
      paragraphs: [
        `Even good templates degrade without a review ritual. Keep one recurring checkpoint and evaluate what consistently stalls.`,
        narrative.closing,
        `Use the ritual below to reset ownership, rebalance effort, and keep your home system aligned with real life.`,
      ],
      highlights: page.reviewRitual,
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Household Templates', href: '/household-templates' },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([page.dailyTemplate, page.weeklyTemplate, page.reviewRitual]),
      }}
      bestFor={page.householdProfile}
      primaryCta={{ label: 'Use This System', href: '/signin' }}
      outcomes={[page.dailyTemplate[0], page.weeklyTemplate[0], page.reviewRitual[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Swap Rules"
      flexibilityItems={page.weeklyTemplate}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'Household Templates',
          links: householdTemplatePages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `/household-templates/${item.slug}` })),
        },
        {
          title: 'Connected Guides',
          links: (seoCrossLinks['/household-templates'] || []).map((item) => ({
            title: item.title,
            href: item.href,
            description: item.description,
          })),
        },
      ]}
      quietCta={{
        title: 'Turn This Template Into a Weekly Habit',
        description: 'Save this template, set reminders, and keep tasks, chores, and meals coordinated.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'Daily template details', items: page.dailyTemplate },
        { title: 'Review ritual details', items: page.reviewRitual },
      ]}
    />
  );
}
