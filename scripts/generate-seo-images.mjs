import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { freeToolPages } from '../src/data/freeToolsContent.ts';
import { comparisonPages } from '../src/data/comparisonContent.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const seoGeneratedDir = path.join(publicDir, 'seo', 'generated');
const landingDir = path.join(publicDir, 'landing');

const bannedTitleTerms = [
  'diagram', 'logo', 'icon', 'map', 'flag', 'coat of arms', 'symbol', 'drawing',
  'illustration', 'poster', 'chart', 'graph', 'screenshot', 'vector', 'seal', 'emblem',
  'coat_of_arms', 'coat-of-arms', 'svg', 'wikidata', 'wordmark', 'insignia',
];

const categoryPromptHints = {
  'meal-plans': 'family meal planning dinner table healthy food',
  'grocery-lists': 'grocery shopping cart produce aisle supermarket',
  'pantry-meals': 'pantry shelves canned food home kitchen ingredients',
  'recipe-collections': 'recipe cards cookbook food photography kitchen',
  'household-templates': 'family planning whiteboard checklist home routine',
  'macro-plans': 'healthy meal prep containers high protein food',
  'chore-systems': 'family chores cleaning home organization',
  'task-systems': 'household task planning checklist calendar desk',
  'workout-tracking': 'home workout strength training fitness journal',
  'lifestyle-tracking': 'sleep wellness hydration healthy habits home',
};

