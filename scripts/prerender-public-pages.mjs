import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import vm from "node:vm";

const SITE_ORIGIN = "https://www.homeharmonyhq.com";
const repoRoot = resolve(process.cwd());
const distDir = resolve(repoRoot, "dist");
const distIndexPath = resolve(distDir, "index.html");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadLiteralExports(filePath, exportNames) {
  let source = readFileSync(filePath, "utf8");
  source = source
    .replace(/export type[\s\S]*?;\n/g, "")
    .replace(/export interface[\s\S]*?\n}\n/g, "")
    .replace(/export const /g, "const ");

  const sandbox = {};
  vm.runInNewContext(
    `${source}\n;globalThis.__exports = { ${exportNames.join(", ")} };`,
    sandbox,
    { filename: filePath },
  );
  return sandbox.__exports;
}

function setTagContent(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

function setMetaByName(html, name, content) {
  const safeContent = escapeHtml(content);
  const pattern = new RegExp(
    `<meta[^>]+name=["']${escapeRegExp(name)}["'][^>]*content=["'][^"']*["'][^>]*>`,
    "i",
  );
  return setTagContent(html, pattern, `<meta name="${name}" content="${safeContent}" />`);
}

function setMetaByProperty(html, property, content) {
  const safeContent = escapeHtml(content);
  const pattern = new RegExp(
    `<meta[^>]+property=["']${escapeRegExp(property)}["'][^>]*content=["'][^"']*["'][^>]*>`,
    "i",
  );
  return setTagContent(html, pattern, `<meta property="${property}" content="${safeContent}" />`);
}

function setCanonical(html, href) {
  const safeHref = escapeHtml(href);
  const pattern = /<link[^>]+rel=["']canonical["'][^>]*href=["'][^"']*["'][^>]*>/i;
  return setTagContent(html, pattern, `<link rel="canonical" href="${safeHref}" />`);
}

function buildBreadcrumbs(route) {
  return route.breadcrumbs.map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: item.name,
    item: `${SITE_ORIGIN}${item.url}`,
  }));
}

