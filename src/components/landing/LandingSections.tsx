import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, ListChecks, ShoppingCart, UtensilsCrossed } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroProps {
  startHref: string;
  onSeeHowItWorks: () => void;
}

interface FeaturesProps {
  startHref: string;
}

interface CTAProps {
  startHref: string;
}

const seoFooterGroups = [
  {
    title: 'Planning Guides',
    links: [
      { label: 'Meal Plan Frameworks', href: '/meal-plans' },
      { label: 'Grocery List Guides', href: '/grocery-lists' },
      { label: 'Pantry Meal Guides', href: '/pantry-meals' },
      { label: 'Recipe Collections', href: '/recipe-collections' },
      { label: 'Household Templates', href: '/household-templates' },
      { label: 'Macro Plan Guides', href: '/macro-plans' },
    ],
  },
  {
    title: 'Home Systems',
    links: [
      { label: 'Chore Systems', href: '/chore-systems' },
      { label: 'Task Systems', href: '/task-systems' },
      { label: 'Workout Tracking', href: '/workout-tracking' },
      { label: 'Lifestyle Tracking', href: '/lifestyle-tracking' },
      { label: 'Template Library', href: '/templates' },
      { label: 'All Resources', href: '/resources' },
    ],
  },
  {
    title: 'Free Tools',
    links: [
      { label: 'Family Meal Plan Generator', href: '/free-tools/family-meal-plan-generator' },
      { label: 'Grocery List Combiner', href: '/free-tools/grocery-list-combiner' },
      { label: 'Macro and Protein Calculator', href: '/free-tools/macro-and-protein-calculator' },
      { label: 'Family Routine Builder', href: '/free-tools/family-routine-builder' },
      { label: 'Compare Home Harmony', href: '/compare' },
      { label: 'All Free Tools', href: '/free-tools' },
    ],
  },
];

const problemBullets = [
  'Dinner planning happens at the last second.',
  'Schedules live in five different places.',
  'Practice, school, and appointments sneak up on you.',
  'Grocery lists get forgotten or duplicated.',
  'The mental load falls on one person.',
];

const featureCards = [
  {
    icon: CalendarDays,
    title: 'Family Schedule',
    description: "Everyone's week at a glance.",
  },
  {
    icon: UtensilsCrossed,
    title: 'Meal Planning',
    description: 'Plan dinners in minutes, not hours.',
  },
  {
    icon: ShoppingCart,
    title: 'Smart Grocery Lists',
    description: 'Turn meals into a list automatically.',
  },
  {
    icon: ListChecks,
    title: 'Daily Rhythm',
    description: 'Simple routines that keep mornings and nights calm.',
  },
];

const testimonials = [
  'Our evenings feel calmer. We’re not scrambling at 5pm anymore.',
  'It’s the first tool that actually reduced my mental load.',
  'Meals + schedules in one place changed our whole week.',
];

const howItWorksSteps = [
  {
    step: 'Step 1',
    title: 'Set up your family',
  },
  {
    step: 'Step 2',
    title: 'Add meals + activities',
  },
  {
    step: 'Step 3',
    title: 'Run an easier week',
  },
];

