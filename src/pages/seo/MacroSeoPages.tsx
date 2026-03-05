import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { macroPlanPages } from '@/data/seoContent';
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
// faqUnique   – one page-specific FAQ that could not apply to any other plan

const macroMeta: Record<
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
  '2200-calorie-high-protein-3-meal-plan': {
    keywords: [
      '2200 calorie high protein meal plan',
      '2200 calorie 3 meal plan family',
      'high protein 2200 calorie daily meal plan',
      '2200 calorie meal plan with protein targets',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Straightforward 2200-calorie structure with protein-first meals and no reliance on constant snacking decisions.',
    hubOutcome:
      'Keep meal timing stable and use this plan as your baseline compliance week before making any adjustments.',
    intro:
      'This plan is for people who want straightforward three-meal structure without constant snacking decisions. The 2200-calorie target is anchored by protein first — which means meal construction starts with the protein source and builds outward, not the other way around.',
    closing:
      'Keep meal timing stable and use this plan as your baseline compliance week. Two weeks of consistent execution produces more useful data than two weeks of constant adjustments.',
    faqUnique: {
      question: 'How do I hit 2200 calories consistently without tracking every meal obsessively?',
      answer:
        'Build two or three repeatable day templates and rotate them rather than planning from scratch daily. When your Tuesday template is identical every Tuesday, you track it once and reuse the log. Consistency in meal structure eliminates most of the cognitive load that makes tracking feel unsustainable.',
    },
  },

  '2800-calorie-muscle-gain-macro-plan': {
    keywords: [
      '2800 calorie muscle gain meal plan',
      '2800 calorie bulking macro plan',
      'muscle gain macro plan 2800 calories',
      'high calorie muscle building meal plan family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Gain-focused 2800-calorie framework with meal-prep-friendly structure and grocery alignment built for real households.',
    hubOutcome:
      'Distribute calories across repeatable meal blocks so the intake target stays achievable every day, not just on good days.',
    intro:
      'This framework supports higher intake targets while preserving practical prep and grocery flow. At 2800 calories, the challenge is not hunger — it is distributing intake across the day without relying on large single meals that are hard to hit consistently.',
    closing:
      'Distribute calories across repeatable meal blocks so intake stays achievable daily. Front-loading too much into one meal is the most common reason higher-calorie targets fail during busy family weeks.',
    faqUnique: {
      question: 'How do I eat 2800 calories while sharing family dinners that are sized for lower-calorie household members?',
      answer:
        'Use add-on carb and protein packs rather than scaling up the shared meal itself. A standard family dinner becomes your base — then you add a pre-portioned rice container, extra protein portion, or a Greek yogurt and fruit side to hit your target without cooking a separate meal. The add-ons are prepped in your Sunday batch and require no extra weeknight cooking.',
    },
  },

  'fat-loss-macro-plan-with-family-dinners': {
    keywords: [
      'fat loss macro plan family dinners',
      'calorie deficit meal plan for families',
      'fat loss plan that works with family meals',
      'weight loss macro plan shared family dinners',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Fat-loss macro structure that works around shared family dinners — no separate meals, no food isolation.',
    hubOutcome:
      'Anchor fat-loss compliance around portion strategy at the shared meal, not separate menu complexity.',
    intro:
      'This page is built for fat-loss goals without requiring separate family meals each night. The model keeps dinner shared and manages the deficit through portion sizing, side swaps, and sauce control — changes that are invisible to the rest of the table.',
    closing:
      'Anchor fat-loss compliance around portion strategy, not separate menu complexity. The fastest way to break a fat-loss plan in a family household is to make it socially isolating at dinner.',
    faqUnique: {
      question: 'How do I maintain a calorie deficit without family members noticing or the dinner feeling like diet food?',
      answer:
        'Control your deficit at the side dish and sauce level, not the protein level. Eat the same protein as everyone else — the highest-satiety component — then reduce your starch portion and skip or swap high-calorie sauces. Add a large vegetable side to maintain plate volume. The meal looks complete because it is complete; it is just composed differently at your portion.',
    },
  },

  'maintenance-macro-plan-for-busy-parents': {
    keywords: [
      'maintenance macro plan busy parents',
      'calorie maintenance meal plan family',
      'macro plan for maintenance phase parents',
      'sustainable nutrition plan busy family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Maintenance-phase macro framework for parents who need stable energy and nutrition consistency — not another aggressive diet.',
    hubOutcome:
      'Use maintenance periods to simplify routines and rebuild consistency before your next intentional phase.',
    intro:
      'This plan supports maintenance phases for parents who need nutrition stability more than constant adjustments. Maintenance is undervalued — it is the phase where good habits consolidate and the household routine catches up with the nutrition system.',
    closing:
      'Use maintenance periods to simplify routines and rebuild consistency before future phases. A well-executed maintenance period makes the next cut or gain phase significantly more effective.',
    faqUnique: {
      question: 'How do I know if I am actually in maintenance versus slowly gaining or losing without realizing it?',
      answer:
        'Track morning bodyweight three times per week and take a four-week rolling average. Maintenance means the rolling average stays within a two-pound window over a full month. Day-to-day fluctuations of two to four pounds are normal and not meaningful. If the four-week average is drifting consistently in one direction, your intake is not matching your expenditure regardless of what the math says.',
    },
  },

  'high-protein-fat-loss-plan-under-2000-calories': {
    keywords: [
      'high protein fat loss plan under 2000 calories',
      '2000 calorie high protein weight loss plan',
      'sub 2000 calorie high protein meal plan',
      'low calorie high protein family meal plan',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Sub-2000 calorie framework that keeps protein high enough to protect muscle and satiety high enough to sustain the deficit.',
    hubOutcome:
      'Protect protein first, then adjust carbs and fats based on weekly adherence — never the other way around.',
    intro:
      'This framework prioritizes satiety and protein quality while working within a lower-calorie budget. Below 2000 calories, food choices matter more than at higher intakes — protein and fiber become the primary tools for managing hunger without adding calories.',
    closing:
      'Protect protein first, then adjust carbs and fats based on weekly adherence data. Cutting protein to hit a lower calorie target defeats the primary purpose of the plan.',
    faqUnique: {
      question: 'How do I avoid feeling constantly hungry on a sub-2000 calorie plan while still feeding a family normally?',
      answer:
        'Build every meal around a high-volume, high-protein anchor: Greek yogurt bowls, large salads with lean protein, vegetable-heavy skillets. These meals are physically large and take time to eat, which improves satiety signals regardless of calorie count. The family eats the same base — you just take a larger vegetable portion and a smaller starch portion. Hunger on low-calorie plans is usually a food-choice problem, not a calorie problem.',
    },
  },

  '2400-calorie-body-recomposition-macro-plan': {
    keywords: [
      '2400 calorie body recomposition plan',
      'body recomposition macro plan',
      'recomp macro plan 2400 calories',
      'muscle gain fat loss macro plan 2400 calories',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Recomposition-focused 2400-calorie plan that supports muscle retention while managing body-fat trend — without aggressive cuts or bulks.',
    hubOutcome:
      'Track strength trends alongside weight change so adjustments are based on full context, not scale alone.',
    intro:
      'This plan is designed for recomposition where performance and recovery need to coexist with body-composition goals. At 2400 calories with high protein, the body has enough to support training adaptations while remaining in a slight enough deficit to trend body fat downward over time.',
    closing:
      'Track strength trends alongside weight change so adjustments are based on full context. A plan that is working for recomposition will show stable or improving strength even when the scale moves slowly.',
    faqUnique: {
      question: 'How do I know if my recomposition plan is actually working when the scale barely moves?',
      answer:
        'Use three metrics together, not one: scale weight trend (four-week rolling average), strength performance on two or three key lifts, and a monthly waist measurement. Recomposition success looks like stable or slightly declining scale weight, stable or improving strength, and a slowly reducing waist measurement over eight to twelve weeks. If all three are moving in the right direction simultaneously, the plan is working — even if no single metric looks dramatic.',
    },
  },

  'postpartum-high-protein-macro-plan-framework': {
    keywords: [
      'postpartum macro plan high protein',
      'postpartum nutrition plan high protein',
      'macro plan after pregnancy recovery',
      'postpartum calorie and protein planning',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Recovery-first macro framework for postpartum — prioritizes protein, energy stability, and practical meal execution over aggressive targets.',
    hubOutcome:
      'Choose convenience intentionally when it improves recovery and routine adherence during this season.',
    intro:
      'This page emphasizes recovery-supportive nutrition with practical execution during postpartum schedule volatility. The primary objective is not fat loss — it is consistent protein intake, adequate energy, and a meal system that can run even on disrupted sleep.',
    closing:
      'Choose convenience intentionally when it improves recovery and routine adherence. This is not a phase to optimize — it is a phase to sustain.',
    faqUnique: {
      question: 'When is the right time to shift from postpartum recovery nutrition to an intentional fat-loss phase?',
      answer:
        'A reasonable signal is when three conditions are stable for at least two consecutive weeks: sleep is consistent enough to function without major impairment, the household routine is running predictably, and energy levels are stable through most of the day. Attempting a calorie deficit before those conditions hold typically produces low adherence and high stress rather than results. There is no universal timeline — the three-condition check is more reliable than any calendar.',
    },
  },

  '1700-calorie-high-satiety-macro-plan': {
    keywords: [
      '1700 calorie high satiety meal plan',
      '1700 calorie macro plan for weight loss',
      'low calorie high satiety meal plan',
      '1700 calorie diet plan with high protein',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Lower-calorie macro framework designed to maximize fullness and adherence — built around volume, protein, and fiber rather than restriction.',
    hubOutcome:
      'Use high-volume, high-protein staples to make 1700 calories feel sustainable across the full week.',
    intro:
      'This structure is aimed at lower-calorie phases where hunger management determines long-term success. At 1700 calories, the plan works not by willpower but by food selection — meals are large in physical volume, high in protein, and structured to prevent the late-afternoon energy drop that causes most lower-calorie plans to break.',
    closing:
      'Use high-volume, high-protein staples to keep this target sustainable across the week. A 1700-calorie plan built on low-volume foods produces hunger that cannot be sustained regardless of motivation.',
    faqUnique: {
      question: 'How do I run a 1700-calorie plan while cooking full-sized family dinners every night?',
      answer:
        'Control your portion at the starch and sauce level while keeping protein portions equal or larger than the rest of the family. A family dinner of chicken, rice, and vegetables becomes your template — you take a larger chicken portion, a smaller rice portion, and a larger vegetable portion. The plate looks full because it is full. Prepare your vegetables in larger quantity than the family needs so you always have a high-volume, low-calorie buffer available.',
    },
  },

  '2600-calorie-active-parent-macro-plan': {
    keywords: [
      '2600 calorie active parent macro plan',
      'macro plan for active parents 2600 calories',
      'high activity parent meal plan 2600 calories',
      'nutrition plan active parents family meals',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Higher-calorie macro framework for active parents who need strong energy support while keeping family dinner routines intact.',
    hubOutcome:
      'Keep pre- and post-activity meal anchors fixed so daily nutrition does not depend on improvised decisions.',
    intro:
      'This framework fits active parents balancing training output, family schedules, and limited prep bandwidth. At 2600 calories, the distribution across the day matters significantly — undereating before activity and compensating late at night is the most common adherence problem at this intake level.',
    closing:
      'Keep pre- and post-activity meal anchors fixed to reduce daily nutrition guesswork. When those two meals are predictable, the rest of the day fills in naturally around the family routine.',
    faqUnique: {
      question: 'How do I hit higher calorie targets on days when my schedule leaves almost no time to eat properly?',
      answer:
        'Pre-build two or three portable high-calorie meal options — Greek yogurt with granola and fruit, rice and chicken prep containers, overnight oats with nut butter — and keep them ready in the fridge for high-demand days. These are not snacks; they are complete meals that require zero preparation time. On chaotic days, you pull from this ready supply rather than improvising, which is where undereating and compensation patterns start.',
    },
  },

  'high-protein-vegetarian-family-macro-plan': {
    keywords: [
      'high protein vegetarian macro plan family',
      'vegetarian macro meal plan high protein',
      'vegetarian family meal plan with protein targets',
      'plant based high protein macro plan family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Vegetarian macro framework with real protein targets, practical meal prep, and grocery alignment for family households.',
    hubOutcome:
      'Standardize your core vegetarian protein sources so grocery planning and macro targets stay aligned week to week.',
    intro:
      'This plan supports vegetarian households that still want clear protein targets and realistic meal prep. High-protein vegetarian eating is achievable but requires intentional protein anchoring at every meal — it does not happen automatically the way it might with animal proteins.',
    closing:
      'Standardize your core vegetarian protein sources so grocery and macros stay aligned. Rotating too many different protein sources week to week makes both planning and tracking harder without meaningfully improving nutrition.',
    faqUnique: {
      question: 'Which vegetarian protein sources are most practical for hitting daily targets in a busy family household?',
      answer:
        'The highest-utility options are Greek yogurt, cottage cheese, eggs, tofu, tempeh, edamame, and legumes (lentils, chickpeas, black beans). These are reliably available, reasonably priced, and work across breakfast, lunch, and dinner formats without requiring specialty recipes. Pick three or four of these as your weekly anchors and build meals around them rather than treating protein as something to add on after the meal is designed.',
    },
  },

  'perimenopause-macro-plan-for-energy-and-compliance': {
    keywords: [
      'perimenopause macro plan',
      'perimenopause nutrition plan energy',
      'macro plan for perimenopause women',
      'perimenopause diet plan calorie protein',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Perimenopause-focused macro framework built for stable energy, protein support, and long-term adherence over aggressive short-term results.',
    hubOutcome:
      'Use trend-based adjustments slowly and prioritize recovery-supportive intake consistency over rapid changes.',
    intro:
      'This page prioritizes energy stability and adherence for perimenopause-focused nutrition planning. The hormonal variability of perimenopause means that calorie needs, hunger signals, and recovery patterns shift in ways that standard macro plans do not account for — this framework builds in that flexibility.',
    closing:
      'Use trend-based adjustments slowly and prioritize recovery-supportive intake consistency. Aggressive calorie cuts during perimenopause often produce fatigue and muscle loss rather than the body composition changes they aim for.',
    faqUnique: {
      question: 'How do I adjust my macro plan when perimenopause symptoms like fatigue and poor sleep make adherence inconsistent?',
      answer:
        'On high-symptom days, move to a simplified fallback template — two or three meals you can prepare in under 15 minutes that still hit your protein floor. Do not try to hit your full target on days when energy is significantly impaired; instead, focus on protein coverage only and let carbs and fats flex. Track your symptom patterns alongside your food log for four to six weeks and look for correlations. Many women find that specific food patterns — skipping breakfast, high-sugar meals, under-eating overall — amplify symptoms, which gives you a practical lever beyond medication.',
    },
  },

  'family-recomp-macro-plan-with-weekend-flex': {
    keywords: [
      'family recomp macro plan weekend flexibility',
      'body recomposition plan with weekend flex',
      'macro plan recomp weekday consistency weekend flex',
      'family macro plan with planned flexibility',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Recomposition macro framework that builds weekday consistency and controlled weekend flexibility into the same system.',
    hubOutcome:
      'Plan flex windows in advance so they support consistency instead of breaking momentum.',
    intro:
      'This framework combines recomposition structure with weekend flexibility to improve long-term compliance. The design acknowledges that family social life happens mostly on weekends — and a plan that does not account for that will fail at exactly the moments it needs to hold.',
    closing:
      'Plan flex windows in advance so they support consistency instead of breaking momentum. Unplanned flexibility always costs more than planned flexibility because it triggers the all-or-nothing reset that derails weekly progress.',
    faqUnique: {
      question: 'How do I enjoy weekend meals with family and friends without completely undoing weekday progress?',
      answer:
        'Run a modest weekly calorie reserve — eating slightly below your maintenance target on four weekdays — and apply that buffer to your flex meals. This means you enter the weekend with built-in room rather than trying to compensate after the fact. The key rules for flex meals are: keep protein consistent even if everything else relaxes, and treat flex as two or three planned meals, not an entire weekend in an unconstrained state. The difference between a planned flexible meal and unplanned drift is whether the decision was made before or after you sat down.',
    },
  },
};

// ─── FAQ builder ──────────────────────────────────────────────────────────────

function buildMacroFaq(page: (typeof macroPlanPages)[number]) {
  const meta = macroMeta[page.slug];
  return [
    {
      question: `How do I start "${page.title}" and build consistency from the first week?`,
      answer: `${meta.intro} Run ${page.sampleDay[0].toLowerCase()} as your default day pattern for the first full week before making any macro changes. One reliable week of data is worth more than a perfect plan that changes daily.`,
    },
    {
      question: 'When is the right time to adjust calories or macro splits?',
      answer: `Apply ${page.adjustmentRules[0].toLowerCase()} only after a full week of reliable logging and trend review — not after a single difficult day. Then layer in ${page.adjustmentRules[1].toLowerCase()} as the second lever if the first adjustment does not produce the expected trend shift.`,
    },
    {
      question: 'What is the most effective way to avoid tracking burnout on this plan?',
      answer: `${meta.closing} Keep logging simple with ${page.loggingProtocol[0].toLowerCase()} and review weekly averages rather than reacting to daily numbers. Daily fluctuations are noise; weekly trends are signal.`,
    },
    meta.faqUnique,
  ];
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

export function MacroHubPage() {
  useSeoMeta({
    title: 'Macro Plan Frameworks | Calorie & Protein Planning for Families | Home Harmony',
    description:
      'Stop guessing your macros. Browse 12 practical macro planning frameworks — fat loss, muscle gain, maintenance, recomposition, postpartum, and perimenopause plans built for real family households and repeatable weekly execution.',
    keywords: [
      'macro meal plan family',
      'calorie and protein planning family',
      'high protein macro plan',
      'fat loss macro plan family',
      'muscle gain macro plan',
      'macro framework weekly family meals',
    ],
    image: '/seo/macro-plans.png',
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
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Each framework below is matched to a specific calorie target and goal — fat loss, muscle gain, maintenance, or recomposition. Pick the one that fits your current phase, not your ideal scenario.
        </p>
      </div>
      <SeoHubPrimer
        title="How to Run a Macro Plan That Actually Lasts"
        intro="Macro success depends less on perfect math and more on repeatable systems. Start with consistent meal templates and adjust targets only after enough trend data exists to make the decision meaningful."
        items={[
          {
            title: 'Prioritize adherence over precision',
            description:
              'Run stable meal patterns for two weeks before making aggressive macro adjustments. Consistency produces better data than constant changes.',
          },
          {
            title: 'Track weekly trends, not daily numbers',
            description:
              'Use four-week rolling averages for bodyweight and intake trends. Daily fluctuations are noise — react to weekly patterns only.',
          },
          {
            title: 'Connect macros to your grocery workflow',
            description:
              'Macro plans fail most often when the shopping list and prep system are disconnected from the targets. Build both from the same meal template.',
          },
          {
            title: 'Adjust in small steps after consistency is validated',
            description:
              'Modify calories and macro splits in 100–200 kcal increments, one variable at a time. Stacking multiple changes at once makes it impossible to know what worked.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {macroPlanPages.map((page) => {
          const meta = macroMeta[page.slug];
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
                  <p className="mt-1 text-sm text-muted-foreground">{page.macroTarget}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Key outcome: {meta?.hubOutcome || page.sampleDay[0]}
                  </p>
                </div>
                <Link to={`/macro-plans/${page.slug}`} className="mt-4 inline-block">
                  <Button variant="outline">Open Plan</Button>
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

export function MacroDetailPage() {
  const { slug } = useParams();
  const page = macroPlanPages.find((item) => item.slug === slug);
  const meta = page ? macroMeta[page.slug] : null;
  const detailedFaq = page ? buildMacroFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Macro Plans | Home Harmony',
    description: page?.description || 'Macro planning framework from Home Harmony.',
    // Unique keywords per page matched to specific calorie target and goal intent
    keywords: meta?.keywords || ['macro meal plan', 'calorie planning family', 'high protein macro plan'],
    image: page?.heroImage.replace('.svg', '.png') || '/seo/macro-plans.png',
    publishedTime: meta?.publishedAt || '2026-02-21',
    modifiedTime: meta?.modifiedAt || '2026-02-21',
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

  if (!page || !meta) {
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
    `Run one repeatable day pattern for the first week: ${page.sampleDay[0]}`,
    `Apply one adjustment rule only after a full week of trend review: ${page.adjustmentRules[0]}`,
    `Maintain consistent logging behavior throughout: ${page.loggingProtocol[0]}`,
  ];

  const editorialBlocks = [
    {
      title: 'Macro Baseline and Target Context',
      intro: page.macroTarget,
      paragraphs: [
        meta.intro,
        `Macro targets only produce results when they match your real routine. Build around repeatable meal structures — ${page.sampleDay[0].toLowerCase()} and ${page.sampleDay[1].toLowerCase()} — instead of chasing perfect numbers on a daily basis.`,
        `This plan gives you a practical baseline you can execute consistently before making any structural changes. Two reliable weeks is the minimum meaningful data window.`,
      ],
      highlights: [page.macroTarget, ...page.sampleDay.slice(0, 2)],
    },
    {
      title: 'Sample Day Structure Built for Repetition',
      paragraphs: [
        `Execution quality comes from repetition, not variety. Start with ${page.sampleDay[0].toLowerCase()} and maintain the same sequence on your busiest days — not just your easiest ones.`,
        `The full sample day — ${page.sampleDay.join(', ').toLowerCase()} — is designed to keep grocery, prep, and tracking aligned. When the day template is stable, the weekly system runs itself.`,
        `Use this as your default pattern and only deviate for planned social meals or flex days — never because the day got busy and you improvised.`,
      ],
      highlights: page.sampleDay,
    },
    {
      title: 'Adjustment Rules and Logging Protocol',
      paragraphs: [
        `Adjustments should be deliberate and trend-based, not reactive. Apply ${page.adjustmentRules[0].toLowerCase()} only after a full consistent logging window — then evaluate before adding a second change.`,
        meta.closing,
        `Keep tracking manageable with protocols like ${page.loggingProtocol[0].toLowerCase()} so the data remains usable week over week. The goal is a logging habit you can run for months, not a perfect log you abandon after two weeks.`,
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
        readMinutes: estimateReadMinutes([page.sampleDay, page.adjustmentRules, page.loggingProtocol]),
      }}
      bestFor={page.macroTarget}
      primaryCta={{ label: 'Use This System', href: '/signin' }}
      outcomes={[page.sampleDay[0], page.adjustmentRules[0], page.loggingProtocol[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Adjustment and Flexibility Rules"
      flexibilityItems={page.adjustmentRules}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'More Macro Plan Frameworks',
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
        title: 'Keep Your Targets Consistent Week to Week',
        description:
          'Save your macro targets, log progress, and connect meals, grocery lists, and workouts in one weekly rhythm.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'Browse More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'Sample day details', items: page.sampleDay },
        { title: 'Logging protocol details', items: page.loggingProtocol },
      ]}
    />
  );
}
