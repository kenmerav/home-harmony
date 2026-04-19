import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { estimateOpenAiCostUsd, logUsageCostEvent } from "../_shared/costMeter.ts";

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

type OpenAiUsageLike = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
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

function safeParseRecipesJson(maybeJson: string | undefined): unknown[] | null {
  if (!maybeJson) return null;
  const trimmed = maybeJson.trim();
  if (!trimmed) return null;

  const getRecipes = (parsed: unknown): unknown[] | null => {
    if (Array.isArray(parsed)) return parsed;
    if (!parsed || typeof parsed !== "object") return null;
    const object = parsed as { recipes?: unknown; recipe?: unknown; name?: unknown; ingredients?: unknown; instructions?: unknown; directions?: unknown };
    if (Array.isArray(object.recipes)) return object.recipes;
    if (object.recipe && typeof object.recipe === "object") return [object.recipe];
    if (
      typeof object.name === "string" ||
      Array.isArray(object.ingredients) ||
      typeof object.instructions === "string" ||
      typeof object.directions === "string"
    ) {
      return [object];
    }
    return null;
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

function toNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTextLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\r?\n|•|(?=\d+\.)/g)
      .map((item) => item.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeTextBlock(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .join("\n");
  }
  return typeof value === "string" ? value.trim() : "";
}

function uniqueByName(recipes: ExtractedRecipe[]): ExtractedRecipe[] {
  const seen = new Set<string>();
  const next: ExtractedRecipe[] = [];
  for (const recipe of recipes) {
    const key = recipe.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(recipe);
  }
  return next;
}

function recipeQualityScore(recipe: ExtractedRecipe): number {
  const instructionStepCount = recipe.instructions
    .split(/\r?\n|(?=\d+\.)/g)
    .map((step) => step.trim())
    .filter(Boolean).length;
  return [
    recipe.name && recipe.name !== "Imported Recipe" ? 6 : 2,
    recipe.servings > 0 ? 1 : 0,
    Math.min(recipe.ingredients.length, 12) * 2,
    Math.min(Math.ceil(recipe.instructions.length / 120), 10) * 2,
    Math.min(instructionStepCount, 8),
    recipe.macrosPerServing.calories > 0 ? 1 : 0,
  ].reduce((sum, part) => sum + part, 0);
}

function recipeSetQualityScore(recipes: ExtractedRecipe[]): number {
  if (!recipes.length) return 0;
  return recipes.reduce((sum, recipe) => sum + recipeQualityScore(recipe), 0);
}

function normalizeOcrText(value: string): string {
  return value
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[•●▪]/g, "\n- ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function ocrLines(value: string): string[] {
  return normalizeOcrText(value)
    .split(/\n+/g)
    .map((line) => line.trim())
    .filter(Boolean);
}

function looksLikeMetaLine(line: string): boolean {
  return (
    /servings?/i.test(line) ||
    /macros?/i.test(line) ||
    /calories?/i.test(line) ||
    /per serving/i.test(line) ||
    /for lower calorie/i.test(line)
  );
}

function looksLikeSectionHeading(line: string): boolean {
  return (
    /^ingredients?$/i.test(line) ||
    /^instructions?$/i.test(line) ||
    /^directions?$/i.test(line) ||
    /^steps?$/i.test(line) ||
    /^for the /i.test(line)
  );
}

function isLikelyTitleLine(line: string): boolean {
  if (!line) return false;
  if (looksLikeMetaLine(line) || looksLikeSectionHeading(line)) return false;
  if (/^\d+[.)]/.test(line)) return false;
  if (/\d/.test(line)) return false;
  if (line.length < 3 || line.length > 40) return false;
  const wordCount = line.split(/\s+/).filter(Boolean).length;
  return wordCount >= 1 && wordCount <= 4;
}

function extractTitleFromOcrLines(lines: string[]): string {
  const sectionBreakIndex = lines.findIndex((line) => /^ingredients?$|^instructions?$/i.test(line));
  const searchLimit = sectionBreakIndex >= 0 ? sectionBreakIndex : Math.min(lines.length, 14);
  let bestTitle = "";

  for (let start = 0; start < searchLimit; start += 1) {
    for (let end = start; end < Math.min(searchLimit, start + 4); end += 1) {
      const chunk = lines.slice(start, end + 1);
      if (!chunk.every(isLikelyTitleLine)) continue;
      const candidate = chunk.join(" ").replace(/\s+/g, " ").trim();
      if (candidate.length > bestTitle.length) {
        bestTitle = candidate;
      }
    }
  }

  return bestTitle || "Imported Recipe";
}

