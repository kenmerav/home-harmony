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
    image: '/seo/meal-plans.svg',
    type: 'website',
    breadcrumbs: [
      { name: 'Home', url: '/' },
      { name: 'Resources', url: '/resources' },
    ],
  });

  return (
    <SeoShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-primary">Programmatic Resource Hub</p>
        <h1 className="mt-2 font-display text-4xl">Plan Better, Shop Smarter, Run Home Smoother</h1>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          These pages are built around real household workflows. Each section has a unique framework so you can apply it directly,
          not generic blog filler.
        </p>
      </div>
      <SeoHubPrimer
        title="How to Use the Resource Library"
        intro="Treat this library as an operating system map. Start in one category, implement for two weeks, then connect adjacent systems to increase consistency."
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

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {seoCategories.map((category) => (
          <article key={category.slug} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <img src={category.heroImage} alt={category.heroAlt} className="h-44 w-full object-cover" loading="lazy" />
            <div className="p-5">
              <h2 className="font-display text-2xl">{category.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{category.description}</p>
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
