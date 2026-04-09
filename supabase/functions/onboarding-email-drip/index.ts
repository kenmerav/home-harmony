import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime } from "npm:luxon@3.6.1";
import { corsHeaders, json } from "../_shared/cors.ts";

type LifecycleTemplateKey =
  | "plan_meals"
  | "review_grocery"
  | "invite_household"
  | "set_reminders"
  | "calendar_setup"
  | "power_up";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  household_id: string | null;
  timezone: string | null;
  onboarding_completed_at: string | null;
  onboarding_settings: Record<string, unknown> | null;
};

type DripContext = {
  userId: string;
  email: string;
  userName: string;
  timezone: string;
  daysSinceOnboarding: number;
  onboarding: Record<string, unknown>;
  recipesCount: number;
  mealsGeneratedCount: number;
  groceriesOrderedCount: number;
  householdMemberCount: number;
  smsEnabled: boolean;
  futureCalendarCount: number;
};

type TemplateRule = {
  key: LifecycleTemplateKey;
  minDay: number;
  shouldSend: (context: DripContext) => boolean;
};

const TEMPLATE_ORDER: TemplateRule[] = [
  {
    key: "plan_meals",
    minDay: 2,
    shouldSend: (context) => context.mealsGeneratedCount === 0 || context.recipesCount < 8,
  },
  {
    key: "invite_household",
    minDay: 4,
    shouldSend: (context) => context.householdMemberCount <= 1,
  },
  {
    key: "review_grocery",
    minDay: 6,
    shouldSend: (context) => context.mealsGeneratedCount > 0 && context.groceriesOrderedCount === 0,
  },
  {
    key: "set_reminders",
    minDay: 8,
    shouldSend: (context) => !context.smsEnabled,
  },
  {
    key: "calendar_setup",
    minDay: 10,
    shouldSend: (context) => {
      const calendarSystem = String(context.onboarding.calendarSystem || "").toLowerCase();
      const mainPainPoint = String(context.onboarding.mainPainPoint || "").toLowerCase();
      const wantsCalendar =
        calendarSystem.includes("apple")
        || calendarSystem.includes("google")
        || mainPainPoint.includes("schedule")
        || mainPainPoint.includes("sports");
      return wantsCalendar && context.futureCalendarCount < 3;
    },
  },
  {
    key: "power_up",
    minDay: 12,
    shouldSend: (context) => {
      const nutritionTracking = String(context.onboarding.nutritionTracking || "").toLowerCase();
      return nutritionTracking.length === 0
        || !nutritionTracking.includes("skip")
        || context.mealsGeneratedCount > 0;
    },
  },
];

function appUrl() {
  const fromEnv = (Deno.env.get("APP_URL") || "").trim();
  return fromEnv || "https://www.homeharmonyhq.com";
}

function isAuthorized(req: Request) {
  const schedulerSource = req.headers.get("x-scheduler-source");
  if (schedulerSource === "supabase-cron") return true;

  const authorization = req.headers.get("authorization") || req.headers.get("Authorization");
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  return Boolean(serviceRoleKey && bearerToken && bearerToken === serviceRoleKey);
}

async function countRows(
  promise: Promise<{ count: number | null; error: { message: string } | null }>,
  fallback = 0,
) {
  const { count, error } = await promise;
  if (error) throw new Error(error.message);
  return count ?? fallback;
}

