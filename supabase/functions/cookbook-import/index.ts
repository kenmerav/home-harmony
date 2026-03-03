import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";

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

type ImportJobRow = {
  id: string;
  user_id: string;
  file_name: string;
  page_count: number | null;
  status: "queued" | "processing" | "completed" | "failed" | "canceled";
  progress_current: number;
  progress_total: number;
  recipes_found: number;
  recipes_saved: number;
  recipes_buffer: unknown;
  error_message: string | null;
  pdf_text: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

const MAX_CHUNK_CHARS = 25_000;
const MIN_RETRY_CHUNK_CHARS = 6_000;
const MAX_RETRY_DEPTH = 2;
const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-4.1";
const PER_CHUNK_TIMEOUT_MS = 120_000;
const PROCESSING_STALE_MS = 3 * 60 * 1000;
const USER_JOB_SELECT =
  "id,user_id,file_name,page_count,status,progress_current,progress_total,recipes_found,recipes_saved,error_message,started_at,finished_at,created_at,updated_at";

function shouldNudgeJob(status: string, updatedAt: string | null | undefined): boolean {
  if (status === "queued") return true;
  if (status !== "processing") return false;
  if (!updatedAt) return true;

  const updatedMs = Date.parse(updatedAt);
  if (!Number.isFinite(updatedMs)) return true;
  return Date.now() - updatedMs > PROCESSING_STALE_MS;
}

function runInBackground(task: Promise<void>) {
  const maybeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<void>) => void } }).EdgeRuntime;
  if (maybeRuntime?.waitUntil) {
    maybeRuntime.waitUntil(task);
    return;
  }

  task.catch((error) => {
    console.error("Background task failed:", error);
  });
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanIngredient(value: string): string {
  return value
    .replace(/^[-*\u2022\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRecipe(raw: unknown): ExtractedRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;

  const name = typeof src.name === "string" ? src.name.trim() : "";
  if (!name) return null;

  const macrosSrc =
    typeof src.macrosPerServing === "object" && src.macrosPerServing
      ? (src.macrosPerServing as Record<string, unknown>)
      : typeof src.nutrition === "object" && src.nutrition
      ? (src.nutrition as Record<string, unknown>)
      : {};

  const ingredients = Array.isArray(src.ingredients)
    ? src.ingredients
        .filter((item) => typeof item === "string")
        .map((item) => cleanIngredient(item))
        .filter(Boolean)
    : [];

  const ingredientsRaw =
    typeof src.ingredientsRaw === "string"
      ? src.ingredientsRaw
      : typeof src.ingredients_raw === "string"
      ? src.ingredients_raw
      : ingredients.join("\n");

  const instructions = Array.isArray(src.instructions)
    ? src.instructions.filter((item) => typeof item === "string").join("\n")
    : typeof src.instructions === "string"
    ? src.instructions
    : typeof src.directions === "string"
    ? src.directions
    : "";

  return {
    name,
    servings: Math.max(1, Math.round(toNumber(src.servings, 4) || 4)),
    macrosPerServing: {
      calories: Math.round(toNumber(macrosSrc.calories, 0)),
      protein_g: Math.round(toNumber(macrosSrc.protein_g ?? macrosSrc.protein, 0)),
      carbs_g: Math.round(toNumber(macrosSrc.carbs_g ?? macrosSrc.carbs, 0)),
      fat_g: Math.round(toNumber(macrosSrc.fat_g ?? macrosSrc.fat, 0)),
      ...(macrosSrc.fiber_g !== undefined
        ? { fiber_g: Math.round(toNumber(macrosSrc.fiber_g, 0)) }
        : {}),
    },
    ingredients,
    ingredientsRaw,
    instructions: typeof instructions === "string" ? instructions.trim() : "",
  };
}

function safeParseRecipesJson(content: string | undefined): unknown[] | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;

  const readRecipes = (input: unknown): unknown[] | null => {
    if (!input) return null;
    if (Array.isArray(input)) return input;
    if (typeof input !== "object") return null;

    const src = input as Record<string, unknown>;
    if (Array.isArray(src.recipes)) return src.recipes;
    if (typeof src.recipes === "string") {
      try {
        const nested = JSON.parse(src.recipes);
        if (Array.isArray(nested)) return nested;
      } catch {
        // noop
      }
    }
    if (Array.isArray(src.data)) return src.data;
    if (Array.isArray(src.items)) return src.items;
    return null;
  };

  const tryParse = (candidate: string): unknown[] | null => {
    try {
      const parsed = JSON.parse(candidate);
      return readRecipes(parsed);
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = tryParse(fenced[1].trim());
    if (fromFence) return fromFence;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const fromObjectSlice = tryParse(trimmed.slice(firstBrace, lastBrace + 1));
    if (fromObjectSlice) return fromObjectSlice;
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    const fromArraySlice = tryParse(trimmed.slice(firstBracket, lastBracket + 1));
    if (fromArraySlice) return fromArraySlice;
  }

  return null;
}

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;
    if (end < text.length) {
      const lastDoubleNewline = text.lastIndexOf("\n\n", end);
      if (lastDoubleNewline > start + maxChars / 2) {
        end = lastDoubleNewline;
      }
    }

    chunks.push(text.slice(start, end));
    start = end;
  }

  return chunks;
}

