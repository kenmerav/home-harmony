import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { useSeoMeta } from '@/lib/seo';
import { SeoShell } from './SeoShell';
import { SeoBreadcrumbs } from './SeoDetailScaffold';

type SupportPageLink = {
  href: string;
  label: string;
  description: string;
};

type SupportPageConfig = {
  slug: 'family-grocery-list-app' | 'shared-family-calendar-app' | 'family-chores-and-tasks-app';
  eyebrow: string;
  title: string;
  heroTitle: string;
  description: string;
  image: string;
  imageAlt: string;
  keywords: string[];
  faq: Array<{ question: string; answer: string }>;
  highlights: Array<{ title: string; description: string }>;
  steps: string[];
  bullets: string[];
  links: SupportPageLink[];
  schemaDescription: string;
};

const supportPages: Record<SupportPageConfig['slug'], SupportPageConfig> = {
  'family-grocery-list-app': {
    slug: 'family-grocery-list-app',
    eyebrow: 'Family Grocery',
    title: 'Family Grocery List App | Shared Shopping Lists That Start With Meals',
    heroTitle: 'A family grocery list app that starts with the meal plan, not a random note',
    description:
      'Home Harmony is a family grocery list app that turns meal plans into shared shopping lists, keeps staples visible, and helps families stay aligned before the order.',
    image: '/seo/meal-plans.jpg',
    imageAlt: 'Shared family grocery list app with meal planning and shopping workflow',
    keywords: [
      'family grocery list app',
      'shared grocery list for families',
      'grocery list app for family',
      'meal plan grocery list app',
      'family shopping list app',
    ],
    faq: [
      {
        question: 'How is this different from a basic shared grocery list app?',
        answer:
          'Most shared grocery list apps start after someone remembers to add items. Home Harmony starts earlier by pulling ingredients from the family meal plan, then layering staples and next-order items on top.',
      },
      {
        question: 'Can both adults update the same grocery workflow?',
        answer:
          'Yes. The grocery system is shared at the household level so both adults can see the same active list, mark items handled, and keep the next order moving.',
      },
      {
        question: 'Does it work if we meal prep and also add quick one-off items?',
        answer:
          'Yes. Planned meals, saved foods, staples, and manual additions all feed the same grocery workflow so you are not juggling separate lists.',
      },
      {
        question: 'Can I still choose my preferred stores?',
        answer:
          'Yes. Home Harmony keeps store preferences in the grocery setup so families can plan around the places they actually shop.',
      },
    ],
    highlights: [
      {
        title: 'Meal plans turn into grocery work automatically',
        description:
          'Dinner planning, breakfasts, lunches, snacks, and saved foods all support the shopping workflow instead of forcing a second planning pass.',
      },
      {
        title: 'One active order instead of a messy running list',
        description:
          'Families can check off what is handled, mark the order complete, and let the next grocery cycle start filling naturally from new meals and staples.',
      },
      {
        title: 'Built for shared ownership',
        description:
          'Both adults can see the same grocery state, so shopping is not trapped inside one person’s notes app or text thread.',
      },
      {
        title: 'Keeps staples and refill items visible',
        description:
          'You can add the extra things that always matter, like yogurt, paper goods, or lunch staples, without losing the connection to the actual meal plan.',
      },
    ],
    steps: [
      'Plan meals for the week or save the foods your family repeats most often.',
      'Let Home Harmony roll those meals into the active grocery workflow automatically.',
      'Add staples, refill items, or quick manual needs as the week changes.',
      'Mark the order handled and let the next list start building from the new plan.',
    ],
    bullets: [
      'Shared grocery workflow for the whole household',
      'Meal-driven list building instead of manual duplication',
      'Weekly staples and refill items layered into the same system',
      'Better handoff between planning, shopping, and the next order',
      'Connected to calendar timing, meals, and household ownership',
    ],
    links: [
      {
        href: '/family-meal-planner',
        label: 'Family Meal Planner',
        description: 'See the full planning flow that feeds the grocery list in the first place.',
      },
      {
        href: '/grocery-lists',
        label: 'Grocery Guides',
        description: 'Browse specific grocery workflows, list strategies, and shopping templates.',
      },
      {
        href: '/shared-family-calendar-app',
        label: 'Shared Family Calendar App',
        description: 'Connect meal timing, errands, and pickups to the same household plan.',
      },
      {
        href: '/family-chores-and-tasks-app',
        label: 'Family Chores + Tasks App',
        description: 'Keep shopping ownership, put-away tasks, and weekly chores connected.',
      },
    ],
    schemaDescription:
      'A shared family grocery list app that turns meal plans into household shopping workflows with staples, shared visibility, and next-order planning.',
  },
  'shared-family-calendar-app': {
    slug: 'shared-family-calendar-app',
    eyebrow: 'Family Calendar',
    title: 'Shared Family Calendar App | Calendar, Meals, Tasks, and Reminders',
    heroTitle: 'A shared family calendar app that actually connects dinner, errands, reminders, and pickups',
    description:
      'Home Harmony is a shared family calendar app that keeps events, dinner timing, tasks, chores, and reminders aligned in one household schedule.',
    image: '/landing/hero-family.jpg',
    imageAlt: 'Shared family calendar app with meals, reminders, and family events',
    keywords: [
      'shared family calendar app',
      'family calendar and meal planner',
      'family schedule app',
      'shared family planner app',
      'family organizer calendar app',
    ],
    faq: [
      {
        question: 'Is this just a family calendar or a broader household planner?',
        answer:
          'It is broader. The calendar is shared, but it also stays connected to dinner timing, chores, tasks, and reminders so the whole family week is easier to execute.',
      },
      {
        question: 'Can spouses see the same family schedule after joining?',
        answer:
          'Yes. Invited family members join the shared household and can see the common family schedule instead of rebuilding it separately.',
      },
      {
        question: 'Can meals show up alongside the rest of the day?',
        answer:
          'Yes. Planned dinners and meal timing live alongside family events, tasks, and reminders so the schedule matches real life.',
      },
      {
        question: 'Can the app text me my schedule?',
        answer:
          'Yes. Home Harmony supports daily schedule texts and reminder flows so your calendar is useful even when you are away from the app.',
      },
    ],
    highlights: [
      {
        title: 'Meals, events, and reminders in one timeline',
        description:
          'Dinner does not live in a separate planner. It shows up in the same family rhythm as practices, appointments, errands, and home logistics.',
      },
      {
        title: 'Shared by the household, not just one owner',
        description:
          'Once family members join, they can see the same shared family schedule instead of maintaining disconnected versions.',
      },
      {
        title: 'Better than a calendar-only family app',
        description:
          'The point is not just seeing the week. It is seeing the week with tasks, chores, shopping, and meals attached to it.',
      },
      {
        title: 'Texts and reminders reduce surprise',
        description:
          'Daily schedule texts and reminders help the plan survive outside the browser and throughout a normal busy day.',
      },
    ],
    steps: [
      'Add family events, appointments, practices, and schedule anchors into one shared calendar.',
      'Let planned dinner timing and household reminders show up alongside those events.',
      'Use tasks and chores to attach ownership to what needs to happen around the day.',
      'Send schedule texts or reminders so the family is not relying on memory alone.',
    ],
    bullets: [
      'Shared family calendar plus meal timing',
      'Tasks, reminders, and chores linked to the week',
      'Spouse-friendly invite flow with household-level visibility',
      'Daily schedule texts and event reminders',
      'Built for execution, not just seeing a colored calendar',
    ],
    links: [
      {
        href: '/family-meal-planner',
        label: 'Family Meal Planner',
        description: 'See how dinner planning feeds the family calendar instead of sitting separately.',
      },
      {
        href: '/family-grocery-list-app',
        label: 'Family Grocery List App',
        description: 'Connect errands, pickup windows, and shopping ownership to the same weekly plan.',
      },
      {
        href: '/compare/home-harmony-vs-cozi',
        label: 'Compare With Cozi',
        description: 'See how Home Harmony differs from a more calendar-first family tool.',
      },
      {
        href: '/task-systems',
        label: 'Task System Guides',
        description: 'Use household task systems that support the same shared weekly calendar.',
      },
    ],
    schemaDescription:
      'A shared family calendar app that connects events, meal timing, chores, reminders, and household ownership in one schedule.',
  },
  'family-chores-and-tasks-app': {
    slug: 'family-chores-and-tasks-app',
    eyebrow: 'Chores + Tasks',
    title: 'Family Chores and Tasks App | Shared Household Ownership for Families',
    heroTitle: 'A family chores and tasks app that keeps the week moving without constant follow-up',
    description:
      'Home Harmony helps families manage chores, tasks, reminders, and recurring household work in one shared app connected to the calendar and meal plan.',
    image: '/seo/task-systems.jpg',
    imageAlt: 'Family chores and tasks app with recurring household ownership',
    keywords: [
      'family chores and tasks app',
      'family task management app',
      'chore chart app for families',
      'shared family to do app',
      'household task app for families',
    ],
    faq: [
      {
        question: 'Can this handle both chores and one-off tasks?',
        answer:
          'Yes. Home Harmony separates recurring chore systems from one-off or recurring household tasks, but both live in the same family workflow.',
      },
      {
        question: 'Does it work for kids as well as adults?',
        answer:
          'Yes. Kids can have chores and skill-development items, while adults can manage tasks, reminders, and shared ownership across the week.',
      },
      {
        question: 'Will spouses see the same chores and tasks after joining?',
        answer:
          'Yes. Household data is shared for family-oriented areas, so joined adults can see and manage the same chores, tasks, and family operations.',
      },
      {
        question: 'Why is this better than a generic to-do list?',
        answer:
          'Generic to-do lists rarely know about family roles, recurring chores, dinner timing, or the calendar. Home Harmony connects those layers so ownership is clearer.',
      },
    ],
    highlights: [
      {
        title: 'Recurring chores plus real household tasks',
        description:
          'Families can track the repeat work of home life without losing the one-off tasks that also need an owner this week.',
      },
      {
        title: 'Kid chores and skill development',
        description:
          'Kids can have visible chores and skill-building items, while the family leaderboard and points system keep follow-through visible.',
      },
      {
        title: 'Shared across invited adults',
        description:
          'Spouses and invited household members can work from the same family system instead of each person keeping their own separate task list.',
      },
      {
        title: 'Connected to the calendar and meals',
        description:
          'Tasks make more sense when they sit near the family schedule and the week’s meal plan, not off in a disconnected productivity app.',
      },
    ],
    steps: [
      'Set up recurring chores, task ownership, and kid skill-development items for the household.',
      'Use the family schedule to see when those tasks actually need to happen in the week.',
      'Keep meals, errands, grocery, and cleanup tied to the same shared system.',
      'Review points, completion, and open items so responsibilities stay visible.',
    ],
    bullets: [
      'Family chores and tasks in one shared app',
      'Kid chores, skill development, and visible point tracking',
      'Adult ownership with recurring reminders and due dates',
      'Tied to calendar timing, meals, and family routines',
      'Less follow-up because the system is visible to everyone',
    ],
    links: [
      {
        href: '/family-meal-planner',
        label: 'Family Meal Planner',
        description: 'Keep cooking, cleanup, and dinner-related ownership tied to the same household week.',
      },
      {
        href: '/shared-family-calendar-app',
        label: 'Shared Family Calendar App',
        description: 'See chores and tasks in the same family rhythm as events and reminders.',
      },
      {
        href: '/chore-systems',
        label: 'Chore System Guides',
        description: 'Browse chore-system frameworks and recurring ownership ideas.',
      },
      {
        href: '/task-systems',
        label: 'Task System Guides',
        description: 'See broader family task systems that support the same home operations flow.',
      },
    ],
    schemaDescription:
      'A family chores and tasks app that helps households manage recurring chores, one-off tasks, kid skill development, and shared ownership.',
  },
};

