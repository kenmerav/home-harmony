import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const seoContent = readFileSync(resolve(root, 'src/data/seoContent.ts'), 'utf8');
const linkGraph = readFileSync(resolve(root, 'src/data/seoLinkGraph.ts'), 'utf8');

const expectedHubs = [
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

const missingHubConfig = expectedHubs.filter((hub) => !linkGraph.includes(`'${hub}'`) && !linkGraph.includes(`\"${hub}\"`));

const categoriesConfigured = (seoContent.match(/slug:\s*'(meal-plans|grocery-lists|pantry-meals|recipe-collections|household-templates|macro-plans|chore-systems|task-systems|workout-tracking|lifestyle-tracking)'/g) || []).length;

const missingRefs = expectedHubs.filter((hub) => !linkGraph.includes(hub));

if (missingHubConfig.length || missingRefs.length) {
  console.error('Link graph check failed');
  console.error('Missing hubs:', missingHubConfig.join(', '));
  process.exit(1);
}

console.log('Link graph check passed');
console.log(`Hubs validated: ${expectedHubs.length}`);
console.log(`SEO category matches found: ${categoriesConfigured}`);
