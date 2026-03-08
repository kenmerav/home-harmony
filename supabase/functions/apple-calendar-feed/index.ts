import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import {
  buildIcsCalendar,
  FEED_LAYERS,
  FeedLayer,
  IcsFeedEvent,
  isValidFeedToken,
  normalizeFeedLayer,
  parseFeedPath,
} from "../_shared/appleCalendarFeed.ts";

type Action = "get_urls" | "regenerate_token";

type CalendarFeedTokenRow = {
  user_id: string;
  feed_token: string;
};

type CalendarEventRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  timezone_name: string | null;
  calendar_layer: string | null;
  location_text: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  is_deleted: boolean | null;
};

const CONNECT_LAYERS: FeedLayer[] = ["all", "family", "meals", "kids", "chores", "deliveries"];

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return "unknown";
  return xff.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  if (bucket.count > RATE_LIMIT_MAX) return true;
  return false;
}

function generateFeedToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const asBinary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(asBinary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function buildFeedUrl(supabaseUrl: string, token: string, layer: FeedLayer): string {
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1/apple-calendar-feed/calendar/${token}/${layer}.ics`;
}

function buildFeedUrls(supabaseUrl: string, token: string) {
  const feeds = Object.fromEntries(CONNECT_LAYERS.map((layer) => [layer, buildFeedUrl(supabaseUrl, token, layer)]));
  return feeds as Record<FeedLayer, string>;
}

async function requireUserId(req: Request, supabaseUrl: string, supabaseAnonKey: string): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing Authorization header.");

  const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await authedClient.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized.");
  return data.user.id;
}

async function ensureFeedToken(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  forceRegenerate = false,
): Promise<string> {
  const { data: existing, error: existingErr } = await adminClient
    .from("calendar_feed_tokens")
    .select("user_id,feed_token")
    .eq("user_id", userId)
    .maybeSingle<CalendarFeedTokenRow>();

  if (existingErr) throw new Error(existingErr.message);
  if (!forceRegenerate && existing?.feed_token && isValidFeedToken(existing.feed_token)) {
    return existing.feed_token;
  }

  const nextToken = generateFeedToken();
  const { error: upsertErr } = await adminClient
    .from("calendar_feed_tokens")
    .upsert({ user_id: userId, feed_token: nextToken }, { onConflict: "user_id" });

  if (upsertErr) throw new Error(upsertErr.message);
  return nextToken;
}

async function resolveUserIdFromToken(
  adminClient: ReturnType<typeof createClient>,
  token: string,
): Promise<string | null> {
  const { data, error } = await adminClient
    .from("calendar_feed_tokens")
    .select("user_id")
    .eq("feed_token", token)
    .maybeSingle<{ user_id: string }>();

  if (error) throw new Error(error.message);
  return data?.user_id || null;
}

function mapRowsToFeedEvents(rows: CalendarEventRow[]): IcsFeedEvent[] {
  return rows
    .filter((row) => !(row.is_deleted || row.deleted_at))
    .map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      location: row.location_text,
      startDatetime: row.starts_at,
      endDatetime: row.ends_at,
      allDay: !!row.all_day,
      timezone: row.timezone_name,
      layer: row.calendar_layer || "family",
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    }));
}

async function renderFeed(req: Request, adminClient: ReturnType<typeof createClient>, token: string, layer: FeedLayer) {
  const rateKey = `${getClientIp(req)}:${token}`;
  if (isRateLimited(rateKey)) {
    return new Response("Too many requests", {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const userId = await resolveUserIdFromToken(adminClient, token);
  if (!userId) {
    return new Response("Feed not found", {
      status: 404,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  let query = adminClient
    .from("calendar_events")
    .select(
      "id,title,description,starts_at,ends_at,all_day,timezone_name,calendar_layer,location_text,updated_at,deleted_at,is_deleted",
    )
    .eq("owner_id", userId)
    .order("starts_at", { ascending: true });

  if (layer !== "all") {
    query = query.eq("calendar_layer", layer);
  }

  const { data, error } = await query;
  if (error) {
    return new Response(`Calendar feed error: ${error.message}`, {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  const feedEvents = mapRowsToFeedEvents(((data || []) as CalendarEventRow[]));
  const layerLabel = layer === "all" ? "All Events" : `${layer.charAt(0).toUpperCase()}${layer.slice(1)} Events`;
  const ics = buildIcsCalendar(feedEvents, `Home Harmony - ${layerLabel}`);

  return new Response(ics, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=60",
    },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase environment variables." }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const url = new URL(req.url);

    if (req.method === "GET") {
      const parsedPath = parseFeedPath(url.pathname);
      const queryToken = url.searchParams.get("token") || "";
      const queryLayer = normalizeFeedLayer(url.searchParams.get("layer") || "all");
      const token = parsedPath?.token || queryToken;
      const layer = parsedPath?.layer || queryLayer;

      if (token) {
        if (!isValidFeedToken(token)) {
          return new Response("Feed not found", {
            status: 404,
            headers: {
              ...corsHeaders,
              "Content-Type": "text/plain; charset=utf-8",
            },
          });
        }
        return await renderFeed(req, adminClient, token, layer);
      }
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed." }, 405);
    }

    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = String(payload?.action || "") as Action;
    if (action !== "get_urls" && action !== "regenerate_token") {
      return json({ error: "Unsupported action." }, 400);
    }

    const userId = await requireUserId(req, supabaseUrl, supabaseAnonKey);
    const token = await ensureFeedToken(adminClient, userId, action === "regenerate_token");

    return json({
      token,
      mode: "one_way_read_only",
      supported_layers: FEED_LAYERS,
      feeds: buildFeedUrls(supabaseUrl, token),
    });
  } catch (error) {
    console.error("apple-calendar-feed error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("authorization") ? 401 : 500;
    return json({ error: message }, status);
  }
});