function buildSchema(route) {
  const canonicalUrl = `${SITE_ORIGIN}${route.path}`;
  const imageUrl = route.image.startsWith("http") ? route.image : `${SITE_ORIGIN}${route.image}`;
  const graph = [
    {
      "@type": "Organization",
      name: "Home Harmony",
      url: SITE_ORIGIN,
      logo: `${SITE_ORIGIN}/landing/hero-family.jpg`,
    },
    {
      "@type": "WebSite",
      name: "Home Harmony",
      url: SITE_ORIGIN,
      description: "Family meal planner app with grocery, calendar, chores, tasks, and routines.",
    },
    {
      "@type": route.type === "article" ? "Article" : "WebPage",
      headline: route.title,
      name: route.title,
      description: route.description,
      url: canonicalUrl,
      image: [imageUrl],
      author: {
        "@type": "Organization",
        name: "Home Harmony Team",
      },
      publisher: {
        "@type": "Organization",
        name: "Home Harmony",
        logo: {
          "@type": "ImageObject",
          url: `${SITE_ORIGIN}/landing/hero-family.jpg`,
        },
      },
      datePublished: route.publishedAt || "2026-02-21",
      dateModified: route.modifiedAt || "2026-04-21",
      mainEntityOfPage: canonicalUrl,
      about: route.keywords,
    },
  ];

  if (route.breadcrumbs.length > 0) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: buildBreadcrumbs(route),
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

function renderRootMarkup(route) {
  const highlights = route.highlights
    .slice(0, 4)
    .map(
      (item) =>
        `<li style="margin:0 0 12px 20px;line-height:1.65;color:#5e5549;">${escapeHtml(item)}</li>`,
    )
    .join("");

  const links = route.links
    .slice(0, 4)
    .map(
      (link) =>
        `<a href="${escapeHtml(link.href)}" style="display:inline-block;margin:0 10px 10px 0;padding:10px 16px;border:1px solid #d8cfc3;border-radius:999px;color:#2f7f61;text-decoration:none;font-weight:600;">${escapeHtml(link.label)}</a>`,
    )
    .join("");

  return `
    <main style="max-width:960px;margin:0 auto;padding:56px 24px 80px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#201813;background:#fff;">
      <p style="margin:0 0 14px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#2f7f61;">Home Harmony</p>
      <h1 style="margin:0 0 18px;font-size:52px;line-height:1.02;font-family:Georgia,'Times New Roman',serif;color:#1f1913;">${escapeHtml(route.heading || route.title)}</h1>
      <p style="margin:0 0 24px;max-width:760px;font-size:20px;line-height:1.7;color:#5e5549;">${escapeHtml(route.description)}</p>
      <p style="margin:0 0 32px;max-width:760px;font-size:16px;line-height:1.75;color:#5e5549;">${escapeHtml(route.intro)}</p>
      <section style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(280px,0.7fr);gap:28px;align-items:start;">
        <div style="padding:28px;border:1px solid #ece2d7;border-radius:24px;background:#fffdfb;">
          <h2 style="margin:0 0 18px;font-size:24px;font-family:Georgia,'Times New Roman',serif;color:#1f1913;">Why this page matters</h2>
          <ul style="margin:0;padding:0 0 0 4px;list-style:disc;">${highlights}</ul>
        </div>
        <div style="padding:28px;border:1px solid #ece2d7;border-radius:24px;background:#f7fbf8;">
          <h2 style="margin:0 0 16px;font-size:24px;font-family:Georgia,'Times New Roman',serif;color:#1f1913;">Keep exploring</h2>
          <div>${links}</div>
        </div>
      </section>
    </main>
  `.trim();
}

function getArrayHighlights(page) {
  return Object.entries(page)
    .filter(([key, value]) => Array.isArray(value) && key !== "faq")
    .flatMap(([, value]) => value)
    .filter((item) => typeof item === "string")
    .slice(0, 4);
}

function buildHtml(baseHtml, route) {
  const canonicalUrl = `${SITE_ORIGIN}${route.path}`;
  const imageUrl = route.image.startsWith("http") ? route.image : `${SITE_ORIGIN}${route.image}`;
  const keywords = route.keywords.join(", ");
  let html = baseHtml;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(route.title)}</title>`);
  html = setCanonical(html, canonicalUrl);
  html = setMetaByName(html, "description", route.description);
  html = setMetaByName(html, "keywords", keywords);
  html = setMetaByName(html, "robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
  html = setMetaByProperty(html, "og:title", route.title);
  html = setMetaByProperty(html, "og:description", route.description);
  html = setMetaByProperty(html, "og:type", route.type);
  html = setMetaByProperty(html, "og:site_name", "Home Harmony");
  html = setMetaByProperty(html, "og:url", canonicalUrl);
  html = setMetaByProperty(html, "og:image", imageUrl);
  html = setMetaByName(html, "twitter:title", route.title);
  html = setMetaByName(html, "twitter:description", route.description);
  html = setMetaByName(html, "twitter:image", imageUrl);

  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application/ld+json">${JSON.stringify(buildSchema(route))}</script>`,
  );

  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${renderRootMarkup(route)}</div>`);

  return html;
}

const seoData = loadLiteralExports(resolve(repoRoot, "src/data/seoContent.ts"), [
  "seoCategories",
  "mealPlanPages",
  "groceryListPages",
  "pantryMealPages",
  "recipeCollectionPages",
  "householdTemplatePages",
  "macroPlanPages",
  "choreSystemPages",
  "taskSystemPages",
  "workoutTrackingPages",
  "lifestyleTrackingPages",
]);

const comparisonData = loadLiteralExports(resolve(repoRoot, "src/data/comparisonContent.ts"), ["comparisonPages"]);
const templateData = loadLiteralExports(resolve(repoRoot, "src/data/templateGalleryContent.ts"), ["templatePacks"]);

const baseHtml = readFileSync(distIndexPath, "utf8");

const hubConfigs = {
  "meal-plans": {
    path: "/meal-plans",
    title: "Weekly Meal Plans for Families | Home Harmony",
    keywords: ["weekly meal plans for families", "family meal planner", "meal planning app for families"],
  },
  "grocery-lists": {
    path: "/grocery-lists",
    title: "Family Grocery List Guides | Home Harmony",
    keywords: ["family grocery list", "weekly grocery list for families", "grocery planning app"],
  },
  "pantry-meals": {
    path: "/pantry-meals",
    title: "Pantry Meal Guides for Families | Home Harmony",
    keywords: ["pantry meals", "cook from pantry", "meals with ingredients I have"],
  },
  "recipe-collections": {
    path: "/recipe-collections",
    title: "Family Recipe Collections | Home Harmony",
    keywords: ["family recipe collection", "kid friendly recipes", "quick dinner recipes"],
  },
  "household-templates": {
    path: "/household-templates",
    title: "Household Routine and Chore Templates | Home Harmony",
    keywords: ["household template", "chore chart template", "family routine template"],
  },
  "macro-plans": {
    path: "/macro-plans",
    title: "Macro Meal Plan Guides | Home Harmony",
    keywords: ["macro meal plan", "high protein plan", "family macro tracking"],
  },
  "chore-systems": {
    path: "/chore-systems",
    title: "Family Chore System Guides | Home Harmony",
    keywords: ["family chore system", "chore chart app", "shared chore tracker"],
  },
  "task-systems": {
    path: "/task-systems",
    title: "Household Task System Guides | Home Harmony",
    keywords: ["family task management", "household task tracker", "shared to do app for families"],
  },
  "workout-tracking": {
    path: "/workout-tracking",
    title: "Workout Tracking for Busy Families | Home Harmony",
    keywords: ["workout tracker app", "family fitness planner", "strength training tracker"],
  },
  "lifestyle-tracking": {
    path: "/lifestyle-tracking",
    title: "Lifestyle and Wellness Tracking for Families | Home Harmony",
    keywords: ["lifestyle tracking", "period tracking planner", "habit tracker app"],
  },
};

const collectionConfigs = [
  { base: "/meal-plans", pages: seoData.mealPlanPages },
  { base: "/grocery-lists", pages: seoData.groceryListPages },
  { base: "/pantry-meals", pages: seoData.pantryMealPages },
  { base: "/recipe-collections", pages: seoData.recipeCollectionPages },
  { base: "/household-templates", pages: seoData.householdTemplatePages },
  { base: "/macro-plans", pages: seoData.macroPlanPages },
  { base: "/chore-systems", pages: seoData.choreSystemPages },
  { base: "/task-systems", pages: seoData.taskSystemPages },
  { base: "/workout-tracking", pages: seoData.workoutTrackingPages },
  { base: "/lifestyle-tracking", pages: seoData.lifestyleTrackingPages },
];

const routes = [
  {
    path: "/",
    title: "Home Harmony | Family Meal Planning, Grocery, Calendar, Chores, and Tasks",
    heading: "Family meal planning, grocery, chores, tasks, and routines in one place",
    description:
      "Home Harmony helps families plan meals, automate grocery lists, coordinate calendars, manage chores, track tasks, and stay on top of daily routines in one app.",
    image: "/landing/hero-family.jpg",
    keywords: [
      "family meal planner app",
      "shared grocery list",
      "family organizer app",
      "household task management",
      "family calendar and chores app",
    ],
    type: "website",
    breadcrumbs: [{ name: "Home", url: "/" }],
    intro:
      "Home Harmony is built for families who want one operating system for meal planning, grocery automation, calendars, chores, tasks, workouts, and household follow-through.",
    highlights: [
      "Plan family meals and turn them into one shared grocery workflow.",
      "Coordinate calendars, chores, tasks, and routines from the same place.",
      "Support individual dashboards without losing the shared family system.",
      "Reduce household mental load with one connected weekly rhythm.",
    ],
    links: [
      { href: "/family-meal-planner", label: "Family Meal Planner" },
      { href: "/resources", label: "Resource Library" },
      { href: "/compare", label: "Compare Home Harmony" },
      { href: "/signin", label: "Sign In" },
    ],
    modifiedAt: "2026-04-21",
  },
  {
    path: "/family-meal-planner",
    title: "Meal Planning App for Families | Weekly Meal Planner, Grocery, Calendar, and Chores",
    heading: "A meal planning app for families that also handles grocery, calendar, chores, and tasks",
    description:
      "See how Home Harmony helps families plan weekly meals, build grocery lists automatically, coordinate shared calendars, and keep chores and tasks moving together.",
    image: "/landing/hero-family.jpg",
    keywords: [
      "family meal planner",
      "meal planning app for families",
      "weekly meal planner for families",
      "automated meal planner for family",
    ],
    type: "website",
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Family Meal Planner", url: "/family-meal-planner" },
    ],
    intro:
      "This page is the main entry point for families who want meal planning tied directly to grocery, routines, chores, and shared household execution instead of managing separate apps.",
    highlights: [
      "Weekly family meal planning with shared grocery rollups and day locks.",
      "One workflow for meals, grocery, chores, tasks, and family calendar coordination.",
      "Personal dashboards for adults with shared family systems underneath.",
      "A setup flow that supports owners and invited spouses differently.",
    ],
    links: [
      { href: "/meal-plans", label: "Meal Plan Guides" },
      { href: "/grocery-lists", label: "Grocery Guides" },
      { href: "/resources", label: "All Resources" },
      { href: "/signin", label: "Open Home Harmony" },
    ],
    modifiedAt: "2026-04-21",
  },
  {
    path: "/resources",
    title: "Home Harmony Resources | Meals, Grocery, Chores, Tasks, Workouts, and Lifestyle Planning",
    heading: "Systems for meals, groceries, chores, tasks, and routines",
    description:
      "Explore practical Home Harmony resources for meal planning, grocery lists, pantry cooking, recipe collections, household templates, task systems, chore systems, workouts, and lifestyle tracking.",
    image: "/seo/meal-plans.jpg",
    keywords: [
      "family planner resources",
      "meal planning guides",
      "family grocery list guides",
      "household task systems",
    ],
    type: "website",
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Resources", url: "/resources" },
    ],
    intro:
      "The Home Harmony resource library is organized around real family bottlenecks: meals, grocery, chores, tasks, routines, workouts, and lifestyle consistency.",
    highlights: [
      "Use the meal and grocery guides to tighten weekly planning first.",
      "Move into chores and task systems once the food workflow is steady.",
      "Layer workout and lifestyle tracking after the household base is running well.",
      "Use comparison pages and templates to speed up setup decisions.",
    ],
    links: [
      { href: "/family-meal-planner", label: "Family Meal Planner" },
      { href: "/compare", label: "Comparison Guides" },
      { href: "/templates", label: "Template Gallery" },
      { href: "/signin", label: "Open Home Harmony" },
    ],
    modifiedAt: "2026-04-21",
  },
  {
    path: "/compare",
    title: "Home Harmony Comparisons | Mealime, Cozi, AnyList, and Todoist Alternatives",
    heading: "Home Harmony vs popular family tools",
    description:
      "Compare Home Harmony with Mealime, Cozi, AnyList, and Todoist for family operations, meal planning, grocery automation, chores, tasks, and routines.",
    image: "/seo/task-systems.jpg",
    keywords: [
      "home harmony vs mealime",
      "home harmony vs cozi",
      "home harmony vs anylist",
      "home harmony vs todoist",
      "best family organizer app",
    ],
    type: "website",
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Resources", url: "/resources" },
      { name: "Comparisons", url: "/compare" },
    ],
    intro:
      "These comparison pages are written for families choosing between calendar-first, shopping-first, and generic productivity tools versus a more connected home-operations system.",
    highlights: [
      "Compare Home Harmony against Cozi, AnyList, and Todoist with migration checklists.",
      "See where Home Harmony is strongest for meals, grocery, chores, and task ownership.",
      "Use one-week pilots instead of static feature checklists to choose the right fit.",
      "Map your core bottleneck first so you pick the system that solves the real weekly problem.",
    ],
    links: [
      { href: "/family-meal-planner", label: "Why Home Harmony" },
      { href: "/resources", label: "Browse Resources" },
      { href: "/templates", label: "Browse Templates" },
      { href: "/signin", label: "Open Home Harmony" },
    ],
    modifiedAt: "2026-04-21",
  },
  {
    path: "/templates",
    title: "Household System Templates | Meals, Grocery, Chores, Tasks, Fitness, and Lifestyle | Home Harmony",
    heading: "Plug-and-play household templates for real weekly systems",
    description:
      "Browse Home Harmony templates for meals, grocery workflows, chores, task boards, fitness routines, and lifestyle tracking.",
    image: "/seo/unique/household-templates.jpg",
    keywords: [
      "household templates",
      "family meal planning template",
      "chore system template",
      "family task board template",
    ],
    type: "website",
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Resources", url: "/resources" },
      { name: "Templates", url: "/templates" },
    ],
    intro:
      "The template gallery gives families a faster starting point for meals, grocery, chores, tasks, workouts, and lifestyle routines without rebuilding every system from scratch.",
    highlights: [
      "Use ready-made templates for busy weeknight meals and grocery guardrails.",
      "Start chore and task systems with practical defaults that match family life.",
      "Layer in workout and lifestyle templates once the household base is stable.",
      "Treat templates as starting points, then refine them to your real routine.",
    ],
    links: [
      { href: "/family-meal-planner", label: "Family Meal Planner" },
      { href: "/resources", label: "Resource Library" },
      { href: "/compare", label: "Compare Home Harmony" },
      { href: "/signin", label: "Open Home Harmony" },
    ],
    modifiedAt: "2026-04-21",
  },
];

for (const category of seoData.seoCategories) {
  const config = hubConfigs[category.slug];
  const collection = collectionConfigs.find((entry) => entry.base === config.path);
  routes.push({
    path: config.path,
    title: config.title,
    heading: config.title.replace(" | Home Harmony", ""),
    description: category.description,
    image: category.heroImage,
    keywords: config.keywords,
    type: "website",
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Resources", url: "/resources" },
      { name: config.title.replace(" | Home Harmony", ""), url: config.path },
    ],
    intro: `${category.description} Home Harmony uses these pages to show practical systems that can be implemented inside the app or adapted into an existing family routine.`,
    highlights: [
      ...category.keywords.map((keyword) => `Targeted topic: ${keyword}.`),
      ...(collection?.pages.slice(0, 1).flatMap((page) => getArrayHighlights(page).slice(0, 1)) || []),
    ].slice(0, 4),
    links: [
      ...(collection?.pages.slice(0, 3).map((page) => ({ href: `${config.path}/${page.slug}`, label: page.title })) || []),
      { href: "/resources", label: "Back to Resources" },
    ],
    modifiedAt: "2026-04-21",
  });
}

for (const { base, pages } of collectionConfigs) {
  for (const page of pages) {
    routes.push({
      path: `${base}/${page.slug}`,
      title: `${page.title} | Home Harmony`,
      heading: page.title,
      description: page.description,
      image: page.heroImage,
      keywords: [page.title.toLowerCase(), "family planning guide", "home harmony resources"],
      type: "article",
      breadcrumbs: [
        { name: "Home", url: "/" },
        { name: "Resources", url: "/resources" },
        { name: base.slice(1).replaceAll("-", " "), url: base },
        { name: page.title, url: `${base}/${page.slug}` },
      ],
      intro: `${page.description} Home Harmony uses this page to show a practical planning system that can be applied inside the app or adapted to a weekly family routine.`,
      highlights: getArrayHighlights(page),
      links: [
        { href: base, label: "More in this collection" },
        { href: "/family-meal-planner", label: "Family Meal Planner" },
        { href: "/resources", label: "All Resources" },
        { href: "/signin", label: "Open Home Harmony" },
      ],
      modifiedAt: "2026-04-21",
    });
  }
}

for (const page of comparisonData.comparisonPages) {
  routes.push({
    path: `/compare/${page.slug}`,
    title: `${page.title} | Home Harmony`,
    heading: page.title,
    description: page.description,
    image: page.heroImage,
    keywords: [page.title.toLowerCase(), "family app comparison", `${page.competitor.toLowerCase()} alternative`],
    type: "article",
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Resources", url: "/resources" },
      { name: "Comparisons", url: "/compare" },
      { name: page.title, url: `/compare/${page.slug}` },
    ],
    intro: `${page.description} This comparison is designed to help families choose between a specialized household operations system and a more narrow family tool.`,
    highlights: [...page.bestForHomeHarmony, ...page.whereHomeHarmonyWins].slice(0, 4),
    links: [
      { href: "/compare", label: "More Comparisons" },
      { href: "/family-meal-planner", label: "Why Home Harmony" },
      { href: "/resources", label: "All Resources" },
      { href: "/signin", label: "Open Home Harmony" },
    ],
    modifiedAt: "2026-04-21",
  });
}

for (const page of templateData.templatePacks) {
  routes.push({
    path: `/templates/${page.slug}`,
    title: `${page.title} Template | Home Harmony`,
    heading: page.title,
    description: page.description,
    image: "/seo/unique/household-templates.jpg",
    keywords: [page.title.toLowerCase(), `${page.category.toLowerCase()} template`, "household system template"],
    type: "article",
    breadcrumbs: [
      { name: "Home", url: "/" },
      { name: "Resources", url: "/resources" },
      { name: "Templates", url: "/templates" },
      { name: page.title, url: `/templates/${page.slug}` },
    ],
    intro: `${page.description} Use this Home Harmony template as a starting point, then adjust it to match your household rhythm and the roles inside your family.`,
    highlights: page.highlights,
    links: [
      { href: "/templates", label: "More Templates" },
      { href: "/family-meal-planner", label: "Family Meal Planner" },
      { href: "/resources", label: "All Resources" },
      { href: "/signin", label: "Open Home Harmony" },
    ],
    modifiedAt: "2026-04-21",
  });
}

for (const route of routes) {
  const targetPath =
    route.path === "/" ? distIndexPath : resolve(distDir, route.path.slice(1), "index.html");
  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, buildHtml(baseHtml, route), "utf8");
}

console.log(`Prerendered ${routes.length} public routes.`);
