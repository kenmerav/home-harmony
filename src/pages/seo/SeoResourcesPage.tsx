import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SeoShell } from './SeoShell';
import { seoCategories } from '@/data/seoContent';
import { useSeoMeta } from '@/lib/seo';
import { SeoHubPrimer } from './SeoDetailScaffold';

const categoryPath: Record<string, string> = {
  'meal-plans': '/meal-plans',
  'grocery-lists': '/grocery-lists',
  'pantry-meals': '/pantry-meals',
  'recipe-collections': '/recipe-collections',
  'household-templates': '/household-templates',
  'macro-plans': '/macro-plans',
  'chore-systems': '/chore-systems',
  'task-systems': '/task-systems',
  'workout-tracking': '/workout-tracking',
  'lifestyle-tracking': '/lifestyle-tracking',
};

export default function SeoResourcesPage() {
  useSeoMeta({
    title: 'Home Harmony Resources | Meals, Grocery, Chores, Tasks, Workouts, Lifestyle, and Macro Planning',
    description:
      'Explore practical family operations resources: meal plans, grocery strategy, pantry guides, recipe collections, chores, task systems, workout tracking, lifestyle tracking, and macro planning.',
    keywords: ['family planner app', 'meal planning', 'chore systems', 'task systems', 'workout tracking', 'lifestyle tracking'],
    image: '/seo/meal-plans.jpg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
    ],
  });

  return (
    <SeoShell>
      <div className="mx-auto mb-12 max-w-4xl border-b border-border/60 pb-10">
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Resource Library</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-[1.04] tracking-tight md:text-6xl">
          Systems for meals, groceries, chores, tasks, and routines
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground md:text-xl">
          Each guide is built to be implemented quickly, with clear next actions and fewer decisions for your week.
        </p>
      </div>
      <SeoHubPrimer
        title="How to use this library"
        intro="Start with your current bottleneck. Run one framework for two weeks before adding another."
        items={[
          {
            title: 'Start with your biggest bottleneck',
            description: 'Choose the category that solves your highest weekly friction point first.',
          },
          {
            title: 'Run one framework fully',
            description: 'Avoid sampling many guides. Complete one operating model to get meaningful results.',
          },
          {
            title: 'Link adjacent systems',
            description: 'Connect meal, grocery, chores, tasks, workout, and lifestyle layers for stronger household execution.',
          },
          {
            title: 'Review and iterate weekly',
            description: 'Use weekly feedback to refine ownership, cadence, and workload.',
          },
        ]}
      />

      <section className="mx-auto mb-12 grid max-w-5xl gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="font-display text-2xl leading-tight">Family Meal Planner</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            See how Home Harmony handles weekly family meal planning, grocery automation, and shared household coordination.
          </p>
          <Link to="/family-meal-planner" className="mt-4 inline-block">
            <Button variant="outline">View Family Meal Planner</Button>
          </Link>
        </article>
        <article className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="font-display text-2xl leading-tight">Comparison Guides</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Evaluate Home Harmony against Cozi, AnyList, and Todoist with migration-focused checklists.
          </p>
          <Link to="/compare" className="mt-4 inline-block">
            <Button variant="outline">View Comparisons</Button>
          </Link>
        </article>
        <article className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="font-display text-2xl leading-tight">Template Gallery</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Use plug-and-play templates for meals, grocery systems, chores, task boards, and fitness cadence.
          </p>
          <Link to="/templates" className="mt-4 inline-block">
            <Button variant="outline">Browse Templates</Button>
          </Link>
        </article>
      </section>

      <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
        {seoCategories.map((category) => (
          <article key={category.slug} className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <img src={category.heroImage} alt={category.heroAlt} className="h-52 w-full object-cover" loading="lazy" />
            <div className="p-6">
              <h2 className="font-display text-2xl leading-tight">{category.title}</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{category.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {category.keywords.slice(0, 2).map((keyword) => (
                  <span key={keyword} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {keyword}
                  </span>
                ))}
              </div>
              <Link to={categoryPath[category.slug]} className="mt-5 inline-block">
                <Button variant="outline">Explore {category.title}</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </SeoShell>
  );
}
