import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { estimateOpenAiCostUsd, logUsageCostEvent } from "../_shared/costMeter.ts";

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

function parseEstimateResponse(content: string) {
  const tryParse = (jsonText: string) => {
    try {
      const parsed = JSON.parse(jsonText) as {
        macrosPerServing?: {
          calories?: unknown;
          protein_g?: unknown;
          carbs_g?: unknown;
          fat_g?: unknown;
        };
      };
      const macros = parsed?.macrosPerServing;
      if (!macros) return null;
      return {
        calories: toInt(macros.calories, 0),
        protein_g: toInt(macros.protein_g, 0),
        carbs_g: toInt(macros.carbs_g, 0),
        fat_g: toInt(macros.fat_g, 0),
      };
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
    const name = String(body?.name || "").trim();
    const servings = Math.max(1, Math.min(24, Number.parseInt(String(body?.servings || "4"), 10) || 4));
    const ingredients = Array.isArray(body?.ingredients)
      ? body.ingredients
          .filter((item: unknown): item is string => typeof item === "string")
          .map((item: string) => item.trim())
          .filter(Boolean)
      : [];
    const instructions = String(body?.instructions || "").trim();

    if (!name && ingredients.length === 0) {
      return jsonOk({ success: false, error: "Recipe details are required" });
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return jsonOk({ success: false, error: "AI service not configured" });
    }

    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const systemPrompt = `You estimate realistic nutrition per serving for recipes in a family meal planning app.
Return JSON only, with this exact schema:
{
  "macrosPerServing": {
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number
  }
}
Rules:
- Estimate per serving, not total recipe.
- Use the provided servings count.
- Base estimates on the provided ingredients and instructions.
- If quantities are vague or missing, make conservative household-cooking assumptions.
- Keep numbers realistic for a real meal, not idealized diet food.
- Do not include any prose outside the JSON object.`;

    const userPrompt = [
      `Recipe name: ${name || "Untitled recipe"}`,
      `Servings: ${servings}`,
      ingredients.length > 0 ? `Ingredients:\n${ingredients.map((item) => `- ${item}`).join("\n")}` : null,
      instructions ? `Instructions:\n${instructions}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel,
        temperature: 0.2,
        max_tokens: 700,
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
        error: text ? `Nutrition estimate failed (${response.status}): ${text}` : `Nutrition estimate failed (${response.status})`,
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
    const macrosPerServing = parseEstimateResponse(content);

    if (!macrosPerServing) {
      return jsonOk({ success: false, error: "Could not parse nutrition estimate." });
    }

    await logUsageCostEvent({
      userId: authData.user.id,
      category: "ai",
      provider: "openai",
      meter: "estimate_recipe_macros",
      estimatedCostUsd: estimateOpenAiCostUsd(openAiModel, payload?.usage),
      quantity: 1,
      metadata: {
        model: openAiModel,
        promptTokens: payload?.usage?.prompt_tokens || 0,
        completionTokens: payload?.usage?.completion_tokens || 0,
      },
    });

    return jsonOk({ success: true, macrosPerServing });
  } catch (error) {
    return jsonOk({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error.",
    });
  }
});
