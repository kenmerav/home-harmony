import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const fileName = body?.fileName;

    if (!imageDataUrl || typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
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

    const systemPrompt = `You are an expert recipe extractor.
Extract every recipe visible in the provided photo.
Only use information visible in the image.

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
- If no recipe is visible, return {"recipes":[]}.`;

    const userPrompt = `Extract recipe(s) from this image file: ${fileName || "recipe photo"}.`;

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
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return jsonOk({
        success: false,
        error: errorText || `AI processing failed (${response.status})`,
      });
    }

    const aiResponse = await response.json();
    const content: string | undefined = aiResponse?.choices?.[0]?.message?.content;
    const rawRecipes = safeParseRecipesJson(content);
    if (!rawRecipes) {
      return jsonOk({
        success: false,
        error: "Could not parse recipe from image output",
      });
    }

    const recipes = rawRecipes
      .map((recipe) => normalizeRecipe(recipe))
      .filter((recipe): recipe is ExtractedRecipe => Boolean(recipe));

    return jsonOk({ success: true, recipes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonOk({ success: false, error: message });
  }
});
