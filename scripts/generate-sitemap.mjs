import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_ORIGIN = 'https://homeharmony.app';
const now = new Date().toISOString().slice(0, 10);

const repoRoot = resolve(process.cwd());
const sourcePath = resolve(repoRoot, 'src/data/seoContent.ts');
const sitemapPath = resolve(repoRoot, 'public/sitemap.xml');

const source = readFileSync(sourcePath, 'utf8');

const staticRoutes = [
  '/',
  '/resources',
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
];

const collections = [
  { constName: 'mealPlanPages', base: '/meal-plans' },
  { constName: 'groceryListPages', base: '/grocery-lists' },
  { constName: 'pantryMealPages', base: '/pantry-meals' },
  { constName: 'recipeCollectionPages', base: '/recipe-collections' },
  { constName: 'householdTemplatePages', base: '/household-templates' },
  { constName: 'macroPlanPages', base: '/macro-plans' },
  { constName: 'choreSystemPages', base: '/chore-systems' },
  { constName: 'taskSystemPages', base: '/task-systems' },
  { constName: 'workoutTrackingPages', base: '/workout-tracking' },
  { constName: 'lifestyleTrackingPages', base: '/lifestyle-tracking' },
];

const allRoutes = new Set(staticRoutes);

for (const collection of collections) {
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
