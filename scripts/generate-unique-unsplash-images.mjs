import fs from 'node:fs/promises';
import path from 'node:path';

import {
  seoCategories,
  mealPlanPages,
  groceryListPages,
  pantryMealPages,
  recipeCollectionPages,
  householdTemplatePages,
  macroPlanPages,
  choreSystemPages,
  taskSystemPages,
  workoutTrackingPages,
  lifestyleTrackingPages,
} from '../src/data/seoContent.ts';
import { comparisonPages } from '../src/data/comparisonContent.ts';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const seoDir = path.join(publicDir, 'seo');
const seoUniqueDir = path.join(seoDir, 'unique');
const landingDir = path.join(publicDir, 'landing');

const categoryTags = {
  'meal-plans': 'family dinner meal prep healthy food weeknight',
  'grocery-lists': 'grocery shopping produce supermarket cart',
  'pantry-meals': 'pantry kitchen ingredients shelf home cooking',
  'recipe-collections': 'recipe cooking kitchen plated food',
  'household-templates': 'home planning desk notebook calendar organization',
  'macro-plans': 'meal prep high protein healthy nutrition',
  'chore-systems': 'home cleaning chores household organization',
  'task-systems': 'task planning to-do list calendar desk',
  'workout-tracking': 'fitness workout training gym home workout',
  'lifestyle-tracking': 'wellness hydration sleep healthy lifestyle',
};

function slugify(input) {
  return String(input).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

function categoryForSlug(slug) {
  if (seoCategories.some((x) => x.slug === slug)) return slug;
  if (mealPlanPages.some((x) => x.slug === slug)) return 'meal-plans';
  if (groceryListPages.some((x) => x.slug === slug)) return 'grocery-lists';
  if (pantryMealPages.some((x) => x.slug === slug)) return 'pantry-meals';
  if (recipeCollectionPages.some((x) => x.slug === slug)) return 'recipe-collections';
  if (householdTemplatePages.some((x) => x.slug === slug)) return 'household-templates';
  if (macroPlanPages.some((x) => x.slug === slug)) return 'macro-plans';
  if (choreSystemPages.some((x) => x.slug === slug)) return 'chore-systems';
  if (taskSystemPages.some((x) => x.slug === slug)) return 'task-systems';
  if (workoutTrackingPages.some((x) => x.slug === slug)) return 'workout-tracking';
  if (lifestyleTrackingPages.some((x) => x.slug === slug)) return 'lifestyle-tracking';
  if (comparisonPages.some((x) => x.slug === slug)) return 'task-systems';
  return 'task-systems';
}

const allEntries = [
  ...seoCategories.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...mealPlanPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...groceryListPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...pantryMealPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...recipeCollectionPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...householdTemplatePages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...macroPlanPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...choreSystemPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...taskSystemPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...workoutTrackingPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...lifestyleTrackingPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
  ...comparisonPages.map((x) => ({ slug: x.slug, title: x.title, description: x.description })),
];

const seen = new Set();
const entries = allEntries.filter((x) => {
  if (seen.has(x.slug)) return false;
  seen.add(x.slug);
  return true;
});

function buildQueries(entry, categorySlug) {
  const tags = categoryTags[categorySlug] || 'home planning';
  const title = entry.title.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const desc = (entry.description || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const slugWords = entry.slug.replace(/-/g, ' ');
  const q = [
    `${title} ${tags}`.trim(),
    `${slugWords} ${tags}`.trim(),
    `${desc} ${tags}`.trim(),
    tags,
  ];
  return [...new Set(q.filter(Boolean).map((x) => x.slice(0, 120)))];
}

async function unsplashSearch(query, page) {
  const url = `https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=30&page=${page}&orientation=landscape`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`search ${res.status}`);
  return res.json();
}

function pickCandidate(results, usedIds) {
  for (const r of results || []) {
    if (!r || usedIds.has(r.id)) continue;
    if (r.plus || r.premium || r.sponsorship) continue;
    if (!r.urls?.raw) continue;
    const w = Number(r.width || 0);
    const h = Number(r.height || 0);
    if (w < 1200 || h < 700) continue;
    if (w / h < 1.2) continue;
    return r;
  }
  return null;
}

async function downloadImage(rawUrl, outPath) {
  const url = `${rawUrl}&auto=format&fit=crop&w=1600&h=900&q=80`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`download ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
}

function updateHeroImagesBySlug(source, replacementsBySlug) {
  let output = source;
  for (const [slug, relPath] of replacementsBySlug.entries()) {
    const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(slug:\\s*'${escaped}',[\\s\\S]*?heroImage:\\s*)'[^']*'`);
    output = output.replace(pattern, `$1'${relPath}'`);
  }
  return output;
}

