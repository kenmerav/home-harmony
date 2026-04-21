import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import { SeoBreadcrumbs } from './SeoDetailScaffold';

const familyMealPlannerFaq = [
  {
    question: 'Is Home Harmony a family meal planner or a full household app?',
    answer:
      'It is both. The meal planner handles weekly dinners, breakfast, lunch, snacks, grocery rollups, and saved foods, while the rest of the app keeps chores, calendar events, tasks, and reminders coordinated around those meals.',
  },
  {
    question: 'Can it work as a weekly meal planner for families with different diets?',
    answer:
      'Yes. Families can save their own recipes, reuse saved foods, adjust servings, and keep one shared dinner structure while still logging different portions or side items by person.',
  },
  {
    question: 'Does the grocery list update automatically from the meal plan?',
    answer:
      'Yes. Planned meals feed into the grocery workflow so ingredients, staples, and next-order items stay connected instead of living in separate tools.',
  },
  {
    question: 'What makes this different from a basic meal planning app?',
    answer:
      'Most meal planning apps stop at recipes and a grocery list. Home Harmony keeps meals, calendar, chores, reminders, and household ownership together so the plan actually survives a real family week.',
  },
  {
    question: 'Can I still add meals manually instead of only using generated plans?',
    answer:
      'Yes. You can add recipes, saved foods, nutrition-label items, or quick manual entries, then edit servings and macros later. That makes it work for meal prep, leftovers, and everyday snacks too.',
  },
] as const;

const plannerHighlights = [
  {
    title: 'Weekly meal plans that fit family life',
    description:
      'Plan dinners, lunches, breakfasts, and snacks in one place with shared visibility for the whole household.',
  },
  {
    title: 'Automatic grocery rollups',
    description:
      'Planned meals feed the grocery list automatically so shopping stays aligned with what the week actually needs.',
  },
  {
    title: 'Saved foods and real-life logging',
    description:
      'Reuse common foods like yogurt, rice cakes, deli chicken, or smoothies without pretending everything is a recipe.',
  },
  {
    title: 'Family coordination beyond meals',
    description:
      'Calendar, tasks, reminders, and chores all stay tied to the same family system instead of living in separate apps.',
  },
] as const;

const plannerSteps = [
  'Import recipes, save favorite foods, and build a reusable family meal library.',
  'Generate or place meals into the week, then adjust by breakfast, lunch, dinner, or snack.',
  'Let grocery items roll forward from the meal plan so shopping is already organized before the order.',
  'Keep the family aligned with shared calendar timing, reminders, chores, and task ownership around the same week.',
] as const;

const comparisonBullets = [
  'One shared family meal plan instead of scattered personal lists',
  'Saved foods plus recipes, so everyday meals are fast to log and reuse',
  'Grocery automation connected to planned meals',
  'Calendar + chores + tasks tied to the same household workflow',
  'Built for parents balancing dinner, pickups, shopping, and routines in one system',
] as const;

