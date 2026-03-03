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
  SeoHubPrimer,
} from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { ResourcePageLayout } from './ResourcePageLayout';

const operationsNarrative: Record<string, { intro: string; closing: string }> = {
  'weekly-family-chore-system-for-two-working-parents': {
    intro: 'This guide is tuned for two-working-parent households where handoff clarity matters more than perfect balance.',
    closing: 'Protect weekly reset time and treat chore ownership as fixed until the next review.',
  },
  'chore-system-for-families-with-young-kids': {
    intro: 'This framework uses age-appropriate participation so routines build without overloading parents.',
    closing: 'Keep young-kid chore expectations small, visible, and repeatable every day.',
  },
  'small-home-high-efficiency-chore-system': {
    intro: 'This page is built for smaller homes where shared spaces require tighter timing and frequent resets.',
    closing: 'Use short, frequent reset blocks instead of one large cleanup window.',
  },
  'teen-accountability-chore-system-with-scorecard': {
    intro: 'This guide adds transparent accountability for teens while keeping household standards objective.',
    closing: 'Use scorecards as feedback, not punishment, and review trends weekly.',
  },
  'chore-system-for-blended-family-schedules': {
    intro: 'This framework addresses rotating custody and blended calendars by anchoring chores to predictable windows.',
    closing: 'Document transitions clearly so standards stay consistent across schedule shifts.',
  },
  'family-task-management-system-with-priority-lanes': {
    intro: 'This page is for families that need clearer priority separation so urgent tasks stop getting buried.',
    closing: 'Keep priority lanes small and reassess lane membership once per week.',
  },
  'shared-to-do-system-for-couples-and-kids': {
    intro: 'This guide focuses on shared visibility without turning the to-do list into constant negotiation.',
    closing: 'Assign one owner per task and use shared review to resolve blockers quickly.',
  },
  'adhd-friendly-household-task-system': {
    intro: 'This framework is designed to lower executive-load by making tasks obvious, finite, and sequential.',
    closing: 'Reduce active tasks and prioritize completion signals over list length.',
  },
  'weekly-household-admin-task-system': {
    intro: 'This page centralizes admin work like bills, forms, and planning so they stop leaking into every day.',
    closing: 'Batch admin tasks into one recurring block and protect it like a fixed appointment.',
  },
  'family-task-system-for-travel-heavy-weeks': {
    intro: 'This system supports households with irregular presence by pre-planning delegation and reset windows.',
    closing: 'Use departure and return checklists to prevent task backlog from compounding.',
  },
  'beginner-strength-training-tracker-for-busy-parents': {
    intro: 'This guide gives busy parents a low-friction strength tracking system built for consistency over complexity.',
    closing: 'Keep sessions short and track the core lifts that matter most each week.',
  },
  'home-gym-workout-tracking-system': {
    intro: 'This framework is tuned for home-gym realities where equipment access is high but schedule windows are short.',
    closing: 'Pre-plan exercise order so you can start training immediately when time opens up.',
  },
  'hypertrophy-workout-tracker-with-family-schedule': {
    intro: 'This page balances hypertrophy progression with family scheduling constraints and variable recovery days.',
    closing: 'Anchor volume targets weekly and flex session timing around family commitments.',
  },
  'couples-workout-planner-and-tracker': {
    intro: 'This guide helps couples coordinate training without adding calendar friction or mismatched expectations.',
    closing: 'Set shared session windows and independent progression goals to reduce conflict.',
  },
  'fat-loss-cardio-and-strength-tracking-system': {
    intro: 'This framework combines cardio and strength tracking so fat-loss plans do not sacrifice muscle retention.',
    closing: 'Track total weekly workload and recovery markers before reducing intake further.',
  },
  'family-sleep-tracking-system-for-better-routines': {
    intro: 'This page is built to improve sleep consistency through shared routines rather than isolated individual hacks.',
    closing: 'Review bedtime and wake-time adherence weekly and adjust evening triggers first.',
  },
  'period-and-cycle-tracking-for-household-planning': {
    intro: 'This guide integrates cycle awareness into planning so workload and expectations align with real energy shifts.',
    closing: 'Use cycle data to plan high-demand tasks and recovery windows more realistically.',
  },
  'alcohol-habit-tracking-system-with-weekly-review': {
    intro: 'This framework uses simple weekly tracking to reduce alcohol drift without all-or-nothing pressure.',
    closing: 'Set clear weekly thresholds and review context around misses, not just totals.',
  },
  'family-wellness-dashboard-with-sleep-workout-nutrition': {
    intro: 'This page combines core wellness signals into one view so household planning decisions use shared data.',
    closing: 'Keep metrics minimal and focus on trends that actually change behavior.',
  },
  'habit-streak-tracking-system-for-household-consistency': {
    intro: 'This system uses streak visibility to reinforce consistency across chores, nutrition, and wellness habits.',
    closing: 'Prioritize streaks tied to outcomes and reset goals quickly after interruptions.',
  },
};

