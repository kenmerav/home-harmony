import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

type GrowthEventRow = {
  user_id: string;
  event_type: string;
  occurred_at: string;
};

type ModuleUsage = Record<string, number>;

function parseAdminEmails(raw: string | null): Set<string> {
  if (!raw) return new Set<string>();
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.length > 0),
  );
}

function toTs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeEventType(type: string): string {
  return type.trim().toLowerCase();
}

function inferModule(eventType: string): string {
  const value = normalizeEventType(eventType);
  if (value.includes("meal")) return "meals";
  if (value.includes("grocery")) return "grocery";
  if (value.includes("recipe")) return "recipes";
  if (value.includes("chore")) return "chores";
  if (value.includes("task")) return "tasks";
  if (value.includes("workout")) return "workouts";
  if (value.includes("referral")) return "referrals";
  if (value.includes("onboarding")) return "onboarding";
  if (value.includes("landing") || value.includes("free_tool")) return "growth";
  return "other";
}

async function countRows(
  service: ReturnType<typeof createClient>,
  table: string,
): Promise<number> {
  const { count, error } = await service
    .from(table)
    .select("id", { head: true, count: "exact" });
  if (error) throw new Error(`Failed counting ${table}: ${error.message}`);
  return count || 0;
}

async function countRowsSince(
  service: ReturnType<typeof createClient>,
  table: string,
  column: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await service
    .from(table)
    .select("id", { head: true, count: "exact" })
    .gte(column, sinceIso);
  if (error) throw new Error(`Failed counting ${table} since ${sinceIso}: ${error.message}`);
  return count || 0;
}

async function fetchGrowthEventsSince(
  service: ReturnType<typeof createClient>,
  sinceIso: string,
  maxRows = 50000,
): Promise<GrowthEventRow[]> {
  const pageSize = 1000;
  let from = 0;
  const rows: GrowthEventRow[] = [];

  while (rows.length < maxRows) {
    const to = from + pageSize - 1;
    const { data, error } = await service
      .from("growth_events")
      .select("user_id,event_type,occurred_at")
      .gte("occurred_at", sinceIso)
      .order("occurred_at", { ascending: false })
      .range(from, to);

    if (error) throw new Error(`Failed loading growth events: ${error.message}`);
    const batch = (data || []) as GrowthEventRow[];
    if (!batch.length) break;

    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows.slice(0, maxRows);
}

async function listAllAuthUsers(service: ReturnType<typeof createClient>) {
  const perPage = 1000;
  let page = 1;
  const users: Array<{
    id: string;
    email: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    email_confirmed_at: string | null;
  }> = [];

  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`Failed listing auth users: ${error.message}`);
    const batch = data?.users || [];
    if (!batch.length) break;

    for (const user of batch) {
      users.push({
        id: user.id,
        email: user.email || null,
        created_at: user.created_at || new Date(0).toISOString(),
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
      });
    }

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase env vars." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authErr } = await authClient.auth.getUser();
    if (authErr || !authData.user) return json({ error: "Unauthorized." }, 401);

    const allowedAdminEmails = parseAdminEmails(Deno.env.get("ADMIN_EMAILS"));
    if (!allowedAdminEmails.size) {
      return json({
        error: "Admin dashboard is not configured. Set ADMIN_EMAILS in Supabase secrets.",
      }, 403);
    }

    const email = (authData.user.email || "").trim().toLowerCase();
    if (!email || !allowedAdminEmails.has(email)) {
      return json({ error: "Forbidden. Admin access required." }, 403);
    }

    const service = createClient(supabaseUrl, serviceRoleKey);

    const now = Date.now();
    const sevenDaysAgoIso = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgoIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      allUsers,
      profilesCount,
      householdsCount,
      recipesCount,
      plannedMealsCount,
      referralsCount,
      freeToolsEventsCount,
      freeToolsLeadsCount,
      growthEventsAllTimeCount,
      growthEventsLast7dCount,
      growthEventsLast30dCount,
      onboardingCompletedCount,
      subscriptionsRows,
    ] = await Promise.all([
      listAllAuthUsers(service),
      countRows(service, "profiles"),
      countRows(service, "households"),
      countRows(service, "recipes"),
      countRows(service, "planned_meals"),
      countRows(service, "referral_events"),
      countRows(service, "free_tools_cta_events"),
      countRows(service, "free_tools_lead_captures"),
      countRows(service, "growth_events"),
      countRowsSince(service, "growth_events", "occurred_at", sevenDaysAgoIso),
      countRowsSince(service, "growth_events", "occurred_at", thirtyDaysAgoIso),
      countRowsSince(service, "profiles", "onboarding_completed_at", "1970-01-01T00:00:00.000Z"),
      service.from("subscriptions").select("status"),
    ]);

    if (subscriptionsRows.error) {
      return json({ error: `Failed loading subscriptions: ${subscriptionsRows.error.message}` }, 500);
    }

    const growthLast30 = await fetchGrowthEventsSince(service, thirtyDaysAgoIso);
    const uniqueUsers30 = new Set<string>();
    const uniqueUsers7 = new Set<string>();
    const eventCounts = new Map<string, number>();
    const moduleUsage: ModuleUsage = {};

    for (const row of growthLast30) {
      const eventType = normalizeEventType(row.event_type);
      const occurredAtTs = toTs(row.occurred_at);
      const userId = row.user_id;

      if (userId) uniqueUsers30.add(userId);
      if (occurredAtTs >= toTs(sevenDaysAgoIso) && userId) uniqueUsers7.add(userId);

      eventCounts.set(eventType, (eventCounts.get(eventType) || 0) + 1);

      const moduleName = inferModule(eventType);
      moduleUsage[moduleName] = (moduleUsage[moduleName] || 0) + 1;
    }

    const verifiedUsers = allUsers.filter((user) => Boolean(user.email_confirmed_at)).length;
    const newUsers7d = allUsers.filter((user) => toTs(user.created_at) >= toTs(sevenDaysAgoIso)).length;
    const newUsers30d = allUsers.filter((user) => toTs(user.created_at) >= toTs(thirtyDaysAgoIso)).length;

    const recentUsers = [...allUsers]
      .sort((a, b) => toTs(b.created_at) - toTs(a.created_at))
      .slice(0, 25)
      .map((user) => ({
        id: user.id,
        email: user.email,
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
        emailConfirmedAt: user.email_confirmed_at,
      }));

    const subscriptionsByStatus = (subscriptionsRows.data || []).reduce<Record<string, number>>((acc, row) => {
      const status = String((row as { status?: string }).status || "unknown").toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const topGrowthEvents = [...eventCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([eventType, count]) => ({ eventType, count }));

    return json({
      summary: {
        totalUsers: allUsers.length,
        verifiedUsers,
        newUsers7d,
        newUsers30d,
        activeUsers7d: uniqueUsers7.size,
        activeUsers30d: uniqueUsers30.size,
        growthEvents7d: growthEventsLast7dCount,
        growthEvents30d: growthEventsLast30dCount,
      },
      totals: {
        profiles: profilesCount,
        onboardingCompleted: onboardingCompletedCount,
        households: householdsCount,
        recipes: recipesCount,
        plannedMeals: plannedMealsCount,
        referralEvents: referralsCount,
        freeToolsEvents: freeToolsEventsCount,
        freeToolsLeads: freeToolsLeadsCount,
        growthEventsAllTime: growthEventsAllTimeCount,
      },
      subscriptionsByStatus,
      moduleUsage30d: moduleUsage,
      topGrowthEvents30d: topGrowthEvents,
      recentUsers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("admin-metrics error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
