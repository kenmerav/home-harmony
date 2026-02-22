import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Dumbbell,
  Heart,
  MoonStar,
  ListChecks,
  ShoppingCart,
  Sparkles,
  Star,
  Wine,
  UtensilsCrossed,
} from 'lucide-react';
import { HomeHarmonyLogo } from '@/components/branding/HomeHarmonyLogo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useSeoMeta } from '@/lib/seo';

const features = [
  {
    icon: UtensilsCrossed,
    title: 'Smart Meal Planning',
    description: 'Auto-plan weekly meals with favorites, kid-friendly logic, and quick-time filters.',
  },
  {
    icon: ShoppingCart,
    title: 'One Unified Grocery List',
    description: 'Automatically combine overlapping ingredients and sum quantities across your full week.',
  },
  {
    icon: ListChecks,
    title: 'Chores + Household Tasks',
    description: 'Assign chores, run house tasks, and keep daily operations visible for everyone.',
  },
  {
    icon: Sparkles,
    title: 'Nutrition + Calorie Tracking',
    description: 'Track personal meal logs and macros for each person with simple dashboard views.',
  },
  {
    icon: Dumbbell,
    title: 'Workout Tracker (Merging In)',
    description: 'Build workouts and track sessions alongside meals and daily routines in one platform.',
  },
  {
    icon: MoonStar,
    title: 'Lifestyle Hub (Coming Soon)',
    description: 'Sleep tracking, cycle tracking, and alcohol tracking are planned next.',
  },
  {
    icon: Wine,
    title: 'Fast Recipe Imports',
    description: 'Import recipes from PDF or JSON, then keep everything searchable and ready to use.',
  },
];

const useCases = [
  {
    title: 'Busy Parents',
    body: 'Plan dinners in minutes, keep grocery runs predictable, and reduce nightly decision fatigue.',
    image: '/landing/usecase-family.svg',
  },
  {
    title: 'Meal Prep Households',
    body: 'Double recipes for the week, generate bulk shopping lists, and keep nutrition on track.',
    image: '/landing/usecase-mealprep.svg',
  },
  {
    title: 'Wellness-Focused Families',
    body: 'Track calories/macros now, with sleep, period, alcohol, and workouts converging into one home system.',
    image: '/landing/usecase-wellness.svg',
  },
];

const seoGuides = [
  { title: 'Meal Plan Frameworks', href: '/meal-plans' },
  { title: 'Grocery List Rollups', href: '/grocery-lists' },
  { title: 'Pantry Meal Guides', href: '/pantry-meals' },
  { title: 'Recipe Collections', href: '/recipe-collections' },
  { title: 'Household Templates', href: '/household-templates' },
  { title: 'Macro Plan Frameworks', href: '/macro-plans' },
  { title: 'Chore System Guides', href: '/chore-systems' },
  { title: 'Task System Guides', href: '/task-systems' },
  { title: 'Workout Tracking Guides', href: '/workout-tracking' },
  { title: 'Lifestyle Tracking Guides', href: '/lifestyle-tracking' },
];

