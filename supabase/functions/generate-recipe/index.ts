import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { estimateOpenAiCostUsd, logUsageCostEvent } from "../_shared/costMeter.ts";

type ExtractedRecipe = {
  name: string;
  servings: number;
  mealType?: "breakfast" | "lunch" | "dinner" | "snack";
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

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.round(parsed));
}

function normalizeMealType(value: unknown): ExtractedRecipe["mealType"] {
  const meal = String(value || "").trim().toLowerCase();
  if (meal === "breakfast" || meal === "lunch" || meal === "dinner" || meal === "snack") {
    return meal;
  }
  return undefined;
}

function normalizeRecipe(raw: unknown, fallbackServings = 4): ExtractedRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const recipe = raw as Record<string, unknown>;

  const name = String(recipe.name || "").trim();
  if (!name) return null;

  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const instructions = String(recipe.instructions || "").trim();
  if (!instructions) return null;

  const macrosRaw =
    recipe.macrosPerServing && typeof recipe.macrosPerServing === "object"
      ? (recipe.macrosPerServing as Record<string, unknown>)
      : {};

  const servings = Math.max(1, Math.min(24, toInt(recipe.servings, fallbackServings) || fallbackServings));

  return {
    name,
    servings,
    mealType: normalizeMealType(recipe.mealType),
    macrosPerServing: {
      calories: toInt(macrosRaw.calories, 0),
      protein_g: toInt(macrosRaw.protein_g, 0),
      carbs_g: toInt(macrosRaw.carbs_g, 0),
      fat_g: toInt(macrosRaw.fat_g, 0),
      ...(macrosRaw.fiber_g !== undefined ? { fiber_g: toInt(macrosRaw.fiber_g, 0) } : {}),
    },
    ingredients,
    ingredientsRaw:
      String(recipe.ingredientsRaw || "").trim() ||
      ingredients.join("\n"),
    instructions,
  };
}

function parseRecipeResponse(content: string, fallbackServings: number): ExtractedRecipe | null {
  const tryParse = (jsonText: string): ExtractedRecipe | null => {
    try {
      const parsed = JSON.parse(jsonText) as { recipe?: unknown };
      if (parsed && parsed.recipe) {
        return normalizeRecipe(parsed.recipe, fallbackServings);
      }
      return null;
    } catch {
      return null;
    }
  };

  const trimmed = content.trim();
  const direct = tryParse(trimmed);
  if (direct) return direct;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return null;
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
    const prompt = String(body?.prompt || "").trim();
    const servings = Math.max(1, Math.min(24, Number.parseInt(String(body?.servings || "4"), 10) || 4));
    if (!prompt) {
      return jsonOk({ success: false, error: "Prompt is required" });
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return jsonOk({ success: false, error: "AI service not configured" });
    }

    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const systemPrompt = `You are a recipe generator for a family meal planning app.
Return JSON only, with this exact schema:
{
  "recipe": {
    "name": "string",
    "servings": number,
    "mealType": "breakfast" | "lunch" | "dinner" | "snack",
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
}
Rules:
- Make the recipe practical for home cooks.
- Include clear quantities in ingredients.
- Use line breaks and numbered steps in instructions.
- Keep macro numbers realistic estimates per serving.
- If meal type is unclear, default to dinner.`;

    const userPrompt = `Create one recipe from this request: ${prompt}\nTarget servings: ${servings}.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel,
        temperature: 0.6,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return jsonOk({
        success: false,
        error: text ? `AI generation failed (${response.status}): ${text}` : `AI generation failed (${response.status})`,
      });
    }

    const payload = await response.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    } | null;
    const content = payload?.choices?.[0]?.message?.content || "";
    const recipe = parseRecipeResponse(content, servings);

    if (!recipe) {
      return jsonOk({ success: false, error: "Could not parse AI recipe." });
    }

    await logUsageCostEvent({
      userId: authData.user.id,
      category: "ai",
      provider: "openai",
      meter: "generate_recipe",
      estimatedCostUsd: estimateOpenAiCostUsd(openAiModel, payload?.usage),
      quantity: 1,
      metadata: {
        model: openAiModel,
        promptTokens: payload?.usage?.prompt_tokens || 0,
        completionTokens: payload?.usage?.completion_tokens || 0,
      },
    });

    return jsonOk({ success: true, recipe });
  } catch (error) {
    return jsonOk({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error.",
    });
  }
});
