import { useEffect } from 'react';

function upsertMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertOg(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertJsonLd(scriptId: string, payload: unknown) {
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = scriptId;
    document.head.appendChild(script);
  }
  script.text = JSON.stringify(payload);
}

export function useSeoMeta(input: {
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
  type?: 'article' | 'website';
  publishedTime?: string;
  modifiedTime?: string;
  authorName?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
  faq?: Array<{ question: string; answer: string }>;
  schemas?: unknown[];
}) {
  useEffect(() => {
    const canonicalHref = `${window.location.origin}${window.location.pathname}`;
    const imageUrl = input.image
      ? input.image.startsWith('http')
        ? input.image
        : `${window.location.origin}${input.image}`
      : undefined;

    document.title = input.title;
    upsertMeta('description', input.description);
    if (input.keywords?.length) upsertMeta('keywords', input.keywords.join(', '));
    upsertOg('og:title', input.title);
    upsertOg('og:description', input.description);
    upsertOg('og:type', input.type || 'article');
    upsertOg('og:url', canonicalHref);
    upsertOg('og:site_name', 'Home Harmony');
    if (imageUrl) upsertOg('og:image', imageUrl);
    upsertMeta('twitter:card', 'summary_large_image');
    upsertMeta('twitter:title', input.title);
    upsertMeta('twitter:description', input.description);
    if (imageUrl) upsertMeta('twitter:image', imageUrl);
    upsertMeta('robots', 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalHref);

    if (input.faq && input.faq.length > 0) {
      upsertJsonLd('seo-faq-jsonld', {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: input.faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: item.answer,
          },
        })),
      });
    } else {
      const faqScript = document.getElementById('seo-faq-jsonld');
      if (faqScript) faqScript.remove();
    }

    if (input.type !== 'website') {
      upsertJsonLd('seo-article-jsonld', {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: input.title,
        description: input.description,
        mainEntityOfPage: canonicalHref,
        image: imageUrl ? [imageUrl] : undefined,
        author: {
          '@type': 'Organization',
          name: input.authorName || 'Home Harmony Team',
        },
        datePublished: input.publishedTime || '2026-02-21',
        dateModified: input.modifiedTime || '2026-02-21',
      });
    } else {
      const articleScript = document.getElementById('seo-article-jsonld');
      if (articleScript) articleScript.remove();
    }

    if (input.breadcrumbs && input.breadcrumbs.length > 0) {
      upsertJsonLd('seo-breadcrumb-jsonld', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: input.breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url.startsWith('http') ? item.url : `${window.location.origin}${item.url}`,
        })),
      });
    } else {
      const breadcrumbScript = document.getElementById('seo-breadcrumb-jsonld');
      if (breadcrumbScript) breadcrumbScript.remove();
    }

    if (input.schemas && input.schemas.length > 0) {
      const payload =
        input.schemas.length === 1
          ? input.schemas[0]
          : {
              '@context': 'https://schema.org',
              '@graph': input.schemas,
            };
      upsertJsonLd('seo-custom-jsonld', payload);
    } else {
      const customScript = document.getElementById('seo-custom-jsonld');
      if (customScript) customScript.remove();
    }

    return () => {
      const faqScript = document.getElementById('seo-faq-jsonld');
      if (faqScript) faqScript.remove();
      const articleScript = document.getElementById('seo-article-jsonld');
      if (articleScript) articleScript.remove();
      const breadcrumbScript = document.getElementById('seo-breadcrumb-jsonld');
      if (breadcrumbScript) breadcrumbScript.remove();
      const customScript = document.getElementById('seo-custom-jsonld');
      if (customScript) customScript.remove();
    };
  }, [
    input.authorName,
    input.breadcrumbs,
    input.description,
    input.faq,
    input.image,
    input.keywords,
    input.modifiedTime,
    input.publishedTime,
    input.schemas,
    input.title,
    input.type,
  ]);
}
