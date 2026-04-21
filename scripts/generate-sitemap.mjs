import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_ORIGIN = 'https://www.homeharmonyhq.com';
const now = new Date().toISOString().slice(0, 10);

const repoRoot = resolve(process.cwd());
const seoSourcePath = resolve(repoRoot, 'src/data/seoContent.ts');
const comparisonSourcePath = resolve(repoRoot, 'src/data/comparisonContent.ts');
const templatesSourcePath = resolve(repoRoot, 'src/data/templateGalleryContent.ts');
const sitemapPath = resolve(repoRoot, 'public/sitemap.xml');

const sources = {
  seo: readFileSync(seoSourcePath, 'utf8'),
  comparison: readFileSync(comparisonSourcePath, 'utf8'),
  templates: readFileSync(templatesSourcePath, 'utf8'),
};

const staticRoutes = [
  '/',
  '/resources',
  '/family-meal-planner',
  '/meal-plans',
  '/grocery-lists',
  '/pantry-meals',
  '/recipe-collections',
  '/household-templates',
  '/macro-plans',
  '/chore-systems',
  '/task-systems',
  '/workout-tracking',
  '/lifestyle-tracking',
  '/compare',
  '/templates',
];

const collections = [
  { sourceKey: 'seo', constName: 'mealPlanPages', base: '/meal-plans' },
  { sourceKey: 'seo', constName: 'groceryListPages', base: '/grocery-lists' },
  { sourceKey: 'seo', constName: 'pantryMealPages', base: '/pantry-meals' },
  { sourceKey: 'seo', constName: 'recipeCollectionPages', base: '/recipe-collections' },
  { sourceKey: 'seo', constName: 'householdTemplatePages', base: '/household-templates' },
  { sourceKey: 'seo', constName: 'macroPlanPages', base: '/macro-plans' },
  { sourceKey: 'seo', constName: 'choreSystemPages', base: '/chore-systems' },
  { sourceKey: 'seo', constName: 'taskSystemPages', base: '/task-systems' },
  { sourceKey: 'seo', constName: 'workoutTrackingPages', base: '/workout-tracking' },
  { sourceKey: 'seo', constName: 'lifestyleTrackingPages', base: '/lifestyle-tracking' },
  { sourceKey: 'comparison', constName: 'comparisonPages', base: '/compare' },
  { sourceKey: 'templates', constName: 'templatePacks', base: '/templates' },
];

const allRoutes = new Set(staticRoutes);

for (const collection of collections) {
  const source = sources[collection.sourceKey];
  const match = source.match(new RegExp(`export const ${collection.constName}[\\s\\S]*?= \\[(?<body>[\\s\\S]*?)\\n\\];`));
  const body = match?.groups?.body || '';

  for (const slugMatch of body.matchAll(/slug:\s*'([^']+)'/g)) {
    const slug = slugMatch[1];
    allRoutes.add(`${collection.base}/${slug}`);
  }
}

const urls = [...allRoutes]
  .sort((a, b) => a.localeCompare(b))
  .map(
    (path) =>
      `  <url>\n    <loc>${SITE_ORIGIN}${path}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${path === '/' ? '1.0' : '0.7'}</priority>\n  </url>`,
  )
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

writeFileSync(sitemapPath, xml, 'utf8');
console.log(`Generated sitemap with ${allRoutes.size} URLs at ${sitemapPath}`);
