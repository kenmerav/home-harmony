import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

type ExtractedRecipe = {
  name: string;
  servings: number;
  macrosPerServing: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
  };
  ingredients: string[];
  ingredientsRaw: string;
  instructions: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const match = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
    if (match) {
      const parsed = Number(match[0]);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return fallback;
}

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, " ").trim();
}

function decodeHtml(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toRecipeServings(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  if (typeof raw === "string") {
    const parsed = toNumber(raw, 0);
    if (parsed > 0) return Math.round(parsed);
  }
  if (Array.isArray(raw) && raw.length) {
    return toRecipeServings(raw[0]);
  }
  return 4;
}

function flattenInstruction(value: unknown): string[] {
  if (typeof value === "string") return [normalizeWhitespace(value)];
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenInstruction(item)).filter(Boolean);
  }
  if (typeof value === "object") {
    const node = value as Record<string, unknown>;
    if (typeof node.text === "string") return [normalizeWhitespace(node.text)];
    if (Array.isArray(node.itemListElement)) {
      return node.itemListElement.flatMap((item) => flattenInstruction(item)).filter(Boolean);
    }
  }
  return [];
}

function normalizeRecipe(raw: unknown): ExtractedRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const recipe = raw as Record<string, unknown>;

  const name = typeof recipe.name === "string" ? normalizeWhitespace(recipe.name) : "";
  if (!name) return null;

  const servings = toRecipeServings(recipe.servings);

  const macrosSrcValue = recipe.macrosPerServing ?? recipe.macros ?? recipe.nutrition ?? {};
  const macrosSrc =
    typeof macrosSrcValue === "object" && macrosSrcValue !== null
      ? (macrosSrcValue as Record<string, unknown>)
      : {};

  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .filter((x: unknown) => typeof x === "string")
        .map((s: string) => normalizeWhitespace(s))
        .filter(Boolean)
    : [];

  const ingredientsRaw =
    typeof recipe.ingredientsRaw === "string"
      ? recipe.ingredientsRaw
      : typeof recipe.ingredients_text === "string"
      ? recipe.ingredients_text
      : ingredients.join("\n");

  const instructions = Array.isArray(recipe.instructions)
    ? recipe.instructions
        .filter((x: unknown) => typeof x === "string")
        .map((s: string) => normalizeWhitespace(s))
        .filter(Boolean)
        .join("\n")
    : typeof recipe.instructions === "string"
    ? normalizeWhitespace(recipe.instructions)
    : typeof recipe.directions === "string"
    ? normalizeWhitespace(recipe.directions)
    : "";

  return {
    name,
    servings,
    macrosPerServing: {
      calories: toNumber(macrosSrc.calories, 0),
      protein_g: toNumber(macrosSrc.protein_g, 0),
      carbs_g: toNumber(macrosSrc.carbs_g, 0),
      fat_g: toNumber(macrosSrc.fat_g, 0),
      ...(macrosSrc.fiber_g !== undefined && macrosSrc.fiber_g !== null
        ? { fiber_g: toNumber(macrosSrc.fiber_g, 0) }
        : {}),
    },
    ingredients,
    ingredientsRaw,
    instructions,
  };
}