export default function FamilyMealPlannerPage() {
  useSeoMeta({
    title: 'Meal Planning App for Families | Weekly Meal Planner, Grocery, Calendar, and Chores',
    description:
      'Home Harmony is a meal planning app for families that need weekly meal plans, automatic grocery lists, shared schedules, and one calm system for meals, chores, and routines.',
    keywords: [
      'family meal planner',
      'meal planning app for families',
      'weekly meal planner for families',
      'family meal planning app',
      'automated meal planner for family',
      'meal planning app',
    ],
    image: '/landing/hero-family.jpg',
    imageAlt: 'Family meal planner app dashboard with weekly meal planning and grocery automation',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: 'Family Meal Planner', url: '/family-meal-planner' },
    ],
    faq: familyMealPlannerFaq.map((item) => ({
      question: item.question,
      answer: item.answer,
    })),
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Home Harmony',
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        description:
          'A meal planning app for families that connects weekly meal planning, grocery lists, calendars, tasks, and chores for busy households.',
        url: 'https://www.homeharmonyhq.com/family-meal-planner',
        featureList: [
          'Weekly family meal planner',
          'Automatic grocery lists from meal plans',
          'Saved foods and reusable recipes',
          'Shared family calendar',
          'Chores and task coordination',
          'Meal logging with calories and macros',
        ],
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          category: 'free trial',
        },
      },
    ],
  });

  return (
    <SeoShell>
      <article className="mx-auto max-w-5xl">
        <SeoBreadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Resources', href: '/resources' },
            { label: 'Family Meal Planner' },
          ]}
        />

        <section className="border-b border-border/60 pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Family Meal Planning</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl leading-[1.04] tracking-tight md:text-6xl">
            A meal planning app for families that actually works in real life
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-xl">
            Home Harmony is built for busy families who need more than recipes. Plan the week, generate grocery lists,
            reuse saved foods, and keep meals connected to the same family calendar, chores, and reminders that run the
            rest of the house.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/onboarding">
              <Button>Start Free</Button>
            </Link>
            <Link to="/meal-plans">
              <Button variant="outline">See Meal Planning</Button>
            </Link>
          </div>
          <img
            src="/landing/hero-family.jpg"
            alt="Family meal planner app dashboard with weekly planning"
            className="mt-8 w-full rounded-2xl border border-border/70 object-cover"
            loading="lazy"
          />
        </section>

        <section className="py-10">
          <div className="grid gap-4 md:grid-cols-2">
            {plannerHighlights.map((item) => (
              <article key={item.title} className="rounded-2xl border border-border/60 bg-card p-6">
                <h2 className="font-display text-2xl leading-tight">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">How weekly meal planning works here</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            If you are looking for a weekly meal planner for families, the biggest difference is that Home Harmony does
            not stop at a pretty calendar. The plan carries forward into shopping, reminders, and the rest of the
            family’s week.
          </p>
          <ol className="mt-6 space-y-4">
            {plannerSteps.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-xl border border-border/60 bg-card/70 px-4 py-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Why this ranks as a meal planning app for families</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            Families rarely have a meals-only problem. They have a decision-fatigue problem. Dinner affects the grocery
            list, the grocery list affects errands, errands affect the calendar, and all of it affects who is doing
            what tonight. That is the real search intent we want this page to satisfy.
          </p>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {comparisonBullets.map((item) => (
              <li key={item} className="rounded-lg border border-border/60 bg-card/60 px-4 py-3 text-sm leading-7 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Related guides</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Link to="/meal-plans" className="rounded-2xl border border-border/60 bg-card p-6 transition hover:bg-muted/30">
              <h3 className="font-display text-2xl leading-tight">Meal Plan Pages</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Weekly meal plan frameworks for budget, high protein, slow cooker, picky eaters, and more.
              </p>
            </Link>
            <Link to="/grocery-lists" className="rounded-2xl border border-border/60 bg-card p-6 transition hover:bg-muted/30">
              <h3 className="font-display text-2xl leading-tight">Grocery List Guides</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                See how planned meals turn into cleaner, grouped shopping lists with better quantity rollups.
              </p>
            </Link>
            <Link to="/recipe-collections" className="rounded-2xl border border-border/60 bg-card p-6 transition hover:bg-muted/30">
              <h3 className="font-display text-2xl leading-tight">Recipe Collections</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Use recipe collections that actually fit family schedules instead of random inspiration boards.
              </p>
            </Link>
            <Link to="/compare" className="rounded-2xl border border-border/60 bg-card p-6 transition hover:bg-muted/30">
              <h3 className="font-display text-2xl leading-tight">Comparison Guides</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Compare Home Harmony against Cozi, AnyList, and other household tools when meals are only one part of the system.
              </p>
            </Link>
          </div>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-4">
            {familyMealPlannerFaq.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="text-left font-medium">{item.question}</AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-muted-foreground">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="border-t border-border/60 py-10">
          <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">Ready to simplify family meal planning?</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Start with the family meal planner, then let grocery, tasks, calendar, and reminders stay connected around
              the same week instead of rebuilding your system in separate apps.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/onboarding">
                <Button>Start Free</Button>
              </Link>
              <Link to="/resources">
                <Button variant="outline">Explore Resources</Button>
              </Link>
            </div>
          </div>
        </section>
      </article>
    </SeoShell>
  );
}