export function Hero({ startHref, onSeeHowItWorks }: HeroProps) {
  return (
    <section className="border-b border-border/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-2 md:px-6 md:py-16">
        <div className="flex flex-col justify-center">
          <p className="mb-3 text-sm font-medium text-primary">Home Harmony</p>
          <h1 className="text-balance font-display text-4xl leading-tight md:text-5xl">
            Bring calm to your family&apos;s daily life.
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
            Home Harmony keeps meals, schedules, and routines in one simple place, so your week runs smoother and your
            home feels lighter.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={startHref}>
              <Button size="lg" aria-label="Start Free">
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" onClick={onSeeHowItWorks} aria-label="See how Home Harmony works">
              See How It Works
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {/* TODO: replace with real Home Harmony lifestyle image */}
          <img
            src="/landing/hero-family.jpg"
            alt="Family playing a board game together in a cozy living room"
            className="h-full min-h-[280px] w-full object-cover"
            loading="eager"
          />
        </div>
      </div>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
        <h2 className="font-display text-3xl md:text-4xl">If home life feels scattered, you&apos;re not alone.</h2>
        <ul className="mt-5 grid gap-3 md:grid-cols-2">
          {problemBullets.map((item) => (
            <li key={item} className="rounded-lg border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Features({ startHref }: FeaturesProps) {
  return (
    <section className="border-y border-border/60 bg-card/40 py-12">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl md:text-4xl">How Home Harmony helps</h2>
            <p className="mt-2 text-muted-foreground">Everything your household needs to stay in sync.</p>
          </div>
          <Link to={startHref}>
            <Button variant="outline">Start Free</Button>
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card) => (
            <article key={card.title} className="rounded-xl border border-border bg-background p-5">
              <card.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-display text-xl">{card.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LifestyleBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="grid gap-6 rounded-2xl border border-border bg-card p-6 md:grid-cols-[1.1fr_1fr] md:p-8">
        <div>
          <h2 className="font-display text-3xl md:text-4xl">Less chaos. More moments that matter.</h2>
          <p className="mt-3 text-muted-foreground">
            When the logistics are handled, you get your time and your energy back.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* TODO: replace with real Home Harmony lifestyle image */}
          <img
            src="/landing/usecase-family.jpg"
            alt="Couple organizing dinner plans together in the kitchen"
            className="h-28 w-full rounded-lg object-cover md:h-32"
            loading="lazy"
          />
          {/* TODO: replace with real Home Harmony lifestyle image */}
          <img
            src="/landing/usecase-mealprep.jpg"
            alt="Prepared meal containers lined up for the week"
            className="h-28 w-full rounded-lg object-cover md:h-32"
            loading="lazy"
          />
          {/* TODO: replace with real Home Harmony lifestyle image */}
          <img
            src="/landing/usecase-wellness.jpg"
            alt="Person taking a wellness break with water outdoors"
            className="col-span-2 h-28 w-full rounded-lg object-cover md:h-36"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <h2 className="font-display text-3xl md:text-4xl">Families are already feeling the difference</h2>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {testimonials.map((quote) => (
          <blockquote key={quote} className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">&ldquo;{quote}&rdquo;</p>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-border/60 bg-card/40 py-12 scroll-mt-24">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="font-display text-3xl md:text-4xl">How it works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {howItWorksSteps.map((step) => (
            <article key={step.step} className="rounded-xl border border-border bg-background p-5">
              <p className="text-sm font-medium text-primary">{step.step}</p>
              <h3 className="mt-2 font-display text-2xl">{step.title}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA({ startHref }: CTAProps) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
      <div className="rounded-2xl border border-primary/30 bg-primary/10 p-8 text-center">
        <h2 className="font-display text-3xl md:text-4xl">Make family life feel easier.</h2>
        <div className="mt-5">
          <Link to={startHref}>
            <Button size="lg" aria-label="Start Free">
              Start Free
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SeoFooterLinks() {
  return (
    <footer className="border-t border-border/60 bg-card/30">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h2 className="font-display text-2xl md:text-3xl">Explore more family planning resources</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Practical guides and tools to improve planning, reduce stress, and keep your household organized.
        </p>

        <nav aria-label="SEO resource links" className="mt-6 grid gap-6 md:grid-cols-3">
          {seoFooterGroups.map((group) => (
            <div key={group.title} className="rounded-xl border border-border bg-background p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.title}</h3>
              <ul className="mt-3 space-y-2">
                {group.links.map((item) => (
                  <li key={item.href}>
                    <Link to={item.href} className="text-sm text-foreground underline-offset-4 hover:text-primary hover:underline">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}
