import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const today = new Date().toISOString().slice(0, 10);
const sitemapPath = resolve(root, 'public/sitemap.xml');
const sitemap = readFileSync(sitemapPath, 'utf8');

const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

function normalizePath(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url.replace(/^https?:\/\/[^/]+/, '');
  }
}

function classify(pathname) {
  if (pathname === '/' || pathname === '/resources') {
    return { priority: 'P0', reason: 'Core entry and discovery hubs' };
  }

  const hubs = [
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

  if (hubs.includes(pathname)) {
    return { priority: 'P0', reason: 'Category hub page with high internal link equity' };
  }

  if (/^\/(chore-systems|task-systems|workout-tracking|lifestyle-tracking)\//.test(pathname)) {
    return { priority: 'P1', reason: 'Feature-led pages with high commercial intent' };
  }

  if (/^\/(macro-plans|household-templates)\//.test(pathname)) {
    return { priority: 'P1', reason: 'Mid-funnel pages tied to behavior and subscription intent' };
  }

  return { priority: 'P2', reason: 'Topical long-tail acquisition pages' };
}

const prioritized = urls.map((url) => {
  const pathname = normalizePath(url);
  const { priority, reason } = classify(pathname);
  return { priority, url, pathname, reason };
});

prioritized.sort((a, b) => {
  const order = { P0: 0, P1: 1, P2: 2 };
  return order[a.priority] - order[b.priority] || a.pathname.localeCompare(b.pathname);
});

const batchSize = 25;
const rows = prioritized.map((item, i) => ({
  ...item,
  batch: `B${String(Math.floor(i / batchSize) + 1).padStart(2, '0')}`,
}));

const csv = [
  'priority,batch,url,reason',
  ...rows.map((r) => `${r.priority},${r.batch},${r.url},"${r.reason}"`),
].join('\n');

mkdirSync(resolve(root, 'reports/seo'), { recursive: true });
writeFileSync(resolve(root, `reports/seo/indexing-queue-${today}.csv`), csv, 'utf8');
writeFileSync(resolve(root, 'reports/seo/indexing-queue-latest.csv'), csv, 'utf8');

console.log(`Generated indexing queue with ${rows.length} URLs`);
console.log(`Output: reports/seo/indexing-queue-${today}.csv`);
