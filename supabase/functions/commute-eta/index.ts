import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { fetchGoogleDriveTrafficEstimate } from "../_shared/traffic.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) return json({ error: "Missing Supabase env vars." }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) return json({ error: "Unauthorized." }, 401);

    const payload = await req.json().catch(() => ({})) as {
      origin?: string;
      destination?: string;
      departureTimeIso?: string;
    };

    const origin = String(payload.origin || "").trim();
    const destination = String(payload.destination || "").trim();
    if (!origin || !destination) {
      return json({ error: "Origin and destination are required." }, 400);
    }

    const departureEpochSeconds = payload.departureTimeIso
      ? Math.floor(new Date(payload.departureTimeIso).getTime() / 1000)
      : undefined;

    const estimate = await fetchGoogleDriveTrafficEstimate({
      origin,
      destination,
      departureEpochSeconds,
    });

    return json({
      durationMinutes: estimate.durationMinutes,
      trafficDurationMinutes: estimate.trafficDurationMinutes,
    });
  } catch (error) {
    console.error("commute-eta error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
