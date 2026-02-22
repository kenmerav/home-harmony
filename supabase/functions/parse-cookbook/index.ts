import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ChunkInfo = { current: number; total: number };

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
  // IMPORTANT: always 200 so supabase-js invoke() never throws “non 2xx status code”
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function prepareChunkText(pdfText: string) {
  // The client already chunks, this is just a safety net.
  const MAX_CHARS = 350_000;
  if (pdfText.length > MAX_CHARS) {
    console.log(`Text truncated from ${pdfText.length} to ${MAX_CHARS} chars`);
    return `${pdfText.slice(0, MAX_CHARS)}\n\n[TRUNCATED - chunk too large]`;
  }
  return pdfText;
}

function buildPrompts(params: {
  fileName?: string;
  pageCount?: number;
  chunkInfo?: ChunkInfo;
  chunkText: string;
}) {
  const { fileName, pageCount, chunkInfo, chunkText } = params;

  const chunkLabel = chunkInfo
    ? `PART ${chunkInfo.current} of ${chunkInfo.total}`
    : "FULL DOCUMENT";

  const systemPrompt = `You are an expert at extracting recipes from cookbook text.
You will receive ${chunkLabel} of a cookbook.

Your job:
- Extract EVERY recipe that appears in the text you are given.
- ONLY use information present in the text (do not invent recipes).

Return JSON ONLY, matching EXACTLY this schema:
{
  "recipes": [
    {
      "name": "string (verbatim title)",
      "servings": number (if missing use 4),
      "macrosPerServing": {
        "calories": number,
        "protein_g": number,
        "carbs_g": number,
        "fat_g": number,
        "fiber_g": number (optional)
      },
      "ingredients": ["string", "string"],
      "ingredientsRaw": "string",
      "instructions": "string"
    }
  ]
}

Rules:
- If nutrition info is missing for a recipe, set calories/protein_g/carbs_g/fat_g (and fiber_g if present) to 0.
- If no recipes are found in the provided text, return: {"recipes": []}
`;

  const userPrompt = `Extract recipes from this cookbook text (${fileName || "cookbook.pdf"}, ${pageCount ?? "unknown"} pages).
This is ${chunkLabel}. Only extract recipes present in THIS TEXT.

COOKBOOK TEXT:
${chunkText}`;

  return { systemPrompt, userPrompt };
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

  // Try direct parse first
  try {
    const parsed = JSON.parse(trimmed);
    const recipes = getRecipes(parsed);
    if (recipes) return recipes;
  } catch {
    // ignore
  }

  // Try extracting a JSON object from surrounding text
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(slice);
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

function normalizeRecipe(raw: unknown): ExtractedRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const recipe = raw as Record<string, unknown>;

  const name = typeof recipe.name === "string" ? recipe.name.trim() : "";
  if (!name) return null;

  const servings = toNumber(recipe.servings, 4) || 4;

  const macrosSrcValue = recipe.macrosPerServing ?? recipe.macros ?? recipe.nutrition ?? {};
  const macrosSrc =
    typeof macrosSrcValue === "object" && macrosSrcValue !== null
      ? (macrosSrcValue as Record<string, unknown>)
      : {};
  const macrosPerServing = {
    calories: toNumber(macrosSrc.calories, 0),
    protein_g: toNumber(macrosSrc.protein_g, 0),
    carbs_g: toNumber(macrosSrc.carbs_g, 0),
    fat_g: toNumber(macrosSrc.fat_g, 0),
    ...(macrosSrc.fiber_g !== undefined && macrosSrc.fiber_g !== null
      ? { fiber_g: toNumber(macrosSrc.fiber_g, 0) }
      : {}),
  };

  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .filter((x: unknown) => typeof x === "string")
        .map((s: string) => s.trim())
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
        .map((s: string) => s.trim())
        .filter(Boolean)
        .join("\n")
    : typeof recipe.instructions === "string"
    ? recipe.instructions
    : typeof recipe.directions === "string"
    ? recipe.directions
    : "";

  return {
    name,
    servings,
    macrosPerServing,
    ingredients,
    ingredientsRaw,
    instructions,
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
      console.error("Supabase auth env vars are not configured");
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
    const pdfText = body?.pdfText;
    const fileName = body?.fileName;
    const pageCount = body?.pageCount;
    const chunkInfo = body?.chunkInfo as ChunkInfo | undefined;

    if (!pdfText || typeof pdfText !== "string" || !pdfText.trim()) {
      return jsonOk({ success: false, error: "Extracted PDF text is required" });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return jsonOk({ success: false, error: "AI service not configured" });
    }

    const chunkText = prepareChunkText(pdfText);
    console.log("Processing cookbook chunk:", {
      fileName,
      pageCount,
      chunkInfo,
      textChars: pdfText.length,
      sentChars: chunkText.length,
    });

    const { systemPrompt, userPrompt } = buildPrompts({
      fileName,
      pageCount,
      chunkInfo,
      chunkText,
    });

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
      console.error("AI gateway error:", response.status, errorText);

      const statusHint =
        response.status === 429
          ? "Rate limit exceeded. Please try again in a moment."
          : response.status === 402
          ? "AI credits required. Please add credits to continue."
          : `AI processing failed (${response.status}).`;

      return jsonOk({
        success: false,
        error: errorText ? `${statusHint} ${errorText}` : statusHint,
      });
    }

    const aiResponse = await response.json();
    const content: string | undefined = aiResponse?.choices?.[0]?.message?.content;

    const rawRecipes = safeParseRecipesJson(content);
    if (!rawRecipes) {
      console.error(
        "Failed to parse JSON from AI response. Content head:",
        content?.slice(0, 500),
      );
      return jsonOk({
        success: false,
        error:
          "Failed to extract recipes from this chunk. Please try again (or re-upload).",
      });
    }

    const recipes = rawRecipes
      .map((r) => normalizeRecipe(r))
      .filter((r): r is ExtractedRecipe => Boolean(r));

    console.log(`Successfully extracted ${recipes.length} recipes`);
    recipes
      .slice(0, 50)
      .forEach((r, i) => console.log(`  ${i + 1}. ${r.name}`));

    return jsonOk({ success: true, recipes });
  } catch (error) {
    console.error("Error processing cookbook:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonOk({ success: false, error: errorMessage });
  }
});