function uniqueByName(recipes: ExtractedRecipe[]) {
  const seen = new Set<string>();
  return recipes.filter((recipe) => {
    const key = recipe.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function safeParseRecipesJson(maybeJson: string | undefined): unknown[] | null {
  if (!maybeJson) return null;
  const trimmed = maybeJson.trim();
  if (!trimmed) return null;

  const getRecipes = (parsed: unknown): unknown[] | null => {
    if (!parsed || typeof parsed !== "object") return null;
    const recipes = (parsed as { recipes?: unknown }).recipes;
    return Array.isArray(recipes) ? recipes : null;
  };

  try {
    const parsed = JSON.parse(trimmed);
    const recipes = getRecipes(parsed);
    if (recipes) return recipes;
  } catch {
    // ignore
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
      const recipes = getRecipes(parsed);
      if (recipes) return recipes;
    } catch {
      // ignore
    }
  }

  return null;
}

function extractMetaTag(html: string, attr: string, key: string): string {
  const pattern = new RegExp(
    `<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]).trim() : "";
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(normalizeWhitespace(match[1])) : "";
}

function extractVisibleText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const text = withoutScripts
    .replace(/<\/(p|div|h1|h2|h3|h4|li|br|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(text)
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectRecipeNodes(node: unknown, out: Record<string, unknown>[]) {
  if (!node) return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectRecipeNodes(item, out));
    return;
  }
  if (typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  const typeVal = obj["@type"];
  const types = Array.isArray(typeVal) ? typeVal : [typeVal];
  const isRecipe = types.some(
    (t) => typeof t === "string" && t.toLowerCase().includes("recipe"),
  );
  if (isRecipe) out.push(obj);

  if (obj["@graph"]) collectRecipeNodes(obj["@graph"], out);
}

function mapJsonLdRecipe(recipeNode: Record<string, unknown>): ExtractedRecipe | null {
  const name = typeof recipeNode.name === "string" ? normalizeWhitespace(recipeNode.name) : "";
  if (!name) return null;

  const nutrition =
    typeof recipeNode.nutrition === "object" && recipeNode.nutrition !== null
      ? (recipeNode.nutrition as Record<string, unknown>)
      : {};

  const ingredients = Array.isArray(recipeNode.recipeIngredient)
    ? recipeNode.recipeIngredient
        .filter((item) => typeof item === "string")
        .map((item) => normalizeWhitespace(String(item)))
        .filter(Boolean)
    : [];

  const steps = flattenInstruction(recipeNode.recipeInstructions);

  return {
    name,
    servings: toRecipeServings(recipeNode.recipeYield),
    macrosPerServing: {
      calories: toNumber(nutrition.calories, 0),
      protein_g: toNumber(nutrition.proteinContent, 0),
      carbs_g: toNumber(nutrition.carbohydrateContent, 0),
      fat_g: toNumber(nutrition.fatContent, 0),
      ...(nutrition.fiberContent !== undefined && nutrition.fiberContent !== null
        ? { fiber_g: toNumber(nutrition.fiberContent, 0) }
        : {}),
    },
    ingredients,
    ingredientsRaw: ingredients.join("\n"),
    instructions: steps.join("\n"),
  };
}

function extractRecipesFromJsonLd(html: string): ExtractedRecipe[] {
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const rawBlocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (raw) rawBlocks.push(raw);
  }

  const recipeNodes: Record<string, unknown>[] = [];
  for (const raw of rawBlocks) {
    try {
      const parsed = JSON.parse(raw);
      collectRecipeNodes(parsed, recipeNodes);
    } catch {
      // ignore malformed blocks
    }
  }

  const recipes = recipeNodes
    .map((node) => mapJsonLdRecipe(node))
    .filter((item): item is ExtractedRecipe => Boolean(item));

  return uniqueByName(recipes);
}

function extractBalancedObject(text: string, startIndex: number): string | null {
  if (startIndex < 0 || text[startIndex] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (ch === "{") depth += 1;
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          return text.slice(startIndex, i + 1);
        }
      }
    }
  }

  return null;
}

function tryParseRecipeObject(rawObject: string): Record<string, unknown> | null {
  const attempts: string[] = [
    rawObject,
    rawObject.replace(/\\"/g, '"').replace(/\\\//g, "/"),
  ];

  for (const candidate of attempts) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next transform
    }
  }

  return null;
}

function extractRecipesFromEmbeddedSchema(html: string): ExtractedRecipe[] {
  const markers = ['"@type":"Recipe"', '\\"@type\\":\\"Recipe\\"'];
  const recipeNodes: Record<string, unknown>[] = [];

  for (const marker of markers) {
    let idx = html.indexOf(marker);
    while (idx >= 0) {
      const start = html.lastIndexOf("{", idx);
      if (start >= 0) {
        const rawObject = extractBalancedObject(html, start);
        if (rawObject) {
          const parsed = tryParseRecipeObject(rawObject);
          if (parsed) {
            const typeValue = parsed["@type"];
            const typeList = Array.isArray(typeValue) ? typeValue : [typeValue];
            const isRecipe = typeList.some(
              (value) => typeof value === "string" && value.toLowerCase().includes("recipe"),
            );
            if (isRecipe) {
              recipeNodes.push(parsed);
            }
          }
        }
      }
      idx = html.indexOf(marker, idx + marker.length);
    }
  }

  const mapped = recipeNodes
    .map((node) => mapJsonLdRecipe(node))
    .filter((item): item is ExtractedRecipe => Boolean(item));

  return uniqueByName(mapped);
}

async function extractRecipesWithAi(params: {
  openAiApiKey: string;
  openAiModel: string;
  sourceUrl: string;
  title: string;
  description: string;
  pageText: string;
}) {
  const { openAiApiKey, openAiModel, sourceUrl, title, description, pageText } = params;
  const trimmedText = pageText.slice(0, 22000);

  const systemPrompt = `You extract recipe data from webpage or social post text.
Return JSON only in this exact schema:
{
  "recipes": [
    {
      "name": "string",
      "servings": number,
      "macrosPerServing": {
        "calories": number,
        "protein_g": number,
        "carbs_g": number,
        "fat_g": number,
        "fiber_g": number
      },
      "ingredients": ["string"],
      "ingredientsRaw": "string",
      "instructions": "string"
    }
  ]
}
Rules:
- Extract only recipes that are explicitly present.
- If macros are missing, use 0 values.
- If servings are missing, use 4.
- If no recipe is present, return {"recipes":[]}.`;

  const userPrompt = `Source URL: ${sourceUrl}
Page title: ${title || "N/A"}
Page description: ${description || "N/A"}

Extract recipe(s) from this content:
${trimmedText}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.1,
      max_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `AI processing failed (${response.status})`);
  }

  const aiResponse = await response.json();
  const content: string | undefined = aiResponse?.choices?.[0]?.message?.content;
  const rawRecipes = safeParseRecipesJson(content);
  if (!rawRecipes) return [];

  const recipes = rawRecipes
    .map((recipe) => normalizeRecipe(recipe))
    .filter((recipe): recipe is ExtractedRecipe => Boolean(recipe));

  return uniqueByName(recipes);
}

function isLikelySocialHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host.includes("instagram.com") ||
    host.includes("tiktok.com") ||
    host.includes("facebook.com") ||
    host.includes("fb.com") ||
    host.includes("x.com") ||
    host.includes("twitter.com")
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const sourceUrl = typeof body?.url === "string" ? body.url.trim() : "";
    if (!sourceUrl) {
      return jsonOk({ success: false, error: "A URL is required." });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      return jsonOk({ success: false, error: "Invalid URL format." });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return jsonOk({ success: false, error: "Only http/https links are supported." });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return jsonOk({
        success: false,
        error: `Could not open that link (${response.status}). Try a public page or upload a screenshot.`,
      });
    }

    const html = await response.text();
    const jsonLdRecipes = extractRecipesFromJsonLd(html);
    if (jsonLdRecipes.length > 0) {
      return jsonOk({ success: true, recipes: jsonLdRecipes });
    }

    const embeddedRecipes = extractRecipesFromEmbeddedSchema(html);
    if (embeddedRecipes.length > 0) {
      return jsonOk({ success: true, recipes: embeddedRecipes });
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return jsonOk({
        success: false,
        error:
          "AI service not configured for link parsing. Add OPENAI_API_KEY in Supabase Edge Function secrets, then retry.",
      });
    }
    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const title = extractMetaTag(html, "property", "og:title") || extractMetaTag(html, "name", "twitter:title") || extractTitle(html);
    const description =
      extractMetaTag(html, "property", "og:description") ||
      extractMetaTag(html, "name", "description") ||
      extractMetaTag(html, "name", "twitter:description");
    const pageText = extractVisibleText(html);

    const aiRecipes = await extractRecipesWithAi({
      openAiApiKey,
      openAiModel,
      sourceUrl: parsedUrl.toString(),
      title,
      description,
      pageText,
    });

    if (aiRecipes.length > 0) {
      return jsonOk({ success: true, recipes: aiRecipes });
    }

    return jsonOk({
      success: false,
      error: isLikelySocialHost(parsedUrl.hostname)
        ? "No extractable recipe text found. For social posts, try a public post URL or upload a screenshot."
        : "No recipe data found on that page. Try another URL or upload a file/photo.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonOk({ success: false, error: message });
  }
});