function splitPdfText(pdfText: string): string[] {
  const pagePattern = /----- PAGE (\d+) \/ \d+ -----/g;
  const pages: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pagePattern.exec(pdfText)) !== null) {
    if (lastIndex > 0) {
      const pageText = pdfText.slice(lastIndex, match.index).trim();
      if (pageText) pages.push(pageText);
    }
    lastIndex = match.index;
  }

  if (lastIndex > 0) {
    const tail = pdfText.slice(lastIndex).trim();
    if (tail) pages.push(tail);
  }

  if (!pages.length) {
    return splitTextIntoChunks(pdfText, MAX_CHUNK_CHARS);
  }

  const chunks: string[] = [];
  let current = "";
  for (const page of pages) {
    if ((current + "\n\n" + page).length > MAX_CHUNK_CHARS) {
      if (current) chunks.push(current);
      current = page;
    } else {
      current = current ? `${current}\n\n${page}` : page;
    }
  }
  if (current) chunks.push(current);

  return chunks.length ? chunks : splitTextIntoChunks(pdfText, MAX_CHUNK_CHARS);
}

function isRetryableError(message: string): boolean {
  const value = message.toLowerCase();
  return (
    value.includes("context_length_exceeded") ||
    value.includes("maximum context length") ||
    value.includes("timed out") ||
    value.includes("timeout") ||
    value.includes("rate limit") ||
    value.includes("429") ||
    value.includes("5xx") ||
    value.includes("server error") ||
    value.includes("could not parse structured recipes from ai response") ||
    value.includes("unterminated string in json")
  );
}

function isRateLimit(message: string): boolean {
  const value = message.toLowerCase();
  return value.includes("429") || value.includes("rate limit");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function buildPrompts(chunkText: string, fileName: string, pageCount: number | null, index: number, total: number) {
  const chunkLabel = `PART ${index + 1} of ${total}`;

  const systemPrompt = `You extract recipes from cookbook text.
Return JSON only in this exact shape:
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
- Extract every recipe in the provided text chunk.
- Do not invent values.
- Use 4 servings when missing.
- Use 0 for missing macro values.
- If no recipes are present, return {"recipes": []}.`;

  const userPrompt = `File: ${fileName}\nPages: ${pageCount ?? "unknown"}\nChunk: ${chunkLabel}\n\nCOOKBOOK TEXT:\n${chunkText}`;
  return { systemPrompt, userPrompt };
}

async function extractChunkRecipes(chunkText: string, fileName: string, pageCount: number | null, index: number, total: number) {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is missing in Edge Function secrets.");
  }

  const { systemPrompt, userPrompt } = buildPrompts(chunkText, fileName, pageCount, index, total);

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("AI request timed out.");
    }
    throw error;
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`AI processing failed (${response.status}). ${errorText}`.trim());
  }

  const aiResponse = await response.json().catch(() => ({}));
  const content = aiResponse?.choices?.[0]?.message?.content as string | undefined;
  const parsed = safeParseRecipesJson(content);
  if (!parsed) {
    throw new Error("Could not parse structured recipes from AI response.");
  }

  return parsed.map((item) => normalizeRecipe(item)).filter((item): item is ExtractedRecipe => Boolean(item));
}

