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

function toIso(ts?: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
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

type StripeSubscription = {
  id?: string;
  customer?: string;
  status?: string;
  created?: number;
  current_period_end?: number | null;
  trial_end?: number | null;
  items?: {
    data?: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  } | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Missing required env vars" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const service = createClient(supabaseUrl, serviceRoleKey);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const user = authData.user;

    const { data: existing, error: existingError } = await service
      .from("subscriptions")
      .select("user_id,status,stripe_customer_id,stripe_subscription_id,price_id,current_period_end,trial_ends_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) {
      return json({ error: existingError.message }, 500);
    }

    const upsertSubscription = async (sub: StripeSubscription) => {
      const { error } = await service
        .from("subscriptions")
        .upsert(
          {
            user_id: user.id,
            stripe_customer_id: typeof sub.customer === "string" ? sub.customer : existing?.stripe_customer_id || null,
            stripe_subscription_id: sub.id || existing?.stripe_subscription_id || null,
            status: sub.status || existing?.status || "inactive",
            price_id: sub.items?.data?.[0]?.price?.id || existing?.price_id || null,
            current_period_end: toIso(sub.current_period_end) || existing?.current_period_end || null,
            trial_ends_at: toIso(sub.trial_end) || existing?.trial_ends_at || null,
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    };

    const pickBestSubscription = (subscriptions: StripeSubscription[]): StripeSubscription | null => {
      if (!subscriptions.length) return null;
      const activeLike = subscriptions.filter((sub) => sub.status === "active" || sub.status === "trialing");
      const candidatePool = activeLike.length > 0 ? activeLike : subscriptions;
      return candidatePool
        .slice()
        .sort((a, b) => (Number(b.created || 0) - Number(a.created || 0)))[0] || null;
    };

    let bestSubscription: StripeSubscription | null = null;

    if (existing?.stripe_subscription_id) {
      const subscriptionLookup = await fetchStripeJson<StripeSubscription>(
        stripeSecretKey,
        `/v1/subscriptions/${encodeURIComponent(existing.stripe_subscription_id)}`,
      );
      if (subscriptionLookup.ok && subscriptionLookup.json?.id) {
        bestSubscription = subscriptionLookup.json;
      }
    }

    if (!bestSubscription && existing?.stripe_customer_id) {
      const customerSubscriptions = await fetchStripeJson<{ data?: StripeSubscription[] }>(
        stripeSecretKey,
        `/v1/subscriptions?customer=${encodeURIComponent(existing.stripe_customer_id)}&status=all&limit=10`,
      );
      if (customerSubscriptions.ok) {
        bestSubscription = pickBestSubscription(Array.isArray(customerSubscriptions.json?.data) ? customerSubscriptions.json.data : []);
      }
    }

    if (!bestSubscription && user.email) {
      const customerLookup = await fetchStripeJson<{ data?: Array<{ id?: string }> }>(
        stripeSecretKey,
        `/v1/customers?email=${encodeURIComponent(user.email)}&limit=10`,
      );
      if (customerLookup.ok && Array.isArray(customerLookup.json?.data)) {
        for (const customer of customerLookup.json.data) {
          if (!customer?.id) continue;
          const customerSubscriptions = await fetchStripeJson<{ data?: StripeSubscription[] }>(
            stripeSecretKey,
            `/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=10`,
          );
          if (!customerSubscriptions.ok) continue;
          const candidate = pickBestSubscription(
            Array.isArray(customerSubscriptions.json?.data) ? customerSubscriptions.json.data : [],
          );
          if (candidate) {
            bestSubscription = candidate;
            break;
          }
        }
      }
    }

    if (bestSubscription?.id) {
      await upsertSubscription(bestSubscription);
      return json({
        synced: true,
        status: bestSubscription.status || "inactive",
        priceId: bestSubscription.items?.data?.[0]?.price?.id || null,
      });
    }

    return json({
      synced: false,
      status: existing?.status || "inactive",
      priceId: existing?.price_id || null,
    });
  } catch (error) {
    console.error("sync-subscription-status error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
