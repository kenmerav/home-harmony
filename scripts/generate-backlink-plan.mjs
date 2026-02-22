import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
const today = new Date().toISOString().slice(0, 10);

const targets = [
  {
    tier: 'T1',
    prospect_type: 'Parenting media and family productivity publishers',
    angle: 'Data-backed household operations frameworks',
    link_asset: '/task-systems and /chore-systems hubs',
    outreach_offer: 'Expert contribution + actionable checklist resource',
  },
  {
    tier: 'T1',
    prospect_type: 'Meal planning and nutrition editorial sites',
    angle: 'Meal planning + grocery automation system',
    link_asset: '/meal-plans + /grocery-lists hubs',
    outreach_offer: 'Guest guide with practical planning templates',
  },
  {
    tier: 'T1',
    prospect_type: 'Fitness and training blogs/newsletters',
    angle: 'Family-friendly workout + macro integration',
    link_asset: '/workout-tracking + /macro-plans hubs',
    outreach_offer: 'Cross-over article for parents who train',
  },
  {
    tier: 'T2',
    prospect_type: 'School/PTA newsletters and community family resources',
    angle: 'Household planning templates for busy school-week routines',
    link_asset: '/household-templates + /task-systems',
    outreach_offer: 'Free printable checklist + resource page mention',
  },
  {
    tier: 'T2',
    prospect_type: 'Local family/lifestyle blogs',
    angle: 'Weekly home systems to reduce family stress',
    link_asset: '/resources',
    outreach_offer: 'Co-branded local family workflow article',
  },
  {
    tier: 'T2',
    prospect_type: 'Wellness newsletters and creators',
    angle: 'Lifestyle tracking frameworks for sleep and habits',
    link_asset: '/lifestyle-tracking',
    outreach_offer: 'Newsletter-ready practical habit framework',
  },
  {
    tier: 'T3',
    prospect_type: 'Template roundups and productivity tool directories',
    angle: 'Operational templates with real execution flow',
    link_asset: '/household-templates and /chore-systems',
    outreach_offer: 'Free template pack listing',
  },
  {
    tier: 'T3',
    prospect_type: 'Podcast hosts in parenting, productivity, and wellness',
    angle: 'How families build one operational system across meals, tasks, and health',
    link_asset: '/resources',
    outreach_offer: 'Founder interview + audience toolkit',
  },
];

const csv = [
  'tier,prospect_type,angle,link_asset,outreach_offer',
  ...targets.map((t) => `${t.tier},"${t.prospect_type}","${t.angle}","${t.link_asset}","${t.outreach_offer}"`),
].join('\n');

const markdown = `# Backlink Execution Plan (${today})\n\n## Weekly Cadence\n1. Build a list of 30 prospects from one target type.\n2. Send 10 personalized pitches per day for 3 days.\n3. Publish one support asset (guide/checklist/case study) each week.\n4. Follow up after 5 business days and 12 business days.\n\n## Target Classes\n${targets
  .map(
    (t) => `- **${t.tier}** | ${t.prospect_type}: ${t.angle}. Asset: ${t.link_asset}. Offer: ${t.outreach_offer}.`,
  )
  .join('\n')}\n\n## Outreach Templates\n### Initial pitch\nSubject: Resource idea for your [audience]\n\nHi [Name],\nI noticed your content on [topic]. We built a practical guide on [angle] that your readers can apply immediately. If helpful, I can send a concise outline and checklist version for review.\n\n### Follow-up 1\nHi [Name], sharing this once in case it helps your editorial calendar. Happy to tailor it for your audience and include concrete examples.\n\n### Follow-up 2\nLast note from me. If this topic is not a fit now, no problem. I can send different angles around [meals/tasks/workouts/lifestyle] if useful later.\n`;

mkdirSync(resolve(root, 'reports/seo'), { recursive: true });
writeFileSync(resolve(root, `reports/seo/backlink-plan-${today}.csv`), csv, 'utf8');
writeFileSync(resolve(root, 'reports/seo/backlink-plan-latest.csv'), csv, 'utf8');
writeFileSync(resolve(root, `reports/seo/backlink-plan-${today}.md`), markdown, 'utf8');
writeFileSync(resolve(root, 'reports/seo/backlink-plan-latest.md'), markdown, 'utf8');

console.log('Generated backlink plan artifacts in reports/seo');
