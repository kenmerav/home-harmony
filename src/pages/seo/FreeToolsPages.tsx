import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Search, Share2, Wand2 } from 'lucide-react';
import { freeToolPages } from '@/data/freeToolsContent';
import { seoCrossLinks } from '@/data/seoLinkGraph';
import { useSeoMeta } from '@/lib/seo';
import {
  CATEGORY_LABELS,
  DEFAULT_QUICK_FIELD_LABELS,
  DEFAULT_QUICK_INPUTS,
  generateQuickOutput,
  getQuickToolUiConfig,
  getToolCategory,
  QUICK_INPUT_SAMPLES,
  type QuickToolField,
  type QuickToolInputs,
  type QuickToolResult,
  type ToolCategory,
  toolInputPlaceholder,
} from '@/lib/freeToolsQuickTool';
import {
  assignVariant,
  CTA_VARIANTS,
  CtaVariantId,
  recordCtaEvent as recordCtaEventStore,
} from '@/lib/freeToolsConversion';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { trackGrowthEventSafe } from '@/lib/api/growthAnalytics';
import { SeoShell } from './SeoShell';
import { ToolPageLayout } from './ToolPageLayout';

interface ToolOptimizationPack {
  quickWins: string[];
  pitfalls: string[];
  successMetrics: string[];
}

function buildSignInHref(slug: string, variant: CtaVariantId) {
  const intent = encodeURIComponent(slug);
  const ab = encodeURIComponent(variant);
  return `/onboarding?source=free-tools&intent=${intent}&ab=${ab}`;
}