function sanitizeFileBase(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

function extFromUrl(url) {
  const clean = url.split('?')[0].toLowerCase();
  if (clean.endsWith('.jpeg')) return 'jpeg';
  if (clean.endsWith('.jpg')) return 'jpg';
  if (clean.endsWith('.png')) return 'png';
  return null;
}

async function searchWikimediaPhoto(query) {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${query} photo`,
    gsrnamespace: '6',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '1920',
    format: 'json',
    origin: '*',
  });

  const url = `https://commons.wikimedia.org/w/api.php?${params.toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'HomeHarmonySeoImageBot/1.0' } });
  if (!res.ok) throw new Error(`Wikimedia search failed (${res.status}) for query: ${query}`);
  const payload = await res.json();
  const pages = Object.values(payload?.query?.pages || {});

  const candidates = pages
    .map((page) => {
      const info = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
      const thumburl = info?.thumburl || info?.url || '';
      return {
        title: String(page?.title || ''),
        thumburl,
        width: Number(info?.thumbwidth || 0),
        height: Number(info?.thumbheight || 0),
      };
    })
    .filter((item) => {
      if (!item.thumburl) return false;
      const ext = extFromUrl(item.thumburl);
      if (!ext || (ext !== 'jpg' && ext !== 'jpeg')) return false;
      if (item.width < 900 || item.height < 500) return false;
      if (item.width / item.height < 1.15) return false;
      const title = item.title.toLowerCase();
      return !bannedTitleTerms.some((term) => title.includes(term));
    })
    .sort((a, b) => b.width * b.height - a.width * a.height);

  return candidates[0] || null;
}

async function downloadToFile(url, outputPath) {
  const res = await fetch(url, { headers: { 'User-Agent': 'HomeHarmonySeoImageBot/1.0' } });
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  const arrayBuffer = await res.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
}

function pageEntries() {
  const entries = [];

  for (const category of seoCategories) {
    entries.push({
      key: `category:${category.slug}`,
      slug: category.slug,
      title: category.title,
      description: category.description,
      query: `${category.title} ${categoryPromptHints[category.slug] || ''}`.trim(),
      outputRel: `/seo/generated/category-${category.slug}.jpg`,
      categorySlug: category.slug,
    });
  }

  const groups = [
    ['meal', mealPlanPages, 'meal-plans'],
    ['grocery', groceryListPages, 'grocery-lists'],
    ['pantry', pantryMealPages, 'pantry-meals'],
    ['recipes', recipeCollectionPages, 'recipe-collections'],
    ['household', householdTemplatePages, 'household-templates'],
    ['macro', macroPlanPages, 'macro-plans'],
    ['chore', choreSystemPages, 'chore-systems'],
    ['task', taskSystemPages, 'task-systems'],
    ['workout', workoutTrackingPages, 'workout-tracking'],
    ['lifestyle', lifestyleTrackingPages, 'lifestyle-tracking'],
  ];

  for (const [prefix, pages, categorySlug] of groups) {
    for (const page of pages) {
      entries.push({
        key: `${prefix}:${page.slug}`,
        slug: page.slug,
        title: page.title,
        description: page.description,
        query: `${page.title} ${categoryPromptHints[categorySlug] || ''}`.trim(),
        outputRel: `/seo/generated/${prefix}-${sanitizeFileBase(page.slug)}.jpg`,
        categorySlug,
      });
    }
  }

  for (const page of freeToolPages) {
    entries.push({
      key: `tool:${page.slug}`,
      slug: page.slug,
      title: page.title,
      description: page.description,
      query: `${page.title} family planning tool real life`.trim(),
      outputRel: `/seo/generated/tool-${sanitizeFileBase(page.slug)}.jpg`,
      categorySlug: 'task-systems',
    });
  }

  for (const page of comparisonPages) {
    entries.push({
      key: `compare:${page.slug}`,
      slug: page.slug,
      title: page.title,
      description: page.description,
      query: `${page.title} family planning app`.trim(),
      outputRel: `/seo/generated/compare-${sanitizeFileBase(page.slug)}.jpg`,
      categorySlug: 'task-systems',
    });
  }

  entries.push(
    {
      key: 'landing:hero',
      slug: 'landing-hero-family',
      title: 'Family meal planning at home',
      description: 'Family using meal plan and grocery list',
      query: 'modern family kitchen meal planning healthy dinner',
      outputRel: '/landing/hero-family.jpg',
      categorySlug: 'meal-plans',
    },
    {
      key: 'landing:usecase-family',
      slug: 'landing-usecase-family',
      title: 'Busy parents family planning',
      description: 'Parents coordinating family schedule',
      query: 'busy parents family schedule at home evening routine',
      outputRel: '/landing/usecase-family.jpg',
      categorySlug: 'household-templates',
    },
    {
      key: 'landing:usecase-mealprep',
      slug: 'landing-usecase-mealprep',
      title: 'Meal prep containers healthy food',
      description: 'Meal prep and grocery planning',
      query: 'meal prep containers high protein food kitchen counter',
      outputRel: '/landing/usecase-mealprep.jpg',
      categorySlug: 'macro-plans',
    },
    {
      key: 'landing:usecase-wellness',
      slug: 'landing-usecase-wellness',
      title: 'Family wellness and lifestyle habits',
      description: 'Wellness tracking sleep hydration habits',
      query: 'family wellness habits hydration sleep healthy lifestyle',
      outputRel: '/landing/usecase-wellness.jpg',
      categorySlug: 'lifestyle-tracking',
    },
  );

  return entries;
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

async function writeUpdatedContentFiles(imageBySlug) {
  const seoContentPath = path.join(root, 'src/data/seoContent.ts');
  let seoText = await fs.readFile(seoContentPath, 'utf8');

  const seoSlugs = [
    ...seoCategories.map((x) => x.slug),
    ...mealPlanPages.map((x) => x.slug),
    ...groceryListPages.map((x) => x.slug),
    ...pantryMealPages.map((x) => x.slug),
    ...recipeCollectionPages.map((x) => x.slug),
    ...householdTemplatePages.map((x) => x.slug),
    ...macroPlanPages.map((x) => x.slug),
    ...choreSystemPages.map((x) => x.slug),
    ...taskSystemPages.map((x) => x.slug),
    ...workoutTrackingPages.map((x) => x.slug),
    ...lifestyleTrackingPages.map((x) => x.slug),
  ];

  const seoMap = new Map();
  for (const slug of seoSlugs) {
    const rel = imageBySlug.get(slug);
    if (rel) seoMap.set(slug, rel);
  }
  seoText = updateHeroImagesBySlug(seoText, seoMap);
  await fs.writeFile(seoContentPath, seoText);

  const freePath = path.join(root, 'src/data/freeToolsContent.ts');
  let freeText = await fs.readFile(freePath, 'utf8');
  const freeMap = new Map();
  for (const page of freeToolPages) {
    const rel = imageBySlug.get(page.slug);
    if (rel) freeMap.set(page.slug, rel);
  }
  freeText = updateHeroImagesBySlug(freeText, freeMap);
  await fs.writeFile(freePath, freeText);

  const cmpPath = path.join(root, 'src/data/comparisonContent.ts');
  let cmpText = await fs.readFile(cmpPath, 'utf8');
  const cmpMap = new Map();
  for (const page of comparisonPages) {
    const rel = imageBySlug.get(page.slug);
    if (rel) cmpMap.set(page.slug, rel);
  }
  cmpText = updateHeroImagesBySlug(cmpText, cmpMap);
  await fs.writeFile(cmpPath, cmpText);

  const landingPath = path.join(root, 'src/pages/LandingPage.tsx');
  let landingText = await fs.readFile(landingPath, 'utf8');
  landingText = landingText
    .replace(/\/landing\/hero-family\.svg/g, '/landing/hero-family.jpg')
    .replace(/\/landing\/usecase-family\.svg/g, '/landing/usecase-family.jpg')
    .replace(/\/landing\/usecase-mealprep\.svg/g, '/landing/usecase-mealprep.jpg')
    .replace(/\/landing\/usecase-wellness\.svg/g, '/landing/usecase-wellness.jpg');
  await fs.writeFile(landingPath, landingText);
}

async function generateCategoryPngFallbacks(imageBySlug) {
  const categoryNames = [
    'meal-plans',
    'grocery-lists',
    'pantry-meals',
    'recipe-collections',
    'household-templates',
    'macro-plans',
    'chore-systems',
    'task-systems',
    'workout-tracking',
    'lifestyle-tracking',
  ];

  for (const slug of categoryNames) {
    const rel = imageBySlug.get(slug);
    if (!rel) continue;
    const src = path.join(publicDir, rel.slice(1));
    const out = path.join(publicDir, 'seo', `${slug}.png`);
    try {
      const { spawn } = await import('node:child_process');
      await new Promise((resolve, reject) => {
        const child = spawn('sips', ['-s', 'format', 'png', src, '--out', out]);
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`sips exit ${code}`))));
        child.on('error', reject);
      });
    } catch (error) {
      console.warn(`WARN: Could not create ${out}:`, error.message);
    }
  }
}

