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

function toNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeMeal(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const meal = raw as Record<string, unknown>;
  const name = typeof meal.name === "string" ? meal.name.trim() : "";
  if (!name) return null;

  return {
    name,
    calories: Math.max(0, Math.round(toNumber(meal.calories, 0))),
    protein_g: Math.max(0, Math.round(toNumber(meal.protein_g, 0))),
    carbs_g: Math.max(0, Math.round(toNumber(meal.carbs_g, 0))),
    fat_g: Math.max(0, Math.round(toNumber(meal.fat_g, 0))),
    ...(meal.fiber_g !== undefined && meal.fiber_g !== null
      ? { fiber_g: Math.max(0, Math.round(toNumber(meal.fiber_g, 0))) }
      : {}),
    assumptions: typeof meal.assumptions === "string" ? meal.assumptions.trim() : "",
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
    const note = typeof body?.note === "string" ? body.note.trim() : "";
    const hasImage = typeof imageDataUrl === "string" && imageDataUrl.startsWith("data:image/");

    if (!hasImage && !note) {
      return jsonOk({ success: false, error: "A meal photo or typed description is required" });
    }

    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return jsonOk({
        success: false,
        error: "AI service not configured. Add OPENAI_API_KEY in Supabase Edge Function secrets, then retry.",
      });
    }
    const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

    const systemPrompt = `You estimate the macros of a single meal from either a food photo, a typed food description, or both.
Return JSON only in this exact schema:
{
  "meal": {
    "name": "string",
    "calories": number,
    "protein_g": number,
    "carbs_g": number,
    "fat_g": number,
    "fiber_g": number,
    "assumptions": "string"
  }
}

Rules:
- Estimate the total macros for the meal described by the user, not per serving unless the user explicitly describes servings and portions.
- Use the typed note as primary context when present.
- If the image shows ingredients or packaging, use that to improve the estimate.
- If the image is a nutrition label or food package and the user says how many servings they ate, estimate the total macros for the amount they actually consumed.
- If the portion size is unclear, make a reasonable estimate and explain the assumptions briefly.
- If the description or image is too unclear to estimate one meal confidently, return a meal object with name "Unknown meal", 0 macros, and explain why in assumptions.`;

    const userPrompt = hasImage
      ? note
        ? `Estimate the meal shown in this photo. User description: ${note}. File: ${fileName || "meal photo"}.`
        : `Estimate the meal shown in this photo. File: ${fileName || "meal photo"}.`
      : `Estimate the macros for this meal description: ${note}.`;

    const userContent = hasImage
      ? [
          { type: "text", text: userPrompt },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ]
      : [{ type: "text", text: userPrompt }];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: openAiModel,
        temperature: 0.1,
        max_tokens: 1200,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: userContent,
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

    const aiResponse = await response.json().catch(() => null) as
      | {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            prompt_tokens_details?: { cached_tokens?: number };
          };
        }
      | null;
    const content = aiResponse?.choices?.[0]?.message?.content || "";

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(content);
    } catch {
      return jsonOk({ success: false, error: "Could not parse meal estimate output" });
    }

    const meal = normalizeMeal(parsed.meal);
    if (!meal) {
      return jsonOk({ success: false, error: "Could not estimate that meal from the photo" });
    }

    await logUsageCostEvent({
      userId: authData.user.id,
      category: "ai",
      provider: "openai",
      meter: hasImage ? "estimate_meal_photo" : "estimate_meal_description",
      estimatedCostUsd: estimateOpenAiCostUsd(openAiModel, aiResponse?.usage),
      quantity: 1,
      metadata: {
        model: openAiModel,
        hasImage,
        promptTokens: aiResponse?.usage?.prompt_tokens || 0,
        completionTokens: aiResponse?.usage?.completion_tokens || 0,
      },
    });

    return jsonOk({ success: true, meal });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonOk({ success: false, error: message });
  }
});