async function extractChunkWithRetries(
  chunkText: string,
  fileName: string,
  pageCount: number | null,
  index: number,
  total: number,
  depth = 0,
): Promise<ExtractedRecipe[]> {
  try {
    return await extractChunkRecipes(chunkText, fileName, pageCount, index, total);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown parse error";
    if (
      depth < MAX_RETRY_DEPTH &&
      chunkText.length > MIN_RETRY_CHUNK_CHARS &&
      isRetryableError(message)
    ) {
      if (isRateLimit(message)) {
        await sleep(2000 * (depth + 1));
      }
      const nextMax = Math.max(MIN_RETRY_CHUNK_CHARS, Math.floor(chunkText.length / 2));
      const smallerChunks = splitTextIntoChunks(chunkText, nextMax);
      const recovered: ExtractedRecipe[] = [];
      for (let i = 0; i < smallerChunks.length; i += 1) {
        const rows = await extractChunkWithRetries(
          smallerChunks[i],
          fileName,
          pageCount,
          i,
          smallerChunks.length,
          depth + 1,
        );
        recovered.push(...rows);
      }
      return recovered;
    }

    throw error;
  }
}

function dedupeRecipes(recipes: ExtractedRecipe[]): ExtractedRecipe[] {
  const seen = new Set<string>();
  const deduped: ExtractedRecipe[] = [];

  for (const recipe of recipes) {
    const key = recipe.name.toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(recipe);
  }

  return deduped;
}

function readRecipeBuffer(raw: unknown): ExtractedRecipe[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => normalizeRecipe(item)).filter((item): item is ExtractedRecipe => Boolean(item));
}

async function maybeSendCompletionSms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  fileName: string,
  recipesSaved: number,
) {
  const { data: pref, error } = await supabase
    .from("sms_preferences")
    .select("enabled, phone_e164")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !pref?.enabled || !pref.phone_e164) return;

  const body = recipesSaved > 0
    ? `Home Harmony: your cookbook import is done. Added ${recipesSaved} recipe${recipesSaved === 1 ? "" : "s"} from ${fileName}.`
    : `Home Harmony: your cookbook import finished for ${fileName}, but no recipes were found.`;

  try {
    await sendTwilioSms(pref.phone_e164, body);
  } catch (smsError) {
    console.error("Failed to send cookbook completion SMS:", smsError);
  }
}