async function updateDataFiles(mapBySlug) {
  const seoPath = path.join(root, 'src/data/seoContent.ts');
  const cmpPath = path.join(root, 'src/data/comparisonContent.ts');

  let seo = await fs.readFile(seoPath, 'utf8');
  seo = updateHeroImagesBySlug(seo, mapBySlug);
  await fs.writeFile(seoPath, seo);

  let cmp = await fs.readFile(cmpPath, 'utf8');
  cmp = updateHeroImagesBySlug(cmp, mapBySlug);
  await fs.writeFile(cmpPath, cmp);
}

async function main() {
  await fs.mkdir(seoUniqueDir, { recursive: true });
  await fs.mkdir(landingDir, { recursive: true });

  const usedIds = new Set();
  const mapBySlug = new Map();
  const credits = [];

  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    const categorySlug = categoryForSlug(entry.slug);
    const queries = buildQueries(entry, categorySlug);
    let pick = null;

    for (const query of queries) {
      for (let page = 1; page <= 4; page += 1) {
        let payload;
        try {
          payload = await unsplashSearch(query, page);
        } catch {
          payload = null;
        }
        pick = pickCandidate(payload?.results, usedIds);
        if (pick) break;
      }
      if (pick) break;
    }

    if (!pick) {
      for (let page = 1; page <= 6; page += 1) {
        const payload = await unsplashSearch(categoryTags[categorySlug], page);
        pick = pickCandidate(payload?.results, usedIds);
        if (pick) break;
      }
    }

    if (!pick) {
      console.warn(`WARN no image: ${entry.slug}`);
      continue;
    }

    usedIds.add(pick.id);
    const rel = `/seo/unique/${slugify(entry.slug)}.jpg`;
    const outPath = path.join(publicDir, rel.slice(1));
    await downloadImage(pick.urls.raw, outPath);
    mapBySlug.set(entry.slug, rel);
    credits.push({
      slug: entry.slug,
      unsplashId: pick.id,
      photographer: pick.user?.name || '',
      photographerProfile: pick.user?.links?.html || '',
      sourcePage: pick.links?.html || '',
    });
    console.log(`${String(i + 1).padStart(3, '0')}/${entries.length} ${entry.slug} -> ${pick.id}`);
  }

  await updateDataFiles(mapBySlug);

  const landingEntries = [
    { key: 'hero-family', query: 'happy family dinner table home kitchen' },
    { key: 'usecase-family', query: 'family planning calendar desk home' },
    { key: 'usecase-mealprep', query: 'meal prep containers healthy food' },
    { key: 'usecase-wellness', query: 'wellness healthy habits water sleep' },
  ];

  for (const le of landingEntries) {
    let pick = null;
    for (let page = 1; page <= 4; page += 1) {
      const payload = await unsplashSearch(le.query, page);
      pick = pickCandidate(payload?.results, usedIds);
      if (pick) break;
    }
    if (!pick) continue;

    usedIds.add(pick.id);
    const outPath = path.join(landingDir, `${le.key}.jpg`);
    await downloadImage(pick.urls.raw, outPath);
    credits.push({
      slug: `landing-${le.key}`,
      unsplashId: pick.id,
      photographer: pick.user?.name || '',
      photographerProfile: pick.user?.links?.html || '',
      sourcePage: pick.links?.html || '',
    });
    console.log(`landing ${le.key} -> ${pick.id}`);
  }

  await fs.writeFile(path.join(publicDir, 'seo', 'image-credits.json'), JSON.stringify(credits, null, 2));

  console.log(`DONE total unique images: ${usedIds.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
