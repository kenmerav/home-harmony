import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { groceryListPages } from '@/data/seoContent';
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
// faqUnique   – one page-specific FAQ that couldn't apply to any other guide

const groceryMeta: Record<
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
  'weekly-grocery-list-kid-friendly-dinners-family-of-4': {
    keywords: [
      'weekly grocery list family of 4',
      'kid friendly dinner grocery list',
      'family of 4 grocery list for dinners',
      'weekly shopping list for family meals',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Consolidated seven-night shopping plan for a family of four with quantity rollups and kid-approved staples built in.',
    hubOutcome:
      'Keep core kid-approved items fixed and vary only one experimental ingredient per week.',
    intro:
      'This list logic is tuned for family-of-four dinner volume where kid acceptance and repeat purchases drive outcomes. Rather than rebuilding from scratch each week, the system locks your proven staples and flags only the variable items that change with your meal rotation.',
    closing:
      'Keep your core kid-approved items fixed and vary only one experimental item each week. Stability in the basket produces stability at the dinner table.',
    faqUnique: {
      question: 'How do I avoid overbuying produce when kids only eat a few specific vegetables?',
      answer:
        'Buy only the two or three vegetables your kids reliably eat in the quantity needed for the week. Add one new vegetable in a small quantity as an optional side — if it goes unused, remove it next week. Produce waste almost always comes from aspirational buying, not intentional meal planning.',
    },
  },

  'high-protein-meal-prep-shopping-list': {
    keywords: [
      'high protein meal prep shopping list',
      'protein meal prep grocery list',
      'high protein grocery list weekly',
      'meal prep shopping list for muscle gain',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Grocery rollup anchored by protein-first purchasing with practical substitution and per-serving cost controls.',
    hubOutcome:
      'Review protein-per-serving weekly and remove low-yield items that increase prep without nutritional return.',
    intro:
      'This page prioritizes protein density per dollar while keeping prep flow straightforward for repeat use. The anchor logic is protein first — quantities, costs, and storage decisions all flow from your protein selection, not the other way around.',
    closing:
      'Review protein-per-serving weekly and remove low-yield items that increase prep without impact. Simplifying the protein lane simplifies the entire list.',
    faqUnique: {
      question: 'How do I avoid spending too much on protein without sacrificing weekly prep quality?',
      answer:
        'Rotate between two protein tiers each week: one premium option (salmon, lean beef) and one value option (ground turkey, eggs, canned fish). This keeps total weekly protein spend controlled while preventing meal fatigue. Bulk-buy the value protein and freeze in meal-sized portions to further reduce per-serving cost.',
    },
  },

  'budget-grocery-rollup-for-mixed-breakfast-and-dinner-plan': {
    keywords: [
      'budget grocery list breakfast and dinner',
      'combined breakfast dinner grocery list family',
      'budget weekly shopping list breakfast dinner',
      'family grocery rollup breakfast and dinner plan',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Unifies breakfast and dinner shopping into one basket so shared staples reduce both cost and planning overlap.',
    hubOutcome:
      'Use one shared ingredient spine across meals to lower both cost and weekly planning friction.',
    intro:
      'This framework merges breakfast and dinner planning into one basket so spend is managed at the household level. Ingredients like eggs, yogurt, onions, and rice appear in both meal tracks — buying them once and routing them to multiple meals is where budget control actually happens.',
    closing:
      'Use one shared ingredient spine across meals to lower both cost and planning friction. The more overlap between your breakfast and dinner staples, the lower your weekly basket complexity.',
    faqUnique: {
      question: 'How do I prevent breakfast items from quietly inflating the weekly grocery total?',
      answer:
        'Set a fixed breakfast basket before adding dinner items and treat it as a budget cap, not an estimate. Use repeatable modular breakfasts — oats, eggs, yogurt, fruit — that share ingredients with dinner recipes. Specialty breakfast items with no dinner crossover are usually where the spend creep happens.',
    },
  },

  'gluten-free-weekly-shopping-list-with-substitutions': {
    keywords: [
      'gluten free weekly grocery list',
      'gluten free shopping list with substitutions',
      'gluten free family grocery list',
      'weekly gluten free shopping plan',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Pre-solves gluten-free substitutions before checkout so weeknight cooking never stalls on a missing ingredient.',
    hubOutcome:
      'Lock gluten-free swaps in advance and preserve the same meal structure week to week.',
    intro:
      'This list is built to reduce gluten-free substitution stress before checkout, not during weeknight cooking. The framework separates strict gluten-free staples from naturally gluten-free whole foods, then builds a reusable substitution table so the same decisions do not get made twice.',
    closing:
      'Lock your gluten-free swaps in advance and preserve the same meal structure week to week. The more your substitution rules become automatic, the faster your weekly list runs.',
    faqUnique: {
      question: 'How do I keep a gluten-free grocery list from becoming significantly more expensive than a standard one?',
      answer:
        'Anchor the list on naturally gluten-free whole foods — rice, potatoes, corn tortillas, legumes, meat, eggs, vegetables — rather than specialty packaged substitutes. Gluten-free pasta, bread, and crackers are the high-cost items; minimize them and build meals that do not require them. Specialty products should fill gaps, not lead the list.',
    },
  },

  'double-recipe-grocery-list-for-large-batch-weeks': {
    keywords: [
      'double recipe grocery list',
      'large batch cooking grocery list',
      'meal prep double batch shopping list',
      'bulk cooking grocery list family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Handles quantity scaling cleanly so large-batch weeks avoid overbuying, unit mismatches, and second grocery trips.',
    hubOutcome:
      'Audit perishables first and freeze-ready items second when doubling — protect usage before you scale.',
    intro:
      'This page supports heavy batch weeks where quantity errors create waste, missed meals, or second trips. The key step is applying meal multipliers before consolidation — not after — so ingredient totals are accurate before a single item goes in the cart.',
    closing:
      'When doubling recipes, audit perishables first and freeze-ready items second to protect usage. A second grocery trip on a batch week costs more time than the batch itself saves.',
    faqUnique: {
      question: 'Which recipes are worth doubling and which should stay single-batch?',
      answer:
        'Double only meals with strong reheat quality: soups, chilis, slow cooker mains, baked pasta dishes, and meatball-based meals. Avoid doubling anything with delicate textures that degrade after one day — fish, stir-fries, anything with fresh greens. The test is simple: if you would eat the leftover without hesitation, it is worth doubling.',
    },
  },

  'costco-weekly-grocery-list-for-family-meal-prep': {
    keywords: [
      'Costco grocery list family meal prep',
      'warehouse store grocery list family',
      'Costco weekly shopping list family',
      'bulk grocery list for family meal planning',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Warehouse-club shopping strategy that reduces unit cost without overbuying perishables your household cannot consume.',
    hubOutcome:
      'Buy bulk only where your household has proven weekly consumption and real freezer capacity.',
    intro:
      'This guide is structured for warehouse-store buying where pack size and storage planning matter as much as price. Buying bulk only saves money if the quantity maps to actual weekly use — otherwise the savings go in the trash with the unused product.',
    closing:
      'Buy bulk only where your household has proven weekly consumption and freezer capacity. Run two weeks of your normal list before your first warehouse trip so you know what volume you actually need.',
    faqUnique: {
      question: 'What is actually worth buying in bulk at Costco for family meal prep versus what to skip?',
      answer:
        'Buy in bulk: proteins you freeze immediately (chicken, ground beef, salmon), pantry staples with long shelf lives (olive oil, rice, canned tomatoes, dried beans), and high-frequency dairy like Greek yogurt and eggs. Skip bulk on: fresh produce unless you have a plan for all of it within 3–4 days, bread products, and specialty items without a clear multi-recipe destination.',
    },
  },

  'summer-no-cook-lunch-and-dinner-grocery-list': {
    keywords: [
      'no cook grocery list summer',
      'summer no cook meal grocery list',
      'no cook lunch and dinner shopping list',
      'heat free meal grocery list summer family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Heat-free grocery framework for summer weeks — high protein, low stove time, and minimal evening effort.',
    hubOutcome:
      'Use short-shelf-life produce early in the week and stable proteins later to prevent mid-week waste.',
    intro:
      'This list is designed for hot weeks when no-cook meals improve adherence and reduce evening energy load. The structure sequences perishables by shelf life so the freshest items get used first and the stable staples — rotisserie chicken, canned fish, yogurt — carry the back half of the week.',
    closing:
      'Prioritize short shelf-life produce first in the week and stable proteins later. A no-cook week still needs a sequencing plan or the produce spoils before the meals happen.',
    faqUnique: {
      question: 'How do I hit protein targets without cooking anything during a no-cook week?',
      answer:
        'Rotisserie chicken, canned tuna and salmon, Greek yogurt, cottage cheese, hard-boiled eggs (pre-made), and deli turkey are your primary tools. Build every lunch and dinner around at least one of these. Pair with produce, a grain component (microwave rice packs, wraps, crackers), and a sauce — assembly only, no heat required.',
    },
  },

  'instacart-family-grocery-list-with-substitution-logic': {
    keywords: [
      'Instacart grocery list family',
      'grocery delivery list family meals',
      'Instacart family meal plan shopping list',
      'grocery delivery substitution planning family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Delivery-optimized grocery strategy with pre-set substitution rules so bad swaps do not break the week\'s dinners.',
    hubOutcome:
      'Set preferred replacement rules once so your orders stay usable without manual correction after every delivery.',
    intro:
      'This framework is optimized for app-based ordering where substitution quality determines dinner reliability. Unlike in-store shopping where you adapt in real time, delivery orders require all substitution decisions to be made upfront — or you accept whatever the shopper chooses.',
    closing:
      'Set preferred replacement rules once so your orders stay useful without manual correction. The time saved on delivery is lost immediately if every order requires post-delivery damage control.',
    faqUnique: {
      question: 'Which grocery items should I mark as "no substitution" in a delivery order?',
      answer:
        'Mark as no-substitute: core allergen items, key sauces where the specific product is essential to the recipe, and any ingredient that is the single point of failure for a meal (e.g. the protein in a one-protein week). Everything else can have a pre-approved backup. A short "no-sub" list is more useful than trying to control every item.',
    },
  },

  'minimal-fridge-space-weekly-grocery-list': {
    keywords: [
      'grocery list limited fridge space',
      'small fridge weekly shopping list family',
      'apartment grocery list limited refrigeration',
      'weekly grocery list small kitchen family',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Compact-storage grocery framework that maximizes meal output per shelf inch while minimizing mid-week spoilage.',
    hubOutcome:
      'Sequence meals by perishability so nothing blocks fridge space — or goes bad — in the middle of the week.',
    intro:
      'This page fits households that need full-week coverage with limited refrigeration and strict storage turnover. The planning model prioritizes shelf-stable and frozen items as the backbone, with fresh perishables used only in the first half of the week.',
    closing:
      'Sequence your meals by perishability so nothing blocks fridge space midweek. A meal sequenced wrong wastes both the ingredient and the storage slot it occupied.',
    faqUnique: {
      question: 'How do I run a full week of family dinners with only a small apartment fridge?',
      answer:
        'Use a two-wave approach: shop fresh produce and proteins for Monday through Wednesday only, then restock Thursday for the back half of the week. Lean heavily on frozen proteins, canned goods, and shelf-stable starches as your base. This keeps fridge load low on any given day and eliminates the mid-week spoilage that happens when a full week of perishables competes for limited space.',
    },
  },

  'anti-waste-weekly-grocery-list-for-families': {
    keywords: [
      'anti waste grocery list family',
      'reduce food waste grocery list',
      'zero waste weekly shopping list family',
      'family grocery list to reduce food waste',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Waste-reduction grocery framework that maps every ingredient to at least two meals before anything goes in the cart.',
    hubOutcome:
      'Track what gets discarded each week and shrink only those categories first — not the whole list.',
    intro:
      'This guide is built to cut household food waste through quantity planning and leftover routing before checkout. The core rule is simple: no ingredient enters the cart without a clear two-meal destination. If you cannot name two uses for it, buy less or skip it.',
    closing:
      'Track what gets discarded each week and shrink only those categories first. Broad restriction rarely reduces waste — targeted category reduction does.',
    faqUnique: {
      question: 'What are the most common food waste triggers in family grocery shopping and how do I fix them?',
      answer:
        'The top three are: (1) fresh herbs bought for one recipe with no second use — fix by buying dried or buying one small bunch shared across multiple meals; (2) produce bought in full-size bags when only a portion is needed — fix by buying loose or halving the quantity; (3) proteins portioned wrong for the number of people eating — fix by checking your actual household serving count before purchase, not the package serving size.',
    },
  },

  'aldi-budget-grocery-list-for-7-family-dinners': {
    keywords: [
      'Aldi grocery list family dinners',
      'Aldi weekly shopping list family',
      'budget grocery list 7 dinners family',
      'cheap weekly grocery list family Aldi',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Value-first weekly list built around Aldi pricing and a small high-utility ingredient set for seven dinners.',
    hubOutcome:
      'Keep your Aldi core staples fixed week to week and rotate flavor profiles, not entire ingredients.',
    intro:
      'This list strategy targets low-cost weekly dinner coverage using a limited but high-utility item set. Aldi shopping works best when you lead with the store\'s strongest categories — proteins, produce, and dairy — and avoid specialty or international items where selection is unpredictable.',
    closing:
      'Keep your Aldi core list fixed and rotate flavors, not entire ingredients. Sauce and seasoning variety produces dinner variety without changing your basket.',
    faqUnique: {
      question: 'How do I plan a full week of family dinners at Aldi without running out of key items mid-week?',
      answer:
        'Build your list around Aldi\'s consistent weekly staples rather than ALDI Finds, which are limited and unpredictable. Anchor on chicken, ground turkey or beef, eggs, rice, potatoes, and frozen vegetables — all reliably stocked. Add one fresh produce selection that is clearly abundant that week. Avoid building a meal plan that depends on a specialty item being in stock; always have a pantry-based fallback dinner.',
    },
  },

  'postpartum-support-grocery-list-for-easy-family-meals': {
    keywords: [
      'postpartum grocery list',
      'easy grocery list postpartum family',
      'postpartum meal planning grocery list',
      'simple grocery list new baby family meals',
    ],
    publishedAt: '2026-02-21',
    modifiedAt: '2026-02-21',
    hubTeaser:
      'Low-friction grocery framework for postpartum households — prioritizes recovery staples, minimal decisions, and reliable family dinners.',
    hubOutcome:
      'Choose convenience where it protects rest, and simplify meal expectations deliberately during this season.',
    intro:
      'This page emphasizes low-lift meals and recovery-supportive staples during postpartum scheduling volatility. The goal is not optimization — it is maintaining consistent nutrition for the whole household with the minimum viable amount of planning and cooking effort.',
    closing:
      'Choose convenience where it preserves rest, and simplify meal expectations for this season. A simple repeated meal that actually happens beats an optimized plan that requires energy you do not have.',
    faqUnique: {
      question: 'How do I set up a postpartum grocery system that a partner or family member can run independently?',
      answer:
        'Create a single fixed list of 12–15 items that covers your most reliable weekly meals — tape it to the fridge or share it as a notes link. Label which items are urgent (proteins, fresh produce) versus can wait (pantry restocks). Anyone who offers to help can run the list without needing a full briefing. Simplicity in the list design is what makes outside help actually usable.',
    },
  },
};

// ─── FAQ builder ─────────────────────────────────────────────────────────────

function buildGroceryFaq(page: (typeof groceryListPages)[number]) {
  const meta = groceryMeta[page.slug];
  return [
    {
      question: `How do I keep "${page.title}" accurate and useful week after week?`,
      answer: `${meta.intro} Lock your meal plan first, then run your list consolidation using ${page.listStrategy[0].toLowerCase()}. Changing meals after the list is built is the most common source of inaccuracy.`,
    },
    {
      question: 'What is the fastest way to lower total grocery spend with this guide?',
      answer: `Apply ${page.costControls[0].toLowerCase()} first, then layer in ${page.costControls[1].toLowerCase()} after your first full shopping cycle. Stacking too many cost controls at once makes it hard to know which change actually reduced spend.`,
    },
    {
      question: 'How do I handle substitutions without dinner execution falling apart?',
      answer: `${meta.closing} Pre-approve a fallback rule like "${page.substitutionRules[0].toLowerCase()}" before you shop so swaps stay predictable when availability changes.`,
    },
    meta.faqUnique,
  ];
}

// ─── Hub page ─────────────────────────────────────────────────────────────────

export function GroceryHubPage() {
  useSeoMeta({
    title: 'Family Grocery List Guides | Meal Prep Shopping & Budget Planning | Home Harmony',
    description:
      'Stop overbuying and under-planning. Browse 12 family grocery list frameworks — kid-friendly dinner rollups, high-protein prep lists, budget shopping guides, and delivery-optimized strategies built for real weekly routines.',
    keywords: [
      'family grocery list',
      'weekly grocery list for families',
      'meal prep shopping list',
      'budget grocery list family',
      'grocery list rollup by meal plan',
      'family shopping list planner',
    ],
    image: '/seo/grocery-lists.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Grocery Lists', url: '/grocery-lists' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <h1 className="font-display text-4xl">Family Grocery List Guides</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Each guide below is built around a specific household constraint — budget, storage, delivery, dietary needs, or batch size. Pick the one that matches your biggest weekly friction point.
        </p>
      </div>
      <SeoHubPrimer
        title="How to Use These Grocery Guides"
        intro="A grocery list is only as good as the meal plan behind it. Lock your meals first, then use these guides to consolidate quantities, control cost, and pre-approve substitutions."
        items={[
          {
            title: 'Finalize meals before building the list',
            description:
              'Lock weekly meals before generating your list so quantities are accurate and not constantly shifting as plans change.',
          },
          {
            title: 'Normalize ingredients before checkout',
            description:
              'Merge ingredient names and units to prevent duplicate purchases — two recipes using "chicken breast" and "chicken" should produce one line item.',
          },
          {
            title: 'Pre-approve substitutions',
            description:
              'Document fallback items for frequently unavailable products before you shop, not after the delivery arrives or you are standing in the aisle.',
          },
          {
            title: 'Review basket quality weekly',
            description:
              'Track overbuy categories, produce waste, and per-serving cost trends so the list improves over time instead of repeating the same gaps.',
          },
        ]}
      />
      <div className="grid gap-5 md:grid-cols-2">
        {groceryListPages.map((page) => {
          const meta = groceryMeta[page.slug];
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
                {/* hubTeaser is distinct from detail-page intro to avoid duplicate content */}
                <p className="mt-2 text-sm text-muted-foreground">{meta?.hubTeaser || page.description}</p>
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Best fit
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{page.focus}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Key outcome: {meta?.hubOutcome || page.listStrategy[0]}
                  </p>
                </div>
                <Link to={`/grocery-lists/${page.slug}`} className="mt-4 inline-block">
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

// ─── Detail page ──────────────────────────────────────────────────────────────

export function GroceryDetailPage() {
  const { slug } = useParams();
  const page = groceryListPages.find((item) => item.slug === slug);
  const meta = page ? groceryMeta[page.slug] : null;
  const detailedFaq = page ? buildGroceryFaq(page) : [];

  useSeoMeta({
    title: page ? `${page.title} | Home Harmony` : 'Grocery Lists | Home Harmony',
    description: page?.description || 'Consolidated grocery rollup guide from Home Harmony.',
    // Unique keywords per page matched to specific search intent
    keywords: meta?.keywords || ['family grocery list', 'weekly shopping list', 'meal prep grocery list'],
    image: page?.heroImage || '/seo/grocery-lists.jpg',
    publishedTime: meta?.publishedAt || '2026-02-21',
    modifiedTime: meta?.modifiedAt || '2026-02-21',
    breadcrumbs: page
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Grocery Lists', url: '/grocery-lists' },
          { name: page.title, url: `/grocery-lists/${page.slug}` },
        ]
      : [],
    faq: detailedFaq,
  });

  if (!page || !meta) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Grocery guide not found</h1>
        <Link to="/grocery-lists" className="mt-4 inline-block">
          <Button variant="outline">Back to Grocery Guides</Button>
        </Link>
      </SeoShell>
    );
  }

  const actionPlanSteps = [
    `Clarify your weekly shopping focus first: ${page.focus}`,
    `Run the list consolidation method before adding to cart: ${page.listStrategy[0]}`,
    `Apply one cost-control lever this week: ${page.costControls[0]}`,
    `Set your primary substitution fallback before checkout: ${page.substitutionRules[0]}`,
  ];

  const editorialBlocks = [
    {
      title: 'Start With a Clear Shopping Objective',
      intro: page.focus,
      paragraphs: [
        meta.intro,
        `A clean grocery system starts with a single weekly focus. When the objective is vague, basket sprawl and duplicate purchases increase — and so does the chance of a mid-week ingredient gap.`,
        `This page is designed so your list logic produces the same reliable outcome every week. ${page.listStrategy[0]} and ${page.listStrategy[1].toLowerCase()} are the two consolidation steps that prevent the most common errors.`,
      ],
      highlights: [page.focus, ...page.listStrategy.slice(0, 2)],
    },
    {
      title: 'Consolidation and Cost Control Workflow',
      paragraphs: [
        `Before checkout, work through this sequence: ${page.listStrategy[0].toLowerCase()}, then ${page.listStrategy[1].toLowerCase()}. Consolidating quantities before applying cost controls prevents you from cutting items you actually need.`,
        `After consolidation, apply budget controls in order: ${page.costControls[0].toLowerCase()} and ${page.costControls[1].toLowerCase()}. Running cost controls last means you only cut from the accurate total, not an inflated draft.`,
        `The third cost lever — ${page.costControls[2].toLowerCase()} — is optional this week. Layer it in after the first two are running consistently.`,
      ],
      highlights: [...page.listStrategy, ...page.costControls],
    },
    {
      title: 'Substitution Rules That Keep the Plan Stable',
      paragraphs: [
        `Out-of-stock items should not break dinner execution. Pre-approved substitutions keep your meal plan usable without adding decision load on the day of cooking.`,
        meta.closing,
        `Use the swap rules below as your default fallback logic. Review them once per month and update any that consistently produce worse outcomes than the original item.`,
      ],
      highlights: page.substitutionRules,
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Grocery Lists', href: '/grocery-lists' },
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
        readMinutes: estimateReadMinutes([page.listStrategy, page.costControls, page.substitutionRules]),
      }}
      bestFor={page.focus}
      primaryCta={{ label: 'Use This System', href: '/signin' }}
      outcomes={[page.listStrategy[0], page.costControls[0], page.substitutionRules[0]]}
      howItWorks={actionPlanSteps}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Substitution Rules"
      flexibilityItems={page.substitutionRules}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'More Grocery Guides',
          links: groceryListPages
            .filter((item) => item.slug !== page.slug)
            .map((item) => ({ title: item.title, href: `/grocery-lists/${item.slug}` })),
        },
        {
          title: 'Connected Planning Systems',
          links: (seoCrossLinks['/grocery-lists'] || []).map((item) => ({
            title: item.title,
            href: item.href,
            description: item.description,
          })),
        },
      ]}
      quietCta={{
        title: 'Keep Your Grocery Planning Consistent',
        description:
          'Save this workflow to your dashboard, set weekly reminders, and keep grocery lists, meal plans, and tasks aligned in one place.',
        primary: { label: 'Start Free Trial', href: '/signin' },
        secondary: { label: 'Browse More Resources', href: '/resources', variant: 'outline' },
      }}
      advancedSections={[
        { title: 'List strategy details', items: page.listStrategy },
        { title: 'Cost control details', items: page.costControls },
      ]}
    />
  );
}
