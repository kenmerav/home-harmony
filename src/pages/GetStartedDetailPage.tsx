import { Link, Navigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { FEATURE_TUTORIALS, getFeatureTutorial } from '@/data/getStartedTutorials';

export default function GetStartedDetailPage() {
  const { topic } = useParams();
  const tutorial = topic ? getFeatureTutorial(topic) : undefined;

  if (!tutorial) {
    return <Navigate to="/getting-started" replace />;
  }

  return (
    <AppLayout>
      <PageHeader
        title={tutorial.title}
        subtitle={tutorial.summary}
        action={
          <div className="flex flex-wrap gap-2">
            <Link to={tutorial.primaryRoute}>
              <Button size="sm">{tutorial.primaryCta}</Button>
            </Link>
            <Link to="/getting-started">
              <Button size="sm" variant="outline">
                Back to tutorials
              </Button>
            </Link>
          </div>
        }
      />

      <div className="space-y-6">
        <SectionCard noPadding>
          <img src={tutorial.heroImage} alt={tutorial.heroAlt} className="h-52 w-full object-cover md:h-64" />
          <div className="space-y-4 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-1">{tutorial.audience}</span>
              <span className="rounded-full border border-border px-2 py-1">{tutorial.timeToComplete}</span>
            </div>
            <div>
              <p className="text-sm font-medium">What you will get</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {tutorial.outcomes.map((outcome) => (
                  <li key={outcome}>{outcome}</li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        {tutorial.sections.map((section, index) => (
          <SectionCard key={section.title} title={`Step ${index + 1}: ${section.title}`}>
            <div className="grid gap-4 lg:grid-cols-[1.35fr,1fr]">
              <ol className="space-y-3 text-sm">
                {section.steps.map((step, stepIndex) => (
                  <li key={step} className="rounded-md border border-border bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Action {stepIndex + 1}</p>
                    <p className="mt-1">{step}</p>
                  </li>
                ))}
              </ol>
              <figure className="overflow-hidden rounded-lg border border-border">
                <img
                  src={section.screenshot.src}
                  alt={section.screenshot.alt}
                  className="h-48 w-full object-cover md:h-56"
                  loading="lazy"
                />
                <figcaption className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                  {section.screenshot.caption}
                </figcaption>
              </figure>
            </div>
          </SectionCard>
        ))}

        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title="Done when">
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {tutorial.checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Common questions">
            <div className="space-y-2">
              {tutorial.troubleshooting.map((item) => (
                <details key={item.question} className="rounded-md border border-border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-medium">{item.question}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
                </details>
              ))}
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Next tutorial" subtitle="Move through these in order for the smoothest setup.">
          <div className="grid gap-3 md:grid-cols-2">
            {FEATURE_TUTORIALS.filter((item) => item.slug !== tutorial.slug)
              .slice(0, 4)
              .map((item) => (
                <Link key={item.slug} to={`/getting-started/${item.slug}`} className="rounded-lg border border-border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.timeToComplete}</p>
                  <p className="mt-1 font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                </Link>
              ))}
          </div>
        </SectionCard>
      </div>
    </AppLayout>
  );
}