function buildOperationsFaq(page: OperationsGuideSeoPage, hubLabel: string) {
  const narrative = operationsNarrative[page.slug];
  return [
    {
      question: `How do I implement "${page.title}" without overwhelming the household?`,
      answer: `${narrative.intro} Start with ${page.systemDesign[0].toLowerCase()} and limit rollout to one lane in week one.`,
    },
    {
      question: `What should I track during the first two weeks of this ${hubLabel.toLowerCase()} guide?`,
      answer: `Track completion consistency and missed handoffs, then review against steps like ${page.implementationSteps[0].toLowerCase()}.`,
    },
    {
      question: 'How do I prevent this system from breaking during busy weeks?',
      answer: `${narrative.closing} Use pitfall controls such as ${page.commonPitfalls[0].toLowerCase()} as your weekly risk checklist.`,
    },
  ];
}

interface OperationsConfig {
  hubTitle: string;
  hubDescription: string;
  hubKeywords: string[];
  hubPath: string;
  hubLabel: string;
  notFoundLabel: string;
  pages: OperationsGuideSeoPage[];
  heroImage: string;
  primerTitle: string;
  primerIntro: string;
  primerItems: Array<{ title: string; description: string }>;
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
        title={config.primerTitle}
        intro={config.primerIntro}
        items={config.primerItems}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {config.pages.map((page) => (
          <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
            <img src={page.heroImage} alt={page.heroAlt} className="h-48 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{page.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{page.description}</p>
              <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {operationsNarrative[page.slug]?.intro || page.bestFor}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Outcome: {operationsNarrative[page.slug]?.closing || page.implementationSteps[0]}
                </p>
              </div>
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
  const detailedFaq = page ? buildOperationsFaq(page, config.hubLabel) : [];

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
    faq: detailedFaq,
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
  const narrative = operationsNarrative[page.slug] || {
    intro: 'This guide gives a practical operations workflow for steady weekly execution.',
    closing: 'Run the same cadence for two weeks before making structural changes.',
  };
  const editorialBlocks = [
    {
      title: 'System Fit and Weekly Scope',
      intro: page.bestFor,
      paragraphs: [
        narrative.intro,
        `A reliable household system starts with scope clarity. This guide works best when you launch one lane and keep ownership visible.`,
        `Use the design model below to prioritize high-friction moments first, then expand only when consistency is stable.`,
      ],
      highlights: page.systemDesign,
    },
    {
      title: 'Implementation Sequence',
      paragraphs: [
        `Treat implementation as a phased rollout, not a one-day setup. Start with ${page.implementationSteps[0].toLowerCase()} and keep checkpoints short.`,
        `This sequencing creates momentum and makes it easier for everyone in the household to adopt the workflow.`,
      ],
      highlights: page.implementationSteps,
    },
    {
      title: 'Risk Control and Failure Prevention',
      paragraphs: [
        `Most systems break at handoffs and review gaps. Address those early using risk controls like ${page.commonPitfalls[0].toLowerCase()}.`,
        narrative.closing,
        `Keep this section as your weekly failure-prevention checklist so execution stays steady.`,
      ],
      highlights: page.commonPitfalls,
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: config.hubLabel, href: config.hubPath },
        { label: page.title },
      ]}
      title={page.title}
      subtitle={page.description}
      heroImage={page.heroImage}
      heroAlt={page.heroAlt}
      meta={{
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([page.systemDesign, page.implementationSteps, page.commonPitfalls]),
      }}
      bestFor={page.bestFor}
      primaryCta={{ label: 'Use This System', href: '/signin' }}
      outcomes={[page.systemDesign[0], page.implementationSteps[0], page.commonPitfalls[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Pitfall Avoidance"
      flexibilityItems={page.commonPitfalls}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: `Related ${config.hubLabel}`,
          links: config.pages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `${config.hubPath}/${item.slug}` })),
        },
        {
          title: 'Connected Systems',
          links: (seoCrossLinks[config.hubPath] || []).map((item) => ({
            title: item.title,
            href: item.href,
            description: item.description,
          })),
        },
      ]}
      quietCta={{
        title: 'Run This System Without Weekly Reset',
        description: 'Save this workflow, assign ownership, and coordinate it with your full household plan.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'System design details', items: page.systemDesign },
        { title: 'Implementation details', items: page.implementationSteps },
      ]}
    />
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
  primerTitle: 'How to Roll Out a Chore System That Sticks',
  primerIntro:
    'Chore systems fail when assignments are vague or overloaded. Launch with clear ownership, visible standards, and a weekly reset ritual.',
  primerItems: [
    {
      title: 'Start with non-negotiable daily standards',
      description: 'Define the minimum daily reset tasks and assign clear owners.',
    },
    {
      title: 'Separate daily vs deep-clean responsibilities',
      description: 'Do not blend routine chores with occasional heavy tasks in one lane.',
    },
    {
      title: 'Use accountability loops',
      description: 'Track completion and review misses weekly so expectations stay clear.',
    },
    {
      title: 'Add incentives after consistency',
      description: 'Stabilize execution first, then layer rewards and optional extra chores.',
    },
  ],
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
  primerTitle: 'How to Build a Reliable Family Task System',
  primerIntro:
    'Task systems work when priority, ownership, and deadlines are obvious at a glance. Keep structure simple and review it on a weekly cadence.',
  primerItems: [
    {
      title: 'Define a small weekly priority set',
      description: 'Limit high-priority tasks so critical work is clear and actionable.',
    },
    {
      title: 'Assign one owner per task',
      description: 'Shared ownership often creates silent drops; one owner keeps accountability clear.',
    },
    {
      title: 'Use recurring templates for repeat work',
      description: 'Automate recurring household tasks instead of rewriting them each week.',
    },
    {
      title: 'Review completion patterns',
      description: 'Adjust deadlines and load based on what consistently slips.',
    },
  ],
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
  primerTitle: 'How to Keep Family Fitness Plans Consistent',
  primerIntro:
    'Workout consistency comes from realistic scheduling and progressive templates. Design for your busiest week, then scale training volume gradually.',
  primerItems: [
    {
      title: 'Set minimum weekly sessions first',
      description: 'Pick a baseline number you can reliably hit before optimizing volume.',
    },
    {
      title: 'Use templated session structures',
      description: 'Repeatable plans reduce planning overhead and improve adherence.',
    },
    {
      title: 'Track progress with simple metrics',
      description: 'Use completion, load progression, and recovery readiness as core indicators.',
    },
    {
      title: 'Align workouts with household schedule',
      description: 'Treat training as part of the family calendar, not separate from it.',
    },
  ],
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
  primerTitle: 'How to Track Lifestyle Habits Without Burnout',
  primerIntro:
    'Lifestyle tracking works when it focuses on a few high-impact habits and clear review windows. Start narrow, measure weekly, and adjust deliberately.',
  primerItems: [
    {
      title: 'Pick 1-2 lead habits per person',
      description: 'Avoid tracking everything at once; focus on the behavior that matters most.',
    },
    {
      title: 'Use clear success thresholds',
      description: 'Define concrete goals for sleep, hydration, alcohol, and recovery behavior.',
    },
    {
      title: 'Review trends weekly, not daily',
      description: 'Trend-level review gives better signals and avoids reactive changes.',
    },
    {
      title: 'Tie habits to existing routines',
      description: 'Attach tracking to existing daily anchors so it is easier to sustain.',
    },
  ],
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
