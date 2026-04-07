import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type UsageCostCategory = "sms" | "ai" | "email";

export interface UsageCostEventInput {
  userId?: string | null;
  category: UsageCostCategory;
  provider: string;
  meter: string;
  estimatedCostUsd: number;
  quantity?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

type OpenAiUsageLike = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
};

const OPENAI_STANDARD_PRICING: Record<string, { inputPer1M: number; outputPer1M: number; cachedInputPer1M?: number }> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6, cachedInputPer1M: 0.075 },
  "gpt-4.1": { inputPer1M: 2.0, outputPer1M: 8.0, cachedInputPer1M: 0.5 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6, cachedInputPer1M: 0.1 },
};

const DEFAULT_OPENAI_PRICING = OPENAI_STANDARD_PRICING["gpt-4o-mini"];
const RESEND_EMAIL_COST_USD = 20 / 50_000;
const TWILIO_INBOUND_SMS_SEGMENT_ESTIMATE_USD = 0.0085;
const TWILIO_INBOUND_MMS_ESTIMATE_USD = 0.0165;

function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

function roundUsd(value: number): number {
  return Math.round(Math.max(0, value) * 1_000_000) / 1_000_000;
}

function isUnicodeSmsBody(body: string): boolean {
  return /[^\u0000-\u007F]/.test(body);
}

export function estimateSmsSegments(body: string): number {
  const text = String(body || "");
  if (!text) return 1;
  const unicode = isUnicodeSmsBody(text);
  const singleLimit = unicode ? 70 : 160;
  const multiLimit = unicode ? 67 : 153;
  if (text.length <= singleLimit) return 1;
  return Math.max(1, Math.ceil(text.length / multiLimit));
}

export function estimateInboundTextCostUsd(body: string, mediaCount = 0): number {
  if (mediaCount > 0) {
    return roundUsd(TWILIO_INBOUND_MMS_ESTIMATE_USD * Math.max(1, mediaCount));
  }
  return roundUsd(estimateSmsSegments(body) * TWILIO_INBOUND_SMS_SEGMENT_ESTIMATE_USD);
}

export function estimateOpenAiCostUsd(model: string, usage: OpenAiUsageLike | null | undefined): number {
  if (!usage) return 0;
  const pricing = OPENAI_STANDARD_PRICING[model] || DEFAULT_OPENAI_PRICING;
  const promptTokens = Math.max(0, Number(usage.prompt_tokens || 0));
  const completionTokens = Math.max(0, Number(usage.completion_tokens || 0));
  const cachedPromptTokens = Math.max(0, Number(usage.prompt_tokens_details?.cached_tokens || 0));
  const uncachedPromptTokens = Math.max(0, promptTokens - cachedPromptTokens);

  const inputCost = (uncachedPromptTokens / 1_000_000) * pricing.inputPer1M;
  const cachedInputCost = (cachedPromptTokens / 1_000_000) * (pricing.cachedInputPer1M ?? pricing.inputPer1M);
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  return roundUsd(inputCost + cachedInputCost + outputCost);
}

export function estimateEmailSendCostUsd(quantity = 1): number {
  return roundUsd(Math.max(0, quantity) * RESEND_EMAIL_COST_USD);
}

export async function logUsageCostEvent(input: UsageCostEventInput): Promise<void> {
  try {
    const supabase = getServiceClient();
    if (!supabase) return;

    const estimatedCostUsd = roundUsd(input.estimatedCostUsd);
    const quantity = Math.max(1, Math.round(Number(input.quantity || 1)));

    const { error } = await supabase
      .from("usage_cost_events")
      .insert({
        user_id: input.userId || null,
        category: input.category,
        provider: input.provider,
        meter: input.meter,
        estimated_cost_usd: estimatedCostUsd,
        quantity,
        metadata: input.metadata || {},
        created_at: input.createdAt || new Date().toISOString(),
      });

    if (error) {
      console.error("usage_cost_events insert failed:", error.message);
    }
  } catch (error) {
    console.error("usage_cost_events logging error:", error);
  }
}