const landingFaq = [
  {
    question: 'What does Home Harmony do?',
    answer:
      'Home Harmony combines meal planning, grocery list automation, chores, tasks, family coordination, and wellness tracking in one system.',
  },
  {
    question: 'Can I use Home Harmony for chores and tasks, not just meals?',
    answer:
      'Yes. The app supports shared household task systems, chore workflows, and family operational dashboards alongside meal planning.',
  },
  {
    question: 'Does Home Harmony support fitness and lifestyle tracking?',
    answer:
      'Yes. Workout tracking is being merged in, and lifestyle modules for sleep, cycle tracking, and alcohol habits are planned and documented.',
  },
  {
    question: 'How does Home Harmony improve grocery shopping?',
    answer:
      'It consolidates ingredient overlaps across scheduled meals and outputs a cleaner shopping list with combined quantities and reduced duplication.',
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const trialCtaTo = user ? '/onboarding?force=1' : '/signin?onboarding=1';

  useSeoMeta({
    title: 'Home Harmony | Family Meal Planner, Shared Grocery, Chores, Tasks, Workouts, and Lifestyle Tracking',
    description:
      'Home Harmony is the all-in-one family management app for meal planning, grocery list automation, chores, tasks, calorie/macro tracking, workouts, and lifestyle habit tracking.',
    keywords: [
      'family meal planner app',
      'shared grocery list app',
      'chore tracker app',
      'household task management app',
      'family dashboard app',
      'workout tracker app',
      'sleep habit tracker',
      'period tracking planner',
    ],
    image: '/landing/hero-family.svg',
    type: 'website',
    faq: landingFaq,
    breadcrumbs: [{ name: 'Home', url: '/' }],
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Home Harmony',
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        description:
          'Family operating system for meal planning, grocery automation, chores, task management, macro tracking, workouts, and lifestyle habits.',
        offers: {
          '@type': 'Offer',
          price: '12',
          priceCurrency: 'USD',
          category: 'Subscription',
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Home Harmony',
        url: 'https://homeharmony.app',
      },
    ],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,hsl(var(--primary)/0.16),transparent_35%),radial-gradient(circle_at_90%_10%,hsl(var(--accent)/0.14),transparent_30%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--background)))]" />

      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <HomeHarmonyLogo />
          <div className="flex items-center gap-2">
            <Link to="/resources">
              <Button variant="ghost">Resources</Button>
            </Link>
            <Link to="/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to={trialCtaTo}>
              <Button>Start Free Trial</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 md:px-6 md:pt-20">
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Star className="h-3.5 w-3.5" />
                Home Harmony for modern households
              </div>
              <h1 className="text-balance font-display text-4xl leading-tight text-foreground md:text-5xl">
                The all-in-one home operating system for food, family, and life.
              </h1>
              <p className="mt-4 max-w-xl text-base text-muted-foreground md:text-lg">
                Home Harmony brings meal planning, grocery automation, chores, tasks, calorie tracking, and upcoming lifestyle + workouts
                into one organized flow.
                Save time, reduce stress, and keep everyone aligned.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link to={trialCtaTo}>
                  <Button size="lg">
                    Try Home Harmony
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/signin">
                  <Button size="lg" variant="outline">Sign In</Button>
                </Link>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3 text-sm md:max-w-md">
                {[
                  'Meal planning with smart swap',
                  'Auto-combined grocery quantities',
                  'Kid-friendly + favorites logic',
                  'Chores + household tasks',
                  'Calories + macro dashboards',
                  'Workout tracker merging in',
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">{line}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
              <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-accent/20 blur-2xl" />
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft-lg">
                <img
                  src="/landing/hero-family.svg"
                  alt="Home Harmony family operations overview"
                  className="h-[420px] w-full object-cover"
                />
                <div className="grid grid-cols-3 border-t border-border bg-background/90 p-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Weekly Plan</p>
                    <p className="font-semibold">Done in mins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Grocery List</p>
                    <p className="font-semibold">Auto merged</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Family Ops</p>
                    <p className="font-semibold">One dashboard</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-card/40 py-14">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 md:grid-cols-3 md:px-6">
            {features.map((item) => (
              <article key={item.title} className="rounded-xl border border-border bg-background p-5 shadow-sm">
                <item.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-3 font-display text-xl">{item.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pt-14 md:px-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.16em] text-primary">What You Get</p>
            <h2 className="mt-2 font-display text-3xl">Current platform + near-term expansion</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">Live now</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Meal planner, recipe library, grocery quantity rollups, chores, tasks, calorie/macro tracking,
                  pantry matcher, and smart swap workflows.
                </p>
              </div>
              <div className="rounded-lg bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">Rolling in soon</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Workout builder + workout logging, plus lifestyle tracking for sleep, period cycles, and alcohol.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 md:px-6">
          <div className="mb-7 flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-primary">Use Cases</p>
              <h2 className="font-display text-3xl">Built for real family life</h2>
            </div>
            <Link to="/signin" className="hidden md:block">
              <Button variant="outline">Explore the App</Button>
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {useCases.map((card) => (
              <article key={card.title} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <img src={card.image} alt={card.title} className="h-44 w-full object-cover" />
                <div className="p-4">
                  <h3 className="font-display text-2xl">{card.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{card.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 md:px-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-primary">Resource Library</p>
                <h2 className="font-display text-3xl">Built-for-action household guides</h2>
              </div>
              <Link to="/resources">
                <Button variant="outline">View All Guides</Button>
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {seoGuides.map((guide) => (
                <Link
                  key={guide.href}
                  to={guide.href}
                  className="rounded-lg border border-border p-4 text-sm font-medium transition hover:bg-muted/40"
                >
                  {guide.title}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 md:px-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-[0.15em] text-primary">SEO FAQ</p>
            <h2 className="mt-2 font-display text-3xl">Common Questions About Home Harmony</h2>
            <div className="mt-5 space-y-4">
              {landingFaq.map((item) => (
                <article key={item.question} className="rounded-lg border border-border p-4">
                  <h3 className="text-base font-semibold">{item.question}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 md:px-6" id="pricing">
          <div className="rounded-2xl border border-border bg-gradient-to-br from-secondary/50 to-background p-6 md:p-10">
            <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
              <div>
                <h2 className="font-display text-3xl">Ready to run your home like a team?</h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Replace scattered notes, group texts, and grocery mistakes with one shared workflow.
                  Home Harmony turns routine house management into a system that actually works.
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock3 className="h-4 w-4 text-primary" />
                  Setup in under 10 minutes
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-5">
                <p className="text-sm text-muted-foreground">Launch Offer</p>
                <p className="mt-1 font-display text-4xl">$12<span className="text-base text-muted-foreground">/month</span></p>
                <p className="mt-1 text-xs text-muted-foreground">14-day free trial, cancel anytime</p>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Unlimited recipes & meal plans</p>
                  <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Shared household dashboards</p>
                  <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Smart grocery list automation</p>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <Link to={trialCtaTo}>
                    <Button className="w-full">Start Free Trial</Button>
                  </Link>
                  <Button
                    variant="outline"
                    className={cn('w-full')}
                    onClick={() => window.open('mailto:founders@homeharmony.app?subject=Home%20Harmony%20Demo', '_blank')}
                  >
                    <Heart className="mr-2 h-4 w-4" />
                    Book a Demo
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
