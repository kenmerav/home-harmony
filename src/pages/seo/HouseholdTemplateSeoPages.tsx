import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { householdTemplatePages } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import { SeoHubPrimer } from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { ResourcePageLayout } from './ResourcePageLayout';

// ─── Per-page metadata ────────────────────────────────────────────────────────
// keywords    – unique, intent-matched search terms for the detail page
// publishedAt – ISO date (update modifiedAt whenever content changes)
// modifiedAt  – ISO date
// hubTeaser   – short card copy shown on hub (distinct from detail intro)
// hubOutcome  – one outcome sentence shown on hub card
// intro       – first editorial paragraph on detail page
// closing     – closing editorial sentence on detail page
// faqUnique   – one page-specific FAQ that could not apply to any other template

const householdMeta: Record<
  string,
  {
    keywords: string[];
    publishedAt: string;
    modifiedAt: string;
    hubTeaser: string;
    hubOutcome: string;
    intro: string;
    closing: string;
    faqUnique: { question: string; answer: string };
  }
> = {
  'family-of-4-weekly-chore-chart-template': {
    keywords: [
      'family of 4 chore chart template',
      'weekly chore chart two kids two adults',
      'printable chore chart family of four',
      'chore rotation template family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Practical chore and task framework for two working adults and two kids — cuts repeated reminders and uneven workload.',
    hubOutcome:
      'Keep the chart visible and reset assignments on the same day each week — consistency beats complexity.',
    intro:
      'This template targets standard family-of-four dynamics where uneven chore load creates weekly friction. The design principle is explicit ownership over assumed responsibility — every recurring task has a named person and a named backup so nothing falls through on a busy night.',
    closing:
      'Keep the chart visible and reset assignments on the same day each week. A system that requires searching for is a system that stops getting used.',
    faqUnique: {
      question: 'How do I assign chores fairly between two kids of different ages without constant complaints?',
      answer:
        'Assign by time cost and physical capability, not perceived equality. A seven-year-old and a twelve-year-old cannot share identical tasks — but both can own tasks matched to their ability. Post the assignments visibly with clear completion criteria so "I forgot" and "that\'s not fair" both have a visible answer. Rotate monthly, not weekly, so kids have time to build the habit before the assignment changes.',
    },
  },

  'two-working-parents-night-routine-template': {
    keywords: [
      'night routine template working parents',
      'evening routine two working parents',
      'weeknight routine for busy parents',
      'working parent evening schedule template',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Evening operations template for dual-income households — aligns dinner, cleanup, school prep, and next-day launch.',
    hubOutcome:
      'Protect the first 60 minutes after arrival as a fixed routine block and the rest of the evening becomes manageable.',
    intro:
      'This system is built for dual-working-parent evenings where transitions determine whether the night feels controlled or chaotic. The leverage point is the arrival-to-dinner window — whoever owns that block sets the tone for everything that follows.',
    closing:
      'Protect the first 60 minutes after arrival as a fixed routine block. When that window has a plan, the rest of the evening follows structure rather than reaction.',
    faqUnique: {
      question: 'How do we divide evening responsibilities when both parents arrive home at different times?',
      answer:
        'Assign evening tasks by arrival order, not by person. The first adult home owns the dinner launch — whatever state it needs to be in when the second arrives. The second adult owns the kid transition, homework check, and post-dinner reset. This removes the "I just got home" friction because the role is tied to the sequence, not the individual.',
    },
  },

  'meal-planning-and-chore-sync-template': {
    keywords: [
      'meal planning and chore sync template',
      'combine meal plan with chore chart',
      'household planning template meals and chores',
      'family operations template meal plan chores',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Links meal decisions directly to cleanup ownership so dinner planning and household tasks stop running as separate systems.',
    hubOutcome:
      'Tie cleanup standards directly to meal nights so follow-through improves without extra reminders.',
    intro:
      'This page combines dinner planning and cleanup ownership so those two workflows stop competing with each other. When meals are planned in isolation from cleanup assignments, the result is dinners that happen but kitchens that stay chaotic — this template closes that gap.',
    closing:
      'Tie cleanup standards directly to meal nights so follow-through improves automatically. If Tuesday is sheet-pan night, Tuesday also has a defined cleanup owner — the decision is made once, not renegotiated every week.',
    faqUnique: {
      question: 'How do I get the whole family to actually follow through on cleanup when dinner is already done?',
      answer:
        'Assign cleanup before dinner, not after. When everyone already knows their role — who clears, who loads, who wipes — before the meal starts, there is no post-dinner negotiation. Build the assignment into your meal card or weekly board so it is visible at the start of dinner, not a surprise request when everyone wants to leave the table.',
    },
  },

  'newborn-and-toddler-household-routine-template': {
    keywords: [
      'household routine template newborn and toddler',
      'daily routine with newborn and toddler',
      'family schedule newborn toddler household',
      'home routine for new baby and young child',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'High-variability household template for families balancing infant care, toddler schedules, and minimum viable home operations.',
    hubOutcome:
      'Keep routines intentionally small and repeatable until family energy and sleep stabilize.',
    intro:
      'This template is designed for high-volatility schedules where sleep disruption and care demands shift by the hour. The model reduces the routine to a short list of non-negotiables — feed, reset, sleep — and explicitly defers everything else until capacity returns.',
    closing:
      'Keep routines intentionally small and repeatable until family energy stabilizes. This is not the season to optimize — it is the season to survive with dignity.',
    faqUnique: {
      question: 'How do we keep the toddler\'s routine consistent when the newborn\'s schedule changes everything?',
      answer:
        'Anchor the toddler\'s day to two fixed points that are independent of the newborn: morning start and evening wind-down. Everything between those anchors can flex around feeding and nap disruptions. When the toddler\'s start and end are predictable, they experience structure even when the middle of the day is unpredictable. That consistency reduces behavioral friction without requiring a rigid schedule.',
    },
  },

  'teen-and-parent-shared-task-template': {
    keywords: [
      'teen chore and task template',
      'shared household tasks parents and teens',
      'teen accountability household system',
      'chore system for teenagers family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Shared-ownership task system for teens and parents that replaces repeated reminders with visible expectations and weekly accountability.',
    hubOutcome:
      'Use weekly checkpoints to adjust responsibility based on reliability and schedule changes — not daily arguments.',
    intro:
      'This framework helps households define shared accountability without constant renegotiation of expectations. The system works because completion criteria are written down, not assumed — which removes the "I thought it was done" conflict at its source.',
    closing:
      'Use weekly checkpoints to adjust responsibility based on reliability and schedule changes. Teens respond better to consistent review than to constant real-time correction.',
    faqUnique: {
      question: 'How do I get a teenager to take household responsibilities seriously without turning it into a daily conflict?',
      answer:
        'Move the accountability conversation from daily to weekly. Instead of checking in every day, hold one weekly review where completion is visible and consequences or acknowledgment happen together. Daily check-ins feel like surveillance; weekly reviews feel like management. Teens are more likely to self-manage when they know the check-in is coming on a fixed schedule rather than unpredictably throughout the week.',
    },
  },

  'blended-family-household-routine-template': {
    keywords: [
      'blended family household routine template',
      'blended family chore and schedule system',
      'household routine shared custody family',
      'family routine template blended household',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Coordination template for blended households with changing weekly schedules, multiple homes, and shared custody transitions.',
    hubOutcome:
      'Document handoff rules across homes so routine drift does not quietly build into weekly stress.',
    intro:
      'This page supports blended-home rhythms where consistency and role clarity matter more than strict sameness across households. The template does not require both homes to operate identically — it requires each home to have clear rules that kids can predict before they arrive.',
    closing:
      'Document handoff rules across homes so routine drift does not build weekly stress. Clear transition checklists are the single highest-leverage tool in blended household operations.',
    faqUnique: {
      question: 'How do we create consistency for kids moving between two homes with different household rules?',
      answer:
        'Align on a short list of non-negotiables that hold in both homes — bedtime window, homework before screens, one household task per day — and let everything else flex by home. Kids adapt to different house cultures easily when the core expectations are consistent. The conflict comes from rules that are communicated differently or enforced inconsistently at the same home, not from the fact that two homes exist.',
    },
  },

  'adhd-friendly-household-task-template': {
    keywords: [
      'ADHD friendly household routine template',
      'ADHD chore system family',
      'household task template for ADHD',
      'low friction household routine ADHD',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Low-cognitive-load household system with short task windows, visual cues, and simple ownership built for ADHD-friendly execution.',
    hubOutcome:
      'Limit active tasks per person and emphasize visible completion signals over long lists.',
    intro:
      'This template focuses on reduced cognitive load, clear sequencing, and visible prompts for ADHD-friendly execution. The design removes the two biggest friction points for ADHD households: task initiation and task completion — by making both visible, short, and bounded.',
    closing:
      'Limit active tasks and emphasize completion signals over long lists. A three-item board that gets done beats a twelve-item board that creates overwhelm.',
    faqUnique: {
      question: 'How do I build a household system that actually works when one or more family members have ADHD?',
      answer:
        'Design for the hardest case in your household, not the easiest. That means visual boards instead of verbal reminders, tasks defined by a clear done state (not a vague standard), and short task windows with built-in transitions. If the system works for the ADHD family member, it works for everyone — neurotypical people are not harmed by visible structure and clear completion criteria. The reverse is not true.',
    },
  },

  'small-apartment-family-routine-template': {
    keywords: [
      'small apartment family routine template',
      'apartment household routine with kids',
      'small space family chore and routine system',
      'compact home daily routine family template',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Compact-space household routine for families managing shared zones, limited storage, and daily clutter in small square footage.',
    hubOutcome:
      'Use short reset windows in shared zones daily — surface clutter in small spaces compounds faster than in large ones.',
    intro:
      'This system is tuned for compact spaces where shared zones and timing coordination are the main challenge. In small apartments, one zone out of control affects the entire home — so the template prioritizes shared-space resets over room-by-room deep cleans.',
    closing:
      'Use short reset windows to keep common areas functional throughout the day. In small spaces, a 10-minute morning reset prevents a 45-minute evening recovery.',
    faqUnique: {
      question: 'How do we keep a small apartment functional with kids without spending the whole day cleaning?',
      answer:
        'Run three short resets instead of one long clean: a 10-minute morning surface reset before anyone leaves, a 5-minute after-school drop-zone reset, and a 15-minute after-dinner kitchen and living area reset. Total time is under 30 minutes daily. The alternative — letting clutter accumulate and doing one large cleanup — takes longer, creates more conflict, and produces the same result. Small spaces need high frequency, not high duration.',
    },
  },

  'single-parent-weekly-household-system-template': {
    keywords: [
      'single parent household system template',
      'single parent weekly routine and chores',
      'household management template single parent',
      'single parent family operations system',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Resilient household operations template for single-parent homes — built for constrained time, high decision load, and no backup.',
    hubOutcome:
      'Keep a clear must-do list and deliberately defer low-impact tasks — protecting energy is part of the system.',
    intro:
      'This template prioritizes workload triage and energy protection for single-parent household management. The model accepts that not everything will get done every week and builds that reality into the design — with an explicit defer list rather than an ever-growing backlog.',
    closing:
      'Keep a clear must-do list and intentionally defer low-impact tasks without guilt. A system that accounts for limited capacity is more sustainable than one that pretends capacity is unlimited.',
    faqUnique: {
      question: 'How do I get kids to contribute meaningfully to the household without it creating more work for me to manage?',
      answer:
        'Assign tasks with completely defined completion criteria so you never have to inspect and re-do. "Clean the bathroom" is not a task — "wipe the sink, toilet, and mirror with the cloth under the sink, then put the cloth in the laundry" is a task. The upfront investment in writing clear criteria pays back every week when you can accept the result without correction. Start with two tasks per child, let them own them fully, and add only when those are running reliably.',
    },
  },

  'homeschool-family-daily-routine-template': {
    keywords: [
      'homeschool family daily routine template',
      'homeschool schedule with household chores',
      'daily routine template homeschooling family',
      'homeschool and home management routine',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Integrates homeschool learning blocks with meals, chores, and household operations into one structured daily template.',
    hubOutcome:
      'Anchor the day with start and shutdown rituals to create a clear boundary between school mode and home mode.',
    intro:
      'This page aligns education blocks with home operations so the day stays structured but flexible. Without a clear template, homeschool families often find that school bleeds into household time and household tasks bleed into school time — with neither getting done well.',
    closing:
      'Anchor the day with start and shutdown rituals to separate school from home mode. The ritual signals transition — and transitions are where homeschool days most commonly lose structure.',
    faqUnique: {
      question: 'How do I prevent homeschooling from consuming the entire day and leaving no time for household operations?',
      answer:
        'Define a hard shutdown time for school and treat it as non-negotiable. Everything academic stops at that time — incomplete work carries to the next school day, not into the evening. Then run a fixed 30-minute household reset block immediately after shutdown before the transition to free time. This structure keeps school from expanding indefinitely and keeps household tasks from being perpetually deferred until "after we finish."',
    },
  },

  'travel-heavy-family-home-reset-template': {
    keywords: [
      'family home reset routine frequent travel',
      'household template for travel heavy families',
      'home reset checklist frequent traveler family',
      'travel family household operations template',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Operations template for families with frequent travel — fast departure prep, reliable arrival resets, and continuity routines.',
    hubOutcome:
      'Use standardized arrival-day reset checklists every trip to prevent backlog from compounding week over week.',
    intro:
      'This template is built for irregular home presence where reset routines must be fast and repeatable. The key insight is that travel-heavy households need two distinct templates — one for departure and one for arrival — because the failure mode in each direction is different.',
    closing:
      'Use arrival-day reset checklists to prevent backlog from compounding. The first four hours back home set the operational state for the rest of the week.',
    faqUnique: {
      question: 'How do we keep the household running smoothly for the parent and kids who stay home during travel weeks?',
      answer:
        'Create a stay-home operations card that the traveling parent sets up before leaving: meals planned for the week, laundry state, grocery status, and any scheduled appointments with logistics covered. The staying parent should not have to make those decisions alone mid-week. Review and update the card before each trip so it reflects current household state, not last month\'s routine.',
    },
  },

  'multigenerational-household-roles-template': {
    keywords: [
      'multigenerational household routine template',
      'grandparents parents kids household system',
      'multigenerational family chore and role template',
      'extended family household operations template',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Role-clarity template for multigenerational homes — balances shared chores, meals, caregiving, and generational capacity differences.',
    hubOutcome:
      'Review roles monthly and rebalance effort as capacity and availability change across generations.',
    intro:
      'This guide supports multigenerational homes where role boundaries and support expectations need explicit structure. Without written role clarity, multigenerational households default to informal patterns that quietly create resentment — someone always feels they are doing more than their share.',
    closing:
      'Review roles monthly and rebalance effort as capacity changes across generations. What works when everyone is healthy and available needs adjustment when it does not.',
    faqUnique: {
      question: 'How do we handle household roles respectfully when older family members have different capabilities or energy levels?',
      answer:
        'Design roles around contribution type, not contribution volume. An older family member who cannot handle physical chores can own the planning, scheduling, and admin layer — grocery lists, appointment tracking, bill management — which is high-value and often the most mentally taxing work in the household. Matching capability to contribution type respects limitations while keeping everyone genuinely involved rather than sidelined.',
    },
  },
};

// ─── FAQ builder ──────────────────────────────────────────────────────────────

function buildHouseholdFaq(page: (typeof householdTemplatePages)[number]) {
  const meta = householdMeta[page.slug];
  return [
    {
      question: `How do I roll out "${page.title}" without resistance from other household members?`,
      answer: `${meta.intro} Start with ${page.dailyTemplate[0].toLowerCase()} for one full week before introducing any additional template elements. One visible win early builds buy-in for the rest.`,
    },
    {
      question: 'What is the single most important weekly checkpoint for keeping this template running?',
      answer: `Run ${page.reviewRitual[0].toLowerCase()} on the same day each week without skipping. Change only one routine rule per review cycle — changing multiple things at once makes it impossible to know what actually improved consistency.`,
    },
    {
      question: 'How do I prevent this system from fading out after a few weeks?',
      answer: `${meta.closing} Anchor the review ritual to an existing weekly habit — Sunday dinner, Friday morning, end of school pickup — so it does not require separate scheduling. Reuse the weekly structure block "${page.weeklyTemplate[0].toLowerCase()}" as your reset point each week.`,
    },
    meta.faqUnique,
  ];
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

export function HouseholdTemplateHubPage() {
  useSeoMeta({
    title: 'Family Household Templates | Chore Charts, Routines & Task Systems | Home Harmony',
    description:
      'Stop running your household on memory and good intentions. Browse 12 practical family household templates — chore charts, evening routines, single-parent systems, blended family schedules, and more — each built for a specific household type.',
    keywords: [
      'family household template',
      'chore chart template family',
      'family routine template',
      'household task system',
      'weekly chore chart family',
      'family operations template',
    ],
    image: '/seo/household-templates.jpg',
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
        <h1 className="font-display text-4xl">Family Household Templates</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Each template below is built for a specific household type — not a generic family. Pick the one that matches your actual operating constraints, not your ideal week.
        </p>
      </div>
      <SeoHubPrimer
        title="How to Implement a Household Template"
        intro="These are operational frameworks, not static checklists. The goal is to reduce decision fatigue and make ownership visible so the household runs on systems, not reminders."
        items={[
          {
            title: 'Start with minimum viable routine',
            description:
              'Launch only the highest-impact daily and weekly actions first. Expand the template only after those are running consistently — not before.',
          },
          {
            title: 'Assign visible ownership',
            description:
              'Every template element needs a named owner and a named backup. Shared responsibility without named owners produces no responsibility.',
          },
          {
            title: 'Run a weekly review ritual',
            description:
              'Template quality improves when households adjust load based on real bottlenecks, not assumptions. Schedule the review before you need it.',
          },
          {
            title: 'Coordinate with meal planning',
            description:
              'Dinner decisions, cleanup ownership, and household admin work best when they are planned together — not in separate systems that never talk to each other.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {householdTemplatePages.map((page) => {
          const meta = householdMeta[page.slug];
          return (
            <article key={page.slug} className="overflow-hidden rounded-xl border border-border bg-card">
              <img
                src={page.heroImage}
                alt={page.heroAlt}
                className="h-48 w-full object-cover"
                loading="lazy"
              />
              <div className="p-5">
                <h2 className="font-display text-2xl">{page.title}</h2>
                {/* hubTeaser is distinct from detail-page intro to prevent duplicate content */}
                <p className="mt-2 text-sm text-muted-foreground">{meta?.hubTeaser || page.description}</p>
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Best fit
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{page.householdProfile}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Key outcome: {meta?.hubOutcome || page.dailyTemplate[0]}
                  </p>
                </div>
                <Link to={`/household-templates/${page.slug}`} className="mt-4 inline-block">
                  <Button variant="outline">Open Template</Button>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </SeoShell>
  );
}

// ─── Detail page ──────────────────────────────────────────────────────────────

export function HouseholdTemplateDetailPage() {
  const { slug } = useParams();
  const page = householdTemplatePages.find((item) => item.slug === slug);
  const meta = page ? householdMeta[page.slug] : null;
  const detailedFaq = page ? buildHouseholdFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Household Templates | Home Harmony',
    description: page?.description || 'Household operations template from Home Harmony.',
    // Unique keywords per page matched to specific household type and search intent
    keywords: meta?.keywords || ['family household template', 'chore chart family', 'weekly routine template'],
    image: page?.heroImage || '/seo/household-templates.jpg',
    publishedTime: meta?.publishedAt || '2026-02-21',
    modifiedTime: meta?.modifiedAt || '2026-02-21',
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

  if (!page || !meta) {
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
    `Confirm your household operating context: ${page.householdProfile}`,
    `Launch with one repeatable daily anchor: ${page.dailyTemplate[0]}`,
    `Lock one weekly structure block before adding more: ${page.weeklyTemplate[0]}`,
    `Run your review ritual on the same day each week: ${page.reviewRitual[0]}`,
  ];

  const editorialBlocks = [
    {
      title: 'Operating Model for This Household Type',
      intro: page.householdProfile,
      paragraphs: [
        meta.intro,
        `This template reduces coordination friction by making daily and weekly ownership explicit before problems surface. When roles are written down and visible, the household stops running on whoever has the most energy to remind everyone else.`,
        `Start with one stable daily anchor — ${page.dailyTemplate[0].toLowerCase()} — before layering in additional structure. A system that works at small scale is one that can be expanded without collapsing.`,
      ],
      highlights: page.dailyTemplate,
    },
    {
      title: 'Weekly Cadence and Workload Balance',
      paragraphs: [
        `Your weekly system should protect capacity, not just list tasks. Use structure blocks like "${page.weeklyTemplate[0].toLowerCase()}" to keep rhythm predictable across different week types.`,
        `Then layer in ${page.weeklyTemplate[1].toLowerCase()} only after completion rates and handoff clarity are stable. Adding complexity before the base is solid is the most common reason household templates fade out.`,
        `The third weekly block — ${page.weeklyTemplate[2].toLowerCase()} — is designed to catch what the first two miss. Run it consistently before adjusting frequency.`,
      ],
      highlights: page.weeklyTemplate,
    },
    {
      title: 'Review Loop That Prevents Drift',
      paragraphs: [
        `Even well-designed templates degrade without a recurring review. The review is not about adding tasks — it is about removing friction that has accumulated since the last check.`,
        meta.closing,
        `Use the review ritual below to reset ownership, rebalance effort, and keep your household system aligned with real life rather than an idealized version of it.`,
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
        published: new Date(meta.publishedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        updated: new Date(meta.modifiedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        readMinutes: estimateReadMinutes([page.dailyTemplate, page.weeklyTemplate, page.reviewRitual]),
      }}
      bestFor={page.householdProfile}
      primaryCta={{ label: 'Use This Template', href: '/signin' }}
      outcomes={[page.dailyTemplate[0], page.weeklyTemplate[0], page.reviewRitual[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Weekly Structure Options"
      flexibilityItems={page.weeklyTemplate}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'More Household Templates',
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
        description:
          'Save this template to your dashboard, set weekly reminders, and keep tasks, chores, and meals coordinated in one place.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'Browse More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'Daily template details', items: page.dailyTemplate },
        { title: 'Review ritual details', items: page.reviewRitual },
      ]}
    />
  );
}
