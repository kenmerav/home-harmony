import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroProps {
  startHref: string;
  onSeeHowItWorks: () => void;
  onExploreFeatures: () => void;
}

interface ModulesSectionProps {
  startHref: string;
}

interface SignupSectionProps {
  startHref: string;
}

const heroModules = [
  '🍽️ Meal Planning',
  '🧹 Chore Manager',
  '✅ Tasks & Reminders',
  '📅 Shared Calendar',
  '🛒 Smart Shopping',
  '📁 Home Docs',
];

const dashboardPanels = [
  {
    id: 'meals',
    emoji: '🍽️',
    label: 'Meals',
    title: 'Dinner plan for the week',
    rows: ['Mon · Pasta + salad', 'Tue · Taco bowls', 'Wed · Slow cooker chili', 'Thu · Sheet pan chicken'],
    footer: '🛒 23 items added to grocery list · 💵 $34 saved this week',
  },
  {
    id: 'chores',
    emoji: '🧹',
    label: 'Chores',
    title: 'Today\'s assignments',
    rows: ['✅ Empty dishwasher · Emma', '⬜ Take out trash · Dad', '⬜ Wipe counters · Jake', '⬜ Laundry fold · Mom'],
    footer: '🏆 Family leaderboard updates as chores are completed',
  },
  {
    id: 'tasks',
    emoji: '✅',
    label: 'Tasks',
    title: 'Priority tasks this week',
    rows: ['Morning routine checklist', 'School forms due Friday', 'Call pediatrician office', 'Prep lunches Sunday'],
    footer: '🔔 Smart reminders and due-date nudges',
  },
  {
    id: 'shopping',
    emoji: '🛒',
    label: 'Shopping',
    title: 'Store-ready grocery list',
    rows: ['Produce: spinach, peppers, tomatoes', 'Proteins: chicken thighs, salmon', 'Dairy: milk, eggs, yogurt', 'Pantry: rice, oats, black beans'],
    footer: '🧾 Combined quantities from all planned meals',
  },
  {
    id: 'calendar',
    emoji: '📅',
    label: 'Calendar',
    title: 'Family week at a glance',
    rows: ['Mon 3:00 PM · Soccer practice', 'Tue 9:00 AM · Dentist appointment', 'Wed 7:00 PM · Date night', 'Sat 10:00 AM · Grocery pickup'],
    footer: '🔔 Optional SMS reminders for key events and prep times',
  },
  {
    id: 'docs',
    emoji: '📁',
    label: 'Docs',
    title: 'Home document vault',
    rows: ['Insurance cards · updated', 'Car warranty · expires 2029', 'School forms · signed', 'Medical records · synced'],
    footer: '🔒 Secure document storage for your household',
  },
] as const;

const proofStats = [
  { value: '12K+', label: 'families organized' },
  { value: '6', label: 'modules in one app' },
  { value: '3 hrs', label: 'saved weekly on planning' },
  { value: '4.9 ★', label: 'family rating' },
  { value: '~10 min', label: 'to get set up' },
];

const moduleCards = [
  {
    emoji: '🍽️',
    title: 'Meal Planning',
    description:
      'Plan dinners and lunches in minutes, then auto-build grocery lists with rolled-up quantities and fewer duplicates.',
    tag: 'Lower grocery stress',
    href: '/meal-plans',
  },
  {
    emoji: '🧹',
    title: 'Chore Manager',
    description:
      'Assign recurring and one-off chores, track completion by person, and unlock extra chores only after daily tasks are done.',
    tag: 'Less nagging',
    href: '/chore-systems',
  },
  {
    emoji: '✅',
    title: 'Tasks & Reminders',
    description:
      'Capture household to-dos, assign ownership, and send reminders so important tasks stop slipping through the cracks.',
    tag: 'Fewer missed tasks',
    href: '/task-systems',
  },
  {
    emoji: '📅',
    title: 'Shared Calendar',
    description:
      'Keep school, practice, appointments, and meal timing in one planner view with reminders before important events.',
    tag: 'Fewer conflicts',
    href: '/task-systems',
  },
  {
    emoji: '🛒',
    title: 'Smart Shopping',
    description:
      'Generate cleaner grocery lists from meal plans and household staples, then sort by store and aisle for faster ordering.',
    tag: 'Faster checkout',
    href: '/grocery-lists',
  },
  {
    emoji: '📁',
    title: 'Home Systems',
    description:
      'Store templates, routines, and key household workflows in one place so your family can run the week with less friction.',
    tag: 'Organized home ops',
    href: '/household-templates',
  },
] as const;

