import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { templatePacks, TemplateCategory } from '@/data/templateGalleryContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import { estimateReadMinutes } from '@/lib/seoContentUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { ResourcePageLayout } from './ResourcePageLayout';

const PENDING_TEMPLATE_KEY = 'homehub.pendingTemplate.v1';
const templateNarrative: Record<string, { intro: string; closing: string }> = {
  'busy-family-weeknight-system': {
    intro: 'This template is for households that need faster weeknight coordination from dinner through cleanup and next-day prep.',
    closing: 'Lock a consistent evening sequence first, then refine details after one full week.',
  },
  'lean-grocery-budget-mode': {
    intro: 'This template helps reduce grocery spend while keeping core dinner coverage stable.',
    closing: 'Track basket drift weekly and keep only rules that consistently protect budget.',
  },
  'kids-chores-points-loop': {
    intro: 'This setup is designed to make chore expectations visible and reward follow-through without constant reminders.',
    closing: 'Keep point rules simple and adjust rewards only after behavior stabilizes.',
  },
  'family-weekly-reset-board': {
    intro: 'This template centralizes the weekly reset so household planning does not leak across the entire weekend.',
    closing: 'Run the same reset cadence each week and cut steps that do not move outcomes.',
  },
  'three-day-family-fitness': {
    intro: 'This template creates a practical three-day fitness rhythm that can survive real family scheduling constraints.',
    closing: 'Protect consistency before adding volume; schedule adherence is the first win.',
  },
  'protein-water-consistency': {
    intro: 'This setup focuses on two high-impact behavior targets that are easy to track and reinforce daily.',
    closing: 'Use this template as a minimum viable wellness layer before adding extra metrics.',
  },
};

function buildTemplateFaq(pack: (typeof templatePacks)[number]) {
  const narrative = templateNarrative[pack.slug];
  return [
    {
      question: `How quickly can I launch the "${pack.title}" template?`,
      answer: `${narrative.intro} Most households can launch the core structure in one setup session, then tune details after week one.`,
    },
    {
      question: `What should I customize first in this ${pack.category.toLowerCase()} template?`,
      answer: `Start with ownership, timing, and reminder intensity. Use highlights like "${pack.highlights[0]}" as your first default.`,
    },
    {
      question: 'How do I keep this template useful long term?',
      answer: `${narrative.closing} Run a weekly review and keep only changes that improve completion and reduce planning friction.`,
    },
  ];
}

const categories: TemplateCategory[] = ['Meals', 'Grocery', 'Chores', 'Tasks', 'Fitness', 'Lifestyle'];

function savePendingTemplate(slug: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    PENDING_TEMPLATE_KEY,
    JSON.stringify({
      slug,
      savedAt: new Date().toISOString(),
    }),
  );
}

