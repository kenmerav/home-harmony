import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SeoShell } from './SeoShell';
import { SeoBreadcrumbs } from './SeoDetailScaffold';

interface ResourceMeta {
  published: string;
  updated: string;
  readMinutes: number;
}

interface ResourceFaq {
  question: string;
  answer: string;
}

interface ResourceLink {
  title: string;
  href: string;
  description?: string;
}

interface ResourceLinkGroup {
  title: string;
  links: ResourceLink[];
}

interface ResourceCta {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline';
}

interface ResourceAdvancedSection {
  title: string;
  items: string[];
}

interface ResourceEditorialBlock {
  title: string;
  intro?: string;
  paragraphs: string[];
  highlights?: string[];
}

interface ResourcePageLayoutProps {
  breadcrumbs: Array<{ label: string; href?: string }>;
  title: string;
  subtitle: string;
  heroImage?: string;
  heroAlt?: string;
  meta: ResourceMeta;
  bestFor: string;
  primaryCta: ResourceCta;
  outcomes: string[];
  howItWorks: string[];
  howItWorksIntro?: string;
  flexibilityTitle?: string;
  flexibilityItems?: string[];
  faq?: ResourceFaq[];
  relatedGroups?: ResourceLinkGroup[];
  quietCta: {
    title: string;
    description: string;
    primary: ResourceCta;
    secondary?: ResourceCta;
  };
  editorialBlocks?: ResourceEditorialBlock[];
  advancedSections?: ResourceAdvancedSection[];
  extraSection?: ReactNode;
}

export function ResourcePageLayout({
  breadcrumbs,
  title,
  subtitle,
  heroImage,
  heroAlt,
  meta,
  bestFor,
  primaryCta,
  outcomes,
  howItWorks,
  howItWorksIntro,
  flexibilityTitle,
  flexibilityItems = [],
  faq = [],
  relatedGroups = [],
  quietCta,
  editorialBlocks = [],
  advancedSections = [],
  extraSection,
}: ResourcePageLayoutProps) {
  const topOutcomes = outcomes.filter(Boolean).slice(0, 3);
  const topSteps = howItWorks.filter(Boolean).slice(0, 3);
  const topFaq = faq.slice(0, 5);
  const hasFlexibility = Boolean(flexibilityTitle && flexibilityItems.length);
  const hasRelated = relatedGroups.some((group) => group.links.length > 0);
  const hasAdvanced = advancedSections.some((section) => section.items.length > 0);
  const hasEditorial = editorialBlocks.some((block) => block.paragraphs.length > 0);

  const renderCta = (cta: ResourceCta, fallbackVariant: 'default' | 'outline' = 'default') => {
    const button = (
      <Button variant={cta.variant || fallbackVariant} onClick={cta.onClick}>
        {cta.label}
      </Button>
    );
    return cta.href ? <Link to={cta.href}>{button}</Link> : button;
  };

  return (
    <SeoShell>
      <article className="mx-auto max-w-4xl">
        <SeoBreadcrumbs items={breadcrumbs} />

        <section className="border-b border-border/60 pb-10">
          <h1 className="max-w-3xl font-display text-4xl leading-[1.04] tracking-tight md:text-6xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground md:text-xl">{subtitle}</p>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <span>Published {meta.published}</span>
            <span aria-hidden="true">•</span>
            <span>Updated {meta.updated}</span>
            <span aria-hidden="true">•</span>
            <span>{meta.readMinutes} min read</span>
          </div>
          <p className="mt-5 inline-flex rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-sm">
            Best for: {bestFor}
          </p>
          <div className="mt-6">{renderCta(primaryCta)}</div>
          {heroImage ? (
            <img
              src={heroImage}
              alt={heroAlt || title}
              className="mt-8 w-full rounded-2xl border border-border/70 object-cover"
              loading="lazy"
            />
          ) : null}
        </section>

        <section className="py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">Outcomes</h2>
          <ul className="mt-6 grid gap-6 md:grid-cols-3">
            {topOutcomes.map((item) => (
              <li key={item} className="border-l-2 border-primary/40 pl-4 text-sm leading-6 text-muted-foreground">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">How This Works</h2>
          {howItWorksIntro ? <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{howItWorksIntro}</p> : null}
          <ol className="mt-6 space-y-4">
            {topSteps.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-xl border border-border/60 bg-card/70 px-4 py-4">
                <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {hasEditorial ? (
          <section className="border-t border-border/60 py-10">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">Guide Breakdown</h2>
            <div className="mt-6 space-y-8">
              {editorialBlocks
                .filter((block) => block.paragraphs.length > 0)
                .map((block) => (
                  <article key={block.title}>
                    <h3 className="font-display text-2xl leading-tight">{block.title}</h3>
                    {block.intro ? <p className="mt-2 text-sm leading-7 text-muted-foreground">{block.intro}</p> : null}
                    <div className="mt-3 space-y-3">
                      {block.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-7 text-muted-foreground">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                    {block.highlights?.length ? (
                      <ul className="mt-4 space-y-2">
                        {block.highlights.map((item) => (
                          <li key={item} className="rounded-lg border border-border/60 bg-card/60 px-4 py-3 text-sm leading-7 text-muted-foreground">
                            {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
            </div>
          </section>
        ) : null}

        {hasFlexibility ? (
          <section className="border-t border-border/60 py-10">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">{flexibilityTitle}</h2>
            <ul className="mt-6 grid gap-3 md:grid-cols-2">
              {flexibilityItems.slice(0, 8).map((item) => (
                <li key={item} className="rounded-lg border border-border/60 bg-card/60 px-4 py-3 text-sm leading-7 text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasAdvanced ? (
          <section className="border-t border-border/60 py-10">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">Advanced Notes</h2>
            <Accordion type="single" collapsible className="mt-3">
              {advancedSections
                .filter((section) => section.items.length > 0)
                .map((section, index) => (
                  <AccordionItem key={section.title} value={`advanced-${index}`}>
                    <AccordionTrigger>{section.title}</AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 text-sm leading-7 text-muted-foreground">
                        {section.items.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </section>
        ) : null}

        {extraSection ? <section className="border-t border-border/60 py-10">{extraSection}</section> : null}

        {topFaq.length ? (
          <section className="border-t border-border/60 py-10">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">FAQ</h2>
            <Accordion type="single" collapsible className="mt-3">
              {topFaq.map((item, index) => (
                <AccordionItem key={item.question} value={`faq-${index}`}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-sm leading-7 text-muted-foreground">{item.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        ) : null}

        {hasRelated ? (
          <section className="border-t border-border/60 py-10">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">Related Resources</h2>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              {relatedGroups
                .filter((group) => group.links.length > 0)
                .map((group) => (
                  <div key={group.title}>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group.title}</h3>
                    <div className="mt-3 space-y-2">
                      {group.links.slice(0, 5).map((link) => (
                        <Link
                          key={link.href}
                          to={link.href}
                          className="block rounded-lg border border-border/60 px-4 py-3 transition hover:bg-muted/30"
                        >
                          <p className="text-sm font-medium">{link.title}</p>
                          {link.description ? <p className="mt-1 text-sm leading-7 text-muted-foreground">{link.description}</p> : null}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-6">
          <h2 className="font-display text-2xl leading-tight md:text-3xl">{quietCta.title}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{quietCta.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {renderCta(quietCta.primary)}
            {quietCta.secondary ? renderCta(quietCta.secondary, 'outline') : null}
          </div>
        </section>
      </article>
    </SeoShell>
  );
}