const howItWorksSteps = [
  {
    step: '01',
    emoji: '👨‍👩‍👧‍👦',
    title: 'Tell us about your family',
    description:
      'Set up household members, preferences, and routines once so your meals, reminders, and assignments are personalized.',
  },
  {
    step: '02',
    emoji: '🎛️',
    title: 'Turn on what you need',
    description:
      'Start with the areas that feel most chaotic right now, then expand to additional modules at your own pace.',
  },
  {
    step: '03',
    emoji: '📲',
    title: 'Invite your household',
    description:
      'Each person gets a focused view while the full family plan stays coordinated from one shared system.',
  },
] as const;

const testimonials = [
  {
    quote:
      'We had five different apps and random notes. Home Harmony replaced all of it, and our evenings are finally calm.',
    name: 'Sarah M.',
    detail: 'Mom of 3 · Phoenix, AZ',
    avatar: '👩‍🦰',
  },
  {
    quote:
      'Tasks and calendar together changed everything. We are on the same page and there are way fewer surprises.',
    name: 'Jessica R.',
    detail: 'Mom of 2 · Austin, TX',
    avatar: '👩',
  },
  {
    quote:
      'Kids can see their chores, we can see meal plans, and nothing important gets lost anymore. Huge quality-of-life upgrade.',
    name: 'Marcus L.',
    detail: 'Dad of 4 · Chicago, IL',
    avatar: '👨‍🦱',
  },
] as const;

const signupPerks = [
  'Meal planning + grocery lists',
  'Chore assignment + tracking',
  'Tasks + reminders',
  'Shared calendar + reminders',
  'Smart shopping + quantity rollups',
  'Household templates + routines',
  'Invite your family with no extra setup',
];

const seoFooterGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Meal Planning', href: '/meal-plans' },
      { label: 'Chore Systems', href: '/chore-systems' },
      { label: 'Task Systems', href: '/task-systems' },
      { label: 'Grocery Planning', href: '/grocery-lists' },
      { label: 'Workout Tracking', href: '/workout-tracking' },
      { label: 'Lifestyle Tracking', href: '/lifestyle-tracking' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'All Resources', href: '/resources' },
      { label: 'Free Tools', href: '/free-tools' },
      { label: 'Template Library', href: '/templates' },
      { label: 'Household Templates', href: '/household-templates' },
      { label: 'Recipe Collections', href: '/recipe-collections' },
      { label: 'Compare Home Harmony', href: '/compare' },
    ],
  },
  {
    title: 'Get Started',
    links: [
      { label: 'Start Free', href: '/signin?onboarding=1' },
      { label: 'Sign In', href: '/signin' },
      { label: 'Getting Started Guide', href: '/getting-started' },
      { label: 'Family Dashboard', href: '/dashboard/me' },
      { label: 'Calendar Planner', href: '/calendar/planner' },
      { label: 'Meals', href: '/meals' },
    ],
  },
] as const;

