import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logContext(stage: string, details: Record<string, unknown>) {
  console.log(JSON.stringify({ stage, ...details }));
}

async function fetchStripeJson<T = unknown>(
  stripeSecretKey: string,
  path: string,
): Promise<{ ok: boolean; status: number; json: T }> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${stripeSecretKey}`,
    },
  });
  const json = await response.json();
  return { ok: response.ok, status: response.status, json: json as T };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const defaultStripePriceId = Deno.env.get("STRIPE_PRICE_ID");
    const monthlyStripePriceId = Deno.env.get("STRIPE_PRICE_ID_MONTHLY");
    const yearlyStripePriceId = Deno.env.get("STRIPE_PRICE_ID_YEARLY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    logContext("checkout_request_started", {
      hasStripeSecretKey: Boolean(stripeSecretKey),
      hasDefaultStripePriceId: Boolean(defaultStripePriceId),
      hasMonthlyStripePriceId: Boolean(monthlyStripePriceId),
      hasYearlyStripePriceId: Boolean(yearlyStripePriceId),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseAnonKey: Boolean(supabaseAnonKey),
    });

    if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey) {
      logContext("checkout_request_failed", {
        reason: "missing_required_env_vars",
      });
      return json({ error: "Missing required env vars" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logContext("checkout_request_failed", {
        reason: "missing_authorization_header",
      });
      return json({ error: "Missing Authorization header" }, 401);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      logContext("checkout_request_failed", {
        reason: "unauthorized_user",
        authError: authErr?.message ?? null,
      });
      return json({ error: "Unauthorized" }, 401);
    }

    const payload = await req.json().catch(() => ({}));
    const successUrl = payload.successUrl || `${new URL(req.url).origin}/billing?checkout=success`;
    const cancelUrl = payload.cancelUrl || `${new URL(req.url).origin}/billing?checkout=cancel`;
    const interval = payload.interval === "yearly" ? "yearly" : "monthly";
    const promoCodeInput = typeof payload.promoCode === "string" ? payload.promoCode.trim() : "";
    const stripePriceId =
      interval === "yearly"
        ? yearlyStripePriceId || defaultStripePriceId
        : monthlyStripePriceId || defaultStripePriceId;

    let appliedPromotionCodeId: string | null = null;
    let appliedCouponId: string | null = null;
    let isFreeForeverPromotion = false;

    if (promoCodeInput) {
      const promoLookup = await fetchStripeJson<{
        data?: Array<{ id?: string; coupon?: string | { id?: string | null } | null }>;
      }>(
        stripeSecretKey,
        `/v1/promotion_codes?code=${encodeURIComponent(promoCodeInput)}&active=true&limit=1`,
      );

      if (!promoLookup.ok) {
        logContext("checkout_request_failed", {
          reason: "promotion_code_lookup_failed",
          promoCodeInput,
          stripeStatus: promoLookup.status,
        });
        return json({ error: "Could not validate promo code right now." }, 500);
      }

      const promotion = Array.isArray(promoLookup.json?.data) ? promoLookup.json.data[0] : null;
      const promotionId = promotion?.id || null;
      const couponField = promotion?.coupon;
      const couponId =
        typeof couponField === "string"
          ? couponField
          : couponField && typeof couponField === "object"
          ? couponField.id || null
          : null;

      if (!promotionId || !couponId) {
        logContext("checkout_request_failed", {
          reason: "promotion_code_not_found",
          promoCodeInput,
        });
        return json({ error: "Promo code not found or no longer active." }, 400);
      }

      const couponLookup = await fetchStripeJson<{ id?: string; percent_off?: number | null; duration?: string }>(
        stripeSecretKey,
        `/v1/coupons/${encodeURIComponent(couponId)}`,
      );

      if (!couponLookup.ok) {
        logContext("checkout_request_failed", {
          reason: "coupon_lookup_failed",
          promoCodeInput,
          couponId,
          stripeStatus: couponLookup.status,
        });
        return json({ error: "Could not validate promo discount right now." }, 500);
      }

      appliedPromotionCodeId = promotionId;
      appliedCouponId = couponId;
      isFreeForeverPromotion =
        Number(couponLookup.json?.percent_off || 0) >= 100 &&
        couponLookup.json?.duration === "forever";
    }

    logContext("checkout_request_authenticated", {
      userId: authData.user.id,
      interval,
      hasStripePriceId: Boolean(stripePriceId),
      hasPromoCode: Boolean(promoCodeInput),
      hasAppliedPromotionCode: Boolean(appliedPromotionCodeId),
      isFreeForeverPromotion,
    });

    if (!stripePriceId) {
      logContext("checkout_request_failed", {
        reason: "missing_stripe_price_id",
        interval,
      });
      return json({ error: `Missing Stripe price ID for ${interval} billing.` }, 500);
    }

    const { data: existing, error: existingError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (existingError) {
      logContext("checkout_subscription_lookup_failed", {
        userId: authData.user.id,
        error: existingError.message,
      });
    }

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("line_items[0][price]", stripePriceId);
    params.set("line_items[0][quantity]", "1");
    if (!isFreeForeverPromotion) {
      params.set("subscription_data[trial_period_days]", "14");
    } else {
      params.set("payment_method_collection", "if_required");
    }
    params.set("subscription_data[metadata][billing_interval]", interval);
    params.set("subscription_data[metadata][user_id]", authData.user.id);
    if (appliedPromotionCodeId) {
      params.set("discounts[0][promotion_code]", appliedPromotionCodeId);
      params.set("metadata[promo_code]", promoCodeInput.toLowerCase());
      params.set("subscription_data[metadata][promo_code]", promoCodeInput.toLowerCase());
      params.set("subscription_data[metadata][promotion_code_id]", appliedPromotionCodeId);
      if (appliedCouponId) {
        params.set("subscription_data[metadata][coupon_id]", appliedCouponId);
      }
    } else {
      params.set("allow_promotion_codes", "true");
    }
    params.set("client_reference_id", authData.user.id);
    params.set("metadata[billing_interval]", interval);
    params.set("metadata[user_id]", authData.user.id);
    if (existing?.stripe_customer_id) {
      params.set("customer", existing.stripe_customer_id);
    } else if (authData.user.email) {
      params.set("customer_email", authData.user.email);
    }

    const stripeResp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const stripeJson = await stripeResp.json();
    if (!stripeResp.ok) {
      console.error("Stripe checkout error:", stripeJson);
      logContext("checkout_request_failed", {
        reason: "stripe_checkout_error",
        interval,
        stripeStatus: stripeResp.status,
        stripeError: stripeJson?.error?.message || null,
        hasPromoCode: Boolean(promoCodeInput),
        isFreeForeverPromotion,
      });
      return json({ error: stripeJson?.error?.message || "Stripe checkout failed" }, 500);
    }

    logContext("checkout_request_succeeded", {
      userId: authData.user.id,
      interval,
      hasUrl: Boolean(stripeJson.url),
    });
    return json({ url: stripeJson.url });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