async function processImportJob(jobId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

  const service = createClient(supabaseUrl, serviceRole);

  const { data: job, error: loadError } = await service
    .from("cookbook_import_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (loadError || !job) {
    throw new Error(loadError?.message || "Import job not found");
  }

  const typedJob = job as ImportJobRow;
  if (typedJob.status === "canceled" || typedJob.status === "completed" || typedJob.status === "failed") {
    return;
  }

  if (!typedJob.pdf_text || !typedJob.pdf_text.trim()) {
    await service
      .from("cookbook_import_jobs")
      .update({
        status: "failed",
        error_message: "No extracted PDF text was stored for this job.",
        finished_at: new Date().toISOString(),
        recipes_buffer: [],
      })
      .eq("id", jobId)
      .neq("status", "canceled");
    return;
  }

  const chunks = splitPdfText(typedJob.pdf_text);
  const total = chunks.length;
  const current = Math.min(Math.max(typedJob.progress_current || 0, 0), total);
  const buffer = readRecipeBuffer(typedJob.recipes_buffer);

  await service
    .from("cookbook_import_jobs")
    .update({
      status: "processing",
      started_at: typedJob.started_at || new Date().toISOString(),
      progress_total: total,
      progress_current: current,
      recipes_found: buffer.length,
      error_message: typedJob.error_message && typedJob.error_message.startsWith("Skipped part")
        ? typedJob.error_message
        : null,
    })
    .eq("id", jobId)
    .neq("status", "canceled");

  if (current < total) {
    const partNumber = current + 1;
    await service
      .from("cookbook_import_jobs")
      .update({ error_message: `Processing part ${partNumber}/${total}...` })
      .eq("id", jobId)
      .neq("status", "canceled");

    let nextBuffer = [...buffer];
    let partWarning: string | null = null;

    try {
      const rows = await withTimeout(
        extractChunkWithRetries(
          chunks[current],
          typedJob.file_name,
          typedJob.page_count,
          current,
          total,
        ),
        PER_CHUNK_TIMEOUT_MS,
        `Part ${partNumber}/${total} timed out.`,
      );
      nextBuffer = [...nextBuffer, ...rows];
    } catch (chunkError) {
      const message = chunkError instanceof Error ? chunkError.message : "Unknown chunk error";
      partWarning = `Skipped part ${partNumber}/${total}: ${message}`;
      console.warn("cookbook-import skipped chunk:", partWarning);
    }

    await service
      .from("cookbook_import_jobs")
      .update({
        progress_current: current + 1,
        progress_total: total,
        recipes_found: nextBuffer.length,
        recipes_buffer: nextBuffer as unknown[],
        error_message: partWarning || `Processed part ${partNumber}/${total}.`,
      })
      .eq("id", jobId)
      .neq("status", "canceled");

    if (current + 1 < total) {
      return;
    }

    const uniqueRecipes = dedupeRecipes(nextBuffer);
    if (uniqueRecipes.length === 0) {
      await service
        .from("cookbook_import_jobs")
        .update({
          status: "failed",
          recipes_found: 0,
          recipes_saved: 0,
          error_message: partWarning || "No recipes were found in this upload.",
          finished_at: new Date().toISOString(),
          pdf_text: null,
          recipes_buffer: [],
        })
        .eq("id", jobId)
        .neq("status", "canceled");
      await maybeSendCompletionSms(service, typedJob.user_id, typedJob.file_name, 0);
      return;
    }

    const rows = uniqueRecipes.map((recipe) => ({
      owner_id: typedJob.user_id,
      name: recipe.name,
      servings: Math.max(1, Math.round(toNumber(recipe.servings, 4))),
      ingredients: recipe.ingredients,
      ingredients_raw: recipe.ingredients.length ? recipe.ingredients.join("\n") : recipe.ingredientsRaw,
      instructions: recipe.instructions || null,
      calories: Math.round(toNumber(recipe.macrosPerServing.calories, 0)),
      protein_g: Math.round(toNumber(recipe.macrosPerServing.protein_g, 0)),
      carbs_g: Math.round(toNumber(recipe.macrosPerServing.carbs_g, 0)),
      fat_g: Math.round(toNumber(recipe.macrosPerServing.fat_g, 0)),
      fiber_g: recipe.macrosPerServing.fiber_g == null ? null : Math.round(toNumber(recipe.macrosPerServing.fiber_g, 0)),
      meal_type: "dinner",
      is_anchored: false,
    }));

    const { data: inserted, error: insertError } = await service
      .from("recipes")
      .insert(rows)
      .select("id");
    if (insertError) throw new Error(`Failed to save imported recipes: ${insertError.message}`);

    const recipesSaved = inserted?.length ?? 0;
    await service
      .from("cookbook_import_jobs")
      .update({
        status: "completed",
        progress_current: total,
        progress_total: total,
        recipes_found: uniqueRecipes.length,
        recipes_saved: recipesSaved,
        error_message: partWarning,
        finished_at: new Date().toISOString(),
        pdf_text: null,
        recipes_buffer: [],
      })
      .eq("id", jobId)
      .neq("status", "canceled");

    await maybeSendCompletionSms(service, typedJob.user_id, typedJob.file_name, recipesSaved);
    return;
  }

  const uniqueRecipes = dedupeRecipes(buffer);
  if (uniqueRecipes.length === 0) {
    await service
      .from("cookbook_import_jobs")
      .update({
        status: "failed",
        recipes_found: 0,
        recipes_saved: 0,
        error_message: "No recipes were found in this upload.",
        finished_at: new Date().toISOString(),
        pdf_text: null,
        recipes_buffer: [],
      })
      .eq("id", jobId)
      .neq("status", "canceled");
    await maybeSendCompletionSms(service, typedJob.user_id, typedJob.file_name, 0);
    return;
  }

  const rows = uniqueRecipes.map((recipe) => ({
    owner_id: typedJob.user_id,
    name: recipe.name,
    servings: Math.max(1, Math.round(toNumber(recipe.servings, 4))),
    ingredients: recipe.ingredients,
    ingredients_raw: recipe.ingredients.length ? recipe.ingredients.join("\n") : recipe.ingredientsRaw,
    instructions: recipe.instructions || null,
    calories: Math.round(toNumber(recipe.macrosPerServing.calories, 0)),
    protein_g: Math.round(toNumber(recipe.macrosPerServing.protein_g, 0)),
    carbs_g: Math.round(toNumber(recipe.macrosPerServing.carbs_g, 0)),
    fat_g: Math.round(toNumber(recipe.macrosPerServing.fat_g, 0)),
    fiber_g: recipe.macrosPerServing.fiber_g == null ? null : Math.round(toNumber(recipe.macrosPerServing.fiber_g, 0)),
    meal_type: "dinner",
    is_anchored: false,
  }));

  const { data: inserted, error: insertError } = await service
    .from("recipes")
    .insert(rows)
    .select("id");
  if (insertError) throw new Error(`Failed to save imported recipes: ${insertError.message}`);

  const recipesSaved = inserted?.length ?? 0;
  await service
    .from("cookbook_import_jobs")
    .update({
      status: "completed",
      progress_current: total,
      progress_total: total,
      recipes_found: uniqueRecipes.length,
      recipes_saved: recipesSaved,
      error_message: null,
      finished_at: new Date().toISOString(),
      pdf_text: null,
      recipes_buffer: [],
    })
    .eq("id", jobId)
    .neq("status", "canceled");

  await maybeSendCompletionSms(service, typedJob.user_id, typedJob.file_name, recipesSaved);
}

