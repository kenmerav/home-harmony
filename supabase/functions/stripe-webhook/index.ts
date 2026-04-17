import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toHex(sig);
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = sigHeader.split(",");
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Parts = parts.filter((p) => p.startsWith("v1="));
  if (!tPart || v1Parts.length === 0) return false;
  const timestamp = tPart.replace("t=", "");
  const signedPayload = `${timestamp}.${payload}`;
  const expected = await signPayload(secret, signedPayload);
  return v1Parts.some((part) => part.replace("v1=", "") === expected);
}

function toIso(ts?: number | null): string | null {
  if (!ts) return null;
  return new Date(ts * 1000).toISOString();
}

function deriveStoredStatus(sub: {
  status?: string | null;
  cancel_at_period_end?: boolean | null;
}): string {
  const rawStatus = String(sub.status || "inactive").toLowerCase();
  if (Boolean(sub.cancel_at_period_end) && (rawStatus === "active" || rawStatus === "trialing")) {
    return "canceled";
  }
  return rawStatus;
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!stripeWebhookSecret || !stripeSecretKey || !supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing required env vars" }, 500);
    }

    const payload = await req.text();
    const signature = req.headers.get("stripe-signature") || "";
    const valid = await verifyStripeSignature(payload, signature, stripeWebhookSecret);
    if (!valid) return json({ error: "Invalid signature" }, 400);

    const event = JSON.parse(payload);
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const upsertSubscription = async (params: {
      userId: string;
      stripeCustomerId?: string | null;
      stripeSubscriptionId?: string | null;
      status?: string | null;
      priceId?: string | null;
      currentPeriodEnd?: string | null;
      trialEndsAt?: string | null;
      cancelAtPeriodEnd?: boolean | null;
      cancelAt?: string | null;
      canceledAt?: string | null;
    }) => {
      const { error } = await supabase
        .from("subscriptions")
        .upsert(
          {
            user_id: params.userId,
            stripe_customer_id: params.stripeCustomerId || null,
            stripe_subscription_id: params.stripeSubscriptionId || null,
            status: params.status || "inactive",
            price_id: params.priceId || null,
            current_period_end: params.currentPeriodEnd || null,
            trial_ends_at: params.trialEndsAt || null,
            cancel_at_period_end: Boolean(params.cancelAtPeriodEnd),
            cancel_at: params.cancelAt || null,
            canceled_at: params.canceledAt || null,
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
    };

    const resolveUserIdForSubscriptionEvent = async (sub: {
      id?: string;
      customer?: string;
      metadata?: { user_id?: string };
    }): Promise<string | null> => {
      const metadataUserId = sub.metadata?.user_id;
      if (metadataUserId) return metadataUserId;

      if (sub.id) {
        const { data } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        if (data?.user_id) return data.user_id;
      }

      if (typeof sub.customer === "string" && sub.customer.length > 0) {
        const { data } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", sub.customer)
          .maybeSingle();
        if (data?.user_id) return data.user_id;
      }

      return null;
    };

    const fetchSubscriptionFromStripe = async (subscriptionId: string) => {
      const resp = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error?.message || "Failed to fetch Stripe subscription");
      return data;
    };

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.client_reference_id || session.metadata?.user_id;
      const subscriptionId = session.subscription;
      if (userId && subscriptionId) {
        const sub = await fetchSubscriptionFromStripe(subscriptionId);
        await upsertSubscription({
          userId,
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          status: deriveStoredStatus(sub),
          priceId: sub.items?.data?.[0]?.price?.id || null,
          currentPeriodEnd: toIso(sub.current_period_end),
          trialEndsAt: toIso(sub.trial_end),
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          cancelAt: toIso(sub.cancel_at),
          canceledAt: toIso(sub.canceled_at),
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object;
      const userId = await resolveUserIdForSubscriptionEvent(sub);
      if (userId) {
        await upsertSubscription({
          userId,
          stripeCustomerId: sub.customer,
          stripeSubscriptionId: sub.id,
          status: deriveStoredStatus(sub),
          priceId: sub.items?.data?.[0]?.price?.id || null,
          currentPeriodEnd: toIso(sub.current_period_end),
          trialEndsAt: toIso(sub.trial_end),
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          cancelAt: toIso(sub.cancel_at),
          canceledAt: toIso(sub.canceled_at),
        });
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error("stripe-webhook error:", error);
    return json({ error: "Internal server error" }, 500);
  }
});