function parseMacroLine(value: string) {
  const compact = value.replace(/\s+/g, "");
  const match = compact.match(/(\d+)G?P(\d+)G?C(\d+)G?F/i);
  if (!match) return null;
  return {
    protein_g: toNumber(match[1], 0),
    carbs_g: toNumber(match[2], 0),
    fat_g: toNumber(match[3], 0),
  };
}

function extractRecipesFromOcrTextHeuristically(ocrText: string): ExtractedRecipe[] {
  const lines = ocrLines(ocrText);
  if (!lines.length) return [];

  const servingsLine = lines.find((line) => /servings?/i.test(line));
  const caloriesLine = lines.find((line) => /calories?(?: per serving)?/i.test(line));
  const macrosLine = lines.find((line) => /macros?(?: per serving)?/i.test(line) || /g?p.*g?c.*g?f/i.test(line.replace(/\s+/g, "")));

  const servingsMatch = servingsLine?.match(/(\d+(?:\.\d+)?)/);
  const caloriesMatch = caloriesLine?.match(/(\d{2,4})/);
  const parsedMacros = macrosLine ? parseMacroLine(macrosLine) : null;

  const ingredientsIndex = lines.findIndex((line) => /^ingredients?$/i.test(line));
  const instructionsIndex = lines.findIndex((line) => /^instructions?$|^directions?$|^steps?$/i.test(line));

  const ingredientsLines =
    ingredientsIndex >= 0
      ? lines
          .slice(ingredientsIndex + 1, instructionsIndex >= 0 ? instructionsIndex : undefined)
          .map((line) => line.replace(/^[-*]\s*/, "").trim())
          .filter((line) => line && !looksLikeMetaLine(line))
      : [];

  const instructionsLines =
    instructionsIndex >= 0
      ? lines.slice(instructionsIndex + 1).filter((line) => line && !/^allow meals?/i.test(line))
      : [];

  const recipe: ExtractedRecipe = {
    name: extractTitleFromOcrLines(lines),
    servings: servingsMatch ? Math.max(1, toNumber(servingsMatch[1], 4)) : 4,
    macrosPerServing: {
      calories: caloriesMatch ? Math.max(0, toNumber(caloriesMatch[1], 0)) : 0,
      protein_g: parsedMacros?.protein_g ?? 0,
      carbs_g: parsedMacros?.carbs_g ?? 0,
      fat_g: parsedMacros?.fat_g ?? 0,
    },
    ingredients: ingredientsLines,
    ingredientsRaw: ingredientsLines.join("\n"),
    instructions: instructionsLines.join("\n"),
  };

  if (recipe.ingredients.length < 2 && recipe.instructions.length < 30) {
    return [];
  }

  return [recipe];
}

function combineUsage(usages: Array<OpenAiUsageLike | null | undefined>): OpenAiUsageLike | null {
  const present = usages.filter(Boolean) as OpenAiUsageLike[];
  if (!present.length) return null;
  return {
    prompt_tokens: present.reduce((sum, usage) => sum + Number(usage.prompt_tokens || 0), 0),
    completion_tokens: present.reduce((sum, usage) => sum + Number(usage.completion_tokens || 0), 0),
    prompt_tokens_details: {
      cached_tokens: present.reduce(
        (sum, usage) => sum + Number(usage.prompt_tokens_details?.cached_tokens || 0),
        0,
      ),
    },
  };
}

function normalizeRecipe(raw: unknown): ExtractedRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const recipe = raw as Record<string, unknown>;
  const ingredients = normalizeTextLines(recipe.ingredients ?? recipe.ingredients_text ?? recipe.ingredientsRaw);
  const ingredientsRaw =
    normalizeTextBlock(recipe.ingredientsRaw) ||
    normalizeTextBlock(recipe.ingredients_text) ||
    ingredients.join("\n");

  const instructions =
    normalizeTextBlock(recipe.instructions) ||
    normalizeTextBlock(recipe.directions) ||
    normalizeTextBlock(recipe.steps);

  const nameCandidate =
    typeof recipe.name === "string"
      ? recipe.name
      : typeof recipe.title === "string"
      ? recipe.title
      : typeof recipe.recipe_name === "string"
      ? recipe.recipe_name
      : "";
  const name = nameCandidate.trim() || (ingredients.length > 1 || instructions ? "Imported Recipe" : "");
  if (!name) return null;

  const servings = toNumber(recipe.servings, 4) || 4;
  const macrosSrcValue = recipe.macrosPerServing ?? recipe.macros ?? recipe.nutrition ?? {};
  const macrosSrc =
    typeof macrosSrcValue === "object" && macrosSrcValue !== null
      ? (macrosSrcValue as Record<string, unknown>)
      : {};

  return {
    name,
    servings,
    macrosPerServing: {
      calories: toNumber(macrosSrc.calories, 0),
      protein_g: toNumber(macrosSrc.protein_g ?? macrosSrc.protein, 0),
      carbs_g: toNumber(macrosSrc.carbs_g ?? macrosSrc.carbs, 0),
      fat_g: toNumber(macrosSrc.fat_g ?? macrosSrc.fat, 0),
      ...(macrosSrc.fiber_g !== undefined && macrosSrc.fiber_g !== null
        ? { fiber_g: toNumber(macrosSrc.fiber_g, 0) }
        : {}),
    },
    ingredients,
    ingredientsRaw,
    instructions,
  };
}