async function sendLifecycleEmail(args: {
  userId: string;
  email: string;
  userName: string;
  templateKey: LifecycleTemplateKey;
}) {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
  const serviceRole = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!supabaseUrl || !serviceRole) throw new Error("Missing Supabase env vars.");

  const response = await fetch(`${supabaseUrl}/functions/v1/transactional-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({
      action: "send_lifecycle_email",
      userId: args.userId,
      email: args.email,
      userName: args.userName,
      templateKey: args.templateKey,
      appUrl: appUrl(),
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`transactional-email failed (${response.status}): ${details || "Unknown error"}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!isAuthorized(req)) return json({ error: "Unauthorized." }, 401);

    const supabaseUrl = (Deno.env.get("SUPABASE_URL") || "").trim();
    const serviceRole = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
    if (!supabaseUrl || !serviceRole) return json({ error: "Missing Supabase env vars." }, 500);

    const supabase = createClient(supabaseUrl, serviceRole);
    const nowUtc = DateTime.utc();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id,email,full_name,household_id,timezone,onboarding_completed_at,onboarding_settings")
      .not("onboarding_completed_at", "is", null)
      .gte("onboarding_completed_at", nowUtc.minus({ days: 21 }).toISO());

    if (profilesError) return json({ error: profilesError.message }, 500);

    const profileRows = ((profiles || []) as ProfileRow[]).filter((profile) => {
      const email = String(profile.email || "").trim();
      return email.length > 0;
    });

    let usersChecked = 0;
    let emailsSent = 0;
    const sent: Array<{ userId: string; email: string; templateKey: LifecycleTemplateKey }> = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const profile of profileRows) {
      usersChecked += 1;

      try {
        const timezone = String(profile.timezone || "America/Phoenix").trim() || "America/Phoenix";
        const localNow = nowUtc.setZone(timezone);
        if (!localNow.isValid || localNow.hour !== 9) {
          skipped.push(`${profile.id}:outside-send-window`);
          continue;
        }

        const onboardingCompletedAt = DateTime.fromISO(String(profile.onboarding_completed_at), { zone: timezone });
        if (!onboardingCompletedAt.isValid) {
          skipped.push(`${profile.id}:invalid-onboarding-date`);
          continue;
        }

        const daysSinceOnboarding = Math.floor(localNow.startOf("day").diff(onboardingCompletedAt.startOf("day"), "days").days);
        if (daysSinceOnboarding < 1) {
          skipped.push(`${profile.id}:too-new`);
          continue;
        }

        const onboardingSettings =
          profile.onboarding_settings && typeof profile.onboarding_settings === "object" && !Array.isArray(profile.onboarding_settings)
            ? profile.onboarding_settings
            : {};
        const onboarding =
          onboardingSettings.onboarding && typeof onboardingSettings.onboarding === "object" && !Array.isArray(onboardingSettings.onboarding)
            ? onboardingSettings.onboarding as Record<string, unknown>
            : {};

        const [
          recipesCount,
          householdMemberCount,
          futureCalendarCount,
          sentRowsResult,
          smsPrefResult,
          weeklyStatusResult,
        ] = await Promise.all([
          countRows(
            supabase.from("recipes").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
          ),
          profile.household_id
            ? countRows(
              supabase.from("household_members").select("id", { count: "exact", head: true }).eq("household_id", profile.household_id),
              1,
            )
            : Promise.resolve(1),
          countRows(
            supabase
              .from("calendar_events")
              .select("id", { count: "exact", head: true })
              .eq("owner_id", profile.id)
              .eq("is_deleted", false)
              .gte("starts_at", nowUtc.toISO()),
          ),
          supabase
            .from("onboarding_email_sends")
            .select("template_key")
            .eq("user_id", profile.id),
          supabase
            .from("sms_preferences")
            .select("enabled")
            .eq("user_id", profile.id)
            .maybeSingle(),
          supabase
            .from("weekly_planning_status")
            .select("meals_generated_at,groceries_ordered_at")
            .eq("user_id", profile.id),
        ]);

        if (sentRowsResult.error) throw new Error(sentRowsResult.error.message);
        if (smsPrefResult.error && !String(smsPrefResult.error.message || "").includes("0 rows")) {
          throw new Error(smsPrefResult.error.message);
        }
        if (weeklyStatusResult.error) throw new Error(weeklyStatusResult.error.message);

        const weeklyStatusRows = (weeklyStatusResult.data || []) as Array<{
          meals_generated_at?: string | null;
          groceries_ordered_at?: string | null;
        }>;
        const mealsGeneratedCount = weeklyStatusRows.filter((row) => Boolean(row.meals_generated_at)).length;
        const groceriesOrderedCount = weeklyStatusRows.filter((row) => Boolean(row.groceries_ordered_at)).length;

        const sentKeys = new Set(
          (sentRowsResult.data || [])
            .map((row) => String((row as { template_key?: string | null }).template_key || "").trim())
            .filter(Boolean),
        );

        const context: DripContext = {
          userId: profile.id,
          email: String(profile.email || "").trim().toLowerCase(),
          userName: String(profile.full_name || "").trim() || "there",
          timezone,
          daysSinceOnboarding,
          onboarding,
          recipesCount,
          mealsGeneratedCount,
          groceriesOrderedCount,
          householdMemberCount,
          smsEnabled: Boolean(smsPrefResult.data?.enabled),
          futureCalendarCount,
        };

        const nextTemplate = TEMPLATE_ORDER.find((rule) =>
          !sentKeys.has(rule.key)
          && context.daysSinceOnboarding >= rule.minDay
          && rule.shouldSend(context)
        );

        if (!nextTemplate) {
          skipped.push(`${profile.id}:no-template`);
          continue;
        }

        await sendLifecycleEmail({
          userId: context.userId,
          email: context.email,
          userName: context.userName,
          templateKey: nextTemplate.key,
        });

        const { error: insertError } = await supabase.from("onboarding_email_sends").insert({
          user_id: context.userId,
          template_key: nextTemplate.key,
          sent_at: nowUtc.toISO(),
          trigger_reason: `days:${context.daysSinceOnboarding}`,
          metadata: {
            timezone: context.timezone,
            recipesCount: context.recipesCount,
            mealsGeneratedCount: context.mealsGeneratedCount,
            groceriesOrderedCount: context.groceriesOrderedCount,
            householdMemberCount: context.householdMemberCount,
            smsEnabled: context.smsEnabled,
            futureCalendarCount: context.futureCalendarCount,
          },
        });
        if (insertError) throw new Error(insertError.message);

        emailsSent += 1;
        sent.push({ userId: context.userId, email: context.email, templateKey: nextTemplate.key });
      } catch (error) {
        errors.push(`${profile.id}:${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return json({
      success: true,
      usersChecked,
      emailsSent,
      sent,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("onboarding-email-drip error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown drip error." }, 500);
  }
});