export function Hero({ startHref, onSeeHowItWorks, onExploreFeatures }: HeroProps) {
  const panelIds = useMemo(() => dashboardPanels.map((panel) => panel.id), []);
  const [activePanel, setActivePanel] = useState<(typeof dashboardPanels)[number]['id']>(panelIds[0]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActivePanel((current) => {
        const index = panelIds.indexOf(current);
        return panelIds[(index + 1) % panelIds.length];
      });
    }, 2800);

    return () => window.clearInterval(timer);
  }, [panelIds]);

  const panel = dashboardPanels.find((item) => item.id === activePanel) ?? dashboardPanels[0];

  return (
    <section className="border-b border-border/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-14 pt-8 md:grid-cols-2 md:px-6 md:pb-20 md:pt-14">
        <div className="flex flex-col justify-center">
          <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            🏠 The complete household operating system
          </p>
          <h1 className="text-balance font-display text-4xl leading-tight md:text-6xl md:leading-[1.03]">
            Your home, <br />
            <span className="italic text-primary">finally running</span> <br />
            like clockwork.
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg md:leading-relaxed">
            Home Harmony brings <strong className="text-foreground">meals, chores, tasks, shopping, schedules, and family docs</strong>{' '}
            into one calm, beautiful hub. Less chaos. More together.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {heroModules.map((module) => (
              <span
                key={module}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground"
              >
                {module}
              </span>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to={startHref}>
              <Button size="lg" aria-label="Start Free - no card needed">
                Start Free - No Card Needed
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" onClick={onExploreFeatures} aria-label="Explore all features">
              Explore all features
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="ghost" size="lg" onClick={onSeeHowItWorks} aria-label="See how it works">
              See how it works
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center -space-x-2">
              {['👩', '👨', '👩‍🦱', '👨‍🦳'].map((avatar) => (
                <span
                  key={avatar}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-background bg-muted text-sm"
                >
                  {avatar}
                </span>
              ))}
            </div>
            <p>
              <span className="text-amber-500">★★★★★</span> Trusted by <strong className="text-foreground">12,000+</strong> families
            </p>
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="absolute -left-4 -top-4 z-10 rounded-xl border border-primary/20 bg-card px-3 py-2 text-xs font-semibold text-primary shadow-sm">
            ✅ Grocery list auto-generated
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="relative h-40 overflow-hidden border-b border-border">
              <img
                src="/landing/hero-family.jpg"
                alt="Family playing a board game together in a cozy living room"
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-background/10 to-transparent" />
              <p className="absolute bottom-3 left-3 text-xs font-semibold text-foreground">
                Home Harmony dashboard preview
              </p>
            </div>

            <div className="grid grid-cols-[148px_1fr]">
              <aside className="space-y-1 border-r border-border bg-muted/40 p-3">
                {dashboardPanels.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActivePanel(item.id)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium transition ${
                      item.id === activePanel
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground'
                    }`}
                  >
                    <span aria-hidden="true">{item.emoji}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </aside>

              <div className="space-y-3 p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{panel.emoji} Active Module</p>
                  <h3 className="mt-1 font-display text-lg leading-tight">{panel.title}</h3>
                </div>

                <ul className="space-y-1.5">
                  {panel.rows.map((row) => (
                    <li key={row} className="rounded-md border border-border/80 bg-background px-2 py-1.5 text-xs text-muted-foreground">
                      {row}
                    </li>
                  ))}
                </ul>

                <p className="text-xs font-medium text-primary">{panel.footer}</p>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-4 -right-4 z-10 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm">
            <p className="font-semibold text-foreground">🏠 Home running smoothly</p>
            <p className="text-muted-foreground">4 of 6 modules active</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProofBar() {
  return (
    <section className="border-b border-border/60 bg-card/40">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-7 sm:grid-cols-2 md:grid-cols-5 md:px-6">
        {proofStats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-display text-3xl font-bold text-primary">{stat.value}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ModulesSection({ startHref }: ModulesSectionProps) {
  return (
    <section id="modules" className="scroll-mt-24 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Everything under one roof</p>
          <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">
            Six modules. <span className="italic text-primary">One calm home.</span>
          </h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Every tool a family needs to run a home, working together in one place instead of scattered across different
            apps.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {moduleCards.map((card) => (
            <article
              key={card.title}
              className="group rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="text-3xl" aria-hidden="true">
                {card.emoji}
              </div>
              <h3 className="mt-4 font-display text-2xl">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.description}</p>
              <p className="mt-4 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{card.tag}</p>
              <div className="mt-5 flex items-center justify-between">
                <Link to={card.href} className="text-sm font-semibold text-primary hover:underline">
                  Learn more
                </Link>
                <ArrowRight className="h-4 w-4 text-primary transition group-hover:translate-x-1" />
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
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

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 border-y border-border/60 bg-card/40 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">How it works</p>
          <h2 className="mt-3 font-display text-4xl leading-tight md:text-5xl">Set up in 10 minutes. Calm for the week.</h2>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">
            Answer a few onboarding questions, then Home Harmony generates your first working household plan.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {howItWorksSteps.map((step) => (
            <article key={step.step} className="rounded-2xl border border-border bg-background p-6">
              <p className="font-display text-5xl leading-none text-primary/25">{step.step}</p>
              <p className="mt-3 text-3xl" aria-hidden="true">
                {step.emoji}
              </p>
              <h3 className="mt-3 font-display text-2xl">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section id="testimonials" className="scroll-mt-24 py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Real families</p>
          <h2 className="mt-3 font-display text-4xl md:text-5xl">What families are saying</h2>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <blockquote key={testimonial.name} className="relative rounded-2xl border border-border bg-card p-6">
              <p className="absolute left-4 top-3 font-display text-5xl text-primary/15" aria-hidden="true">
                “
              </p>
              <p className="relative z-10 mt-5 text-sm leading-relaxed text-muted-foreground">{testimonial.quote}</p>
              <div className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">{testimonial.avatar}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-xs text-muted-foreground">{testimonial.detail}</p>
                </div>
              </div>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

export function SignupSection({ startHref }: SignupSectionProps) {
  return (
    <section id="signup" className="scroll-mt-24 border-y border-border/60 bg-foreground py-16 text-background md:py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1.1fr_0.9fr] md:px-6">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Get started free
          </p>
          <h2 className="mt-5 font-display text-4xl leading-tight md:text-5xl">
            Your whole home, <br />
            under control. <br />
            <span className="italic text-primary">Starting today.</span>
          </h2>
          <p className="mt-4 max-w-xl text-sm text-background/70 md:text-base">
            Free to start. Core modules included. Invite your family and build your first working weekly plan.
          </p>

          <ul className="mt-6 space-y-2.5">
            {signupPerks.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-sm text-background/80">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border/60 bg-background p-6 text-foreground shadow-xl md:p-8">
          <h3 className="font-display text-3xl">Set up your home hub</h3>
          <p className="mt-2 text-sm text-muted-foreground">Join 12,000+ families. Start free and onboard in minutes.</p>

          <div className="mt-6 space-y-3">
            <Link to={startHref} className="block">
              <Button variant="outline" className="w-full justify-center" aria-label="Continue with Google">
                Continue with Google
              </Button>
            </Link>

            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or sign up with email
              <span className="h-px flex-1 bg-border" />
            </div>

            <input
              type="text"
              placeholder="Your first name"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Your first name"
            />
            <input
              type="email"
              placeholder="Email address"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Email address"
            />
            <input
              type="password"
              placeholder="Create a password"
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Create a password"
            />

            <Link to={startHref} className="block">
              <Button className="w-full" aria-label="Create my free home hub">
                Create My Free Home Hub
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>

            <p className="text-center text-xs text-muted-foreground">
              Free to start. No credit card. By signing up, you agree to terms and privacy policy.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SeoFooterLinks() {
  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.2fr_1fr_1fr_1fr] md:px-6">
        <div>
          <p className="font-display text-2xl">Home Harmony HQ</p>
          <p className="mt-3 text-sm text-background/60">
            The household operating system for modern families. Meals, chores, schedules, and routines in one place.
          </p>
        </div>

        {seoFooterGroups.map((group) => (
          <nav key={group.title} className="space-y-3" aria-label={`${group.title} links`}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-background/60">{group.title}</h3>
            <ul className="space-y-2">
              {group.links.map((item) => (
                <li key={item.href}>
                  <Link to={item.href} className="text-sm text-background/75 hover:text-primary-foreground hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-background/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-background/50 md:flex-row md:items-center md:justify-between md:px-6">
          <p>© 2026 Home Harmony HQ. All rights reserved.</p>
          <p>Built for busy families who want calmer weeks.</p>
        </div>
      </div>
    </footer>
  );
}