async function extractRecipesWithAi(params: {
  openAiApiKey: string;
  openAiModel: string;
  imageDataUrls: string[];
  fileName?: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const { openAiApiKey, openAiModel, imageDataUrls, fileName, systemPrompt, userPrompt } = params;
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
        {
          role: "user",
          content: [
            { type: "text", text: `${userPrompt}\nFile: ${fileName || "recipe photo"}` },
            ...imageDataUrls.map((imageDataUrl) => ({
              type: "image_url" as const,
              image_url: { url: imageDataUrl },
            })),
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `AI processing failed (${response.status})`);
  }

  const aiResponse = await response.json().catch(() => null) as
    | {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: OpenAiUsageLike;
      }
    | null;
  const content: string | undefined = aiResponse?.choices?.[0]?.message?.content;
  const rawRecipes = safeParseRecipesJson(content);
  const recipes = (rawRecipes || [])
    .map((recipe) => normalizeRecipe(recipe))
    .filter((recipe): recipe is ExtractedRecipe => Boolean(recipe));

  return {
    recipes: uniqueByName(recipes),
    usage: aiResponse?.usage || null,
  };
}

async function extractOcrTextWithAi(params: {
  openAiApiKey: string;
  openAiModel: string;
  imageDataUrls: string[];
  fileName?: string;
}) {
  const { openAiApiKey, openAiModel, imageDataUrls, fileName } = params;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.0,
      max_tokens: 5000,
      messages: [
        {
          role: "system",
          content:
            "You transcribe recipe screenshots and recipe cards. Preserve visible wording, headings, bullet items, numbered steps, servings, macros, and notes. Do not summarize or interpret. Return plain text only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                `Transcribe the recipe text visible in these images. They may be full screenshots plus cropped views of the same screenshot. Merge them into one clean transcription and avoid duplicate repeated lines.\nFile: ${fileName || "recipe photo"}`,
            },
            ...imageDataUrls.map((imageDataUrl) => ({
              type: "image_url" as const,
              image_url: { url: imageDataUrl },
            })),
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `OCR processing failed (${response.status})`);
  }

  const aiResponse = await response.json().catch(() => null) as
    | {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: OpenAiUsageLike;
      }
    | null;

  const content = aiResponse?.choices?.[0]?.message?.content || "";
  let ocrText = content.trim();
  if (ocrText.startsWith("{")) {
    try {
      const parsed = JSON.parse(ocrText) as { ocrText?: unknown };
      ocrText = typeof parsed.ocrText === "string" ? parsed.ocrText.trim() : ocrText;
    } catch {
      // Keep the raw plain-text OCR content.
    }
  }

  return {
    ocrText,
    usage: aiResponse?.usage || null,
  };
}

