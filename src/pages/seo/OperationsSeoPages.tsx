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
import { SeoHubPrimer } from './SeoDetailScaffold';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { ResourcePageLayout } from './ResourcePageLayout';

// ─── Per-page metadata ────────────────────────────────────────────────────────
// keywords    – unique, intent-matched search terms for the detail page
// publishedAt – ISO date (update modifiedAt whenever content changes)
// modifiedAt  – ISO date
// hubTeaser   – short card copy shown on hub (distinct from detail intro)
// hubOutcome  – one outcome sentence shown on hub card
// intro       – first editorial paragraph on detail page
// closing     – closing editorial sentence on detail page
// faqUnique   – one page-specific FAQ that could not apply to any other guide

const operationsMeta: Record<
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
  // ── Chore Systems ────────────────────────────────────────────────────────────
  'weekly-family-chore-system-for-two-working-parents': {
    keywords: [
      'family chore system two working parents',
      'weekly chore system dual income household',
      'chore ownership system working parents',
      'family chore schedule two jobs',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Chore ownership framework for dual-working-parent homes — built around handoff clarity, not perfect balance.',
    hubOutcome:
      'Protect weekly reset time and treat chore ownership as fixed until the next scheduled review.',
    intro:
      'This guide is tuned for two-working-parent households where handoff clarity matters more than perfect balance. The system does not try to make every week equal — it makes every week legible, so neither parent is silently carrying an unacknowledged load.',
    closing:
      'Protect weekly reset time and treat chore ownership as fixed until the next review. Ad-hoc reassignment mid-week is where most dual-working-parent chore systems quietly break down.',
    faqUnique: {
      question: 'How do we prevent one parent from defaulting to doing everything when the other is traveling or working late?',
      answer:
        'Build a travel-week and late-night protocol into the system before you need it. Define a minimum viable chore list — the tasks that must happen regardless — and assign a named backup for each one. When the default owner is unavailable, the backup is already known. The decision was made in advance during a low-stress planning moment, not improvised during a high-stress evening.',
    },
  },

  'chore-system-for-families-with-young-kids': {
    keywords: [
      'chore system young kids family',
      'chore chart preschool and elementary kids',
      'age appropriate chores young children family',
      'family chore system toddler and school age',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Kid-inclusive chore framework using age-appropriate tasks and short windows — builds participation without reminder loops.',
    hubOutcome:
      'Keep young-kid chore expectations small, visible, and repeatable every day before adding complexity.',
    intro:
      'This framework uses age-appropriate participation so routines build without overloading parents. The design logic is: young kids can own two things reliably, and two things done consistently is more valuable than six things done occasionally with reminders.',
    closing:
      'Keep young-kid chore expectations small, visible, and repeatable every day. Early habit formation through small consistent tasks produces far more long-term capability than ambitious lists that require constant parental enforcement.',
    faqUnique: {
      question: 'What are the most effective chores to start with for kids under 7, and how do I know when to add more?',
      answer:
        'Start with two chores that have an obvious done state — making the bed (covers pulled up, pillow placed) and putting dirty clothes in the hamper. These require no reading ability, no complex judgment, and produce a visible result the child can evaluate themselves. Add a third chore only after both are running without reminders for two consecutive weeks. The readiness signal is self-initiation, not parent reminder, being the default trigger.',
    },
  },

  'small-home-high-efficiency-chore-system': {
    keywords: [
      'apartment chore system family',
      'small home chore routine family',
      'high efficiency chore system small space',
      'chore system limited square footage family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Zone-based chore model for small homes and apartments — frequent short resets beat infrequent deep cleans in tight spaces.',
    hubOutcome:
      'Use short, frequent reset blocks in shared zones instead of one large cleanup window each week.',
    intro:
      'This page is built for smaller homes where shared spaces require tighter timing and frequent resets. In compact spaces, the kitchen, entryway, and living area affect the entire household experience — which means shared-zone resets must happen daily, not weekly.',
    closing:
      'Use short, frequent reset blocks instead of one large cleanup window. In a small home, a 10-minute daily reset prevents a 60-minute weekend recovery and reduces the ambient stress that cluttered shared spaces create.',
    faqUnique: {
      question: 'How do we keep a small apartment from feeling chaotic without spending our entire weekend cleaning?',
      answer:
        'Cap total daily chore time at 20 minutes across the whole household and protect that cap aggressively. Three 7-minute zone resets — morning kitchen, after-school drop zone, after-dinner living area — cover the highest-impact areas without consuming the evening. The weekend deep clean then becomes a light touch-up rather than a recovery operation. The constraint forces prioritization: you learn quickly which zones matter most and which can wait.',
    },
  },

  'teen-accountability-chore-system-with-scorecard': {
    keywords: [
      'teen chore accountability system',
      'chore scorecard for teenagers',
      'teen household responsibility system',
      'chore system for teenagers with accountability',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Performance-style chore framework for teens using visible expectations, weekly scorecards, and objective completion standards.',
    hubOutcome:
      'Use scorecards as structured feedback, not punishment — review trends weekly rather than correcting daily.',
    intro:
      'This guide adds transparent accountability for teens while keeping household standards objective. When teens can see their own completion record in black and white, the conversation shifts from parental opinion to visible data — which reduces defensiveness and creates a more productive accountability dynamic.',
    closing:
      'Use scorecards as feedback, not punishment, and review trends weekly. A teen who can see their own pattern in data is more likely to self-correct than one who only hears about failures in the moment.',
    faqUnique: {
      question: 'How do we set chore standards that a teenager cannot argue are subjective or unfair?',
      answer:
        'Write the done state as a checklist, not a description. Instead of "clean the bathroom," write: wipe sink and countertop with cloth, clean toilet bowl and seat, wipe mirror until streak-free, replace towels if used. The teen checks off each item; the parent inspects against the same list. When both sides use the same written criteria, "I did it" and "that\'s not how we define done" become resolvable with evidence rather than an ongoing opinion conflict.',
    },
  },

  'chore-system-for-blended-family-schedules': {
    keywords: [
      'chore system blended family',
      'chore schedule shared custody household',
      'blended family chore and task system',
      'chore rotation blended family custody schedule',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Transition-aware chore structure for blended households with rotating attendance and shared custody schedules.',
    hubOutcome:
      'Document transitions clearly so chore standards stay consistent across schedule shifts rather than resetting each time.',
    intro:
      'This framework addresses rotating custody and blended calendars by anchoring chores to predictable windows rather than specific people. When a child is present, they own their tasks. When they are not, those tasks either pause or transfer to a named backup — and that decision is made once, not negotiated each transition.',
    closing:
      'Document transitions clearly so standards stay consistent across schedule shifts. The handoff checklist is the single most effective tool in blended household chore management.',
    faqUnique: {
      question: 'How do we handle chores fairly when kids are present different amounts of time each week?',
      answer:
        'Track contribution by presence ratio, not by fixed weekly targets. A child present four days this week and two days next week cannot be held to the same absolute chore count both weeks. Build chore expectations as "when you are here, you own these tasks" rather than "you are responsible for X tasks per week." This removes the resentment that comes from being held to standards that do not account for the reality of split-home schedules.',
    },
  },

  // ── Task Systems ─────────────────────────────────────────────────────────────
  'family-task-management-system-with-priority-lanes': {
    keywords: [
      'family task management priority system',
      'household task system with priority lanes',
      'family to do system priority based',
      'shared task management family priority',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Priority-lane task framework for families — separates urgent from important so critical work stops getting buried under noise.',
    hubOutcome:
      'Keep priority lanes small and reassess lane membership once per week — not every time a new task arrives.',
    intro:
      'This page is for families that need clearer priority separation so urgent tasks stop getting buried under lower-stakes items. The three-lane model — critical this week, important this week, optional — is intentionally simple because complexity in a task system is what causes people to stop using it.',
    closing:
      'Keep priority lanes small and reassess lane membership once per week. A task system with too many urgent items is a system where no one knows what actually matters.',
    faqUnique: {
      question: 'How do we stop everything from ending up in the "urgent" lane, which makes the whole system useless?',
      answer:
        'Set a hard cap: no more than three items in the critical lane at any time. When a new critical item arrives, something existing must move down or get completed first. This constraint forces genuine prioritization and prevents the inflation that makes priority systems meaningless. Review the critical lane together every Sunday — if it has more than three items, the household has a scope problem, not a task problem.',
    },
  },

  'shared-to-do-system-for-couples-and-kids': {
    keywords: [
      'shared to do system couples and kids',
      'household to do list couples family',
      'family shared task list couples and children',
      'couples and kids shared task management',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Shared-visibility to-do structure that reduces mental load for couples and keeps kids involved without constant negotiation.',
    hubOutcome:
      'Assign one owner per task and use shared weekly review to resolve blockers — not daily check-ins.',
    intro:
      'This guide focuses on shared visibility without turning the to-do list into constant negotiation. When both partners can see the same task board, the "I didn\'t know that needed doing" conversation disappears — which is where most household mental-load resentment begins.',
    closing:
      'Assign one owner per task and use shared review to resolve blockers quickly. Shared visibility with individual ownership is the combination that reduces both dropped tasks and recurring arguments about who is doing what.',
    faqUnique: {
      question: 'How do we involve kids in the family task system without creating more work for parents to manage?',
      answer:
        'Create a separate kid-visible lane with tasks that have fully defined completion criteria — not tasks that require parental judgment to evaluate. Kids should be able to determine whether their own task is done without asking a parent. If a task requires inspection and feedback to close, it is not ready to be assigned to a child independently. Start with two kid tasks, accept the result without re-doing them, and expand only when those run without intervention.',
    },
  },

  'adhd-friendly-household-task-system': {
    keywords: [
      'ADHD friendly household task system',
      'ADHD family task management',
      'household task system for ADHD adults',
      'low friction task system ADHD household',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Low-cognitive-load task system using now/next/later sequencing, capped active tasks, and visual completion signals.',
    hubOutcome:
      'Reduce active tasks per person and prioritize completion signals over list length — done is more important than comprehensive.',
    intro:
      'This framework is designed to lower executive-load by making tasks obvious, finite, and sequential. The two failure modes ADHD households face most are task initiation (starting) and task switching (finishing one before starting another) — this system addresses both through visual sequencing and hard caps on active work.',
    closing:
      'Reduce active tasks and prioritize completion signals over list length. A three-item board that gets completed produces more household progress than a twelve-item board that creates decision paralysis.',
    faqUnique: {
      question: 'How do we design a household task system that works even on days when executive function is significantly impaired?',
      answer:
        'Build a two-tier system: a normal operating mode and a minimum viable mode. The minimum viable mode has exactly three tasks — one per person — that are the non-negotiable floor for the day. When capacity is low, everyone switches to minimum viable mode without discussion or guilt. The normal mode resumes when capacity returns. Having the floor defined in advance removes the decision-making burden on exactly the days when decision-making is hardest.',
    },
  },

  'weekly-household-admin-task-system': {
    keywords: [
      'weekly household admin task system',
      'family admin task management system',
      'household administrative tasks weekly system',
      'family bills and admin task tracker',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Admin-focused task framework that batches bills, scheduling, school items, and home logistics into one protected weekly window.',
    hubOutcome:
      'Batch admin tasks into one recurring weekly block and protect it like a fixed appointment — not a when-I-get-to-it task.',
    intro:
      'This page centralizes admin work like bills, forms, and planning so they stop leaking into every day. When admin tasks have no dedicated home, they live in someone\'s head — which is the definition of invisible mental load and the most common source of missed deadlines.',
    closing:
      'Batch admin tasks into one recurring block and protect it like a fixed appointment. Admin that gets done reliably in 30 focused minutes each week almost never reaches crisis level.',
    faqUnique: {
      question: 'How do we make sure both partners are aware of and contributing to household admin without one person silently carrying everything?',
      answer:
        'Divide admin by category ownership, not by task. One partner owns financial admin (bills, insurance, banking), the other owns logistics admin (school, appointments, subscriptions). Each person knows their category completely — not just their assigned tasks for this week. This model eliminates the "I didn\'t know that was happening" problem because each person has full visibility and accountability for their domain, not just their individual checklist items.',
    },
  },

  'family-task-system-for-travel-heavy-weeks': {
    keywords: [
      'family task system frequent travel',
      'household task management travel weeks',
      'family operations system business travel',
      'task system for families with frequent travel',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Resilient task workflow for travel-heavy households — pre-planned delegation and reset protocols keep operations stable during irregular weeks.',
    hubOutcome:
      'Use standardized departure and return checklists every trip to prevent task backlog from compounding week over week.',
    intro:
      'This system supports households with irregular presence by pre-planning delegation and reset windows. The biggest cost in travel-heavy household management is not the travel itself — it is the compounding backlog that accumulates when no reset protocol exists for the return.',
    closing:
      'Use departure and return checklists to prevent task backlog from compounding. The first 24 hours back home determine whether the week recovers cleanly or carries forward chaos into the next one.',
    faqUnique: {
      question: 'How do we keep the at-home parent from being overwhelmed with household management during travel weeks?',
      answer:
        'The traveling partner completes a home-state handoff document before every departure: meals planned for the week, grocery status, any pending admin deadlines, and scheduled appointments with logistics covered. The at-home partner should not be making those decisions alone mid-week. Build the handoff document into the departure checklist so it happens every time — not just when the traveling partner remembers to offer it.',
    },
  },

  // ── Workout Tracking ──────────────────────────────────────────────────────────
  'beginner-strength-training-tracker-for-busy-parents': {
    keywords: [
      'beginner strength training tracker busy parents',
      'strength training log for parents',
      'simple workout tracker beginner parents',
      'strength training program tracker busy schedule',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Low-friction strength tracking system for beginner parents — built for consistency across real family schedules, not ideal training conditions.',
    hubOutcome:
      'Keep sessions short and track only the core lifts that matter most — more data does not mean better progress.',
    intro:
      'This guide gives busy parents a low-friction strength tracking system built for consistency over complexity. The most common beginner mistake is tracking too much — which creates overhead that makes skipping a session feel easier than logging one.',
    closing:
      'Keep sessions short and track the core lifts that matter most each week. Three consistent sessions logged simply outperforms five inconsistent sessions tracked perfectly.',
    faqUnique: {
      question: 'How do I make consistent progress on strength training when my schedule only allows 3 inconsistent sessions per week?',
      answer:
        'Use a flexible session template rather than a rigid program. Define three session types — lower body, upper body, full body — and do whichever fits your available time that day rather than following a fixed day-of-week schedule. Track load and reps for your three to four primary movements. As long as those numbers progress over four to six weeks, the programming is working regardless of which days the sessions fell on.',
    },
  },

  'home-gym-workout-tracking-system': {
    keywords: [
      'home gym workout tracking system',
      'home gym training log',
      'workout tracker home gym no commercial gym',
      'home gym progression tracking system',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Home-gym tracking workflow for structured programming without commercial gym dependency — built around available equipment and short windows.',
    hubOutcome:
      'Pre-plan exercise order so you can start training immediately when time opens up — setup friction kills home gym consistency.',
    intro:
      'This framework is tuned for home-gym realities where equipment access is high but schedule windows are short. The failure mode in home gyms is not motivation — it is the decision overhead of starting, which is why pre-planned session templates matter more at home than at a commercial gym.',
    closing:
      'Pre-plan exercise order so you can start training immediately when time opens up. The session that starts in three minutes happens; the session that requires five minutes of planning often does not.',
    faqUnique: {
      question: 'How do I create meaningful progression with limited home gym equipment without hitting a plateau quickly?',
      answer:
        'Progression is not only load. With limited equipment, use tempo (slow the eccentric), volume (add sets before weight), density (reduce rest), and unilateral variations (single-leg, single-arm) as your primary progression tools. A dumbbell that feels light for a standard squat becomes challenging as a slow-tempo Bulgarian split squat. Map your equipment to these five progression variables and you will have months of meaningful training stimulus before load becomes the constraint.',
    },
  },

  'hypertrophy-workout-tracker-with-family-schedule': {
    keywords: [
      'hypertrophy workout tracker family schedule',
      'muscle building tracker for parents',
      'hypertrophy training log flexible schedule',
      'muscle growth workout tracker family constraints',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Muscle-growth tracking system built for variable family calendars — volume targets flex around schedule without sacrificing progression.',
    hubOutcome:
      'Anchor weekly volume targets by muscle group and flex session timing around family commitments rather than the reverse.',
    intro:
      'This page balances hypertrophy progression with family scheduling constraints and variable recovery days. The key shift is moving from session-count thinking to weekly-volume thinking — which allows the same training stimulus to be achieved across three, four, or five sessions depending on what the week allows.',
    closing:
      'Anchor volume targets weekly and flex session timing around family commitments. Consistent weekly volume over twelve weeks produces more hypertrophy than a perfect program that gets skipped when life disrupts the schedule.',
    faqUnique: {
      question: 'How do I maintain hypertrophy progress during weeks when family commitments cut my training to two sessions?',
      answer:
        'Design a two-session minimum template in advance that covers your most important muscle groups at reduced but meaningful volume — full body with four to six sets per major movement. When a low-availability week arrives, you execute this template rather than improvising or skipping. Two well-executed full-body sessions produce more stimulus than trying to compress a four-day split into two days. The minimum template is not a compromise; it is a planned gear for certain weeks.',
    },
  },

  'couples-workout-planner-and-tracker': {
    keywords: [
      'couples workout planner and tracker',
      'shared workout tracker for couples',
      'couples fitness planner family',
      'workout coordination system for couples',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Shared workout system for partners — aligns training schedules, childcare windows, and accountability without mismatched expectations.',
    hubOutcome:
      'Set shared session windows and independent progression goals so training stays coordinated without becoming a source of friction.',
    intro:
      'This guide helps couples coordinate training without adding calendar friction or mismatched expectations. The tension in couples training usually comes from one person\'s training goals requiring schedule space that affects the other — this system makes those tradeoffs visible and negotiable before they become resentments.',
    closing:
      'Set shared session windows and independent progression goals to reduce conflict. Training together is a choice; the schedule infrastructure around it is a system that should be designed, not assumed.',
    faqUnique: {
      question: 'How do we keep training consistent as a couple when one partner\'s schedule is significantly more unpredictable than the other\'s?',
      answer:
        'Assign two session types: partner sessions (both attend, scheduled like appointments) and solo sessions (each person manages their own). Partner sessions are treated as non-negotiable unless both agree to move them — which prevents the asymmetry where the more flexible partner absorbs all the schedule adjustments. Solo sessions fill the remaining training slots around individual availability. This structure keeps both people progressing even when synchronization is not always possible.',
    },
  },

  'fat-loss-cardio-and-strength-tracking-system': {
    keywords: [
      'fat loss cardio and strength tracking',
      'combined cardio and strength tracker fat loss',
      'fat loss workout tracking system',
      'weight loss strength and cardio tracking plan',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Dual-modality tracking system for fat loss — balances cardio compliance with strength retention so results come without muscle loss.',
    hubOutcome:
      'Track total weekly workload and recovery markers before reducing intake further — most fat-loss plateaus are recovery problems, not calorie problems.',
    intro:
      'This framework combines cardio and strength tracking so fat-loss plans do not sacrifice muscle retention. The most common mistake in fat-loss training is over-prioritizing cardio while allowing strength performance to decline — which accelerates muscle loss and undermines the long-term body composition outcome.',
    closing:
      'Track total weekly workload and recovery markers before reducing intake further. A plateau that looks like a calorie problem is often a recovery and workload distribution problem.',
    faqUnique: {
      question: 'How do I know if I am doing too much cardio and not enough strength work during a fat-loss phase?',
      answer:
        'Watch your strength performance on two or three key lifts over four weeks. If loads are declining or you are failing reps you previously completed comfortably, cardio volume is likely impairing recovery. The signal is not fatigue — fatigue is normal in a deficit. The signal is strength regression. When that appears, reduce cardio session duration or frequency before reducing calories, and reassess after two weeks.',
    },
  },

  // ── Lifestyle Tracking ────────────────────────────────────────────────────────
  'family-sleep-tracking-system-for-better-routines': {
    keywords: [
      'family sleep tracking system',
      'household sleep routine tracker',
      'family bedtime routine tracking system',
      'sleep consistency tracker for families',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Practical sleep tracking framework that improves evening routine consistency and next-day household performance.',
    hubOutcome:
      'Review bedtime and wake-time adherence weekly and adjust evening triggers first before changing sleep targets.',
    intro:
      'This page is built to improve sleep consistency through shared routines rather than isolated individual hacks. When the household evening routine is aligned — dinner timing, screen use, wind-down sequence — sleep quality tends to improve for everyone, not just the person being tracked.',
    closing:
      'Review bedtime and wake-time adherence weekly and adjust evening triggers first. Most sleep problems are upstream evening behavior problems that show up at bedtime.',
    faqUnique: {
      question: 'How do we improve children\'s sleep consistency without it becoming a nightly conflict?',
      answer:
        'Design the wind-down sequence so the child is making low-stakes choices within a structured container: they choose which book, but reading happens; they choose their pajamas, but screens are off at the same time each night. The autonomy within the structure reduces resistance because the child has agency without the child having control over the boundary itself. Track bedtime consistency for two weeks before adjusting the sequence — most sleep resistance is a consistency problem, not a routine-content problem.',
    },
  },

  'period-and-cycle-tracking-for-household-planning': {
    keywords: [
      'cycle tracking for household planning',
      'period tracking and family planning',
      'menstrual cycle tracking household schedule',
      'cycle aware planning family household',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Cycle-aware planning framework that aligns energy patterns, workload timing, and household scheduling with real monthly rhythms.',
    hubOutcome:
      'Use cycle data to plan high-demand tasks around likely high-energy windows and protect recovery during low-energy ones.',
    intro:
      'This guide integrates cycle awareness into planning so workload and expectations align with real energy shifts. Cycle tracking becomes practically useful when it moves beyond symptom logging into schedule design — using observed patterns to place demanding tasks in high-energy phases and protect low-energy phases from overcommitment.',
    closing:
      'Use cycle data to plan high-demand tasks and recovery windows more realistically. The value is not in perfect prediction — it is in building a planning model that acknowledges energy is not constant across the month.',
    faqUnique: {
      question: 'How do I start using cycle tracking practically for household planning without needing extensive data first?',
      answer:
        'Begin with a simple three-field log: energy level (1–5), mood (1–5), and one symptom if present. Do this for 60 days without trying to use the data yet — just collect it. After two full cycles, look for patterns: are there consistent high-energy windows in the first half of the cycle? Consistent low-energy or high-symptom days in the second half? Use those two observations to make one planning adjustment — schedule your highest-demand week of monthly tasks around your observed high-energy window. One adjustment applied consistently is more valuable than a complex system applied inconsistently.',
    },
  },

  'alcohol-habit-tracking-system-with-weekly-review': {
    keywords: [
      'alcohol habit tracking system',
      'alcohol moderation tracker weekly',
      'drinking habit tracker family wellness',
      'alcohol reduction tracking system with review',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Realistic alcohol tracking framework focused on awareness and moderation — no all-or-nothing pressure, just weekly pattern visibility.',
    hubOutcome:
      'Set clear weekly thresholds and review the context around misses — not just the totals — to find the actual leverage points.',
    intro:
      'This framework uses simple weekly tracking to reduce alcohol drift without all-or-nothing pressure. The target is awareness and pattern recognition, not perfection — because tracking systems that demand perfection produce abandonment rather than behavior change.',
    closing:
      'Set clear weekly thresholds and review context around misses, not just totals. A miss in a social context has different implications than a miss at home on a Tuesday — and the distinction is where the useful behavior change information lives.',
    faqUnique: {
      question: 'How do I use alcohol tracking to actually reduce consumption without it becoming obsessive or all-or-nothing?',
      answer:
        'Set a weekly unit target that represents meaningful but realistic reduction from your current baseline — not an aspirational zero. Track every drinking event with one context tag: social, stress, habit, celebration. After four weeks, look at which context tags appear most frequently with overages. That is your highest-leverage intervention point. If stress-context events drive most overages, address the stress trigger, not the alcohol rule. Tracking without context data tells you what happened but not why — and the why is where sustainable change comes from.',
    },
  },

  'family-wellness-dashboard-with-sleep-workout-nutrition': {
    keywords: [
      'family wellness dashboard tracking',
      'household wellness tracker sleep workout nutrition',
      'family health dashboard app',
      'combined wellness tracker family household',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Multi-metric household wellness model that connects sleep, workout, and nutrition data into one weekly decision system.',
    hubOutcome:
      'Keep metrics minimal and focus only on trends that actually change planning behavior — more data does not mean better decisions.',
    intro:
      'This page combines core wellness signals into one view so household planning decisions use shared data. The goal is not comprehensive tracking — it is connecting three or four key metrics so they inform each other rather than existing in separate apps that no one reviews together.',
    closing:
      'Keep metrics minimal and focus on trends that actually change behavior. A dashboard reviewed weekly with three metrics outperforms a dashboard with fifteen metrics that no one opens.',
    faqUnique: {
      question: 'How do we get the whole household engaged with a wellness dashboard without it feeling like surveillance or extra pressure?',
      answer:
        'Frame the dashboard as a planning tool, not a performance evaluation. Review it together once per week with one question: "What do we want to adjust this week based on what we see?" This positions the data as useful information for decisions rather than a scorecard. Keep individual metrics private if anyone is uncomfortable with full visibility — the household-level view (overall sleep trend, combined activity) is often more useful than individual-level comparison anyway.',
    },
  },

  'habit-streak-tracking-system-for-household-consistency': {
    keywords: [
      'habit streak tracking system family',
      'household habit tracker with streaks',
      'family habit consistency tracker',
      'habit streak system for household routines',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Streak-based habit system focused on consistency and fast recovery after missed days — not perfection maintenance.',
    hubOutcome:
      'Prioritize streaks tied to real outcomes and reset goals quickly after interruptions — the recovery speed matters more than the streak length.',
    intro:
      'This system uses streak visibility to reinforce consistency across chores, nutrition, and wellness habits. The critical design choice is treating missed days as a reset point rather than a failure — which keeps people re-engaging rather than abandoning the system after a bad week.',
    closing:
      'Prioritize streaks tied to outcomes and reset goals quickly after interruptions. A two-day streak started today is worth more than a broken forty-day streak that causes someone to quit entirely.',
    faqUnique: {
      question: 'How do we design habit streaks that motivate the household without creating anxiety about breaking them?',
      answer:
        'Build in an official "skip" mechanism — one allowed skip per week that does not break the streak. This removes the all-or-nothing psychology without eliminating the motivating structure. When a skip is used, the streak counter continues. When two consecutive days are missed, the streak resets and restarts. This design acknowledges real life without rewarding disengagement. The skip rule also removes the incentive to cheat or hide missed days, which is what damages household trust in shared tracking systems.',
    },
  },
};

// ─── FAQ builder ──────────────────────────────────────────────────────────────

function buildOperationsFaq(page: OperationsGuideSeoPage, hubLabel: string) {
  const meta = operationsMeta[page.slug];
  return [
    {
      question: `How do I implement "${page.title}" without overwhelming the household?`,
      answer: `${meta.intro} Start with ${page.systemDesign[0].toLowerCase()} and limit rollout to one lane in week one. Adding the full system at once is the most common reason household operations guides get abandoned after two weeks.`,
    },
    {
      question: `What should I track during the first two weeks of this ${hubLabel.toLowerCase()} guide?`,
      answer: `Track completion consistency and missed handoffs first — before tracking anything more detailed. Then review against ${page.implementationSteps[0].toLowerCase()} and ${page.implementationSteps[1].toLowerCase()} to identify where the system is losing momentum.`,
    },
    {
      question: 'How do I prevent this system from breaking down during unusually busy weeks?',
      answer: `${meta.closing} Use "${page.commonPitfalls[0].toLowerCase()}" as your weekly risk checklist — if that condition is present, address it before it compounds into a full system failure.`,
    },
    meta.faqUnique,
  ];
}

// ─── Shared hub and detail components ────────────────────────────────────────

interface OperationsConfig {
  hubTitle: string;
  hubDescription: string;
  hubMetaTitle: string;
  hubMetaDescription: string;
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
    title: config.hubMetaTitle,
    description: config.hubMetaDescription,
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
        {config.pages.map((page) => {
          const meta = operationsMeta[page.slug];
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
                  <p className="mt-1 text-sm text-muted-foreground">{page.bestFor}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Key outcome: {meta?.hubOutcome || page.implementationSteps[0]}
                  </p>
                </div>
                <Link to={`${config.hubPath}/${page.slug}`} className="mt-4 inline-block">
                  <Button variant="outline">Open Guide</Button>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </SeoShell>
  );
}

function OperationsDetail({ config }: { config: OperationsConfig }) {
  const { slug } = useParams();
  const page = config.pages.find((item) => item.slug === slug);
  const meta = page ? operationsMeta[page.slug] : null;
  const detailedFaq = page ? buildOperationsFaq(page, config.hubLabel) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : `${config.hubLabel} | Home Harmony`,
    description: page?.description || `${config.hubLabel} guide from Home Harmony.`,
    // Each detail page gets its own unique keywords — not the hub-level keywords
    keywords: meta?.keywords || config.hubKeywords,
    image: page?.heroImage || config.heroImage,
    publishedTime: meta?.publishedAt || '2026-02-21',
    modifiedTime: meta?.modifiedAt || '2026-02-21',
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

  if (!page || !meta) {
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
    `Activate the first system design principle: ${page.systemDesign[0]}`,
    `Run your first implementation checkpoint: ${page.implementationSteps[0]}`,
    `Preempt the most common execution risk immediately: ${page.commonPitfalls[0]}`,
  ];

  const editorialBlocks = [
    {
      title: 'System Fit and Weekly Scope',
      intro: page.bestFor,
      paragraphs: [
        meta.intro,
        `A reliable household system starts with scope clarity. This guide works best when you launch one lane, keep ownership visible, and resist the temptation to add complexity before the baseline is stable.`,
        `Use the design model below to prioritize high-friction moments first — ${page.systemDesign[0].toLowerCase()} and ${page.systemDesign[1].toLowerCase()} — then expand the system only when those two are running without intervention.`,
      ],
      highlights: page.systemDesign,
    },
    {
      title: 'Implementation Sequence',
      paragraphs: [
        `Treat implementation as a phased rollout, not a one-day setup. Start with ${page.implementationSteps[0].toLowerCase()} and keep early checkpoints short — 15 minutes maximum.`,
        `Then move to ${page.implementationSteps[1].toLowerCase()} only after the first step is stable. This sequencing creates momentum and gives each household member time to adapt before the next layer arrives.`,
        `The full sequence — ${page.implementationSteps.join(', ').toLowerCase()} — is designed to build incrementally so no single week feels like a complete overhaul.`,
      ],
      highlights: page.implementationSteps,
    },
    {
      title: 'Risk Control and Failure Prevention',
      paragraphs: [
        `Most household systems break at handoffs and review gaps — not at the point of initial setup. Address those early using risk controls like ${page.commonPitfalls[0].toLowerCase()}.`,
        meta.closing,
        `Use the pitfall list below as your weekly failure-prevention checklist. Review it at the same time as your household reset so it becomes part of the routine rather than a reactive tool.`,
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
        readMinutes: estimateReadMinutes([page.systemDesign, page.implementationSteps, page.commonPitfalls]),
      }}
      bestFor={page.bestFor}
      primaryCta={{ label: 'Use This System', href: '/onboarding' }}
      outcomes={[page.systemDesign[0], page.implementationSteps[0], page.commonPitfalls[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Pitfall Avoidance and Flexibility"
      flexibilityItems={page.commonPitfalls}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: `More ${config.hubLabel}`,
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
        description:
          'Save this workflow to your dashboard, assign ownership, and coordinate it with your full household plan.',
        primary: { label: 'Start Free Trial', href: '/onboarding' },
        secondary: { label: 'Browse More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'System design details', items: page.systemDesign },
        { title: 'Implementation details', items: page.implementationSteps },
      ]}
    />
  );
}

// ─── Config objects ───────────────────────────────────────────────────────────

const choreConfig: OperationsConfig = {
  hubTitle: 'Family Chore System Guides',
  hubMetaTitle: 'Family Chore Systems | Chore Charts, Ownership & Accountability | Home Harmony',
  hubMetaDescription:
    'Stop running your household on reminders and good intentions. Browse 5 practical family chore system guides — dual-working-parent setups, young kids, teen accountability, blended families, and small homes — each built for a specific household type.',
  hubDescription:
    'Structured chore systems for real households — with ownership design, completion standards, and accountability loops built in from day one.',
  hubKeywords: [
    'family chore system',
    'chore chart family',
    'household chore system with ownership',
    'chore accountability system family',
    'weekly chore system family',
  ],
  hubPath: '/chore-systems',
  hubLabel: 'Chore Systems',
  notFoundLabel: 'Chore guide',
  pages: choreSystemPages,
  heroImage: '/seo/chore-systems.jpg',
  primerTitle: 'How to Roll Out a Chore System That Actually Sticks',
  primerIntro:
    'Chore systems fail when assignments are vague, ownership is shared without being named, or the system is launched all at once. Start with clear ownership, visible completion standards, and one weekly reset ritual.',
  primerItems: [
    {
      title: 'Define non-negotiable daily standards first',
      description:
        'Identify the minimum daily reset tasks and name an owner for each. Vague standards and shared ownership are where most chore systems quietly break down.',
    },
    {
      title: 'Separate daily resets from deep-clean responsibilities',
      description:
        'Daily chores and occasional heavy tasks require different ownership and scheduling. Blending them in one lane creates consistent overload.',
    },
    {
      title: 'Build accountability loops into the system',
      description:
        'Track completion and review misses weekly so expectations stay visible and objective rather than relying on memory and reminders.',
    },
    {
      title: 'Stabilize execution before adding rewards or complexity',
      description:
        'Consistent basic execution is the prerequisite for anything more elaborate. A simple system that runs reliably beats a sophisticated one that does not.',
    },
  ],
};

const taskConfig: OperationsConfig = {
  hubTitle: 'Family Task System Guides',
  hubMetaTitle: 'Family Task Management Systems | Priority, Ownership & Weekly Review | Home Harmony',
  hubMetaDescription:
    'Stop losing track of what matters most. Browse 5 household task management frameworks — priority lanes, couples and kids systems, ADHD-friendly setups, admin batching, and travel-week protocols — each built for a specific family operating challenge.',
  hubDescription:
    'Household task management frameworks that reduce mental load, keep priority visible, and ensure the right work gets done each week.',
  hubKeywords: [
    'family task management system',
    'household task tracker priority',
    'shared family to do system',
    'weekly household task management',
    'family task ownership system',
  ],
  hubPath: '/task-systems',
  hubLabel: 'Task Systems',
  notFoundLabel: 'Task guide',
  pages: taskSystemPages,
  heroImage: '/seo/task-systems.jpg',
  primerTitle: 'How to Build a Family Task System That Reduces Mental Load',
  primerIntro:
    'Task systems work when priority, ownership, and deadlines are visible at a glance. The goal is not a comprehensive list — it is a system where everyone knows what matters most this week without asking.',
  primerItems: [
    {
      title: 'Define a small weekly priority set',
      description:
        'Limit high-priority tasks to three or fewer so critical work is clear and actionable rather than buried in a long list.',
    },
    {
      title: 'Assign one owner per task',
      description:
        'Shared ownership produces silent drops. Named ownership with a named backup is the minimum viable accountability structure.',
    },
    {
      title: 'Use recurring templates for repeat work',
      description:
        'Automate recurring household tasks instead of rewriting them each week — which is where most task systems lose time.',
    },
    {
      title: 'Review completion patterns weekly',
      description:
        'Adjust deadlines and ownership based on what consistently slips, not based on what looks reasonable in theory.',
    },
  ],
};

const workoutConfig: OperationsConfig = {
  hubTitle: 'Workout Tracking Guides',
  hubMetaTitle: 'Workout Tracking Systems | Strength, Cardio & Family Schedule | Home Harmony',
  hubMetaDescription:
    'Stop starting over every time life gets busy. Browse 5 workout tracking systems for parents — beginner strength, home gym, hypertrophy, couples planning, and fat-loss cardio — each built around realistic family schedules and variable availability.',
  hubDescription:
    'Workout planning and tracking systems that fit real family schedules, support progression, and survive the weeks when life does not cooperate.',
  hubKeywords: [
    'workout tracker family schedule',
    'fitness tracker for parents',
    'strength training tracker busy parents',
    'workout tracking system family',
    'workout planning system parents',
  ],
  hubPath: '/workout-tracking',
  hubLabel: 'Workout Tracking',
  notFoundLabel: 'Workout guide',
  pages: workoutTrackingPages,
  heroImage: '/seo/workout-tracking.jpg',
  primerTitle: 'How to Keep Training Consistent Around a Family Schedule',
  primerIntro:
    'Workout consistency with a family schedule comes from designing for your worst week, not your best one. Build the minimum viable training template first, then scale volume when availability allows.',
  primerItems: [
    {
      title: 'Set a minimum weekly session target first',
      description:
        'Pick a session count you can hit even on your most constrained weeks — then optimize from that floor upward.',
    },
    {
      title: 'Use templated session structures',
      description:
        'Pre-planned sessions eliminate the decision overhead that prevents training from starting on busy days.',
    },
    {
      title: 'Track progress with three simple metrics',
      description:
        'Completion rate, load progression on key movements, and recovery readiness cover the essential signals without creating logging overhead.',
    },
    {
      title: 'Treat training as part of the family calendar',
      description:
        'Training sessions that are scheduled like appointments happen consistently. Training sessions that require finding time do not.',
    },
  ],
};

const lifestyleConfig: OperationsConfig = {
  hubTitle: 'Lifestyle Tracking Guides',
  hubMetaTitle: 'Lifestyle Tracking Systems | Sleep, Cycle, Habits & Family Wellness | Home Harmony',
  hubMetaDescription:
    'Stop tracking habits in isolation. Browse 5 practical lifestyle tracking frameworks — sleep routines, cycle-aware planning, alcohol moderation, family wellness dashboards, and habit streaks — each designed for sustainable household use.',
  hubDescription:
    'Practical lifestyle tracking systems for sleep, cycle awareness, alcohol habits, and family wellness — built for real households, not ideal conditions.',
  hubKeywords: [
    'lifestyle tracking system family',
    'family sleep tracker',
    'household wellness tracking',
    'habit tracking system family',
    'cycle tracking household planning',
  ],
  hubPath: '/lifestyle-tracking',
  hubLabel: 'Lifestyle Tracking',
  notFoundLabel: 'Lifestyle guide',
  pages: lifestyleTrackingPages,
  heroImage: '/seo/lifestyle-tracking.jpg',
  primerTitle: 'How to Track Lifestyle Habits Without Burnout',
  primerIntro:
    'Lifestyle tracking works when it focuses on a small number of high-impact habits and uses weekly review rather than daily pressure. Start narrow, measure trends, and adjust deliberately.',
  primerItems: [
    {
      title: 'Pick one or two lead habits per person',
      description:
        'Tracking everything at once produces data but not behavior change. Focus on the one or two habits that most directly affect household function.',
    },
    {
      title: 'Define concrete success thresholds',
      description:
        'Vague goals like "sleep better" cannot be tracked. Define specific targets — in bed by 10:30, eight hours minimum — that produce a clear yes or no each day.',
    },
    {
      title: 'Review trends weekly, not daily',
      description:
        'Daily tracking data is noise. Weekly trend review produces the signal — and prevents the reactive behavior changes that undermine long-term progress.',
    },
    {
      title: 'Attach tracking to existing daily anchors',
      description:
        'Habit tracking that requires a separate dedicated moment to complete rarely survives a busy week. Attach logging to an existing routine that already happens.',
    },
  ],
};

// ─── Exported page components ─────────────────────────────────────────────────

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