export function TemplatesHubPage() {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory | 'All'>('All');

  useSeoMeta({
    title: 'Free Family Templates | Meals, Grocery, Chores, Tasks, Fitness',
    description:
      'Browse ready-to-use family templates for meal planning, grocery workflows, chores, tasks, workouts, and lifestyle consistency.',
    keywords: [
      'family template gallery',
      'meal planning templates',
      'chore chart templates',
      'household checklist templates',
    ],
    image: '/seo/household-templates.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Templates', url: '/templates' },
    ],
  });

  const filtered = useMemo(
    () => (activeCategory === 'All' ? templatePacks : templatePacks.filter((pack) => pack.category === activeCategory)),
    [activeCategory],
  );
  const categoryContext: Record<TemplateCategory | 'All', { title: string; focus: string; outcome: string }> = {
    All: {
      title: 'Choose one template that fixes your biggest weekly bottleneck first',
      focus: 'Each template is designed as a launch-ready operating baseline, not a generic checklist.',
      outcome: 'You get a faster setup and clearer weekly execution path.',
    },
    Meals: {
      title: 'Meal templates for faster weeknight execution',
      focus: 'Use these when dinner planning takes too many decisions or prep feels scattered.',
      outcome: 'You get a repeatable meal cadence with less daily friction.',
    },
    Grocery: {
      title: 'Grocery templates for tighter basket control',
      focus: 'Use these when spend drifts or list quality breaks down.',
      outcome: 'You get cleaner shopping behavior and stronger budget consistency.',
    },
    Chores: {
      title: 'Chore templates for visible ownership and follow-through',
      focus: 'Use these when responsibilities are unclear or uneven.',
      outcome: 'You get a routine families can see, track, and sustain.',
    },
    Tasks: {
      title: 'Task templates for weekly reset and prioritization',
      focus: 'Use these when household admin work gets lost in reactive to-dos.',
      outcome: 'You get a clearer weekly action board with ownership built in.',
    },
    Fitness: {
      title: 'Fitness templates designed for real household calendars',
      focus: 'Use these when workouts are inconsistent because planning is too complex.',
      outcome: 'You get a realistic training rhythm you can maintain weekly.',
    },
    Lifestyle: {
      title: 'Lifestyle templates for daily consistency habits',
      focus: 'Use these when hydration, protein, or recovery habits keep resetting.',
      outcome: 'You get simple, trackable behavior targets that compound over time.',
    },
  };
  const activeContext = categoryContext[activeCategory];

  return (
    <SeoShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Template Gallery</p>
        <h1 className="mt-2 font-display text-4xl">Plug-and-Play Family System Templates</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          Pick a template, customize in minutes, and deploy directly into your Home Harmony workflow.
        </p>
      </div>

      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <h2 className="font-display text-2xl">Filter by category</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={activeCategory === 'All' ? 'default' : 'outline'} onClick={() => setActiveCategory('All')}>
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? 'default' : 'outline'}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-border/60 bg-card/70 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{activeCategory} focus</p>
        <h2 className="mt-2 font-display text-2xl leading-tight">{activeContext.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{activeContext.focus}</p>
        <p className="mt-2 text-sm text-muted-foreground">Expected result: {activeContext.outcome}</p>
      </section>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((pack) => (
          <article key={pack.slug} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-primary">{pack.category}</p>
            <h2 className="mt-2 font-display text-2xl">{pack.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{pack.description}</p>
            <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Best fit</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {templateNarrative[pack.slug]?.intro || pack.highlights[0]}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Outcome: {templateNarrative[pack.slug]?.closing || pack.highlights[1] || pack.highlights[0]}
              </p>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
              {pack.highlights.map((highlight) => (
                <li key={highlight}>• {highlight}</li>
              ))}
            </ul>
            <Link to={`/templates/${pack.slug}`} className="mt-5 inline-block">
              <Button variant="outline">Open Template</Button>
            </Link>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}

export function TemplateDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const pack = templatePacks.find((item) => item.slug === slug);
  const detailedFaq = pack ? buildTemplateFaq(pack) : [];

  useSeoMeta({
    title: pack ? `${pack.title} Template | Home Harmony` : 'Template | Home Harmony',
    description: pack?.description || 'Family workflow template from Home Harmony.',
    keywords: pack ? [pack.title.toLowerCase(), 'family system template', 'home management template'] : ['family template'],
    image: '/seo/household-templates.jpg',
    breadcrumbs: pack
      ? [
          { name: 'Home', url: '/' },
          { name: 'Resources', url: '/resources' },
          { name: 'Templates', url: '/templates' },
          { name: pack.title, url: `/templates/${pack.slug}` },
        ]
      : [],
    faq: detailedFaq,
  });

  if (!pack) {
    return (
      <SeoShell>
        <h1 className="font-display text-3xl">Template not found</h1>
        <Link to="/templates" className="mt-4 inline-block">
          <Button variant="outline">Back to Templates</Button>
        </Link>
      </SeoShell>
    );
  }

  const copyTemplateJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(pack.payload, null, 2));
      toast({ title: 'Template copied', description: 'Template payload copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Clipboard access failed.', variant: 'destructive' });
    }
  };

  const useTemplateInApp = () => {
    savePendingTemplate(pack.slug);
    if (user) {
      navigate('/onboarding?force=1');
      return;
    }
    navigate('/signin?onboarding=1');
  };
  const narrative = templateNarrative[pack.slug] || {
    intro: 'This template is designed for fast deployment and consistent weekly use.',
    closing: 'Start simple, review results, and expand only what improves completion.',
  };
  const editorialBlocks = [
    {
      title: 'What This Template Solves',
      intro: `${pack.category} template for faster setup and clearer execution.`,
      paragraphs: [
        narrative.intro,
        `This template reduces setup time by giving you a proven baseline. Instead of building from scratch, you start with a working structure and tune only what is specific to your household.`,
        `That approach helps teams launch faster and avoid overconfiguring features before weekly habits are stable.`,
      ],
      highlights: pack.highlights,
    },
    {
      title: 'How to Customize Without Overcomplicating',
      paragraphs: [
        `Keep edits focused on ownership, timing, and reminders first. These settings have the largest impact on real completion rates.`,
        `After one full week, review missed actions and adjust only the fields that created friction.`,
      ],
      highlights: [
        'Set clear ownership first.',
        'Lock default schedule windows.',
        'Add reminders only where completion drops.',
      ],
    },
    {
      title: 'Weekly Review and Iteration Loop',
      paragraphs: [
        `Treat this template as a living operating model. Review outcomes weekly and evolve the structure gradually rather than making large resets.`,
        narrative.closing,
        `This keeps adoption high and makes the template reusable across future planning cycles.`,
      ],
      highlights: [
        'Keep what completed without reminders.',
        'Simplify steps that were skipped twice.',
        'Promote successful routines into defaults.',
      ],
    },
  ];

  return (
    <ResourcePageLayout
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'Resources', href: '/resources' },
        { label: 'Templates', href: '/templates' },
        { label: pack.title },
      ]}
      title={pack.title}
      subtitle={pack.description}
      meta={{
        published: 'February 21, 2026',
        updated: 'February 21, 2026',
        readMinutes: estimateReadMinutes([pack.highlights, [JSON.stringify(pack.payload)]]),
      }}
      bestFor={`${pack.category} workflows that need fast setup.`}
      primaryCta={{ label: 'Use This Template', onClick: useTemplateInApp }}
      outcomes={pack.highlights}
      howItWorks={[
        'Choose this template as your baseline operating model.',
        'Customize ownership, timing, and reminders in onboarding.',
        'Run for one week and adjust only where friction appears.',
      ]}
      editorialBlocks={editorialBlocks}
      flexibilityTitle="Flexibility and Customization"
      flexibilityItems={pack.highlights}
      faq={detailedFaq}
      relatedGroups={[
        {
          title: 'Related Templates',
          links: templatePacks
            .filter((item) => item.slug !== pack.slug)
            .map((item) => ({ title: item.title, href: `/templates/${item.slug}` })),
        },
        {
          title: 'Resource Categories',
          links: [
            { title: 'Meal Plan Frameworks', href: '/meal-plans' },
            { title: 'Task Systems', href: '/task-systems' },
            { title: 'Free Tools', href: '/free-tools' },
          ],
        },
      ]}
      quietCta={{
        title: 'Deploy and Reuse Weekly',
        description: 'Save this template once, then reuse it across planning cycles with reminders and ownership built in.',
        primary: { label: 'Use in Home Harmony', onClick: useTemplateInApp },
        secondary: { label: 'Back to Templates', href: '/templates', variant: 'outline' },
      }}
      extraSection={
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-xl">Deploy This Template</h3>
            <p className="mt-2 text-sm text-muted-foreground">Save to setup flow, then customize during onboarding.</p>
            <div className="mt-4 space-y-2">
              <Button className="w-full" onClick={useTemplateInApp}>
                Use in Home Harmony
              </Button>
              <Button className="w-full" variant="outline" onClick={copyTemplateJson}>
                Copy Template JSON
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-display text-xl">Template Payload</h3>
            <pre className="mt-3 max-h-72 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              {JSON.stringify(pack.payload, null, 2)}
            </pre>
          </div>
        </div>
      }
    />
  );
}
