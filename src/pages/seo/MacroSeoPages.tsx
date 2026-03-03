import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { macroPlanPages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import {
  SeoHubPrimer,
} from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';

const macroNarrative: Record<string, { intro: string; closing: string }> = {
  '2200-calorie-high-protein-3-meal-plan': {
    intro: 'This plan is for people who want straightforward three-meal structure without constant snacking decisions.',
    closing: 'Keep meal timing stable and use this plan as your baseline compliance week.',
  },
  '2800-calorie-muscle-gain-macro-plan': {
    intro: 'This framework supports higher intake targets while preserving practical prep and grocery flow.',
    closing: 'Distribute calories across repeatable meal blocks so intake stays achievable daily.',
  },
  'fat-loss-macro-plan-with-family-dinners': {
    intro: 'This page is built for fat-loss goals without requiring separate family meals each night.',
    closing: 'Anchor fat-loss compliance around portion strategy, not separate menu complexity.',
  },
  'maintenance-macro-plan-for-busy-parents': {
    intro: 'This plan supports maintenance phases for parents who need nutrition stability more than constant adjustments.',
    closing: 'Use maintenance periods to simplify routines and rebuild consistency before future phases.',
  },
  'high-protein-fat-loss-plan-under-2000-calories': {
    intro: 'This framework prioritizes satiety and protein quality while working within a lower-calorie budget.',
    closing: 'Protect protein first, then adjust carbs and fats based on weekly adherence data.',
  },
  '2400-calorie-body-recomposition-macro-plan': {
    intro: 'This plan is designed for recomposition where performance and recovery need to coexist with body-composition goals.',
    closing: 'Track strength trends alongside weight change so adjustments are based on full context.',
  },
  'postpartum-high-protein-macro-plan-framework': {
    intro: 'This page emphasizes recovery-supportive nutrition with practical execution during postpartum schedule volatility.',
    closing: 'Choose convenience intentionally when it improves recovery and routine adherence.',
  },
  '1700-calorie-high-satiety-macro-plan': {
    intro: 'This structure is aimed at lower-calorie phases where hunger management determines long-term success.',
    closing: 'Use high-volume, high-protein staples to keep this target sustainable across the week.',
  },
  '2600-calorie-active-parent-macro-plan': {
    intro: 'This framework fits active parents balancing training output, family schedules, and limited prep bandwidth.',
    closing: 'Keep pre- and post-activity meal anchors fixed to reduce daily nutrition guesswork.',
  },
  'high-protein-vegetarian-family-macro-plan': {
    intro: 'This plan supports vegetarian households that still want clear protein targets and realistic meal prep.',
    closing: 'Standardize your core vegetarian protein sources so grocery and macros stay aligned.',
  },
  'perimenopause-macro-plan-for-energy-and-compliance': {
    intro: 'This page prioritizes energy stability and adherence for perimenopause-focused nutrition planning.',
    closing: 'Use trend-based adjustments slowly and prioritize recovery-supportive intake consistency.',
  },
  'family-recomp-macro-plan-with-weekend-flex': {
    intro: 'This framework combines recomposition structure with weekend flexibility to improve long-term compliance.',
    closing: 'Plan flex windows in advance so they support consistency instead of breaking momentum.',
  },
};

function buildMacroFaq(page: (typeof macroPlanPages)[number]) {
  const narrative = macroNarrative[page.slug];
  return [
    {
      question: `How do I begin "${page.title}" and stay consistent?`,
      answer: `${narrative.intro} Run ${page.sampleDay[0].toLowerCase()} as your default day pattern before making any macro changes.`,
    },
    {
      question: 'When should I adjust calories or macro splits?',
      answer: `Use ${page.adjustmentRules[0].toLowerCase()} only after a full week of reliable logging and trend review.`,
    },
    {
      question: 'What is the easiest way to avoid tracking burnout?',
      answer: `${narrative.closing} Keep logging simple with ${page.loggingProtocol[0].toLowerCase()} and review weekly, not daily.`,
    },
  ];
}

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
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">{macroNarrative[page.slug]?.intro || page.macroTarget}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Outcome: {macroNarrative[page.slug]?.closing || page.sampleDay[0]}
                </p>
              </div>
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
  const detailedFaq = page ? buildMacroFaq(page) : [];

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
    faq: detailedFaq,
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
  const narrative = macroNarrative[page.slug] || {
    intro: 'This macro page is built for practical weekly adherence, not theoretical perfection.',
    closing: 'Make small adjustments only after a full week of consistent tracking.',
  };
  const editorialBlocks = [
    {
      title: 'Macro Baseline and Target Context',
      intro: page.macroTarget,
      paragraphs: [
        narrative.intro,
        `Macro targets only work when they match your real routine. Build around repeatable meal structures instead of chasing perfect numbers daily.`,
        `This plan gives you a practical baseline you can execute consistently before making adjustments.`,
      ],
      highlights: [page.macroTarget, ...page.sampleDay.slice(0, 2)],
    },
    {
      title: 'Sample Day Structure That Is Easy to Repeat',
      paragraphs: [
        `Execution quality comes from repetition. Start with ${page.sampleDay[0].toLowerCase()} and maintain the same sequence on your busiest days.`,
        `Use this as your default pattern so grocery, prep, and tracking stay aligned week to week.`,
      ],
      highlights: page.sampleDay,
    },
    {
      title: 'Adjustment and Logging Rules',
      paragraphs: [
        `Adjustments should be deliberate and trend-based. Follow rules such as ${page.adjustmentRules[0].toLowerCase()} only after a consistent logging window.`,
        narrative.closing,
        `Keep tracking simple with protocols like ${page.loggingProtocol[0].toLowerCase()} so the data remains usable.`,
      ],
      highlights: [...page.adjustmentRules, ...page.loggingProtocol],
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Macro Plans', href: '/macro-plans' },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([page.sampleDay, page.adjustmentRules, page.loggingProtocol]),
      }}
      bestFor={page.macroTarget}
      primaryCta={{ label: 'Use This System', href: '/signin' }}
      outcomes={[page.sampleDay[0], page.adjustmentRules[0], page.loggingProtocol[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Macro Adjustments"
      flexibilityItems={page.adjustmentRules}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'Macro Plans',
          links: macroPlanPages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `/macro-plans/${item.slug}` })),
        },
        {
          title: 'Related Planning Systems',
          links: (seoCrossLinks['/macro-plans'] || []).map((item) => ({
            title: item.title,
            href: item.href,
            description: item.description,
          })),
        },
      ]}
      quietCta={{
        title: 'Keep Your Targets Consistent',
        description: 'Save targets, log progress, and connect meals, grocery, and workouts in one weekly rhythm.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'Sample day details', items: page.sampleDay },
        { title: 'Logging protocol details', items: page.loggingProtocol },
      ]}
    />
  );
}