const toolOptimizationMap: Record<string, ToolOptimizationPack> = {
  'family-meal-plan-generator': {
    quickWins: [
      'Lock one non-negotiable anchor night first (for example taco Tuesday).',
      'Set a prep-time cap before assigning any dinner slots.',
      'Generate week one, then only swap two meals instead of rebuilding everything.',
    ],
    pitfalls: [
      'Over-planning with seven new meals in one week usually lowers adherence.',
      'Skipping a prep-day checklist creates weeknight friction by day three.',
      'Not accounting for activity-heavy nights causes missed dinner windows.',
    ],
    successMetrics: [
      'Planned dinners executed each week.',
      'Takeout nights reduced versus prior month.',
      'Household stress level at dinner decision time.',
    ],
  },
  'grocery-list-combiner': {
    quickWins: [
      'Paste all family lists before cleaning item names so quantity rollup works correctly.',
      'Resolve conflicting units immediately (oz vs lb, cups vs ml).',
      'Group by store aisle before checkout to cut shopping time.',
    ],
    pitfalls: [
      'Combining lists with duplicate naming variants without normalization.',
      'Ignoring unresolved unit conflicts until in-store.',
      'Keeping one-off specialty items mixed into staple sections.',
    ],
    successMetrics: [
      'Duplicate items removed per order.',
      'Average in-store or pickup assembly time.',
      'Weekly grocery overspend from accidental duplicates.',
    ],
  },
  'macro-and-protein-calculator': {
    quickWins: [
      'Start with protein target adherence before optimizing carbs and fat.',
      'Keep calorie targets realistic for weekday schedule constraints.',
      'Adjust only one macro variable per week to avoid noise.',
    ],
    pitfalls: [
      'Aggressive calorie deficits that lower adherence by midweek.',
      'Frequent macro target changes that prevent trend analysis.',
      'Ignoring hydration targets while tracking nutrition.',
    ],
    successMetrics: [
      'Protein goal hit rate by week.',
      'Calorie target adherence over rolling 14 days.',
      'Energy and recovery consistency across the week.',
    ],
  },
  'chore-reward-calculator': {
    quickWins: [
      'Start with fixed daily chores before unlocking extra chore board access.',
      'Set one visible weekly prize to drive short-term engagement.',
      'Apply rewards and penalties on a consistent weekly closeout day.',
    ],
    pitfalls: [
      'Too many low-value chores that dilute motivation.',
      'Inconsistent completion verification by parents.',
      'Changing rules midweek, which reduces trust in the system.',
    ],
    successMetrics: [
      'Daily chore completion rate per child.',
      'Extra chore pickup rate after daily completion.',
      'Weekly leaderboard participation consistency.',
    ],
  },
  'pantry-meal-finder': {
    quickWins: [
      'Enter pantry inventory in broad categories first, then add specifics.',
      'Prioritize near-expiration items to reduce waste quickly.',
      'Use one replenishment mini-list for missing high-impact ingredients.',
    ],
    pitfalls: [
      'Ignoring expiration priority when generating meals.',
      'Adding too many optional ingredients that break pantry-first logic.',
      'Not updating pantry snapshots after main grocery runs.',
    ],
    successMetrics: [
      'Expired items avoided per month.',
      'Emergency grocery trips reduced.',
      'Percentage of meals using pantry-first inputs.',
    ],
  },
  'dinner-start-time-calculator': {
    quickWins: [
      'Set one target dinner time for weekdays first.',
      'Include buffer time for cleanup and serving, not just cook time.',
      'Use reminder offsets for prep and start-cooking separately.',
    ],
    pitfalls: [
      'Using recipe cook time only and skipping prep time.',
      'One reminder for all meals despite large duration differences.',
      'No buffer for school pickups, sports, or commute delays.',
    ],
    successMetrics: [
      'On-time dinner rate each week.',
      'Last-minute meal scramble frequency.',
      'Average variance from target dinner time.',
    ],
  },
  'family-routine-builder': {
    quickWins: [
      'Define must-do steps before optional steps for each routine block.',
      'Assign one owner per routine action to remove ambiguity.',
      'Pilot the routine for five days before adding complexity.',
    ],
    pitfalls: [
      'Too many routine steps for available time windows.',
      'Shared ownership of tasks without explicit accountability.',
      'No distinction between weekday and weekend cadence.',
    ],
    successMetrics: [
      'Routine completion rate by block.',
      'Morning departure on-time consistency.',
      'Number of reminder nudges required per day.',
    ],
  },
  'weekly-home-reset-checklist-generator': {
    quickWins: [
      'Schedule reset by room, not by random task list order.',
      'Spread high-effort tasks across the week to avoid burnout.',
      'Assign quick-win items first to build momentum.',
    ],
    pitfalls: [
      'Stacking all heavy reset tasks on one day.',
      'No owner assignment for shared spaces.',
      'Using the same checklist despite changing weekly load.',
    ],
    successMetrics: [
      'Weekly reset completion rate.',
      'Backlog tasks carried into next week.',
      'Time spent on home reset versus plan.',
    ],
  },
  'shared-household-task-priority-planner': {
    quickWins: [
      'Capture all open loops before priority scoring.',
      'Use urgency and impact scoring to rank objectively.',
      'Cap weekly priority board size so execution stays realistic.',
    ],
    pitfalls: [
      'Overloaded priority board with too many P1 items.',
      'Tasks assigned to multiple owners with no final accountable person.',
      'No weekly review to rebalance task load.',
    ],
    successMetrics: [
      'Top-priority completion rate each week.',
      'Task rollover volume week to week.',
      'Owner balance across recurring admin tasks.',
    ],
  },
  'family-workout-schedule-builder': {
    quickWins: [
      'Set minimum viable workout cadence before ideal cadence.',
      'Match workout intensity to realistic sleep and schedule load.',
      'Reserve fixed workout windows on calendar first.',
    ],
    pitfalls: [
      'Programming high training volume in unstable weeks.',
      'No fallback session option for busy days.',
      'Ignoring recovery markers when adjusting training load.',
    ],
    successMetrics: [
      'Planned workouts completed per week.',
      'Consistency streak length by person.',
      'Training load adherence versus target.',
    ],
  },
  'family-budget-dinner-planner': {
    quickWins: [
      'Set a hard weekly dinner budget before selecting meal themes.',
      'Use one lower-cost anchor night to stabilize spend.',
      'Pre-select two substitution rules for price spikes.',
    ],
    pitfalls: [
      'Ignoring ingredient overlap across nights.',
      'Using premium proteins every night in a constrained budget.',
      'Not reviewing total cost before the shopping run.',
    ],
    successMetrics: [
      'Total weekly dinner spend versus target.',
      'Takeout avoidance rate across budget weeks.',
      'Cost per dinner trend over 4 weeks.',
    ],
  },
  'kids-lunchbox-rotation-builder': {
    quickWins: [
      'Start with repeatable favorites first, then add one new option.',
      'Prep two components ahead on Sunday.',
      'Keep one emergency fallback lunch option ready.',
    ],
    pitfalls: [
      'Too much variety too quickly for picky eaters.',
      'No prep block before school week starts.',
      'Ignoring returned or wasted lunch patterns.',
    ],
    successMetrics: [
      'Lunchbox acceptance rate by child.',
      'Weekday morning prep time.',
      'Lunch ingredient waste reduction.',
    ],
  },
  '15-minute-school-night-dinner-filter': {
    quickWins: [
      'Use a strict max-time cap for school nights.',
      'Keep one backup dinner ready when timing slips.',
      'Choose low-cleanup meals on activity-heavy days.',
    ],
    pitfalls: [
      'Underestimating prep/cleanup time.',
      'Picking complex meals on late-arrival nights.',
      'No contingency option when schedule runs behind.',
    ],
    successMetrics: [
      'On-time dinner completion rate.',
      'School-night stress score during dinner window.',
      'Number of emergency meal pivots per week.',
    ],
  },
};