function FamilySupportPage({ page }: { page: SupportPageConfig }) {
  useSeoMeta({
    title: page.title,
    description: page.description,
    keywords: page.keywords,
    image: page.image,
    imageAlt: page.imageAlt,
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
      { name: page.title.replace(' | Home Harmony', ''), url: `/${page.slug}` },
    ],
    faq: page.faq,
    schemas: [
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Home Harmony',
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        description: page.schemaDescription,
        url: `https://www.homeharmonyhq.com/${page.slug}`,
        featureList: page.bullets,
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
            { label: page.title.replace(' | Home Harmony', '') },
          ]}
        />

        <section className="border-b border-border/60 pb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{page.eyebrow}</p>
          <h1 className="mt-3 max-w-4xl font-display text-4xl leading-[1.04] tracking-tight md:text-6xl">
            {page.heroTitle}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-xl">{page.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/onboarding">
              <Button>Start Free</Button>
            </Link>
            <Link to="/resources">
              <Button variant="outline">Browse Resources</Button>
            </Link>
          </div>
          <img
            src={page.image}
            alt={page.imageAlt}
            className="mt-8 w-full rounded-2xl border border-border/70 object-cover"
            loading="lazy"
          />
        </section>

        <section className="py-10">
          <div className="grid gap-4 md:grid-cols-2">
            {page.highlights.map((item) => (
              <article key={item.title} className="rounded-2xl border border-border/60 bg-card p-6">
                <h2 className="font-display text-2xl leading-tight">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">How this works in real life</h2>
          <ol className="mt-6 space-y-4">
            {page.steps.map((step, index) => (
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
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Why families use this instead of a narrower app</h2>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {page.bullets.map((item) => (
              <li key={item} className="rounded-lg border border-border/60 bg-card/60 px-4 py-3 text-sm leading-7 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Related guides</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {page.links.map((link) => (
              <Link key={link.href} to={link.href} className="rounded-2xl border border-border/60 bg-card p-6 transition hover:bg-muted/30">
                <h3 className="font-display text-2xl leading-tight">{link.label}</h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="mt-4">
            {page.faq.map((item, index) => (
              <AccordionItem key={item.question} value={`faq-${index}`}>
                <AccordionTrigger className="text-left font-medium">{item.question}</AccordionTrigger>
                <AccordionContent className="text-sm leading-7 text-muted-foreground">{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="border-t border-border/60 py-10">
          <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">Ready to make the family week feel lighter?</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              Start with one shared system, then let meals, grocery, calendar, chores, and tasks reinforce each other
              instead of creating more household fragmentation.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/onboarding">
                <Button>Start Free</Button>
              </Link>
              <Link to="/family-meal-planner">
                <Button variant="outline">View Family Meal Planner</Button>
              </Link>
            </div>
          </div>
        </section>
      </article>
    </SeoShell>
  );
}

export function FamilyGroceryListAppPage() {
  return <FamilySupportPage page={supportPages['family-grocery-list-app']} />;
}

export function SharedFamilyCalendarAppPage() {
  return <FamilySupportPage page={supportPages['shared-family-calendar-app']} />;
}

export function FamilyChoresAndTasksAppPage() {
  return <FamilySupportPage page={supportPages['family-chores-and-tasks-app']} />;
}
