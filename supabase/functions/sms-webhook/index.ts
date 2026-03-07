import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime } from "npm:luxon@3.6.1";
import { verifyTwilioSignature } from "../_shared/twilio.ts";

function twiml(message: string, status = 200) {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`, {
    status,
    headers: { "Content-Type": "application/xml" },
  });
}

function normalizeKeyword(input: string): string {
  return input.trim().toLowerCase();
}

function isSignatureEnforced(): boolean {
  const raw = String(Deno.env.get("TWILIO_ENFORCE_SIGNATURE") || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

type AgendaEvent = {
  id: string;
  title: string;
  startsAtUtc: DateTime;
  startsAtLocal: DateTime;
  source: "meal" | "manual";
};

type RecipeRow = {
  id: string;
  name: string;
  is_anchored: boolean | null;
  default_day: string | null;
};

type PlannedMealRow = {
  id: string;
  day: string;
  recipe_id: string;
  is_locked: boolean | null;
};

const MEAL_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type MealDay = (typeof MEAL_DAYS)[number];

const DAY_NAME_BY_WEEKDAY: Record<number, string> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  7: "sunday",
};

const DAY_LABEL_BY_NAME: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function weekOfIso(localDate: DateTime): string {
  return localDate.minus({ days: localDate.weekday - 1 }).toISODate() || "";
}

function timeLabel(value: DateTime): string {
  return value.toFormat("h:mm a");
}

function parseTimeToHourMinute(value: string | null | undefined): { hour: number; minute: number } {
  const normalized = String(value || "18:00").slice(0, 5);
  const [hourRaw, minuteRaw] = normalized.split(":");
  const hour = Number.parseInt(hourRaw || "18", 10);
  const minute = Number.parseInt(minuteRaw || "0", 10);
  return {
    hour: Number.isFinite(hour) ? hour : 18,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function safeDateTime(value: string | null | undefined, zone: string): DateTime | null {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { zone });
  if (!parsed.isValid || !Number.isFinite(parsed.toMillis())) return null;
  return parsed;
}

function hasAnyKeyword(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word));
}

function formatAgendaList(label: string, date: DateTime, events: AgendaEvent[]): string {
  const heading = `${label} (${date.toFormat("EEE, LLL d")})`;
  if (!events.length) return `${heading}: no events found.`;
  const rows = events.slice(0, 8).map((event) => `- ${timeLabel(event.startsAtLocal)} ${event.title}`);
  const more = events.length > rows.length ? `\n+${events.length - rows.length} more` : "";
  return `${heading}:\n${rows.join("\n")}${more}`;
}

function formatWeekMeals(weekLabel: string, rows: Array<{ day: string; meal: string }>): string {
  if (!rows.length) return `${weekLabel}: no meals planned yet.`;
  const byDay = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.day.toLowerCase();
    const list = byDay.get(key) || [];
    list.push(row.meal);
    byDay.set(key, list);
  }
  const lines = DAY_ORDER
    .filter((day) => byDay.has(day))
    .map((day) => `${DAY_LABEL_BY_NAME[day]}: ${(byDay.get(day) || []).join(", ")}`);
  return `${weekLabel}:\n${lines.join("\n")}`;
}

function formatRangeAgenda(label: string, grouped: Array<{ date: DateTime; events: AgendaEvent[] }>): string {
  if (!grouped.length) return `${label}: no events found.`;
  const lines: string[] = [];
  for (const item of grouped) {
    if (!item.events.length) continue;
    const preview = item.events.slice(0, 2).map((event) => `${timeLabel(event.startsAtLocal)} ${event.title}`).join(", ");
    const suffix = item.events.length > 2 ? ` +${item.events.length - 2}` : "";
    lines.push(`${item.date.toFormat("EEE LLL d")}: ${preview}${suffix}`);
  }
  if (!lines.length) return `${label}: no events found.`;
  return `${label}:\n${lines.slice(0, 7).join("\n")}`;
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function isMealDay(value: string | null | undefined): value is MealDay {
  if (!value) return false;
  return MEAL_DAYS.includes(String(value).toLowerCase() as MealDay);
}

function chooseRecipeIdByKeywords(
  recipes: RecipeRow[],
  keywords: string[],
  usedRecipeIds: Set<string>,
): string | null {
  for (const recipe of recipes) {
    if (usedRecipeIds.has(recipe.id)) continue;
    const haystack = normalizeToken(recipe.name);
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      usedRecipeIds.add(recipe.id);
      return recipe.id;
    }
  }
  return null;
}

function buildDayLocksFromOnboarding(
  recipes: RecipeRow[],
  onboardingSettings: Record<string, unknown> | null,
): Partial<Record<MealDay, string>> {
  if (!onboardingSettings) return {};
  const onboardingRaw = onboardingSettings.onboarding;
  if (!onboardingRaw || typeof onboardingRaw !== "object" || Array.isArray(onboardingRaw)) return {};

  const weeklyStaplesRaw = (onboardingRaw as Record<string, unknown>).weeklyStaples;
  if (!Array.isArray(weeklyStaplesRaw)) return {};

  const weeklyStaples = weeklyStaplesRaw
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  const locks: Partial<Record<MealDay, string>> = {};
  const usedRecipeIds = new Set<string>();

  for (const staple of weeklyStaples) {
    const normalized = normalizeToken(staple);
    if (normalized === "taco tuesday" && !locks.tuesday) {
      const recipeId = chooseRecipeIdByKeywords(recipes, ["taco", "fajita"], usedRecipeIds);
      if (recipeId) locks.tuesday = recipeId;
      continue;
    }
    if (normalized === "pizza friday" && !locks.friday) {
      const recipeId = chooseRecipeIdByKeywords(recipes, ["pizza", "flatbread"], usedRecipeIds);
      if (recipeId) locks.friday = recipeId;
    }
  }

  return locks;
}

function randomRecipe(
  recipes: RecipeRow[],
  usedRecipeIds: Set<string>,
  excludeRecipeId: string | null,
): RecipeRow | null {
  const uniquePool = recipes.filter((recipe) => !usedRecipeIds.has(recipe.id) && recipe.id !== excludeRecipeId);
  if (uniquePool.length > 0) {
    return uniquePool[Math.floor(Math.random() * uniquePool.length)] || null;
  }
  const fallbackPool = recipes.filter((recipe) => recipe.id !== excludeRecipeId);
  if (fallbackPool.length > 0) {
    return fallbackPool[Math.floor(Math.random() * fallbackPool.length)] || null;
  }
  return recipes[0] || null;
}

async function generateMealsForWeekBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  weekOf: string,
): Promise<{ inserted: number; lockedKept: number; total: number }> {
  const { data: recipesData, error: recipeError } = await supabase
    .from("recipes")
    .select("id,name,is_anchored,default_day")
    .eq("owner_id", userId);
  if (recipeError) throw recipeError;

  const recipes = ((recipesData || []) as RecipeRow[]).filter((recipe) => !!recipe.id && !!recipe.name);
  if (!recipes.length) {
    throw new Error("Your recipe library is empty. Add recipes first, then reply RUN MEALS.");
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("onboarding_settings")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;

  const onboardingSettings =
    profileData?.onboarding_settings && typeof profileData.onboarding_settings === "object" && !Array.isArray(profileData.onboarding_settings)
      ? (profileData.onboarding_settings as Record<string, unknown>)
      : null;
  const dayLocks = buildDayLocksFromOnboarding(recipes, onboardingSettings);

  const { data: existingData, error: existingError } = await supabase
    .from("planned_meals")
    .select("id,day,recipe_id,is_locked")
    .eq("owner_id", userId)
    .eq("week_of", weekOf);
  if (existingError) throw existingError;

  const existingMeals = (existingData || []) as PlannedMealRow[];
  const lockedMeals = existingMeals.filter((meal) => !!meal.is_locked);
  const deleteIds = existingMeals.filter((meal) => !meal.is_locked).map((meal) => meal.id);
  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("planned_meals")
      .delete()
      .in("id", deleteIds);
    if (deleteError) throw deleteError;
  }

  const usedRecipeIds = new Set<string>(lockedMeals.map((meal) => meal.recipe_id));
  const keptDays = new Set<MealDay>(
    lockedMeals
      .map((meal) => String(meal.day || "").toLowerCase())
      .filter((day): day is MealDay => isMealDay(day)),
  );

  const previousRecipeByDay = new Map<MealDay, string>(
    existingMeals
      .map((meal) => [String(meal.day || "").toLowerCase(), meal.recipe_id] as const)
      .filter(([day]) => isMealDay(day))
      .map(([day, recipeId]) => [day as MealDay, recipeId]),
  );

  const rowsToInsert: Array<{ owner_id: string; recipe_id: string; day: MealDay; week_of: string; is_skipped: boolean; is_locked: boolean }> = [];
  const daysNeeding = MEAL_DAYS.filter((day) => !keptDays.has(day));

  for (const day of [...daysNeeding]) {
    const forcedRecipeId = dayLocks[day];
    if (!forcedRecipeId) continue;
    rowsToInsert.push({
      owner_id: userId,
      recipe_id: forcedRecipeId,
      day,
      week_of: weekOf,
      is_skipped: false,
      is_locked: false,
    });
    usedRecipeIds.add(forcedRecipeId);
    daysNeeding.splice(daysNeeding.indexOf(day), 1);
  }

  for (const recipe of recipes) {
    if (!recipe.is_anchored || !isMealDay(recipe.default_day)) continue;
    const day = recipe.default_day;
    if (!daysNeeding.includes(day) || usedRecipeIds.has(recipe.id)) continue;
    rowsToInsert.push({
      owner_id: userId,
      recipe_id: recipe.id,
      day,
      week_of: weekOf,
      is_skipped: false,
      is_locked: false,
    });
    usedRecipeIds.add(recipe.id);
    daysNeeding.splice(daysNeeding.indexOf(day), 1);
  }

  for (const day of daysNeeding) {
    const previousRecipeId = previousRecipeByDay.get(day) || null;
    const picked = randomRecipe(recipes, usedRecipeIds, previousRecipeId);
    if (!picked) continue;
    rowsToInsert.push({
      owner_id: userId,
      recipe_id: picked.id,
      day,
      week_of: weekOf,
      is_skipped: false,
      is_locked: false,
    });
    usedRecipeIds.add(picked.id);
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("planned_meals").insert(rowsToInsert);
    if (insertError) throw insertError;
  }

  const nowIso = new Date().toISOString();
  const { error: statusError } = await supabase
    .from("weekly_planning_status")
    .upsert(
      {
        user_id: userId,
        week_of: weekOf,
        meals_generated_at: nowIso,
      },
      { onConflict: "user_id,week_of" },
    );
  if (statusError) throw statusError;

  return {
    inserted: rowsToInsert.length,
    lockedKept: lockedMeals.length,
    total: rowsToInsert.length + lockedMeals.length,
  };
}

async function findRecentWeeklyNudgeWeek(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("sms_notification_log")
    .select("payload,created_at")
    .eq("user_id", userId)
    .eq("notification_type", "weekly_planning_nudge")
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data || typeof data.payload !== "object" || !data.payload) return null;
  const weekOf = (data.payload as Record<string, unknown>).weekOf;
  return typeof weekOf === "string" && weekOf ? weekOf : null;
}

async function fetchMealsForWeek(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  weekOf: string,
): Promise<Array<{ day: string; meal: string }>> {
  const { data } = await supabase
    .from("planned_meals")
    .select("day, recipes(name)")
    .eq("owner_id", userId)
    .eq("week_of", weekOf)
    .eq("is_skipped", false);

  const rows = (data || []).map((row) => {
    const mealName =
      typeof row.recipes === "object" && row.recipes && "name" in row.recipes
        ? String((row.recipes as { name?: string }).name || "Meal")
        : "Meal";
    return {
      day: String(row.day || "").toLowerCase(),
      meal: mealName,
    };
  });

  return rows.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));
}

async function fetchAgendaForDate(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  localDate: DateTime,
  timezone: string,
  includeModules: string[],
  preferredDinnerTime: string,
): Promise<AgendaEvent[]> {
  const events: AgendaEvent[] = [];
  const dateIso = localDate.toISODate();
  if (!dateIso) return events;

  const includeMeals = includeModules.includes("meals") || includeModules.length === 0;
  const includeManual = includeModules.includes("manual") || includeModules.length === 0;

  if (includeMeals) {
    const weekOf = weekOfIso(localDate);
    const day = DAY_NAME_BY_WEEKDAY[localDate.weekday];
    const { data } = await supabase
      .from("planned_meals")
      .select("id, recipes(name)")
      .eq("owner_id", userId)
      .eq("week_of", weekOf)
      .eq("day", day)
      .eq("is_skipped", false);

    const { hour, minute } = parseTimeToHourMinute(preferredDinnerTime);
    for (const row of data || []) {
      const mealName =
        typeof row.recipes === "object" && row.recipes && "name" in row.recipes
          ? String((row.recipes as { name?: string }).name || "Dinner")
          : "Dinner";
      const startsAtLocal = DateTime.fromISO(`${dateIso}T00:00:00`, { zone: timezone }).set({ hour, minute });
      events.push({
        id: `meal-${row.id}`,
        title: mealName,
        startsAtLocal,
        startsAtUtc: startsAtLocal.toUTC(),
        source: "meal",
      });
    }
  }

  if (includeManual) {
    const dayStartUtc = localDate.startOf("day").toUTC().toISO();
    const dayEndUtc = localDate.plus({ days: 1 }).startOf("day").toUTC().toISO();
    const { data } = await supabase
      .from("calendar_events")
      .select("id,title,starts_at,module,source")
      .eq("owner_id", userId)
      .eq("is_deleted", false)
      .gte("starts_at", dayStartUtc)
      .lt("starts_at", dayEndUtc);

    for (const row of data || []) {
      const startsAtUtc = safeDateTime(String(row.starts_at || ""), "utc");
      if (!startsAtUtc) continue;
      const moduleName = String(row.module || "manual").toLowerCase();
      if (moduleName !== "manual" && moduleName !== "meals") continue;
      events.push({
        id: `manual-${row.id}`,
        title: String(row.title || "Event"),
        startsAtUtc,
        startsAtLocal: startsAtUtc.setZone(timezone),
        source: "manual",
      });
    }
  }

  return events.sort((a, b) => a.startsAtUtc.toMillis() - b.startsAtUtc.toMillis());
}

async function buildTomorrowScheduleReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  includeModules: string[],
  preferredDinnerTime: string,
): Promise<string> {
  const tomorrow = DateTime.now().setZone(timezone).plus({ days: 1 }).startOf("day");
  const events = await fetchAgendaForDate(supabase, userId, tomorrow, timezone, includeModules, preferredDinnerTime);
  return formatAgendaList("Tomorrow", tomorrow, events);
}

async function buildTodayScheduleReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  includeModules: string[],
  preferredDinnerTime: string,
): Promise<string> {
  const today = DateTime.now().setZone(timezone).startOf("day");
  const events = await fetchAgendaForDate(supabase, userId, today, timezone, includeModules, preferredDinnerTime);
  return formatAgendaList("Today", today, events);
}

async function buildNextWeekScheduleReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  includeModules: string[],
  preferredDinnerTime: string,
): Promise<string> {
  const tomorrow = DateTime.now().setZone(timezone).plus({ days: 1 }).startOf("day");
  const grouped: Array<{ date: DateTime; events: AgendaEvent[] }> = [];
  for (let i = 0; i < 7; i += 1) {
    const date = tomorrow.plus({ days: i });
    const events = await fetchAgendaForDate(supabase, userId, date, timezone, includeModules, preferredDinnerTime);
    grouped.push({ date, events });
  }
  return formatRangeAgenda("Next 7 days", grouped);
}

async function buildMealsReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  nextWeek: boolean,
): Promise<string> {
  const reference = DateTime.now().setZone(timezone).startOf("day").plus({ days: nextWeek ? 7 : 0 });
  const weekOf = weekOfIso(reference);
  const label = nextWeek ? "Meals next week" : "Meals this week";
  const meals = await fetchMealsForWeek(supabase, userId, weekOf);
  return formatWeekMeals(label, meals);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return new Response("Missing env vars", { status: 500 });

    const rawBody = await req.text();
    const signature = req.headers.get("x-twilio-signature");
    const signatureOk = await verifyTwilioSignature(req.url, rawBody, signature);
    if (!signatureOk && isSignatureEnforced()) {
      return new Response("Invalid Twilio signature", { status: 403 });
    }
    if (!signatureOk) {
      console.warn("sms-webhook signature check failed; continuing because TWILIO_ENFORCE_SIGNATURE is false");
    }

    const params = new URLSearchParams(rawBody);
    const from = params.get("From")?.trim() || "";
    const body = normalizeKeyword(params.get("Body") || "");
    const messageStatus = params.get("MessageStatus") || "";

    const supabase = createClient(supabaseUrl, serviceRole);

    // Status callback path (if configured).
    if (messageStatus) {
      const messageSid = params.get("MessageSid");
      if (messageSid) {
        await supabase
          .from("sms_notification_log")
          .update({
            payload: {
              twilio_status: messageStatus,
              error_code: params.get("ErrorCode"),
              error_message: params.get("ErrorMessage"),
            },
          })
          .eq("provider_message_sid", messageSid);
      }
      return new Response("ok", { status: 200 });
    }

    if (!from) return twiml("We could not identify your number.");

    const { data: pref } = await supabase
      .from("sms_preferences")
      .select("user_id,enabled,timezone,preferred_dinner_time,include_modules")
      .eq("phone_e164", from)
      .maybeSingle();

    if (!pref) {
      return twiml("This number is not linked to a Home Harmony account yet.");
    }
    if (!pref.enabled) {
      return twiml("SMS is paused for this account. Reply START to re-enable messages.");
    }

    const stopWords = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit"]);
    const startWords = new Set(["start", "unstop", "subscribe"]);
    const helpWords = new Set(["help", "info"]);

    if (stopWords.has(body)) {
      await supabase
        .from("sms_preferences")
        .update({
          enabled: false,
          last_opt_out_at: new Date().toISOString(),
        })
        .eq("user_id", pref.user_id);
      return twiml("Home Harmony SMS is now paused. Reply START to re-enable messages.");
    }

    if (startWords.has(body)) {
      await supabase
        .from("sms_preferences")
        .update({
          enabled: true,
          last_opt_in_at: new Date().toISOString(),
        })
        .eq("user_id", pref.user_id);
      return twiml("Home Harmony SMS is active again. Reply HELP for available commands.");
    }

    if (helpWords.has(body)) {
      return twiml(
        "Home Harmony commands:\n- What do I have tomorrow?\n- What do I have next week?\n- What meals do we have this week?\n- What meals next week?\n- Run meals for next week\nReply STOP to pause or START to resume.",
      );
    }

    const timezone = String(pref.timezone || "America/New_York");
    const includeModules = Array.isArray(pref.include_modules)
      ? pref.include_modules.map((value: unknown) => String(value).toLowerCase())
      : ["meals", "manual"];
    const preferredDinnerTime = String(pref.preferred_dinner_time || "18:00").slice(0, 5);

    const wantsTomorrow = hasAnyKeyword(body, ["tomorrow"]);
    const wantsToday = hasAnyKeyword(body, ["today"]);
    const wantsNextWeek = hasAnyKeyword(body, ["next week", "coming week"]);
    const wantsThisWeek = hasAnyKeyword(body, ["this week", "this weeks"]);
    const asksMeals = hasAnyKeyword(body, ["meal", "meals", "dinner", "menu", "breakfast", "lunch"]);
    const asksSchedule = hasAnyKeyword(body, ["what do i have", "schedule", "calendar", "event", "events", "tomorrow", "next week", "this week"]);
    const asksChores = hasAnyKeyword(body, ["chore", "chores", "kid", "kids"]);
    const asksAutoGenerateMeals =
      hasAnyKeyword(body, ["run meals", "auto generate", "autogenerate", "generate meals", "plan meals"]) ||
      body === "yes" ||
      body === "y";

    if (asksAutoGenerateMeals) {
      const localNow = DateTime.now().setZone(timezone).startOf("day");
      const recentNudgeWeek = await findRecentWeeklyNudgeWeek(supabase, pref.user_id);
      const fallbackWeek = weekOfIso(localNow.plus({ weeks: 1 }));
      const currentWeek = weekOfIso(localNow);
      const targetWeekOf =
        wantsThisWeek && !wantsNextWeek
          ? currentWeek
          : recentNudgeWeek || fallbackWeek;

      if (!targetWeekOf) {
        return twiml("I couldn't determine which week to plan. Reply RUN MEALS NEXT WEEK.");
      }

      try {
        const result = await generateMealsForWeekBySms(supabase, pref.user_id, targetWeekOf);
        return twiml(
          `Done. I generated ${result.inserted} meals${result.lockedKept ? ` and kept ${result.lockedKept} locked` : ""} for week of ${targetWeekOf}. Your grocery list is ready in Home Harmony.`,
        );
      } catch (generationError) {
        const message = generationError instanceof Error ? generationError.message : "Could not generate meals.";
        return twiml(`Could not run meal generation: ${message}`);
      }
    }

    if (asksChores && !asksMeals && !asksSchedule) {
      return twiml(
        "I can text schedule and meal updates right now. Kids chore completion by person is not cloud-synced yet, so I can't verify that by SMS yet.",
      );
    }

    if (asksMeals && wantsNextWeek) {
      const reply = await buildMealsReply(supabase, pref.user_id, timezone, true);
      return twiml(reply);
    }

    if (asksMeals && (wantsThisWeek || body.includes("week"))) {
      const reply = await buildMealsReply(supabase, pref.user_id, timezone, false);
      return twiml(reply);
    }

    if (wantsToday || (asksSchedule && body.includes("today"))) {
      const reply = await buildTodayScheduleReply(
        supabase,
        pref.user_id,
        timezone,
        includeModules,
        preferredDinnerTime,
      );
      return twiml(reply);
    }

    if (wantsTomorrow || (asksSchedule && body.includes("tomorrow"))) {
      const reply = await buildTomorrowScheduleReply(
        supabase,
        pref.user_id,
        timezone,
        includeModules,
        preferredDinnerTime,
      );
      return twiml(reply);
    }

    if (wantsNextWeek || (asksSchedule && body.includes("week"))) {
      const reply = await buildNextWeekScheduleReply(
        supabase,
        pref.user_id,
        timezone,
        includeModules,
        preferredDinnerTime,
      );
      return twiml(reply);
    }

    return twiml("I didn't catch that. Reply HELP for examples.");
  } catch (error) {
    console.error("sms-webhook error:", error);
    return new Response("Internal server error", { status: 500 });
  }
});
