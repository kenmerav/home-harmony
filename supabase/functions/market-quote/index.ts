import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

type QuotePayload = {
  symbol?: string;
};

function parseStooqCsv(csv: string): { price: number; asOf: string } | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
  const values = lines[1].split(",").map((item) => item.trim());
  const closeIndex = headers.indexOf("close");
  const dateIndex = headers.indexOf("date");
  const timeIndex = headers.indexOf("time");
  if (closeIndex < 0) return null;
  const price = Number.parseFloat(values[closeIndex]);
  if (!Number.isFinite(price) || price <= 0) return null;
  const date = dateIndex >= 0 ? values[dateIndex] : "";
  const time = timeIndex >= 0 ? values[timeIndex] : "";
  return {
    price,
    asOf: date ? `${date}${time ? `T${time}` : ""}` : new Date().toISOString(),
  };
}

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
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ error: "Unauthorized." }, 401);

    const payload = await req.json().catch(() => ({})) as QuotePayload;
    const symbol = String(payload.symbol || "VOO").trim().toUpperCase();
    if (symbol !== "VOO") return json({ error: "Only VOO is supported right now." }, 400);

    const response = await fetch("https://stooq.com/q/l/?s=voo.us&i=d", {
      headers: { "User-Agent": "HomeHarmonyHQ/1.0" },
    });
    if (!response.ok) {
      return json({ error: `Quote provider returned ${response.status}.` }, 502);
    }

    const parsed = parseStooqCsv(await response.text());
    if (!parsed) return json({ error: "Could not parse VOO quote." }, 502);

    return json({
      symbol: "VOO",
      price: parsed.price,
      asOf: parsed.asOf,
      source: "stooq",
    });
  } catch (error) {
    console.error("market-quote error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