function createHubSchemas() {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://homeharmony.app';

  return [
    {
      '@type': 'CollectionPage',
      name: 'Free Home Management Tools',
      description:
        'Free family operations tools for meal planning, grocery list combining, chores, routines, nutrition targets, and workout scheduling.',
      url: `${origin}/free-tools`,
      about: freeToolPages.flatMap((tool) => tool.searchIntent).slice(0, 24),
    },
    {
      '@type': 'ItemList',
      name: 'Home Harmony Free Tool Directory',
      itemListElement: freeToolPages.map((tool, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tool.title,
        url: `${origin}/free-tools/${tool.slug}`,
      })),
    },
  ];
}

function createDetailSchemas(slug: string, title: string, description: string, workflow: string[], output: string[]) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://homeharmony.app';
  const pageUrl = `${origin}/free-tools/${slug}`;

  return [
    {
      '@type': 'WebPage',
      name: title,
      description,
      url: pageUrl,
    },
    {
      '@type': 'SoftwareApplication',
      name: title,
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'Web',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      description,
      url: pageUrl,
    },
    {
      '@type': 'HowTo',
      name: `How to use ${title}`,
      description,
      step: workflow.map((item, index) => ({
        '@type': 'HowToStep',
        position: index + 1,
        name: `Step ${index + 1}`,
        text: item,
      })),
      supply: output.map((item) => ({
        '@type': 'HowToSupply',
        name: item,
      })),
    },
  ];
}