async function parseRecipesFromOcrTextWithAi(params: {
  openAiApiKey: string;
  openAiModel: string;
  fileName?: string;
  ocrText: string;
}) {
  const { openAiApiKey, openAiModel, fileName, ocrText } = params;
  const systemPrompt = `You extract recipe data from OCR text pulled from screenshots, recipe cards, and social posts.
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
- Extract only the recipe or recipes explicitly present in the OCR text.
- If macros are missing, use 0 values.
- If servings are missing, use 4.
- If the OCR text is partial but still clearly describes one recipe, return that recipe with partial ingredients/instructions.
- If no usable recipe is present, return {"recipes":[]}.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.1,
      max_tokens: 5000,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `File: ${fileName || "recipe photo"}\n\nExtract recipe(s) from this OCR text:\n${ocrText.slice(0, 28000)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `OCR recipe parsing failed (${response.status})`);
  }

  const aiResponse = await response.json().catch(() => null) as
    | {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: OpenAiUsageLike;
      }
    | null;
  const content: string | undefined = aiResponse?.choices?.[0]?.message?.content;
  const rawRecipes = safeParseRecipesJson(content);
  const recipes = (rawRecipes || [])
    .map((recipe) => normalizeRecipe(recipe))
    .filter((recipe): recipe is ExtractedRecipe => Boolean(recipe));

  return {
    recipes: uniqueByName(recipes),
    usage: aiResponse?.usage || null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonOk({ success: false, error: "Unauthorized" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonOk({ success: false, error: "Server auth is not configured" });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return jsonOk({ success: false, error: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const imageDataUrl = body?.imageDataUrl;
    const imageUrls = Array.isArray(body?.imageUrls)
      ? body.imageUrls.filter(
          (value: unknown): value is string =>
            typeof value === "string" && /^https?:\/\//i.test(value),
        )
      : [];
    const imageDataUrls = Array.isArray(body?.imageDataUrls)
      ? body.imageDataUrls.filter(
          (value: unknown): value is string =>
            typeof value === "string" && value.startsWith("data:image/"),
        )
      : [];
    const fileName = body?.fileName;

    const candidateImageDataUrls = imageUrls.length
      ? imageUrls
      : imageDataUrls.length
      ? imageDataUrls
      : typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:image/")
      ? [imageDataUrl]
      : [];

    if (!candidateImageDataUrls.length) {
      return jsonOk({ success: false, error: "Valid image data is required" });
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return jsonOk({
        success: false,
        error:
          "AI service not configured. Add OPENAI_API_KEY in Supabase Edge Function secrets, then retry.",
      });
    }
    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const systemPrompt = `You extract recipes from screenshots, photos, and recipe cards.
The image input may include the same screenshot more than once: a full image plus cropped variants to help with multi-column recipe layouts.
Treat all provided images as views of the same recipe content unless they clearly show different recipes.
The image may be a screenshot of a recipe website, a recipe card, a social post, handwritten notes, or a partial crop.
Ignore ads, navigation, comments, and unrelated UI.
Extract the main recipe(s) visible in the image, even if the screenshot is partial.

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
- If servings or macros are missing, use sensible defaults (servings: 4, macros: 0).
- If the recipe title is cut off or missing but the recipe content is clearly visible, use "Imported Recipe".
- Ingredients and instructions may be partial if the screenshot is partial.
- If no recipe is visible, return {"recipes":[]}.`;

    const primaryResult = await extractRecipesWithAi({
      openAiApiKey,
      openAiModel,
      imageDataUrls: candidateImageDataUrls,
      fileName,
      systemPrompt,
      userPrompt:
        "Extract the recipe or recipes shown in this image. Focus on the actual recipe content and ignore page chrome or extra text.",
    });

    let recipes = primaryResult.recipes;
    let usage = primaryResult.usage;

    if (recipes.length === 0) {
      const fallbackResult = await extractRecipesWithAi({
        openAiApiKey,
        openAiModel,
        imageDataUrls: candidateImageDataUrls,
        fileName,
        systemPrompt,
        userPrompt:
          "Be tolerant of imperfect screenshots. If one main recipe is visible, return it even if only part of the ingredients or instructions are shown.",
      });
      recipes = fallbackResult.recipes;
      usage = combineUsage([primaryResult.usage, fallbackResult.usage]);
    }

    const needsOcrFallback =
      recipes.length === 0 || recipeSetQualityScore(recipes) < 24;

    if (needsOcrFallback) {
      const ocrResult = await extractOcrTextWithAi({
        openAiApiKey,
        openAiModel,
        imageDataUrls: candidateImageDataUrls,
        fileName,
      });

      if (ocrResult.ocrText) {
        const heuristicRecipes = extractRecipesFromOcrTextHeuristically(ocrResult.ocrText);
        const textParseResult = await parseRecipesFromOcrTextWithAi({
          openAiApiKey,
          openAiModel,
          fileName,
          ocrText: ocrResult.ocrText,
        });
        const candidates = [recipes, heuristicRecipes, textParseResult.recipes];
        recipes = candidates.reduce((best, candidate) =>
          recipeSetQualityScore(candidate) > recipeSetQualityScore(best) ? candidate : best,
        );
        usage = combineUsage([usage, ocrResult.usage, textParseResult.usage]);
      }
    }

    if (!recipes.length) {
      return jsonOk({
        success: false,
        error: "I couldn't pull a usable recipe from that image. Try a tighter screenshot of just the recipe card, ingredients, and instructions.",
      });
    }

    await logUsageCostEvent({
      userId: authData.user.id,
      category: "ai",
      provider: "openai",
      meter: "parse_recipe_photo",
      estimatedCostUsd: estimateOpenAiCostUsd(openAiModel, usage),
      quantity: 1,
      metadata: {
        model: openAiModel,
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        recipeCount: recipes.length,
      },
    });

    return jsonOk({ success: true, recipes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonOk({ success: false, error: message });
  }
});
