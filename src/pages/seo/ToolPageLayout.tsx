import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SeoShell } from './SeoShell';
import { SeoBreadcrumbs } from './SeoDetailScaffold';

interface ToolFaq {
  question: string;
  answer: string;
}

interface ToolCta {
  label: string;
  href: string;
  variant?: 'default' | 'outline';
  onClick?: () => void;
}

interface ToolPageLayoutProps {
  breadcrumbs: Array<{ label: string; href?: string }>;
  title: string;
  subtitle: string;
  trustSignals: string[];
  heroImage?: string;
  heroAlt?: string;
  tool: ReactNode;
  outputs: string[];
  howItWorks: string[];
  faq: ToolFaq[];
  softCta: {
    title: string;
    description: string;
    primary: ToolCta;
    secondary?: ToolCta;
  };
  relatedLinks?: Array<{ title: string; href: string }>;
  advancedSections?: Array<{ title: string; items: string[] }>;
}

export function ToolPageLayout({
  breadcrumbs,
  title,
  subtitle,
  trustSignals,
  heroImage,
  heroAlt,
  tool,
  outputs,
  howItWorks,
  faq,
  softCta,
  relatedLinks = [],
  advancedSections = [],
}: ToolPageLayoutProps) {
  const topOutputs = outputs.filter(Boolean).slice(0, 3);
  const topSteps = howItWorks.filter(Boolean).slice(0, 3);
  const topFaq = faq.slice(0, 3);
  const hasAdvanced = advancedSections.some((section) => section.items.length > 0);

  return (
    <SeoShell>
      <article className="mx-auto max-w-4xl">
        <SeoBreadcrumbs items={breadcrumbs} />

        <section className="border-b border-border/60 pb-10">
          <h1 className="max-w-3xl font-display text-4xl leading-[1.04] tracking-tight md:text-6xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground md:text-xl">{subtitle}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {trustSignals.slice(0, 3).map((signal) => (
              <span key={signal} className="rounded-full border border-border/80 bg-card px-3 py-1 text-xs text-muted-foreground">
                {signal}
              </span>
            ))}
          </div>
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
          <div className="mx-auto max-w-4xl rounded-2xl border border-primary/30 bg-primary/5 p-5 md:p-7">{tool}</div>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">What You Get</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {topOutputs.map((item) => (
              <article key={item} className="border-l-2 border-primary/40 pl-4">
                <p className="text-sm leading-6 text-muted-foreground">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-border/60 py-10">
          <h2 className="font-display text-3xl leading-tight md:text-4xl">How It Works</h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {topSteps.map((step, index) => (
              <li key={step} className="rounded-xl border border-border/60 bg-card/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Step {index + 1}</p>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {hasAdvanced ? (
          <section className="border-t border-border/60 py-10">
            <h2 className="font-display text-3xl leading-tight md:text-4xl">Advanced Tips</h2>
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

        <section className="mb-6 rounded-2xl border border-primary/30 bg-primary/10 p-6">
          <h2 className="font-display text-2xl leading-tight md:text-3xl">{softCta.title}</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{softCta.description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link to={softCta.primary.href} onClick={softCta.primary.onClick}>
              <Button variant={softCta.primary.variant || 'default'}>{softCta.primary.label}</Button>
            </Link>
            {softCta.secondary ? (
              <Link to={softCta.secondary.href} onClick={softCta.secondary.onClick}>
                <Button variant={softCta.secondary.variant || 'outline'}>{softCta.secondary.label}</Button>
              </Link>
            ) : null}
          </div>
          {relatedLinks.length ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Related tools</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {relatedLinks.slice(0, 4).map((link) => (
                  <Link key={link.href} to={link.href}>
                    <Button size="sm" variant="outline">
                      {link.title}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </article>
    </SeoShell>
  );
}