export function FreeToolsHubPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | ToolCategory>('all');

  useSeoMeta({
    title: 'Free Family Planning Tools | Meal, Grocery, Chores, Macros, Tasks, Workouts | Home Harmony',
    description:
      'Use free home-management tools for meal planning, grocery list combining, chore rewards, routines, macro targets, and family workout scheduling.',
    keywords: [
      'free family planner tools',
      'free meal planning tools',
      'free grocery list combiner',
      'free chore chart tools',
      'free macro calculator',
      'free home management tools',
    ],
    image: '/seo/meal-plans.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Free Tools', url: '/free-tools' },
    ],
    schemas: createHubSchemas(),
  });

  const filteredTools = useMemo(() => {
    const term = query.trim().toLowerCase();
    return freeToolPages.filter((tool) => {
      const matchesCategory = category === 'all' || getToolCategory(tool.slug) === category;
      if (!matchesCategory) return false;
      if (!term) return true;
      const haystack = `${tool.title} ${tool.description} ${tool.searchIntent.join(' ')}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [category, query]);

  const categories: Array<{ id: 'all' | ToolCategory; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'meals', label: 'Meals' },
    { id: 'grocery', label: 'Grocery' },
    { id: 'nutrition', label: 'Nutrition' },
    { id: 'chores', label: 'Chores' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'fitness', label: 'Fitness' },
    { id: 'routines', label: 'Routines' },
  ];
  const categoryContext: Record<'all' | ToolCategory, { title: string; focus: string; outcome: string }> = {
    all: {
      title: 'Start with the one workflow creating the most weekly friction',
      focus: 'These tools are built for fast outputs you can use immediately.',
      outcome: 'You leave with a practical plan, checklist, or generated result in under a minute.',
    },
    meals: {
      title: 'Meal planning tools for weeknight consistency',
      focus: 'Use these when dinners feel reactive or repetitive.',
      outcome: 'You get faster meal decisions and a clearer weekly dinner structure.',
    },
    grocery: {
      title: 'Grocery tools for cleaner carts and fewer duplicates',
      focus: 'Use these when lists are messy, over-budget, or hard to execute.',
      outcome: 'You get a consolidated shopping plan with clearer quantities.',
    },
    nutrition: {
      title: 'Nutrition tools for simpler macro and protein execution',
      focus: 'Use these when tracking feels complicated or inconsistent.',
      outcome: 'You get practical targets and easier daily adherence.',
    },
    chores: {
      title: 'Chore tools for better family follow-through',
      focus: 'Use these when chores are unclear or unevenly distributed.',
      outcome: 'You get visible ownership and a more consistent completion loop.',
    },
    tasks: {
      title: 'Task tools for weekly prioritization and home resets',
      focus: 'Use these when to-do lists are scattered or stale.',
      outcome: 'You get a focused action plan with next steps already sequenced.',
    },
    fitness: {
      title: 'Fitness tools that fit real family schedules',
      focus: 'Use these when workout planning keeps getting pushed aside.',
      outcome: 'You get a workable schedule and realistic progression cadence.',
    },
    routines: {
      title: 'Routine tools for smoother mornings and evenings',
      focus: 'Use these when daily transitions feel chaotic.',
      outcome: 'You get a repeatable routine structure you can run this week.',
    },
  };
  const activeContext = categoryContext[category];
  const searchTerm = query.trim();

  return (
    <SeoShell>
      <div className="mx-auto mb-12 max-w-4xl border-b border-border/60 pb-10">
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Free Tools</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.04] tracking-tight md:text-6xl">
          Fast planning tools for real home workflows
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground md:text-xl">
          {searchTerm
            ? `Showing results for "${searchTerm}" in ${categories.find((item) => item.id === category)?.label || 'All'} tools.`
            : 'Pick a tool, fill a few fields, and get an output you can use right now.'}
        </p>
      </div>

      <section className="mx-auto mb-10 max-w-4xl rounded-2xl border border-border/60 bg-card p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools (meal plan, grocery, macros, chores...)"
              className="pl-9"
            />
          </div>
          <p className="text-sm text-muted-foreground">{filteredTools.length} tools</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((item) => (
            <Button
              key={item.id}
              variant={category === item.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </section>

      <section className="mx-auto mb-8 max-w-4xl rounded-xl border border-border/60 bg-card/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          {categories.find((item) => item.id === category)?.label || 'All'} focus
        </p>
        <h2 className="mt-2 font-display text-2xl leading-tight">{activeContext.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{activeContext.focus}</p>
        <p className="mt-2 text-sm text-muted-foreground">Expected result: {activeContext.outcome}</p>
      </section>

      <div className="mx-auto grid max-w-5xl gap-5">
        {filteredTools.map((tool) => (
          <article key={tool.slug} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="grid gap-0 md:grid-cols-[280px_1fr]">
              <img src={tool.heroImage} alt={tool.heroAlt} className="h-52 w-full object-cover md:h-full" loading="lazy" />
              <div className="p-6">
                <div className="mb-2 inline-block rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {CATEGORY_LABELS[getToolCategory(tool.slug)]}
                </div>
                <h2 className="font-display text-2xl leading-tight md:text-3xl">{tool.title.replace(/^Free\s+/i, '')}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{tool.description}</p>
                <Link to={`/free-tools/${tool.slug}`} className="mt-6 inline-block">
                  <Button>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Try This Tool
                  </Button>
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {filteredTools.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No tools matched your search. Try a broader term like meal, grocery, tasks, chores, or workouts.
        </div>
      ) : null}
    </SeoShell>
  );
}

export function FreeToolsDetailPage() {
  const { slug } = useParams();
  const tool = freeToolPages.find((item) => item.slug === slug);
  const selectedTool = tool || freeToolPages[0];
  const { toast } = useToast();
  const { user, isDemoUser } = useAuth();
  const [quickInputs, setQuickInputs] = useState<QuickToolInputs>(DEFAULT_QUICK_INPUTS);
  const [quickResult, setQuickResult] = useState<QuickToolResult | null>(null);
  const [copiedQuickResult, setCopiedQuickResult] = useState(false);

  useSeoMeta({
    title: tool ? `${tool.title} | Home Harmony` : 'Free Tool | Home Harmony',
    description: tool?.description || 'Free household planning tool from Home Harmony.',
    keywords: tool?.searchIntent || ['free family planning tool'],
    image: tool?.heroImage || '/seo/meal-plans.jpg',
    breadcrumbs: tool
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Free Tools', url: '/free-tools' },
          { name: tool.title, url: `/free-tools/${tool.slug}` },
        ]
      : [],
    faq: tool?.faq || [],
    schemas: tool
      ? createDetailSchemas(tool.slug, tool.title, tool.description, tool.workflow, tool.output)
      : undefined,
  });

  const optimizationPack = toolOptimizationMap[selectedTool.slug] || {
    quickWins: ['Define one clear weekly outcome before using the tool.'],
    pitfalls: ['Changing too many setup variables at once.'],
    successMetrics: ['Weekly completion consistency for this workflow.'],
  };
  const ctaVariant = useMemo(() => {
    const assigned = assignVariant(selectedTool.slug);
    return CTA_VARIANTS.find((variant) => variant.id === assigned) || CTA_VARIANTS[0];
  }, [selectedTool.slug]);
  const signInHref = useMemo(() => buildSignInHref(selectedTool.slug, ctaVariant.id), [selectedTool.slug, ctaVariant.id]);
  const quickToolUi = useMemo(() => getQuickToolUiConfig(selectedTool.slug), [selectedTool.slug]);

  const quickFieldMeta: Record<QuickToolField, { type: 'number' | 'time' | 'text'; min?: number }> = {
    householdSize: { type: 'number', min: 1 },
    maxMinutes: { type: 'number', min: 10 },
    weeklyBudget: { type: 'number', min: 30 },
    dinnerTime: { type: 'time' },
    focus: { type: 'text' },
    listInput: { type: 'text' },
  };
  const getQuickFieldLabel = (field: QuickToolField): string =>
    quickToolUi.fieldLabels?.[field] || DEFAULT_QUICK_FIELD_LABELS[field];
  const quickCoreFields = quickToolUi.fields.filter(
    (field): field is Exclude<QuickToolField, 'focus' | 'listInput'> => field !== 'focus' && field !== 'listInput',
  );
  const showFocusField = quickToolUi.fields.includes('focus');
  const showListField = quickToolUi.fields.includes('listInput');

  useEffect(() => {
    if (!tool) return;
    recordCtaEventStore({
      type: 'impression',
      slug: tool.slug,
      variant: ctaVariant.id,
      at: new Date().toISOString(),
    });
    if (!user?.id || isDemoUser) return;
    void trackGrowthEventSafe(
      'free_tool_impression',
      { slug: tool.slug, variant: ctaVariant.id },
    );
  }, [tool, ctaVariant.id, user?.id, isDemoUser]);

  useEffect(() => {
    setQuickInputs((prev) => ({
      ...prev,
      listInput: QUICK_INPUT_SAMPLES[selectedTool.slug] || prev.listInput,
      focus: '',
    }));
    setQuickResult(null);
    setCopiedQuickResult(false);
  }, [selectedTool.slug]);

  if (!tool) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Free tool not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The requested tool page does not exist. Use the main directory to pick a live tool.
        </p>
        <Link to="/free-tools" className="mt-4 inline-block">
          <Button variant="outline">Back to Free Tools</Button>
        </Link>
      </SeoShell>
    );
  }

  const updateQuickInput = (key: keyof QuickToolInputs, value: string) => {
    setQuickInputs((prev) => ({ ...prev, [key]: value }));
  };

  const generateQuickResult = () => {
    const result = generateQuickOutput(tool.slug, quickInputs);
    setQuickResult(result);
  };

  const useSampleInput = () => {
    setQuickInputs((prev) => ({
      ...prev,
      listInput: QUICK_INPUT_SAMPLES[tool.slug] || '',
    }));
  };

  const copyQuickResult = async () => {
    if (!quickResult) return;
    const text = [
      quickResult.summary,
      '',
      'Primary output:',
      ...quickResult.primary.map((line) => `- ${line}`),
      '',
      'Next actions:',
      ...quickResult.checklist.map((line) => `- ${line}`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopiedQuickResult(true);
      toast({ title: 'Output copied' });
      setTimeout(() => setCopiedQuickResult(false), 1800);
    } catch {
      toast({ title: 'Could not copy output', variant: 'destructive' });
    }
  };

  const quickToolCard = (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {CATEGORY_LABELS[getToolCategory(selectedTool.slug)]}
        </span>
        <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">Beginner mode</span>
      </div>
      <h2 className="font-display text-2xl leading-tight md:text-3xl">Quick Tool (60 seconds)</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">{quickToolUi.intro}</p>

      {quickCoreFields.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {quickCoreFields.map((field) => {
            const meta = quickFieldMeta[field];
            return (
              <label key={field} className="text-sm font-medium">
                {getQuickFieldLabel(field)}
                <Input
                  type={meta.type}
                  min={meta.min}
                  value={quickInputs[field]}
                  onChange={(e) => updateQuickInput(field, e.target.value)}
                  className="mt-1"
                />
              </label>
            );
          })}
        </div>
      ) : null}

      {showFocusField ? (
        <label className="mt-3 block text-sm font-medium">
          {getQuickFieldLabel('focus')}
          <Input
            value={quickInputs.focus}
            onChange={(e) => updateQuickInput('focus', e.target.value)}
            placeholder={quickToolUi.focusPlaceholder}
            className="mt-1"
          />
        </label>
      ) : null}

      {showListField ? (
        <label className="mt-3 block text-sm font-medium">
          {quickToolUi.listLabel || getQuickFieldLabel('listInput')}
          <Textarea
            value={quickInputs.listInput}
            onChange={(e) => updateQuickInput('listInput', e.target.value)}
            placeholder={toolInputPlaceholder(tool.slug)}
            className="mt-1 min-h-28"
          />
        </label>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={generateQuickResult}>
          <Wand2 className="mr-2 h-4 w-4" />
          {quickToolUi.generateLabel}
        </Button>
        {showListField ? (
          <Button variant="outline" onClick={useSampleInput}>
            {quickToolUi.sampleLabel}
          </Button>
        ) : null}
        {quickResult ? (
          <Button variant="outline" onClick={() => void copyQuickResult()}>
            {copiedQuickResult ? 'Copied' : 'Copy output'}
          </Button>
        ) : null}
      </div>

      {quickResult ? (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <p className="text-sm leading-7 font-medium">{quickResult.summary}</p>
          <p className="mt-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">{quickToolUi.outputTitle || 'Primary output'}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {quickResult.primary.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs uppercase tracking-[0.12em] text-muted-foreground">Next actions</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {quickResult.checklist.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );

  return (
    <ToolPageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Free Tools', href: '/free-tools' },
        { label: tool.title },
      ]}
      title={tool.title}
      subtitle={tool.description}
      trustSignals={['60 seconds', 'No signup required', 'Copy-ready output']}
      heroImage={tool.heroImage}
      heroAlt={tool.heroAlt}
      tool={quickToolCard}
      outputs={tool.output}
      howItWorks={tool.workflow}
      faq={tool.faq}
      softCta={{
        title: 'Save This and Reuse Weekly',
        description: ctaVariant.subcopy,
        primary: {
          label: ctaVariant.label,
          href: signInHref,
          onClick: () => {
            recordCtaEventStore({
              type: 'primary_click',
              slug: tool.slug,
              variant: ctaVariant.id,
              at: new Date().toISOString(),
            });
            if (!user?.id || isDemoUser) return;
            void trackGrowthEventSafe('free_tool_primary_click', { slug: tool.slug, variant: ctaVariant.id });
          },
        },
        secondary: { label: 'More Resources', href: '/resources', variant: 'outline' },
      }}
      relatedLinks={freeToolPages
        .filter((item) => item.slug !== tool.slug)
        .slice(0, 4)
        .map((item) => ({ title: item.title.replace(/^Free\\s+/i, ''), href: `/free-tools/${item.slug}` }))}
      advancedSections={[
        { title: 'What this tool does', items: tool.whatItDoes },
        { title: 'Quick wins', items: optimizationPack.quickWins },
        { title: 'Common pitfalls', items: optimizationPack.pitfalls },
        { title: 'What to track', items: optimizationPack.successMetrics },
        {
          title: 'Related resources',
          items: (seoCrossLinks['/free-tools'] || []).map((item) => `${item.title}: ${item.description}`),
        },
      ]}
    />
  );
}