async function dispatchCookbookImports(limit = 1): Promise<{ processed: number; ids: string[] }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

  const service = createClient(supabaseUrl, serviceRole);
  const safeLimit = Math.min(5, Math.max(1, Math.round(limit)));

  const { data: jobs, error } = await service
    .from("cookbook_import_jobs")
    .select("id,status,updated_at")
    .in("status", ["queued", "processing"])
    .order("updated_at", { ascending: true })
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  const ids: string[] = [];
  const candidates = (jobs || []).filter((job) => shouldNudgeJob(job.status, job.updated_at));

  for (const job of candidates) {
    if (!job?.id) continue;
    ids.push(job.id);
    try {
      await processImportJob(job.id);
    } catch (jobError) {
      console.error(`Failed processing cookbook import job ${job.id}:`, jobError);
      const message = jobError instanceof Error ? jobError.message : "Unknown import error";
      await service
        .from("cookbook_import_jobs")
        .update({
          status: "failed",
          error_message: message,
          finished_at: new Date().toISOString(),
          pdf_text: null,
          recipes_buffer: [],
        })
        .eq("id", job.id)
        .neq("status", "canceled");
    }
  }

  return { processed: ids.length, ids };
}

async function kickCookbookImports(limit = 1): Promise<{ queued: number; ids: string[] }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

  const service = createClient(supabaseUrl, serviceRole);
  const safeLimit = Math.min(5, Math.max(1, Math.round(limit)));

  const { data: jobs, error } = await service
    .from("cookbook_import_jobs")
    .select("id,status,updated_at")
    .in("status", ["queued", "processing"])
    .order("updated_at", { ascending: true })
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  const ids = (jobs || [])
    .filter((job) => shouldNudgeJob(job.status, job.updated_at))
    .map((job) => job.id)
    .filter(Boolean);
  for (const id of ids) {
    runInBackground(processImportJob(id));
  }

  return { queued: ids.length, ids };
}
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "list";

    if (action === "dispatch") {
      const dispatchKey = Deno.env.get("COOKBOOK_IMPORT_DISPATCH_API_KEY");
      if (!dispatchKey) {
        return json({ success: false, error: "Server dispatch key is not configured." }, 500);
      }
      const provided = req.headers.get("x-cookbook-dispatch-key");
      if (provided !== dispatchKey) {
        return json({ success: false, error: "Unauthorized." }, 401);
      }

      const limitRaw = Number(body?.limit);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 1;
      const sync = body?.sync === true;

      if (sync) {
        const result = await dispatchCookbookImports(limit);
        return json({ success: true, mode: "sync", ...result }, 200);
      }

      const result = await kickCookbookImports(limit);
      return json({ success: true, mode: "async", ...result }, 200);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ success: false, error: "Server auth is not configured." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const userId = authData.user.id;

    if (action === "enqueue") {
      const pdfText = typeof body?.pdfText === "string" ? body.pdfText : "";
      const fileName = typeof body?.fileName === "string" && body.fileName.trim() ? body.fileName.trim() : "cookbook.pdf";
      const pageCount = Number.isFinite(Number(body?.pageCount)) ? Number(body.pageCount) : null;

      if (!pdfText.trim()) {
        return json({ success: false, error: "Extracted PDF text is required." }, 200);
      }

      if (pdfText.length > 1_500_000) {
        return json({ success: false, error: "This upload is too large. Split the PDF into smaller files and retry." }, 200);
      }

      const chunks = splitPdfText(pdfText);
      const { data: created, error: createError } = await supabase
        .from("cookbook_import_jobs")
        .insert({
          user_id: userId,
          file_name: fileName,
          page_count: pageCount,
          status: "queued",
          progress_current: 0,
          progress_total: chunks.length,
          recipes_found: 0,
          recipes_saved: 0,
          pdf_text: pdfText,
          recipes_buffer: [],
        })
        .select(USER_JOB_SELECT)
        .single();

      if (createError || !created) {
        return json({ success: false, error: createError?.message || "Could not queue import." }, 200);
      }

      runInBackground(processImportJob(created.id));

      return json({ success: true, job: created }, 200);
    }

    if (action === "get") {
      const jobId = typeof body?.jobId === "string" ? body.jobId : "";
      if (!jobId) return json({ success: false, error: "jobId is required" }, 200);

      const { data: job, error } = await supabase
        .from("cookbook_import_jobs")
        .select(USER_JOB_SELECT)
        .eq("id", jobId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) return json({ success: false, error: error.message }, 200);
      if (job && shouldNudgeJob(job.status, job.updated_at)) {
        runInBackground(processImportJob(job.id));
      }
      return json({ success: true, job }, 200);
    }

    if (action === "cancel") {
      const jobId = typeof body?.jobId === "string" ? body.jobId : "";
      if (!jobId) return json({ success: false, error: "jobId is required" }, 200);

      const { data: job, error: loadErr } = await supabase
        .from("cookbook_import_jobs")
        .select("id,status")
        .eq("id", jobId)
        .eq("user_id", userId)
        .maybeSingle();

      if (loadErr) return json({ success: false, error: loadErr.message }, 200);
      if (!job) return json({ success: false, error: "Import job not found." }, 200);

      if (job.status === "completed" || job.status === "failed" || job.status === "canceled") {
        return json({ success: true, job }, 200);
      }

      const { data: canceled, error: cancelErr } = await supabase
        .from("cookbook_import_jobs")
        .update({
          status: "canceled",
          error_message: "Canceled by user.",
          finished_at: new Date().toISOString(),
          pdf_text: null,
          recipes_buffer: [],
        })
        .eq("id", jobId)
        .eq("user_id", userId)
        .select(USER_JOB_SELECT)
        .maybeSingle();

      if (cancelErr) return json({ success: false, error: cancelErr.message }, 200);
      if (!canceled) {
        // Most likely already transitioned by the worker; return latest row.
        const { data: latest, error: latestErr } = await supabase
          .from("cookbook_import_jobs")
          .select(USER_JOB_SELECT)
          .eq("id", jobId)
          .eq("user_id", userId)
          .maybeSingle();
        if (latestErr) return json({ success: false, error: latestErr.message }, 200);
        return json({ success: true, job: latest }, 200);
      }
      return json({ success: true, job: canceled }, 200);
    }

    const limitRaw = Number(body?.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(50, Math.max(1, Math.round(limitRaw))) : 15;

    const { data: jobs, error } = await supabase
      .from("cookbook_import_jobs")
      .select(USER_JOB_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return json({ success: false, error: error.message }, 200);
    const activeJob = (jobs || []).find((job) => shouldNudgeJob(job.status, job.updated_at));
    if (activeJob) {
      runInBackground(processImportJob(activeJob.id));
    }
    return json({ success: true, jobs: jobs || [] }, 200);
  } catch (error) {
    console.error("cookbook-import error:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
