import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface RelatedItem {
  title: string;
  slug: string;
}

interface CrossLinkItem {
  href: string;
  title: string;
  description: string;
}

interface HubPrimerItem {
  title: string;
  description: string;
}

export function SeoBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex items-center gap-2">
            {item.href ? (
              <Link to={item.href} className="hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground">{item.label}</span>
            )}
            {index < items.length - 1 ? <span aria-hidden="true">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function SeoFreshnessBar({ minutes }: { minutes: number }) {
  return (
    <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      <span>Published: February 21, 2026</span>
      <span className="mx-2">•</span>
      <span>Updated: February 21, 2026</span>
      <span className="mx-2">•</span>
      <span>{minutes} min read</span>
    </div>
  );
}

export function SeoRelatedGuides({
  title,
  items,
  basePath,
  currentSlug,
}: {
  title: string;
  items: RelatedItem[];
  basePath: string;
  currentSlug: string;
}) {
  const related = items.filter((item) => item.slug !== currentSlug).slice(0, 4);
  if (!related.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3 grid gap-2">
        {related.map((item) => (
          <Link
            key={item.slug}
            to={`${basePath}/${item.slug}`}
            className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-muted/50"
          >
            {item.title}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SeoCrossClusterLinks({
  title,
  links,
}: {
  title: string;
  links: CrossLinkItem[];
}) {
  if (!links.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {links.map((link) => (
          <Link key={link.href} to={link.href} className="rounded-lg border border-border p-3 transition hover:bg-muted/50">
            <p className="text-sm font-semibold">{link.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SeoActionPlan({
  title,
  intro,
  steps,
}: {
  title: string;
  intro: string;
  steps: string[];
}) {
  if (!steps.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

export function SeoSuccessMetrics({
  title,
  metrics,
}: {
  title: string;
  metrics: string[];
}) {
  if (!metrics.length) return null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {metrics.map((metric) => (
          <li key={metric}>• {metric}</li>
        ))}
      </ul>
    </section>
  );
}

export function SeoHubPrimer({
  title,
  intro,
  items,
}: {
  title: string;
  intro: string;
  items: HubPrimerItem[];
}) {
  if (!items.length) return null;

  return (
    <section className="mb-8 rounded-xl border border-border bg-card p-5">
      <h2 className="font-display text-2xl">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{intro}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <article key={item.title} className="rounded-lg border border-border p-4">
            <h3 className="text-sm font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
