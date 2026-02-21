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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const stripePriceId = Deno.env.get("STRIPE_PRICE_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!stripeSecretKey || !stripePriceId || !supabaseUrl || !supabaseAnonKey) {
      return json({ error: "Missing required env vars" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) return json({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const successUrl = payload.successUrl || `${new URL(req.url).origin}/billing?checkout=success`;
    const cancelUrl = payload.cancelUrl || `${new URL(req.url).origin}/billing?checkout=cancel`;

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("success_url", successUrl);
    params.set("cancel_url", cancelUrl);
    params.set("line_items[0][price]", stripePriceId);
    params.set("line_items[0][quantity]", "1");
    params.set("subscription_data[trial_period_days]", "14");
    params.set("subscription_data[metadata][user_id]", authData.user.id);
    params.set("allow_promotion_codes", "true");
    params.set("client_reference_id", authData.user.id);
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
      return json({ error: stripeJson?.error?.message || "Stripe checkout failed" }, 500);
    }

    return json({ url: stripeJson.url });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
