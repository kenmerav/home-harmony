import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const today = new Date().toISOString().slice(0, 10);

const files = {
  robots: resolve(root, 'public/robots.txt'),
  sitemap: resolve(root, 'public/sitemap.xml'),
  app: resolve(root, 'src/App.tsx'),
  indexHtml: resolve(root, 'index.html'),
  seoContent: resolve(root, 'src/data/seoContent.ts'),
};

const robots = readFileSync(files.robots, 'utf8');
const sitemap = readFileSync(files.sitemap, 'utf8');
const app = readFileSync(files.app, 'utf8');
const indexHtml = readFileSync(files.indexHtml, 'utf8');
const seoContent = readFileSync(files.seoContent, 'utf8');

const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
const lazyRouteCount = (app.match(/lazy\(\(\) => import\(/g) || []).length;
const seoCategoryCount = (seoContent.match(/slug:\s*'(meal-plans|grocery-lists|pantry-meals|recipe-collections|household-templates|macro-plans|chore-systems|task-systems|workout-tracking|lifestyle-tracking)'/g) || []).length;

const checks = [
  {
    name: 'Robots references sitemap',
    pass: /Sitemap:\s*https:\/\/homeharmony\.app\/sitemap\.xml/.test(robots),
    impact: 'high',
  },
  {
    name: 'Private app routes disallowed in robots',
    pass: ['/signin', '/onboarding', '/billing', '/app', '/meals', '/recipes', '/grocery', '/chores', '/tasks', '/family', '/me', '/wife'].every((p) =>
      robots.includes(`Disallow: ${p}`),
    ),
    impact: 'high',
  },
  {
    name: 'Absolute canonical in base HTML',
    pass: /<link rel="canonical" href="https:\/\/homeharmony\.app\/?"\s*\/>/.test(indexHtml),
    impact: 'medium',
  },
  {
    name: 'Robots meta present in base HTML',
    pass: /<meta name="robots" content="index,follow/.test(indexHtml),
    impact: 'medium',
  },
  {
    name: 'Sitemap has 100+ URLs',
    pass: urls.length >= 100,
    impact: 'high',
  },
  {
    name: 'Public SEO hub routes are in App router',
    pass: ['/meal-plans', '/grocery-lists', '/pantry-meals', '/recipe-collections', '/household-templates', '/macro-plans', '/chore-systems', '/task-systems', '/workout-tracking', '/lifestyle-tracking'].every((p) =>
      app.includes(`path=\"${p}\"`),
    ),
    impact: 'high',
  },
  {
    name: 'Route-level code splitting enabled',
    pass: lazyRouteCount >= 20,
    impact: 'high',
  },
  {
    name: 'Core SEO category coverage configured',
    pass: seoCategoryCount >= 10,
    impact: 'high',
  },
];

const score = Math.round((checks.filter((c) => c.pass).length / checks.length) * 100);

const failed = checks.filter((c) => !c.pass);
const passed = checks.filter((c) => c.pass);

const report = `# SEO Audit Report (${today})\n\n## Score\n- Overall technical score: **${score}/100**\n- URLs in sitemap: **${urls.length}**\n- Lazy-loaded route modules: **${lazyRouteCount}**\n\n## Passed Checks\n${passed.map((c) => `- [x] ${c.name} (${c.impact})`).join('\n')}\n\n## Failed Checks\n${failed.length ? failed.map((c) => `- [ ] ${c.name} (${c.impact})`).join('\n') : '- None'}\n\n## Priority Actions\n${failed.length ? failed.map((c, i) => `${i + 1}. ${c.name}`).join('\n') : '1. Keep publishing and backlink operations cadence active weekly.'}\n\n## Notes\n- This script checks on-repo technical SEO signals.\n- It does not measure Google Search Console performance, backlinks, or ranking positions.\n`;

mkdirSync(resolve(root, 'reports/seo'), { recursive: true });
writeFileSync(resolve(root, `reports/seo/audit-${today}.md`), report, 'utf8');
writeFileSync(resolve(root, 'reports/seo/audit-latest.md'), report, 'utf8');

console.log(`SEO audit complete. Score: ${score}/100`);
console.log(`Report: reports/seo/audit-${today}.md`);