async function main() {
  await fs.mkdir(seoGeneratedDir, { recursive: true });
  await fs.mkdir(landingDir, { recursive: true });

  const entries = pageEntries();
  const imageBySlug = new Map();

  for (const entry of entries) {
    const outPath = path.join(publicDir, entry.outputRel.slice(1));
    await fs.mkdir(path.dirname(outPath), { recursive: true });

    let candidate = null;
    const queryVariants = [
      entry.query,
      `${entry.title} ${categoryPromptHints[entry.categorySlug] || ''}`.trim(),
      `${entry.description || ''} ${categoryPromptHints[entry.categorySlug] || ''}`.trim(),
      categoryPromptHints[entry.categorySlug] || 'family home planning lifestyle',
    ].filter(Boolean);

    for (const query of queryVariants) {
      try {
        candidate = await searchWikimediaPhoto(query);
      } catch {
        candidate = null;
      }
      if (candidate?.thumburl) break;
    }

    if (!candidate?.thumburl) {
      console.warn(`WARN: No image found for ${entry.key}`);
      continue;
    }

    try {
      await downloadToFile(candidate.thumburl, outPath);
      imageBySlug.set(entry.slug, entry.outputRel);
      console.log(`OK  ${entry.key} -> ${entry.outputRel}`);
    } catch (error) {
      console.warn(`WARN: Failed download for ${entry.key}: ${error.message}`);
    }
  }

  await writeUpdatedContentFiles(imageBySlug);
  await generateCategoryPngFallbacks(imageBySlug);

  console.log(`Generated images for ${imageBySlug.size} entries.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
