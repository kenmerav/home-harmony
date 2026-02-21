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
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey) {
      return json({ error: "Missing required env vars" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) return json({ error: "Unauthorized" }, 401);

    const { data: subData, error: subErr } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", authData.user.id)
      .maybeSingle();

    if (subErr) return json({ error: subErr.message }, 500);
    if (!subData?.stripe_customer_id) return json({ error: "No billing customer found for this account." }, 400);

    const payload = await req.json().catch(() => ({}));
    const returnUrl = payload.returnUrl || `${new URL(req.url).origin}/billing`;

    const params = new URLSearchParams();
    params.set("customer", subData.stripe_customer_id);
    params.set("return_url", returnUrl);

    const stripeResp = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const stripeJson = await stripeResp.json();
    if (!stripeResp.ok) {
      return json({ error: stripeJson?.error?.message || "Failed to create portal session" }, 500);
    }

    return json({ url: stripeJson.url });
  } catch (error) {
    console.error("create-portal-session error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
