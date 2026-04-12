import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime } from "npm:luxon@3.6.1";
import { normalizePhone, verifyTwilioSignature } from "../_shared/twilio.ts";
import { estimateInboundTextCostUsd, estimateOpenAiCostUsd, logUsageCostEvent } from "../_shared/costMeter.ts";

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

function describeUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = typeof record.message === "string" ? record.message.trim() : "";
    const details = typeof record.details === "string" ? record.details.trim() : "";
    const hint = typeof record.hint === "string" ? record.hint.trim() : "";
    const pieces = [message, details, hint].filter(Boolean);
    if (pieces.length > 0) return pieces.join(" | ");
    try {
      return JSON.stringify(record);
    } catch {
      return "unknown error";
    }
  }
  return typeof error === "string" && error.trim() ? error.trim() : "unknown error";
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

type MacroProfile = {
  id: string;
  name: string;
  memberType?: string;
  aliases?: string[];
};

type MacroMealLog = {
  id: string;
  recipeId?: string;
  recipeName: string;
  date: string;
  person: string;
  servings: number;
  macros: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
  };
  isQuickAdd: boolean;
  createdAt: string;
};

type MacroDayTracker = {
  waterOz: number;
  alcoholDrinks: number;
};

type MacroActivityState = {
  mealLogs: MacroMealLog[];
  trackers: Record<string, Record<string, MacroDayTracker>>;
};

type GroceryManualItem = {
  id: string;
  name: string;
  quantity: string;
  category: "produce" | "meat" | "dairy" | "pantry" | "other";
  createdAt: string;
};

type GroceryWeekState = {
  checkedKeys: string[];
  manualItems: GroceryManualItem[];
  orderedAt?: string | null;
};

type StoredTask = {
  id: string;
  title: string;
  notes?: string;
  type: "do" | "maintain" | "notice";
  status: "not_started" | "in_progress" | "done";
  frequency: "daily" | "weekly" | "monthly" | "every_3_months" | "every_6_months" | "yearly" | "once";
  assignedToId?: string;
  assignedToName?: string;
  dueDate?: string;
  day?: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderLeadMinutes?: number;
  createdAt: string;
};

type StoredGroceryListState = {
  recurringItems: GroceryManualItem[];
  weekStates: Record<string, GroceryWeekState>;
};

type CalendarAddIntent = {
  title: string;
  layer: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  locationText?: string | null;
  description?: string | null;
};

type CalendarFollowUpIntent = {
  layer?: string;
  reminderLeadMinutes?: number;
  makeAllDay?: boolean;
  moveDateText?: string;
  moveTimeText?: string;
  deleteEvent?: boolean;
};

type SmsAssistantContext = {
  lastCalendarEvent?: {
    eventId: string;
    title: string;
    updatedAt: string;
  } | null;
  lastMealLog?: {
    logId: string;
    title: string;
    personId: string;
    personName: string;
    servings: number;
    updatedAt: string;
  } | null;
};

type GroceryAddIntent = {
  name: string;
  quantity: string;
  weekly: boolean;
};

type GroceryRemoveIntent = {
  name: string;
};

type WaterLogIntent = {
  personName: string;
  ounces: number;
};

type TaskAddIntent = {
  title: string;
  personName?: string;
  dueDate?: string;
  reminderTime?: string;
};

type TaskCompleteIntent = {
  title: string;
};

type MealLogIntent = {
  personName: string;
  recipeName: string;
  servings: number;
};

type MealFollowUpIntent = {
  servings?: number;
  deleteLog?: boolean;
  genericDelete?: boolean;
};

type RecipeLookupRow = {
  id: string;
  name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
};

type InboundSmsPreferenceRow = {
  user_id: string;
  enabled: boolean;
  timezone: string | null;
  preferred_dinner_time: string | null;
  include_modules: unknown;
  module_recipients: Record<string, unknown> | null;
  phone_e164: string | null;
  updated_at?: string | null;
};

type InboundProfileRow = {
  id: string;
  phone: string | null;
  household_id: string | null;
  onboarding_completed_at: string | null;
  updated_at?: string | null;
};

type InboundSubscriptionRow = {
  user_id: string;
  status: string;
  updated_at?: string | null;
};

type SmsNotificationLogRow = {
  user_id: string;
  created_at: string;
  payload: Record<string, unknown> | null;
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

function normalizePhoneList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item) => typeof item === "string")
      .map((item) => normalizePhone(String(item || "")))
      .filter((item) => item.length > 0),
  )];
}

function recipientListForModules(
  includeModules: string[],
  moduleRecipients: Record<string, string[]>,
  fallbackPhone: string | null,
): string[] {
  const recipients = new Set<string>();
  for (const moduleName of includeModules) {
    for (const phone of moduleRecipients[moduleName] || []) {
      recipients.add(phone);
    }
  }
  if (fallbackPhone) recipients.add(fallbackPhone);
  return Array.from(recipients);
}

function sortPreferenceRowsByUpdatedAt(rows: InboundSmsPreferenceRow[]): InboundSmsPreferenceRow[] {
  return [...rows].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

function sortRowsByUpdatedAt<T extends { updated_at?: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
}

async function findRecentSmsOwnerForRecipient(
  supabase: ReturnType<typeof createClient>,
  userIds: string[],
  recipientPhone: string,
): Promise<string | null> {
  if (!userIds.length) return null;

  const { data, error } = await supabase
    .from("sms_notification_log")
    .select("user_id,created_at,payload")
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Failed loading sms notification log for inbound recipient matching:", error.message || error);
    return null;
  }

  for (const row of ((data || []) as SmsNotificationLogRow[])) {
    const payloadTo = normalizePhone(String((row.payload || {}).to || ""));
    if (payloadTo && payloadTo === recipientPhone) {
      return row.user_id;
    }
  }

  return null;
}

function subscriptionScore(status: string | null | undefined): number {
  switch (String(status || "").toLowerCase()) {
    case "active":
      return 30;
    case "trialing":
      return 28;
    case "past_due":
      return 8;
    case "canceled":
    case "cancelled":
      return 4;
    default:
      return 0;
  }
}

async function findPreferredInboundSmsOwner(
  supabase: ReturnType<typeof createClient>,
  rows: InboundSmsPreferenceRow[],
  normalizedFrom: string,
): Promise<string | null> {
  const uniqueRows = rows.filter((row, index, all) => all.findIndex((item) => item.user_id === row.user_id) === index);
  const userIds = uniqueRows.map((row) => row.user_id);
  if (!userIds.length) return null;

  const recentOwner = await findRecentSmsOwnerForRecipient(supabase, userIds, normalizedFrom);

  const [{ data: profilesData, error: profileError }, { data: subscriptionsData, error: subscriptionError }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,phone,household_id,onboarding_completed_at,updated_at")
      .in("id", userIds),
    supabase
      .from("subscriptions")
      .select("user_id,status,updated_at")
      .in("user_id", userIds),
  ]);

  if (profileError) {
    console.error("Failed loading profiles for inbound recipient matching:", profileError.message || profileError);
  }
  if (subscriptionError) {
    console.error("Failed loading subscriptions for inbound recipient matching:", subscriptionError.message || subscriptionError);
  }

  const profilesByUser = new Map<string, InboundProfileRow>();
  for (const profile of sortRowsByUpdatedAt((profilesData || []) as InboundProfileRow[])) {
    if (!profilesByUser.has(profile.id)) profilesByUser.set(profile.id, profile);
  }

  const subscriptionScoreByUser = new Map<string, number>();
  for (const subscription of ((subscriptionsData || []) as InboundSubscriptionRow[])) {
    const nextScore = subscriptionScore(subscription.status);
    const currentScore = subscriptionScoreByUser.get(subscription.user_id) || 0;
    if (nextScore > currentScore) {
      subscriptionScoreByUser.set(subscription.user_id, nextScore);
    }
  }

  const ranked = uniqueRows
    .map((row) => {
      const profile = profilesByUser.get(row.user_id);
      const profilePhone = normalizePhone(String(profile?.phone || ""));
      const rowPhone = normalizePhone(String(row.phone_e164 || ""));
      let score = 0;

      if (profilePhone && profilePhone === normalizedFrom) score += 50;
      if (rowPhone && rowPhone === normalizedFrom) score += 18;
      if (profile?.onboarding_completed_at) score += 16;
      if (profile?.household_id) score += 14;
      score += subscriptionScoreByUser.get(row.user_id) || 0;
      if (recentOwner && recentOwner === row.user_id) score += 12;

      return {
        row,
        score,
        profileUpdatedAt: String(profile?.updated_at || ""),
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.profileUpdatedAt !== a.profileUpdatedAt) return b.profileUpdatedAt.localeCompare(a.profileUpdatedAt);
      return String(b.row.updated_at || "").localeCompare(String(a.row.updated_at || ""));
    });

  return ranked[0]?.row.user_id || recentOwner || null;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function extensionForImageContentType(contentType: string | null): string {
  const normalized = String(contentType || "").toLowerCase().trim();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "jpeg";
}

async function fetchTwilioImageAsDataUrl(mediaUrl: string, contentType: string | null): Promise<string> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  if (!accountSid || !authToken) {
    throw new Error("Twilio image access is not configured.");
  }

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Could not download screenshot from Twilio (${response.status}).`);
  }

  const mediaType = (contentType || response.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:${mediaType};base64,${bytesToBase64(bytes)}`;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

async function parseCalendarScreenshotIntent(
  imageDataUrl: string,
  fileName: string,
  timezone: string,
  userId: string | null,
): Promise<{ intent: CalendarAddIntent | null; clarification: string | null }> {
  const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAiApiKey) {
    throw new Error("AI service not configured. Add OPENAI_API_KEY in Supabase Edge Function secrets.");
  }

  const openAiModel = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  const systemPrompt = `You extract a single calendar event from a screenshot.
Only use details that are visible in the image.
If the screenshot does not clearly show one event to add, return a clarification message.

Return JSON only in this exact schema:
{
  "title": "string",
  "date": "YYYY-MM-DD",
  "startTime": "h:mm AM/PM or empty string",
  "endTime": "h:mm AM/PM or empty string",
  "allDay": boolean,
  "locationText": "string or empty string",
  "description": "string or empty string",
  "layer": "Family",
  "clarification": "string or empty string"
}

Rules:
- Default layer to "Family".
- If a time is visible, allDay must be false.
- If no time is visible but the event is clearly all-day, set allDay true.
- If the screenshot is ambiguous, contains multiple candidate events, or does not show enough information to add an event confidently, leave fields blank and set clarification.
- Do not invent missing dates or times.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.1,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: `Extract the calendar event shown in this screenshot file: ${fileName}.` },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || `AI screenshot parsing failed (${response.status}).`);
  }

  const aiResponse = await response.json().catch(() => null) as
    | {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        prompt_tokens_details?: { cached_tokens?: number };
      };
    }
    | null;
  await logUsageCostEvent({
    userId,
    category: "ai",
    provider: "openai",
    meter: "sms_calendar_screenshot_parse",
    estimatedCostUsd: estimateOpenAiCostUsd(openAiModel, aiResponse?.usage),
    quantity: 1,
    metadata: {
      model: openAiModel,
      promptTokens: aiResponse?.usage?.prompt_tokens ?? 0,
      completionTokens: aiResponse?.usage?.completion_tokens ?? 0,
      cachedPromptTokens: aiResponse?.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    },
  });
  const content = aiResponse?.choices?.[0]?.message?.content || "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Could not parse calendar screenshot output.");
  }

  const clarification = String(parsed.clarification || "").trim();
  if (clarification) {
    return { intent: null, clarification };
  }

  const title = normalizeCalendarTitle(String(parsed.title || ""));
  const dateText = String(parsed.date || "").trim();
  const startTimeText = String(parsed.startTime || "").trim();
  const endTimeText = String(parsed.endTime || "").trim();
  const allDay = parseBoolean(parsed.allDay);
  const layer = normalizeCalendarLayerName(String(parsed.layer || "Family"));
  const locationText = String(parsed.locationText || "").trim() || null;
  const description = String(parsed.description || "").trim() || null;

  if (!title || !dateText) {
    return {
      intent: null,
      clarification: "I couldn't clearly read the event title and date from that screenshot. Try a tighter screenshot of the event details.",
    };
  }

  let date = DateTime.fromISO(dateText, { zone: timezone }).startOf("day");
  if (!date.isValid) {
    return {
      intent: null,
      clarification: "I couldn't clearly read the date from that screenshot. Try a screenshot that includes the full event date.",
    };
  }

  const today = DateTime.now().setZone(timezone).startOf("day");
  if (date < today.minus({ days: 30 })) {
    for (let i = 0; i < 4; i += 1) {
      const nextYear = date.plus({ years: 1 });
      if (nextYear > date) {
        date = nextYear;
      }
      if (date >= today.minus({ days: 7 })) {
        break;
      }
    }
  }

  if (allDay || !startTimeText) {
    return {
      intent: {
        title,
        layer,
        startsAt: date.set({ hour: 12, minute: 0, second: 0, millisecond: 0 }).toUTC().toISO() || "",
        endsAt: null,
        allDay: true,
        locationText,
        description,
      },
      clarification: null,
    };
  }

  const startsAt = parseTimeForZone(startTimeText, date, timezone);
  if (!startsAt) {
    return {
      intent: null,
      clarification: "I found the event, but I couldn't confidently read the start time. Try a screenshot that shows the time more clearly.",
    };
  }

  const endsAt = endTimeText ? parseTimeForZone(endTimeText, date, timezone) : startsAt.plus({ hours: 1 });

  return {
    intent: {
      title,
      layer,
      startsAt: startsAt.toUTC().toISO() || "",
      endsAt: (endsAt || startsAt.plus({ hours: 1 })).toUTC().toISO() || null,
      allDay: false,
      locationText,
      description,
    },
    clarification: null,
  };
}

function normalizeRecipientMap(input: unknown): Record<string, string[]> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.entries(input as Record<string, unknown>).reduce<Record<string, string[]>>((map, [moduleName, recipients]) => {
    map[moduleName] = normalizePhoneList(recipients);
    return map;
  }, {});
}

function normalizeEntityName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function titleCaseWords(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function normalizeCalendarTitle(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const letters = trimmed.replace(/[^A-Za-z]/g, "");
  const uppercaseLetters = letters.replace(/[^A-Z]/g, "").length;
  const lowercaseLetters = letters.replace(/[^a-z]/g, "").length;
  const shouldTitleCase = uppercaseLetters > 0 && (lowercaseLetters === 0 || uppercaseLetters >= lowercaseLetters * 2);
  return shouldTitleCase ? titleCaseWords(trimmed.toLowerCase()) : trimmed;
}

function trimTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?,;:]+$/g, "").trim();
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

function getDocumentValue(document: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = document;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function setDocumentValue(document: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  if (path.length === 0) {
    return value && typeof value === "object" && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  }

  const next = { ...document };
  let cursor = next as Record<string, unknown>;

  path.forEach((segment, index) => {
    const isLeaf = index === path.length - 1;
    if (isLeaf) {
      cursor[segment] = value;
      return;
    }
    const existing = cursor[segment];
    const nested =
      existing && typeof existing === "object" && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    cursor[segment] = nested;
    cursor = nested;
  });

  return next;
}

function normalizeSmsAssistantContext(input: unknown): SmsAssistantContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const rawLast = record.lastCalendarEvent;
  const rawMeal = record.lastMealLog;
  const context: SmsAssistantContext = {};

  if (rawLast && typeof rawLast === "object" && !Array.isArray(rawLast)) {
    const last = rawLast as Record<string, unknown>;
    const eventId = typeof last.eventId === "string" ? last.eventId.trim() : "";
    const title = typeof last.title === "string" ? last.title.trim() : "";
    const updatedAt = typeof last.updatedAt === "string" ? last.updatedAt.trim() : "";
    if (eventId && updatedAt) {
      context.lastCalendarEvent = {
        eventId,
        title: title || "Event",
        updatedAt,
      };
    }
  }

  if (rawMeal && typeof rawMeal === "object" && !Array.isArray(rawMeal)) {
    const lastMeal = rawMeal as Record<string, unknown>;
    const logId = typeof lastMeal.logId === "string" ? lastMeal.logId.trim() : "";
    const title = typeof lastMeal.title === "string" ? lastMeal.title.trim() : "";
    const personId = typeof lastMeal.personId === "string" ? lastMeal.personId.trim() : "";
    const personName = typeof lastMeal.personName === "string" ? lastMeal.personName.trim() : "";
    const servings = Number(lastMeal.servings);
    const updatedAt = typeof lastMeal.updatedAt === "string" ? lastMeal.updatedAt.trim() : "";
    if (logId && updatedAt) {
      context.lastMealLog = {
        logId,
        title: title || "Meal",
        personId: personId || "me",
        personName: personName || "your dashboard",
        servings: Number.isFinite(servings) && servings > 0 ? servings : 1,
        updatedAt,
      };
    }
  }

  return context;
}

async function loadProfileSettingsDocument(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_settings")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  const raw = data?.onboarding_settings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  return { ...(raw as Record<string, unknown>) };
}

async function loadProfileSettingsContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ document: Record<string, unknown>; fullName: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_settings,full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  const raw = data?.onboarding_settings;
  const document =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  const fullName = typeof data?.full_name === "string" && data.full_name.trim() ? data.full_name.trim() : null;
  return { document, fullName };
}

async function saveProfileSettingsDocument(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  document: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_settings: document })
    .eq("id", userId);
  if (error) throw error;
}

async function loadSmsAssistantContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ document: Record<string, unknown>; context: SmsAssistantContext }> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const context = normalizeSmsAssistantContext(getDocumentValue(document, ["appPreferences", "smsAssistant"]));
  return { document, context };
}

async function saveSmsAssistantContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  document: Record<string, unknown>,
  context: SmsAssistantContext,
): Promise<void> {
  const nextDocument = setDocumentValue(document, ["appPreferences", "smsAssistant"], context);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);
}

function firstNameFromFullName(fullName: string | null | undefined): string | null {
  const trimmed = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  const [firstName] = trimmed.split(" ");
  return firstName ? titleCaseWords(firstName) : null;
}

function macroProfilesFromDocument(
  document: Record<string, unknown>,
  options?: { accountFullName?: string | null },
): MacroProfile[] {
  const raw = getDocumentValue(document, ["appPreferences", "macroGame", "profiles"]);
  const accountFirstName = firstNameFromFullName(options?.accountFullName);
  const fallbackPrimaryProfile: MacroProfile | null = accountFirstName
    ? {
        id: "me",
        name: accountFirstName,
        memberType: "adult",
        aliases: ["me", accountFirstName],
      }
    : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallbackPrimaryProfile ? [fallbackPrimaryProfile] : [];

  const profiles = Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
    .map(([id, value]) => {
      const row = value as Record<string, unknown>;
      const fallbackName = id === "me" && accountFirstName ? accountFirstName : titleCaseWords(id);
      const resolvedName =
        typeof row.name === "string" && row.name.trim()
          ? row.name.trim()
          : fallbackName;
      const aliases = new Set<string>();
      aliases.add(id);
      if (id === "me") aliases.add("me");
      if (accountFirstName && id === "me") aliases.add(accountFirstName);
      return {
        id,
        name: resolvedName,
        memberType: typeof row.memberType === "string" ? row.memberType : undefined,
        aliases: Array.from(aliases),
      };
    });

  if (fallbackPrimaryProfile && !profiles.some((profile) => profile.id === "me")) {
    profiles.unshift(fallbackPrimaryProfile);
  }

  return profiles;
}

function normalizeMacroActivityState(input: unknown): MacroActivityState {
  const record = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};

  const mealLogs = Array.isArray(record.mealLogs)
    ? record.mealLogs
        .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
        .map((item) => ({
          id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : crypto.randomUUID(),
          recipeId: typeof item.recipeId === "string" && item.recipeId.trim() ? item.recipeId.trim() : undefined,
          recipeName: typeof item.recipeName === "string" && item.recipeName.trim() ? item.recipeName.trim() : "Meal",
          date: typeof item.date === "string" && item.date.trim() ? item.date.trim() : "",
          person: typeof item.person === "string" && item.person.trim() ? item.person.trim() : "me",
          servings: Number.isFinite(Number(item.servings)) && Number(item.servings) > 0 ? Number(item.servings) : 1,
          macros: {
            calories: Number.isFinite(Number((item.macros as Record<string, unknown> | undefined)?.calories))
              ? Math.max(0, Number((item.macros as Record<string, unknown>).calories))
              : 0,
            protein_g: Number.isFinite(Number((item.macros as Record<string, unknown> | undefined)?.protein_g))
              ? Math.max(0, Number((item.macros as Record<string, unknown>).protein_g))
              : 0,
            carbs_g: Number.isFinite(Number((item.macros as Record<string, unknown> | undefined)?.carbs_g))
              ? Math.max(0, Number((item.macros as Record<string, unknown>).carbs_g))
              : 0,
            fat_g: Number.isFinite(Number((item.macros as Record<string, unknown> | undefined)?.fat_g))
              ? Math.max(0, Number((item.macros as Record<string, unknown>).fat_g))
              : 0,
          },
          isQuickAdd: !!item.isQuickAdd,
          createdAt:
            typeof item.createdAt === "string" && item.createdAt.trim()
              ? item.createdAt.trim()
              : new Date().toISOString(),
        }))
    : [];

  const trackersInput = record.trackers && typeof record.trackers === "object" && !Array.isArray(record.trackers)
    ? (record.trackers as Record<string, unknown>)
    : {};

  const trackers = Object.entries(trackersInput).reduce<Record<string, Record<string, MacroDayTracker>>>(
    (dates, [dateKey, trackerValue]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !trackerValue || typeof trackerValue !== "object" || Array.isArray(trackerValue)) {
        return dates;
      }
      const people = Object.entries(trackerValue as Record<string, unknown>).reduce<Record<string, MacroDayTracker>>(
        (nextPeople, [personId, stats]) => {
          if (!stats || typeof stats !== "object" || Array.isArray(stats) || !personId.trim()) return nextPeople;
          const statRecord = stats as Record<string, unknown>;
          nextPeople[personId] = {
            waterOz: Number.isFinite(Number(statRecord.waterOz)) ? Math.max(0, Number(statRecord.waterOz)) : 0,
            alcoholDrinks:
              Number.isFinite(Number(statRecord.alcoholDrinks))
                ? Math.max(0, Number(statRecord.alcoholDrinks))
                : 0,
          };
          return nextPeople;
        },
        {},
      );
      if (Object.keys(people).length > 0) {
        dates[dateKey] = people;
      }
      return dates;
    },
    {},
  );

  return { mealLogs, trackers };
}

function normalizeGroceryState(input: unknown): StoredGroceryListState {
  const record = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};

  const normalizeItem = (item: unknown): GroceryManualItem | null => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name.trim().replace(/\s+/g, " ") : "";
    if (!name) return null;
    const category = typeof row.category === "string" ? row.category : "other";
    return {
      id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : crypto.randomUUID(),
      name,
      quantity:
        typeof row.quantity === "string" && row.quantity.trim()
          ? row.quantity.trim().replace(/\s+/g, " ")
          : "1x",
      category:
        category === "produce" || category === "meat" || category === "dairy" || category === "pantry"
          ? category
          : "other",
      createdAt:
        typeof row.createdAt === "string" && row.createdAt.trim()
          ? row.createdAt.trim()
          : new Date().toISOString(),
    };
  };

  const recurringItems = Array.isArray(record.recurringItems)
    ? record.recurringItems.map((item) => normalizeItem(item)).filter((item): item is GroceryManualItem => !!item)
    : [];

  const weekStatesInput = record.weekStates && typeof record.weekStates === "object" && !Array.isArray(record.weekStates)
    ? (record.weekStates as Record<string, unknown>)
    : {};

  const weekStates = Object.entries(weekStatesInput).reduce<Record<string, GroceryWeekState>>((weeks, [weekKey, value]) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekKey) || !value || typeof value !== "object" || Array.isArray(value)) {
      return weeks;
    }
    const row = value as Record<string, unknown>;
    const manualItems = Array.isArray(row.manualItems)
      ? row.manualItems.map((item) => normalizeItem(item)).filter((item): item is GroceryManualItem => !!item)
      : [];
    const checkedKeys = Array.isArray(row.checkedKeys)
      ? [...new Set(row.checkedKeys.filter((item): item is string => typeof item === "string" && item.trim()).map((item) => item.trim()))]
      : [];
    weeks[weekKey] = {
      checkedKeys,
      manualItems,
      orderedAt:
        typeof row.orderedAt === "string" && row.orderedAt.trim()
          ? row.orderedAt.trim()
          : null,
    };
    return weeks;
  }, {});

  return {
    recurringItems,
    weekStates,
  };
}

function normalizeStoredTasks(input: unknown): StoredTask[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const title = typeof row.title === "string" ? row.title.trim().replace(/\s+/g, " ") : "";
      if (!title) return null;
      const frequency = typeof row.frequency === "string" ? row.frequency.trim().toLowerCase() : "once";
      const normalizedFrequency =
        frequency === "daily" ||
        frequency === "weekly" ||
        frequency === "monthly" ||
        frequency === "every_3_months" ||
        frequency === "every_6_months" ||
        frequency === "yearly" ||
        frequency === "once"
          ? frequency
          : "once";
      const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : "not_started";
      const normalizedStatus =
        status === "done" || status === "in_progress" || status === "not_started"
          ? status
          : "not_started";
      const type = typeof row.type === "string" ? row.type.trim().toLowerCase() : "do";
      const normalizedType = type === "maintain" || type === "notice" ? type : "do";
      const day = typeof row.day === "string" ? row.day.trim().toLowerCase() : "";
      return {
        id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `task-${index}`,
        title,
        notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : undefined,
        type: normalizedType,
        status: normalizedStatus,
        frequency: normalizedFrequency,
        assignedToId: typeof row.assignedToId === "string" && row.assignedToId.trim() ? row.assignedToId.trim() : undefined,
        assignedToName: typeof row.assignedToName === "string" && row.assignedToName.trim() ? row.assignedToName.trim() : undefined,
        dueDate: typeof row.dueDate === "string" && row.dueDate.trim() ? row.dueDate.trim() : undefined,
        day:
          day === "monday" || day === "tuesday" || day === "wednesday" || day === "thursday" || day === "friday" || day === "saturday" || day === "sunday"
            ? day
            : undefined,
        reminderEnabled: row.reminderEnabled === true,
        reminderTime: typeof row.reminderTime === "string" && /^\d{2}:\d{2}$/.test(row.reminderTime.trim()) ? row.reminderTime.trim() : undefined,
        reminderLeadMinutes: Number.isFinite(Number(row.reminderLeadMinutes))
          ? Math.max(5, Math.min(240, Number(row.reminderLeadMinutes)))
          : undefined,
        createdAt:
          typeof row.createdAt === "string" && row.createdAt.trim()
            ? row.createdAt.trim()
            : new Date().toISOString(),
      };
    })
    .filter((task): task is StoredTask => Boolean(task));
}

function startOfWeekIso(localDate: DateTime): string {
  return localDate.minus({ days: localDate.weekday - 1 }).toISODate() || "";
}

function guessGroceryCategory(name: string): GroceryManualItem["category"] {
  const lower = name.toLowerCase();
  const produce = ["lettuce", "tomato", "onion", "garlic", "pepper", "broccoli", "carrot", "potato", "lemon", "lime", "mushroom", "spinach", "cucumber", "avocado", "zucchini"];
  const meat = ["chicken", "beef", "pork", "salmon", "fish", "steak", "sausage", "turkey", "shrimp", "bacon"];
  const dairy = ["cheese", "milk", "cream", "butter", "yogurt", "egg"];
  const pantry = ["sauce", "oil", "salt", "pepper", "seasoning", "flour", "sugar", "rice", "pasta", "soy", "honey", "vinegar", "broth", "stock"];
  if (produce.some((item) => lower.includes(item))) return "produce";
  if (meat.some((item) => lower.includes(item))) return "meat";
  if (dairy.some((item) => lower.includes(item))) return "dairy";
  if (pantry.some((item) => lower.includes(item))) return "pantry";
  return "other";
}

function parseUsDate(dateText: string, timezone: string): DateTime | null {
  const normalized = trimTrailingPunctuation(dateText).toLowerCase();
  const now = DateTime.now().setZone(timezone);

  if (normalized === "today") return now.startOf("day");
  if (normalized === "tomorrow") return now.plus({ days: 1 }).startOf("day");

  const mdMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (mdMatch) {
    const month = Number.parseInt(mdMatch[1] || "", 10);
    const day = Number.parseInt(mdMatch[2] || "", 10);
    const yearRaw = mdMatch[3];
    const year = yearRaw
      ? Number.parseInt(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw, 10)
      : now.year;
    let parsed = DateTime.fromObject({ year, month, day }, { zone: timezone }).startOf("day");
    if (!parsed.isValid) return null;
    if (!yearRaw && parsed < now.startOf("day")) {
      parsed = parsed.plus({ years: 1 });
    }
    return parsed;
  }

  const natural = DateTime.fromFormat(normalized, "LLLL d", { zone: timezone });
  if (natural.isValid) {
    let parsed = natural.set({ year: now.year }).startOf("day");
    if (parsed < now.startOf("day")) {
      parsed = parsed.plus({ years: 1 });
    }
    return parsed;
  }

  return null;
}

function parseTimeForZone(timeText: string, date: DateTime, timezone: string): DateTime | null {
  const normalized = trimTrailingPunctuation(timeText).toLowerCase().replace(/\./g, "");
  const formats = ["h:mm a", "h a", "h:mma", "ha", "H:mm", "H"];

  for (const format of formats) {
    const parsed = DateTime.fromFormat(normalized, format, { zone: timezone });
    if (!parsed.isValid) continue;
    return date.set({ hour: parsed.hour, minute: parsed.minute, second: 0, millisecond: 0 });
  }

  return null;
}

function normalizeCalendarLayerName(value: string): string {
  const trimmed = trimTrailingPunctuation(value).replace(/\s+/g, " ");
  const normalized = trimmed.toLowerCase();
  if (!trimmed) return "family";
  if (normalized === "family" || normalized === "manual") return "family";
  return titleCaseWords(trimmed);
}

function normalizeGroceryItemName(value: string): string {
  const trimmed = trimTrailingPunctuation(value).replace(/\s+/g, " ");
  if (!trimmed) return "";
  return titleCaseWords(trimmed.toLowerCase());
}

function groceryItemMatchesName(itemName: string, requestedName: string): boolean {
  const itemKey = normalizeToken(itemName);
  const requestedKey = normalizeToken(requestedName);
  if (!itemKey || !requestedKey) return false;
  return itemKey === requestedKey || itemKey.includes(requestedKey) || requestedKey.includes(itemKey);
}

function parseCalendarAddIntent(body: string, timezone: string): CalendarAddIntent | null {
  const normalized = trimTrailingPunctuation(body);
  const verboseMatch = normalized.match(
    /^add\s+(?:an?\s+)?event\s+(.+?)\s+to\s+(.+?)(?:\s+filter)?(?:\s+on\s+calendar)?\s+(?:starting\s+at|at)\s+(.+?)\s+for\s+(.+)$/i,
  );
  if (verboseMatch) {
    const title = normalizeCalendarTitle(trimTrailingPunctuation(verboseMatch[1] || ""));
    const layer = normalizeCalendarLayerName(verboseMatch[2] || "");
    const timeText = trimTrailingPunctuation(verboseMatch[3] || "");
    const dateText = trimTrailingPunctuation(verboseMatch[4] || "");
    if (!title || !layer) return null;

    const date = parseUsDate(dateText, timezone);
    if (!date) return null;

    if (!timeText) {
      const allDayStart = date.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
      return {
        title,
        layer,
        startsAt: allDayStart.toUTC().toISO() || "",
        endsAt: null,
        allDay: true,
      };
    }

    const startsAt = parseTimeForZone(timeText, date, timezone);
    if (!startsAt) return null;
    return {
      title,
      layer,
      startsAt: startsAt.toUTC().toISO() || "",
      endsAt: startsAt.plus({ hours: 1 }).toUTC().toISO() || null,
      allDay: false,
    };
  }

  const patterns = [
    /^add\s+(.+?)\s+for\s+(.+?)\s+at\s+(.+?)\s+on\s+(.+)$/i,
    /^add\s+(.+?)\s+for\s+(.+?)\s+on\s+(.+?)\s+at\s+(.+)$/i,
    /^add\s+(.+?)\s+for\s+(.+?)\s+(today|tomorrow)\s+at\s+(.+)$/i,
    /^add\s+(.+?)\s+for\s+(.+?)\s+on\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const title = normalizeCalendarTitle(trimTrailingPunctuation(match[1] || ""));
    const rawLayer = trimTrailingPunctuation(match[2] || "");
    let layer = normalizeCalendarLayerName(rawLayer);
    const third = trimTrailingPunctuation(match[3] || "");
    const fourth = trimTrailingPunctuation(match[4] || "");
    if (!title || !layer) return null;

    let dateText = third;
    let timeText = fourth;
    if (pattern === patterns[0] || pattern === patterns[2]) {
      dateText = fourth;
      timeText = third;
    }

    if (pattern === patterns[3]) {
      const layerWithTime = rawLayer.match(/^(.+?)\s+at\s+(.+)$/i);
      if (layerWithTime) {
        layer = normalizeCalendarLayerName(layerWithTime[1] || "");
        timeText = trimTrailingPunctuation(layerWithTime[2] || "");
      } else {
        const dateWithTime = third.match(/^(.+?)\s+at\s+(.+)$/i);
        if (dateWithTime) {
          dateText = trimTrailingPunctuation(dateWithTime[1] || "");
          timeText = trimTrailingPunctuation(dateWithTime[2] || "");
        }
      }
    }

    const date = parseUsDate(dateText, timezone);
    if (!date) return null;

    if (!timeText) {
      const allDayStart = date.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
      return {
        title,
        layer,
        startsAt: allDayStart.toUTC().toISO() || "",
        endsAt: null,
        allDay: true,
      };
    }

    const startsAt = parseTimeForZone(timeText, date, timezone);
    if (!startsAt) return null;
    return {
      title,
      layer,
      startsAt: startsAt.toUTC().toISO() || "",
      endsAt: startsAt.plus({ hours: 1 }).toUTC().toISO() || null,
      allDay: false,
    };
  }

  return null;
}

function parseGroceryAddIntent(body: string): GroceryAddIntent | null {
  const normalized = trimTrailingPunctuation(body);
  if (!/^add\s+/i.test(normalized) || !/\bgrocery(?:\s+list)?\b/i.test(normalized)) {
    return null;
  }

  const weekly = /\b(?:every week|weekly)\b/i.test(normalized);
  let name = normalized
    .replace(/^add\s+/i, "")
    .replace(/\b(?:every week|weekly)\b/gi, "")
    .trim();

  if (/^to\s+(?:the\s+)?grocery(?:\s+list)?\b/i.test(name)) {
    name = name.replace(/^to\s+(?:the\s+)?grocery(?:\s+list)?\s*/i, "");
  } else {
    name = name.replace(/\s+to\s+(?:the\s+)?grocery(?:\s+list)?$/i, "");
  }

  name = name.trim().replace(/\s+/g, " ");

  if (!name) return null;
  return {
    name,
    quantity: "1x",
    weekly,
  };
}

function parseGroceryRemoveIntent(body: string): GroceryRemoveIntent | null {
  const normalized = trimTrailingPunctuation(body);
  const match = normalized.match(
    /^(?:remove|delete)\s+(.+?)\s+from\s+(?:the\s+)?grocery(?:\s+list)?$/i,
  );
  if (!match) return null;
  const name = trimTrailingPunctuation(match[1] || "");
  if (!name) return null;
  return { name };
}

function groceryOrderIntent(body: string): "ordered" | "not_ordered" | null {
  const normalized = trimTrailingPunctuation(body);
  if (/^(?:mark\s+)?(?:groceries|grocery(?:\s+list)?)(?:\s+as)?\s+ordered$/i.test(normalized)) {
    return "ordered";
  }
  if (/^(?:undo\s+grocery\s+order|mark\s+(?:groceries|grocery(?:\s+list)?)(?:\s+as)?\s+not\s+ordered)$/i.test(normalized)) {
    return "not_ordered";
  }
  return null;
}

function asksForGroceryList(body: string): boolean {
  return /(?:what(?:'s| is)\s+on\s+(?:the\s+)?grocery(?:\s+list)?|show\s+(?:me\s+)?(?:the\s+)?grocery(?:\s+list)?)/i.test(body);
}

function parseWaterLogIntent(body: string): WaterLogIntent | null {
  const normalized = trimTrailingPunctuation(body);
  const patterns = [
    /^add\s+water\s+log\s+to\s+(.+?)\s+drank\s+(\d+(?:\.\d+)?)\s*oz$/i,
    /^log\s+(\d+(?:\.\d+)?)\s*oz\s+water\s+for\s+(.+)$/i,
    /^(.+?)\s+drank\s+(\d+(?:\.\d+)?)\s*oz\s+water$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    if (pattern === patterns[1]) {
      return {
        personName: trimTrailingPunctuation(match[2] || ""),
        ounces: Math.max(1, Math.round(Number(match[1]))),
      };
    }
    return {
      personName: trimTrailingPunctuation(match[1] || ""),
      ounces: Math.max(1, Math.round(Number(match[2]))),
    };
  }

  return null;
}

function parseTaskAddIntent(body: string, timezone: string): TaskAddIntent | null {
  const normalized = trimTrailingPunctuation(body);
  const patterns = [
    /^add\s+task\s+(.+?)\s+for\s+(.+?)\s+(today|tomorrow|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+at\s+(.+)$/i,
    /^add\s+task\s+(.+?)\s+for\s+(.+?)\s+on\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+at\s+(.+)$/i,
    /^add\s+task\s+(.+?)\s+for\s+(.+?)\s+(today|tomorrow|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/i,
    /^add\s+task\s+(.+?)\s+for\s+(.+?)$/i,
    /^add\s+task\s+(.+?)\s+(today|tomorrow|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+at\s+(.+)$/i,
    /^add\s+task\s+(.+?)\s+(today|tomorrow|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)$/i,
    /^add\s+task\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    if (pattern === patterns[0] || pattern === patterns[1]) {
      const dueDate = parseUsDate(trimTrailingPunctuation(match[3] || ""), timezone);
      const reminderTime = dueDate ? parseTimeForZone(trimTrailingPunctuation(match[4] || ""), dueDate, timezone) : null;
      return {
        title: titleCaseWords(trimTrailingPunctuation(match[1] || "").toLowerCase()),
        personName: trimTrailingPunctuation(match[2] || ""),
        dueDate: dueDate?.toISODate() || undefined,
        reminderTime: reminderTime?.toFormat("HH:mm") || undefined,
      };
    }
    if (pattern === patterns[2] || pattern === patterns[3]) {
      const dueDate = pattern === patterns[2] ? parseUsDate(trimTrailingPunctuation(match[3] || ""), timezone) : null;
      return {
        title: titleCaseWords(trimTrailingPunctuation(match[1] || "").toLowerCase()),
        personName: trimTrailingPunctuation(match[2] || ""),
        dueDate: dueDate?.toISODate() || undefined,
      };
    }
    if (pattern === patterns[4]) {
      const dueDate = parseUsDate(trimTrailingPunctuation(match[2] || ""), timezone);
      const reminderTime = dueDate ? parseTimeForZone(trimTrailingPunctuation(match[3] || ""), dueDate, timezone) : null;
      return {
        title: titleCaseWords(trimTrailingPunctuation(match[1] || "").toLowerCase()),
        dueDate: dueDate?.toISODate() || undefined,
        reminderTime: reminderTime?.toFormat("HH:mm") || undefined,
      };
    }
    if (pattern === patterns[5]) {
      const dueDate = parseUsDate(trimTrailingPunctuation(match[2] || ""), timezone);
      return {
        title: titleCaseWords(trimTrailingPunctuation(match[1] || "").toLowerCase()),
        dueDate: dueDate?.toISODate() || undefined,
      };
    }
    return {
      title: titleCaseWords(trimTrailingPunctuation(match[1] || "").toLowerCase()),
    };
  }

  return null;
}

function parseTaskCompleteIntent(body: string): TaskCompleteIntent | null {
  const normalized = trimTrailingPunctuation(body);
  const match = normalized.match(/^mark\s+(.+?)\s+done$/i)
    || normalized.match(/^(?:complete|finish)\s+(.+)$/i);
  if (!match) return null;
  const title = trimTrailingPunctuation(match[1] || "");
  if (!title) return null;
  return { title };
}

function asksForOpenTasks(body: string): boolean {
  return /(?:what\s+tasks?(?:\s+are)?\s+(?:open|left|remaining)|show\s+(?:me\s+)?(?:my\s+)?open\s+tasks?|what\s+do\s+i\s+still\s+need\s+to\s+do)/i.test(body);
}

function parseMealLogIntent(body: string): MealLogIntent | null {
  const normalized = trimTrailingPunctuation(body);
  const explicitServings = normalized.match(/^log\s+(\d+(?:\.\d+)?)\s+servings?\s+of\s+(.+?)\s+for\s+(.+)$/i);
  if (explicitServings) {
    return {
      servings: Math.max(0.25, Number(explicitServings[1])),
      recipeName: trimTrailingPunctuation(explicitServings[2] || ""),
      personName: trimTrailingPunctuation(explicitServings[3] || ""),
    };
  }

  const xServings = normalized.match(/^log\s+(.+?)\s+x(\d+(?:\.\d+)?)\s+for\s+(.+)$/i);
  if (xServings) {
    return {
      servings: Math.max(0.25, Number(xServings[2])),
      recipeName: trimTrailingPunctuation(xServings[1] || ""),
      personName: trimTrailingPunctuation(xServings[3] || ""),
    };
  }

  const basic = normalized.match(/^log\s+(.+?)\s+for\s+(.+)$/i);
  if (!basic) return null;

  return {
    servings: 1,
    recipeName: trimTrailingPunctuation(basic[1] || ""),
    personName: trimTrailingPunctuation(basic[2] || ""),
  };
}

function parseMealFollowUpIntent(body: string): MealFollowUpIntent | null {
  const normalized = trimTrailingPunctuation(body);

  const servingsPatterns = [
    /^(?:change that to|make that|make it|change it to|that was|actually make it)\s+(\d+(?:\.\d+)?)\s+servings?$/i,
    /^(?:change that meal to|make that meal|change that lunch to|change that breakfast to|change that dinner to|change that snack to)\s+(\d+(?:\.\d+)?)\s+servings?$/i,
  ];
  for (const pattern of servingsPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const servings = Number(match[1]);
    if (Number.isFinite(servings) && servings > 0) {
      return { servings: Math.max(0.25, servings) };
    }
  }

  if (/^(?:delete that meal|remove that meal|delete that log|remove that log)$/i.test(normalized)) {
    return { deleteLog: true, genericDelete: false };
  }

  if (/^(?:delete that|remove that|delete it|remove it)$/i.test(normalized)) {
    return { deleteLog: true, genericDelete: true };
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitMealRecipeNames(value: string): string[] {
  return value
    .split(/\s*(?:,| and )\s*/i)
    .map((item) => trimTrailingPunctuation(item))
    .filter(Boolean);
}

function parseNaturalMealLogIntents(body: string): MealLogIntent[] | null {
  const normalized = trimTrailingPunctuation(body);
  const match = normalized.match(
    /^add\s+(.+?)\s+to\s+(.+?)(?:['’]s)?\s+meal\s+log(?:\s+for\s+(?:breakfast|lunch|dinner|snack|snacks|drinks?))?(?:\s+(?:this|today|tonight|this morning|this afternoon|this evening).*)?$/i,
  );
  if (!match) return null;

  const recipeListRaw = trimTrailingPunctuation(match[1] || "");
  const personName = trimTrailingPunctuation(match[2] || "");
  if (!recipeListRaw || !personName) return null;

  const leadingPossessivePattern = new RegExp(`^${escapeRegExp(personName)}(?:['’]s)?\\s+`, "i");
  const intents = splitMealRecipeNames(recipeListRaw)
    .map((recipeName) => trimTrailingPunctuation(recipeName.replace(leadingPossessivePattern, "")))
    .filter(Boolean)
    .map((recipeName) => ({
      servings: 1,
      recipeName,
      personName,
    }));

  return intents.length ? intents : null;
}

function resolvePersonByName(
  profiles: MacroProfile[],
  requestedName: string,
): MacroProfile | null {
  const normalized = normalizeEntityName(requestedName);
  if (!normalized) return null;

  const direct = profiles.find((profile) =>
    normalizeEntityName(profile.name) === normalized
    || normalizeEntityName(profile.id) === normalized
    || (profile.aliases || []).some((alias) => normalizeEntityName(alias) === normalized),
  );
  if (direct) return direct;

  const fuzzy = profiles.filter((profile) => {
    const profileName = normalizeEntityName(profile.name);
    const profileId = normalizeEntityName(profile.id);
    const aliasMatch = (profile.aliases || []).some((alias) => {
      const aliasKey = normalizeEntityName(alias);
      return aliasKey.includes(normalized) || normalized.includes(aliasKey);
    });
    return profileName.includes(normalized) || normalized.includes(profileName) || profileId.includes(normalized) || aliasMatch;
  });

  return fuzzy.length === 1 ? fuzzy[0] : null;
}

async function addCalendarEventBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  intent: CalendarAddIntent,
): Promise<{ reply: string; eventId: string }> {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(),
    owner_id: userId,
    title: intent.title,
    description: intent.description || null,
    location_text: intent.locationText || null,
    event_reminder_enabled: false,
    event_reminder_lead_minutes: 5,
    travel_from_address: null,
    travel_mode: "driving",
    travel_duration_minutes: null,
    traffic_duration_minutes: null,
    leave_by: null,
    leave_reminder_enabled: false,
    leave_reminder_lead_minutes: 10,
    starts_at: intent.startsAt,
    ends_at: intent.endsAt,
    all_day: intent.allDay,
    module: "manual",
    source: "manual",
    calendar_layer: intent.layer,
    timezone_name: timezone,
    recurrence_rule: null,
    is_deleted: false,
    deleted_at: null,
  };

  const payloadVariants: Record<string, unknown>[] = [
    payload,
    (() => {
      const {
        location_text: _locationText,
        event_reminder_enabled: _eventReminderEnabled,
        event_reminder_lead_minutes: _eventReminderLeadMinutes,
        travel_from_address: _travelFromAddress,
        travel_mode: _travelMode,
        travel_duration_minutes: _travelDurationMinutes,
        traffic_duration_minutes: _trafficDurationMinutes,
        leave_by: _leaveBy,
        leave_reminder_enabled: _leaveReminderEnabled,
        leave_reminder_lead_minutes: _leaveReminderLeadMinutes,
        recurrence_rule: _recurrenceRule,
        deleted_at: _deletedAt,
        ...legacyPayload
      } = payload;
      return legacyPayload;
    })(),
    (() => {
      const {
        calendar_layer: _calendarLayer,
        timezone_name: _timezoneName,
        is_deleted: _isDeleted,
        ...basePayload
      } = payload;
      const {
        location_text: _locationText,
        event_reminder_enabled: _eventReminderEnabled,
        event_reminder_lead_minutes: _eventReminderLeadMinutes,
        travel_from_address: _travelFromAddress,
        travel_mode: _travelMode,
        travel_duration_minutes: _travelDurationMinutes,
        traffic_duration_minutes: _trafficDurationMinutes,
        leave_by: _leaveBy,
        leave_reminder_enabled: _leaveReminderEnabled,
        leave_reminder_lead_minutes: _leaveReminderLeadMinutes,
        recurrence_rule: _recurrenceRule,
        deleted_at: _deletedAt,
        ...oldestPayload
      } = basePayload;
      return oldestPayload;
    })(),
  ];

  let lastError: unknown = null;
  for (const candidate of payloadVariants) {
    const { error } = await supabase.from("calendar_events").insert(candidate);
    if (!error) {
      const localStart = DateTime.fromISO(intent.startsAt, { zone: "utc" }).setZone(timezone);
      const dateFormat = localStart.year === DateTime.now().setZone(timezone).year ? "LLL d" : "LLL d, yyyy";
      const whenText = intent.allDay
        ? localStart.toFormat(dateFormat)
        : localStart.toFormat(`${dateFormat} 'at' h:mm a`);
      return {
        reply: `Added ${intent.title} to ${intent.layer} for ${whenText}.`,
        eventId: String(candidate.id),
      };
    }
    lastError = error;
  }

  throw lastError instanceof Error ? lastError : new Error("Could not save calendar event.");
}

function parseCalendarFollowUpIntent(body: string, timezone: string): CalendarFollowUpIntent | null {
  const normalized = trimTrailingPunctuation(body);

  const layerPatterns = [
    /^change\s+it\s+to\s+(.+?)\s+calendar$/i,
    /^change\s+it\s+to\s+(.+?)\s+filter$/i,
    /^move\s+it\s+to\s+(.+?)\s+calendar$/i,
    /^move\s+it\s+to\s+(.+?)\s+filter$/i,
  ];

  for (const pattern of layerPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const layer = normalizeCalendarLayerName(match[1] || "");
      if (layer) return { layer };
    }
  }

  const reminderPatterns = [
    /^change\s+(?:the\s+)?reminder(?:\s+time|\s+timing)?\s+to\s+(\d+)\s*(?:min|mins|minute|minutes)\s+before$/i,
    /^change\s+it\s+to\s+(\d+)\s*(?:min|mins|minute|minutes)\s+before$/i,
    /^remind\s+me\s+(\d+)\s*(?:min|mins|minute|minutes)\s+before$/i,
    /^set\s+(?:the\s+)?reminder(?:\s+time|\s+timing)?\s+to\s+(\d+)\s*(?:min|mins|minute|minutes)\s+before$/i,
  ];

  for (const pattern of reminderPatterns) {
    const match = normalized.match(pattern);
    if (match) {
      const lead = Number.parseInt(match[1] || "", 10);
      if (Number.isFinite(lead) && lead >= 0) {
        return { reminderLeadMinutes: Math.max(0, Math.min(240, lead)) };
      }
    }
  }

  if (/^(?:turn off|disable)\s+(?:the\s+)?reminder$/i.test(normalized)) {
    return { reminderLeadMinutes: -1 };
  }

  if (/^(?:remind me|set reminder)(?:\s+at time|\s+on time)?$/i.test(normalized)) {
    return { reminderLeadMinutes: 0 };
  }

  if (/^(?:delete that|remove that|delete it|remove it|cancel that event|delete that event)$/i.test(normalized)) {
    return { deleteEvent: true };
  }

  if (/^(?:make it all day|change it to all day|set it as all day)$/i.test(normalized)) {
    return { makeAllDay: true };
  }

  const movePatterns = [
    /^move\s+it\s+to\s+(.+?)\s+at\s+(.+)$/i,
    /^change\s+it\s+to\s+(.+?)\s+at\s+(.+)$/i,
    /^move\s+it\s+to\s+(.+)$/i,
  ];

  for (const pattern of movePatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    if (pattern === movePatterns[2]) {
      const trailing = trimTrailingPunctuation(match[1] || "");
      const dateWithTime = trailing.match(/^(.+?)\s+at\s+(.+)$/i);
      if (dateWithTime) {
        return {
          moveDateText: trimTrailingPunctuation(dateWithTime[1] || ""),
          moveTimeText: trimTrailingPunctuation(dateWithTime[2] || ""),
        };
      }
      const parsedAsDate = parseUsDate(trailing, timezone);
      if (parsedAsDate) {
        return { moveDateText: trailing };
      }
      return { moveTimeText: trailing };
    }
    return {
      moveDateText: trimTrailingPunctuation(match[1] || ""),
      moveTimeText: trimTrailingPunctuation(match[2] || ""),
    };
  }

  return null;
}

async function updateRecentCalendarEventBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  context: SmsAssistantContext,
  intent: CalendarFollowUpIntent,
): Promise<string | null> {
  const lastEvent = context.lastCalendarEvent;
  if (!lastEvent?.eventId) return null;

  const updatedAt = DateTime.fromISO(lastEvent.updatedAt, { zone: timezone });
  if (!updatedAt.isValid || updatedAt < DateTime.now().setZone(timezone).minus({ hours: 24 })) {
    return null;
  }

  const { data: existing, error: loadError } = await supabase
    .from("calendar_events")
    .select("id,title,calendar_layer,event_reminder_enabled,event_reminder_lead_minutes,starts_at,ends_at,all_day")
    .eq("owner_id", userId)
    .eq("id", lastEvent.eventId)
    .eq("source", "manual")
    .eq("is_deleted", false)
    .maybeSingle();

  if (loadError) throw loadError;
  if (!existing) return null;

  if (intent.deleteEvent) {
    const { error: deleteError } = await supabase
      .from("calendar_events")
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq("id", lastEvent.eventId)
      .eq("owner_id", userId);

    if (deleteError) throw deleteError;
    return `Deleted ${existing.title || lastEvent.title}.`;
  }

  const currentStart = safeDateTime(String(existing.starts_at || ""), "utc")?.setZone(timezone);
  const currentEnd = safeDateTime(String(existing.ends_at || ""), "utc")?.setZone(timezone);
  let nextStartsAt = currentStart;
  let nextEndsAt = currentEnd;
  let nextAllDay = !!existing.all_day;

  if (intent.makeAllDay && currentStart) {
    nextAllDay = true;
    nextStartsAt = currentStart.startOf("day").set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
    nextEndsAt = null;
  } else if ((intent.moveDateText || intent.moveTimeText) && currentStart) {
    let nextDate = currentStart.startOf("day");
    if (intent.moveDateText) {
      const parsedDate = parseUsDate(intent.moveDateText, timezone);
      if (!parsedDate) return "I couldn't read the new date for that event. Try something like 'move it to tomorrow at 3 PM'.";
      nextDate = parsedDate;
    }
    if (intent.moveTimeText) {
      const parsedTime = parseTimeForZone(intent.moveTimeText, nextDate, timezone);
      if (!parsedTime) return "I couldn't read the new time for that event. Try something like 'move it to 3:15 PM'.";
      nextStartsAt = parsedTime;
      nextAllDay = false;
      const durationMinutes =
        currentStart && currentEnd && currentEnd > currentStart
          ? Math.max(15, Math.round(currentEnd.diff(currentStart, "minutes").minutes))
          : 60;
      nextEndsAt = nextStartsAt.plus({ minutes: durationMinutes });
    } else {
      nextAllDay = true;
      nextStartsAt = nextDate.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
      nextEndsAt = null;
    }
  }

  const nextLayer = intent.layer || String(existing.calendar_layer || "family");
  const nextReminderEnabled =
    typeof intent.reminderLeadMinutes === "number"
      ? intent.reminderLeadMinutes >= 0
      : !!existing.event_reminder_enabled;
  const nextReminderLead =
    typeof intent.reminderLeadMinutes === "number" && intent.reminderLeadMinutes >= 0
      ? intent.reminderLeadMinutes
      : typeof existing.event_reminder_lead_minutes === "number"
      ? existing.event_reminder_lead_minutes
      : 0;

  const updatePayload = {
    calendar_layer: nextLayer,
    event_reminder_enabled: nextReminderEnabled,
    event_reminder_lead_minutes: nextReminderEnabled ? nextReminderLead : 0,
    starts_at: nextStartsAt ? nextStartsAt.toUTC().toISO() : existing.starts_at,
    ends_at: nextEndsAt ? nextEndsAt.toUTC().toISO() : null,
    all_day: nextAllDay,
  };

  const { error: updateError } = await supabase
    .from("calendar_events")
    .update(updatePayload)
    .eq("id", lastEvent.eventId)
    .eq("owner_id", userId);

  if (updateError) throw updateError;

  const detailParts: string[] = [];
  if (intent.layer) {
    detailParts.push(`moved it to ${nextLayer}`);
  }
  if (typeof intent.reminderLeadMinutes === "number") {
    if (intent.reminderLeadMinutes < 0) {
      detailParts.push("turned the reminder off");
    } else if (intent.reminderLeadMinutes === 0) {
      detailParts.push("set the reminder for event time");
    } else {
      detailParts.push(`set the reminder for ${intent.reminderLeadMinutes} min before`);
    }
  }
  if (intent.makeAllDay) {
    detailParts.push("made it all day");
  } else if (intent.moveDateText || intent.moveTimeText) {
    const whenParts: string[] = [];
    if (intent.moveDateText && nextStartsAt) whenParts.push(nextStartsAt.toFormat("LLL d"));
    if (intent.moveTimeText && nextStartsAt) whenParts.push(nextStartsAt.toFormat("h:mm a"));
    if (whenParts.length) {
      detailParts.push(`moved it to ${whenParts.join(" at ")}`);
    }
  }

  const details = detailParts.length ? ` and ${detailParts.join(" and ")}` : "";
  return `Updated ${existing.title || lastEvent.title}${details}.`;
}

async function addGroceryItemBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  intent: GroceryAddIntent,
): Promise<string> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const groceryState = normalizeGroceryState(getDocumentValue(document, ["appPreferences", "groceryList"]));
  const normalizedName = normalizeGroceryItemName(intent.name);
  const item: GroceryManualItem = {
    id: crypto.randomUUID(),
    name: normalizedName || intent.name,
    quantity: intent.quantity,
    category: guessGroceryCategory(normalizedName || intent.name),
    createdAt: new Date().toISOString(),
  };

  if (intent.weekly) {
    groceryState.recurringItems = [...groceryState.recurringItems, item];
  } else {
    const weekOf = startOfWeekIso(DateTime.now().setZone(timezone).startOf("day"));
    const currentWeek = groceryState.weekStates[weekOf] || { checkedKeys: [], manualItems: [], orderedAt: null };
    groceryState.weekStates[weekOf] = {
      ...currentWeek,
      manualItems: [...currentWeek.manualItems, item],
    };
  }

  const nextDocument = setDocumentValue(document, ["appPreferences", "groceryList"], groceryState);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);

  return intent.weekly
    ? `${item.name} will now show up on your grocery list every week.`
    : groceryState.weekStates[startOfWeekIso(DateTime.now().setZone(timezone).startOf("day"))]?.orderedAt
      ? `${item.name} is now on your next grocery list.`
      : `${item.name} is now on this week’s grocery list.`;
}

async function removeGroceryItemBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  intent: GroceryRemoveIntent,
): Promise<string> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const groceryState = normalizeGroceryState(getDocumentValue(document, ["appPreferences", "groceryList"]));
  const weekOf = startOfWeekIso(DateTime.now().setZone(timezone).startOf("day"));
  const currentWeek = groceryState.weekStates[weekOf] || { checkedKeys: [], manualItems: [], orderedAt: null };

  const recurringBefore = groceryState.recurringItems.length;
  groceryState.recurringItems = groceryState.recurringItems.filter((item) => !groceryItemMatchesName(item.name, intent.name));
  const currentBefore = currentWeek.manualItems.length;
  const nextWeekState: GroceryWeekState = {
    ...currentWeek,
    manualItems: currentWeek.manualItems.filter((item) => !groceryItemMatchesName(item.name, intent.name)),
  };
  groceryState.weekStates[weekOf] = nextWeekState;

  const removedCount = (recurringBefore - groceryState.recurringItems.length) + (currentBefore - nextWeekState.manualItems.length);
  if (removedCount === 0) {
    return `I couldn't find ${intent.name} on your grocery list.`;
  }

  const nextDocument = setDocumentValue(document, ["appPreferences", "groceryList"], groceryState);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);
  return `Removed ${titleCaseWords(intent.name.toLowerCase())} from your grocery list.`;
}

async function updateGroceryOrderBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  action: "ordered" | "not_ordered",
): Promise<string> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const groceryState = normalizeGroceryState(getDocumentValue(document, ["appPreferences", "groceryList"]));
  const weekOf = startOfWeekIso(DateTime.now().setZone(timezone).startOf("day"));
  const currentWeek = groceryState.weekStates[weekOf] || { checkedKeys: [], manualItems: [], orderedAt: null };
  groceryState.weekStates[weekOf] = {
    ...currentWeek,
    checkedKeys: action === "ordered" ? currentWeek.checkedKeys : [],
    manualItems: action === "ordered" ? [] : currentWeek.manualItems,
    orderedAt: action === "ordered" ? new Date().toISOString() : null,
  };
  const nextDocument = setDocumentValue(document, ["appPreferences", "groceryList"], groceryState);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);
  return action === "ordered"
    ? "Marked groceries ordered. Your finished order is cleared and new items will go onto your next list."
    : "Marked groceries not ordered. Your current grocery list is open again.";
}

async function buildGroceryListReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
): Promise<string> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const groceryState = normalizeGroceryState(getDocumentValue(document, ["appPreferences", "groceryList"]));
  const weekOf = startOfWeekIso(DateTime.now().setZone(timezone).startOf("day"));
  const currentWeek = groceryState.weekStates[weekOf] || { checkedKeys: [], manualItems: [], orderedAt: null };

  const names = [
    ...groceryState.recurringItems.map((item) => item.name),
    ...currentWeek.manualItems.map((item) => item.name),
  ];
  const uniqueNames = [...new Set(names)].filter(Boolean);
  if (!uniqueNames.length) {
    return currentWeek.orderedAt
      ? "Your current grocery order is marked done. Only new items or weekly staples will show for the next order."
      : "Your grocery list is empty right now.";
  }
  const preview = uniqueNames.slice(0, 10).join(", ");
  const more = uniqueNames.length > 10 ? `, +${uniqueNames.length - 10} more` : "";
  return `Your grocery list has ${uniqueNames.length} items: ${preview}${more}.`;
}

function taskOccursOnDate(task: StoredTask, date: DateTime): boolean {
  const target = date.startOf("day");
  const dueDate = task.dueDate ? DateTime.fromISO(task.dueDate, { zone: date.zoneName }).startOf("day") : null;
  const anchor = dueDate?.isValid ? dueDate : DateTime.fromISO(task.createdAt, { zone: date.zoneName }).startOf("day");
  if (!anchor.isValid || target < anchor) return false;

  if (task.frequency === "once") {
    return !!dueDate?.isValid && dueDate.toISODate() === target.toISODate();
  }
  if (task.frequency === "daily") return true;
  if (task.frequency === "weekly") {
    const targetDay = DAY_NAME_BY_WEEKDAY[target.weekday];
    const weeklyDay = task.day || DAY_NAME_BY_WEEKDAY[anchor.weekday];
    return weeklyDay === targetDay;
  }

  return false;
}

async function addTaskBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  intent: TaskAddIntent,
): Promise<string> {
  const { document, fullName } = await loadProfileSettingsContext(supabase, userId);
  const tasks = normalizeStoredTasks(getDocumentValue(document, ["appPreferences", "tasks"]));
  const profiles = macroProfilesFromDocument(document, { accountFullName: fullName });
  const person = intent.personName ? resolvePersonByName(profiles, intent.personName) : null;
  if (intent.personName && !person) {
    return `I couldn't find ${intent.personName}. Reply with the exact dashboard name, like Ken or Katie.`;
  }

  tasks.push({
    id: `task-${crypto.randomUUID()}`,
    title: intent.title,
    type: "do",
    status: "not_started",
    frequency: "once",
    assignedToId: person?.id,
    assignedToName: person?.name,
    dueDate: intent.dueDate,
    reminderEnabled: Boolean(intent.reminderTime),
    reminderTime: intent.reminderTime,
    createdAt: new Date().toISOString(),
  });

  const nextDocument = setDocumentValue(document, ["appPreferences", "tasks"], tasks);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);

  const details: string[] = [];
  if (person?.name) details.push(`for ${person.name}`);
  if (intent.dueDate) {
    const parsedDate = DateTime.fromISO(intent.dueDate, { zone: timezone });
    if (parsedDate.isValid) details.push(`on ${parsedDate.toFormat("LLL d")}`);
  }
  if (intent.reminderTime && intent.dueDate) {
    const parsedDate = DateTime.fromISO(intent.dueDate, { zone: timezone });
    const parsedTime = parseTimeForZone(intent.reminderTime, parsedDate.isValid ? parsedDate : DateTime.now().setZone(timezone), timezone);
    if (parsedTime) details.push(`at ${parsedTime.toFormat("h:mm a")}`);
  }

  return `Added task ${intent.title}${details.length ? ` ${details.join(" ")}` : ""}.`;
}

async function completeTaskBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  intent: TaskCompleteIntent,
): Promise<string> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const tasks = normalizeStoredTasks(getDocumentValue(document, ["appPreferences", "tasks"]));
  const normalizedTitle = normalizeToken(intent.title);
  if (!normalizedTitle) return "I couldn't tell which task to complete.";

  const matches = tasks.filter((task) => normalizeToken(task.title).includes(normalizedTitle) || normalizedTitle.includes(normalizeToken(task.title)));
  if (!matches.length) return `I couldn't find a task named ${intent.title}.`;
  if (matches.length > 1) {
    return `I found a few tasks that could match ${intent.title}: ${matches.slice(0, 3).map((task) => task.title).join(", ")}. Reply with the exact task name.`;
  }

  const target = matches[0];
  const nextTasks = tasks.map((task) => task.id === target.id ? { ...task, status: "done" as const } : task);
  const nextDocument = setDocumentValue(document, ["appPreferences", "tasks"], nextTasks);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);
  return `Marked ${target.title} done.`;
}

async function buildOpenTasksReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
): Promise<string> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const tasks = normalizeStoredTasks(getDocumentValue(document, ["appPreferences", "tasks"]));
  const today = DateTime.now().setZone(timezone).startOf("day");
  const openTasks = tasks.filter((task) => task.status !== "done" && taskOccursOnDate(task, today));
  if (!openTasks.length) return "You have no open tasks for today.";
  const preview = openTasks.slice(0, 6).map((task) => task.title).join(", ");
  const more = openTasks.length > 6 ? `, +${openTasks.length - 6} more` : "";
  return `Open tasks for today: ${preview}${more}.`;
}

async function addWaterLogBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  personId: string,
  ounces: number,
): Promise<void> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const activity = normalizeMacroActivityState(getDocumentValue(document, ["appPreferences", "macroGame", "activity"]));
  const dateKey = DateTime.now().setZone(timezone).toISODate() || "";
  const dayTrackers = activity.trackers[dateKey] || {};
  const current = dayTrackers[personId] || { waterOz: 0, alcoholDrinks: 0 };
  activity.trackers[dateKey] = {
    ...dayTrackers,
    [personId]: {
      ...current,
      waterOz: Math.max(0, current.waterOz + ounces),
    },
  };

  const nextDocument = setDocumentValue(document, ["appPreferences", "macroGame", "activity"], activity);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);
}

async function addMealLogBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  personId: string,
  recipe: RecipeLookupRow,
  servings: number,
): Promise<{ logId: string }> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const activity = normalizeMacroActivityState(getDocumentValue(document, ["appPreferences", "macroGame", "activity"]));
  const dateKey = DateTime.now().setZone(timezone).toISODate() || "";
  const logId = crypto.randomUUID();
  activity.mealLogs.push({
    id: logId,
    recipeId: recipe.id,
    recipeName: recipe.name,
    date: dateKey,
    person: personId,
    servings,
    macros: {
      calories: Math.round((recipe.calories || 0) * servings),
      protein_g: Math.round((recipe.protein_g || 0) * servings),
      carbs_g: Math.round((recipe.carbs_g || 0) * servings),
      fat_g: Math.round((recipe.fat_g || 0) * servings),
      ...(Number.isFinite(Number(recipe.fiber_g)) ? { fiber_g: Math.round(Number(recipe.fiber_g || 0) * servings) } : {}),
    },
    isQuickAdd: false,
    createdAt: new Date().toISOString(),
  });

  const nextDocument = setDocumentValue(document, ["appPreferences", "macroGame", "activity"], activity);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);
  return { logId };
}

function mostRecentAssistantSubject(context: SmsAssistantContext, timezone: string): "meal" | "calendar" | null {
  const calendarAt = context.lastCalendarEvent?.updatedAt
    ? DateTime.fromISO(context.lastCalendarEvent.updatedAt, { zone: timezone })
    : null;
  const mealAt = context.lastMealLog?.updatedAt
    ? DateTime.fromISO(context.lastMealLog.updatedAt, { zone: timezone })
    : null;

  const validCalendarAt = calendarAt?.isValid ? calendarAt : null;
  const validMealAt = mealAt?.isValid ? mealAt : null;
  if (!validCalendarAt && !validMealAt) return null;
  if (!validCalendarAt) return "meal";
  if (!validMealAt) return "calendar";
  return validMealAt >= validCalendarAt ? "meal" : "calendar";
}

async function updateRecentMealLogBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  context: SmsAssistantContext,
  intent: MealFollowUpIntent,
): Promise<string | null> {
  const lastMeal = context.lastMealLog;
  if (!lastMeal?.logId) return null;

  const updatedAt = DateTime.fromISO(lastMeal.updatedAt, { zone: timezone });
  if (!updatedAt.isValid || updatedAt < DateTime.now().setZone(timezone).minus({ hours: 24 })) {
    return null;
  }

  const document = await loadProfileSettingsDocument(supabase, userId);
  const activity = normalizeMacroActivityState(getDocumentValue(document, ["appPreferences", "macroGame", "activity"]));
  const targetIndex = activity.mealLogs.findIndex((log) => log.id === lastMeal.logId);
  if (targetIndex < 0) return null;

  if (intent.deleteLog) {
    activity.mealLogs.splice(targetIndex, 1);
    const nextDocument = setDocumentValue(document, ["appPreferences", "macroGame", "activity"], activity);
    await saveProfileSettingsDocument(supabase, userId, nextDocument);
    return `Deleted ${lastMeal.title} for ${lastMeal.personName}.`;
  }

  if (typeof intent.servings === "number" && intent.servings > 0) {
    const current = activity.mealLogs[targetIndex];
    const currentServings = Number(current.servings) > 0 ? Number(current.servings) : lastMeal.servings || 1;
    const scale = intent.servings / currentServings;
    activity.mealLogs[targetIndex] = {
      ...current,
      servings: intent.servings,
      macros: {
        calories: Math.round((current.macros.calories || 0) * scale),
        protein_g: Math.round((current.macros.protein_g || 0) * scale),
        carbs_g: Math.round((current.macros.carbs_g || 0) * scale),
        fat_g: Math.round((current.macros.fat_g || 0) * scale),
        ...(typeof current.macros.fiber_g === "number"
          ? { fiber_g: Math.round(current.macros.fiber_g * scale) }
          : {}),
      },
    };
    const nextDocument = setDocumentValue(document, ["appPreferences", "macroGame", "activity"], activity);
    await saveProfileSettingsDocument(supabase, userId, nextDocument);
    const servingsLabel = intent.servings === 1 ? "1 serving" : `${intent.servings} servings`;
    return `Updated ${lastMeal.title} to ${servingsLabel} for ${lastMeal.personName}.`;
  }

  return null;
}

async function findRecipeForMealLog(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  recipeName: string,
): Promise<{ recipe: RecipeLookupRow | null; ambiguousMatches: string[] }> {
  const { data, error } = await supabase
    .from("recipes")
    .select("id,name,calories,protein_g,carbs_g,fat_g,fiber_g")
    .eq("owner_id", userId);
  if (error) throw error;

  const recipes = (data || []) as RecipeLookupRow[];
  const normalizedQuery = normalizeToken(recipeName);
  if (!normalizedQuery) return { recipe: null, ambiguousMatches: [] };

  const exact = recipes.filter((recipe) => normalizeToken(recipe.name) === normalizedQuery);
  if (exact.length === 1) return { recipe: exact[0], ambiguousMatches: [] };
  if (exact.length > 1) return { recipe: null, ambiguousMatches: exact.slice(0, 3).map((item) => item.name) };

  const contains = recipes.filter((recipe) => normalizeToken(recipe.name).includes(normalizedQuery));
  if (contains.length === 1) return { recipe: contains[0], ambiguousMatches: [] };
  if (contains.length > 1) return { recipe: null, ambiguousMatches: contains.slice(0, 3).map((item) => item.name) };

  const reverseContains = recipes.filter((recipe) => normalizedQuery.includes(normalizeToken(recipe.name)));
  if (reverseContains.length === 1) return { recipe: reverseContains[0], ambiguousMatches: [] };
  if (reverseContains.length > 1) {
    return { recipe: null, ambiguousMatches: reverseContains.slice(0, 3).map((item) => item.name) };
  }

  return { recipe: null, ambiguousMatches: [] };
}

async function findSmsPreferenceForInboundNumber(
  supabase: ReturnType<typeof createClient>,
  from: string,
): Promise<InboundSmsPreferenceRow | null> {
  const normalizedFrom = normalizePhone(from);
  if (!normalizedFrom) return null;

  const { data: candidates, error: candidateError } = await supabase
    .from("sms_preferences")
    .select("user_id,enabled,timezone,preferred_dinner_time,include_modules,module_recipients,phone_e164,updated_at")
    .eq("enabled", true);
  if (candidateError) throw candidateError;

  const allRows = (candidates || []) as InboundSmsPreferenceRow[];
  const exactMatches = allRows.filter((row) => normalizePhone(String(row.phone_e164 || "")) === normalizedFrom);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    const preferredOwner = await findPreferredInboundSmsOwner(supabase, exactMatches, normalizedFrom);
    if (preferredOwner) {
      const owned = exactMatches.find((row) => row.user_id === preferredOwner);
      if (owned) return owned;
    }
    return sortPreferenceRowsByUpdatedAt(exactMatches)[0];
  }

  const matches = allRows.filter((row) => {
    const primary = normalizePhone(String(row.phone_e164 || ""));
    if (primary === normalizedFrom) return true;
    const moduleRecipients = normalizeRecipientMap(row.module_recipients);
    return Object.values(moduleRecipients).some((numbers) => numbers.includes(normalizedFrom));
  });

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const preferredOwner = await findPreferredInboundSmsOwner(supabase, matches, normalizedFrom);
  if (preferredOwner) {
    const owned = matches.find((row) => row.user_id === preferredOwner);
    if (owned) return owned;
  }

  const ownershipRows = sortPreferenceRowsByUpdatedAt(allRows);
  const ownerByRecipient = new Map<string, string>();
  for (const row of ownershipRows.reverse()) {
    const includeModules = Array.isArray(row.include_modules)
      ? row.include_modules.map((value) => String(value).toLowerCase())
      : [];
    const recipients = recipientListForModules(
      includeModules,
      normalizeRecipientMap(row.module_recipients),
      row.phone_e164 || null,
    )
      .map((item) => normalizePhone(String(item || "")))
      .filter(Boolean);
    for (const recipient of recipients) {
      ownerByRecipient.set(recipient, row.user_id);
    }
  }

  const ownedMatch = matches.find((row) => ownerByRecipient.get(normalizedFrom) === row.user_id);
  if (ownedMatch) return ownedMatch;
  return sortPreferenceRowsByUpdatedAt(matches)[0];
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

async function buildTonightDinnerReply(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  preferredDinnerTime: string,
): Promise<string> {
  const today = DateTime.now().setZone(timezone).startOf("day");
  const weekOf = weekOfIso(today);
  const day = DAY_NAME_BY_WEEKDAY[today.weekday];
  const { data, error } = await supabase
    .from("planned_meals")
    .select("id, recipes(name)")
    .eq("owner_id", userId)
    .eq("week_of", weekOf)
    .eq("day", day)
    .eq("is_skipped", false);

  if (error) throw error;

  const dinnerNames = (data || [])
    .map((row) =>
      typeof row.recipes === "object" && row.recipes && "name" in row.recipes
        ? String((row.recipes as { name?: string }).name || "").trim()
        : "",
    )
    .filter(Boolean);

  if (!dinnerNames.length) {
    return "No dinner is planned for tonight yet.";
  }

  const dinnerTime = DateTime.fromISO(`${today.toISODate()}T00:00:00`, { zone: timezone }).set(parseTimeToHourMinute(preferredDinnerTime));
  const names = dinnerNames.join(" and ");
  return dinnerNames.length === 1
    ? `Tonight's dinner is ${names} at ${timeLabel(dinnerTime)}.`
    : `Tonight's dinners are ${names} at ${timeLabel(dinnerTime)}.`;
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

    const pref = await findSmsPreferenceForInboundNumber(supabase, from);

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
        "Home Harmony commands:\n- add dentist appt for family at 9:00 AM on 4/6\n- text a screenshot with 'add this to calendar'\n- then follow up with 'change it to Katie calendar', 'remind me 45 min before', 'move it to tomorrow at 3 PM', 'make it all day', or 'delete that'\n- add milk to grocery list\n- remove milk from grocery list\n- mark groceries ordered\n- undo grocery order\n- what's on the grocery list\n- add task take trash to road for Ken tomorrow at 6 PM\n- mark take trash to road done\n- what tasks are open today\n- add water log to ken drank 32 oz\n- log air fryer orange chicken for ken\n- add ken's morning smoothie and ken's greek yogurt fruit bowl to ken's meal log for breakfast this morning\n- then follow up with 'change that to 2 servings' or 'delete that meal'\n- What do I have tomorrow?\n- What meals do we have this week?\n- Run meals for next week\nReply STOP to pause or START to resume.",
      );
    }

    const timezone = String(pref.timezone || "America/New_York");
    const includeModules = Array.isArray(pref.include_modules)
      ? pref.include_modules.map((value: unknown) => String(value).toLowerCase())
      : ["meals", "manual"];
    const preferredDinnerTime = String(pref.preferred_dinner_time || "18:00").slice(0, 5);
    const numMedia = Number.parseInt(params.get("NumMedia") || "0", 10);
    const mediaUrl = params.get("MediaUrl0")?.trim() || "";
    const mediaContentType = params.get("MediaContentType0")?.trim() || "";

    await logUsageCostEvent({
      userId: pref.user_id,
      category: "sms",
      provider: "twilio",
      meter: Number.isFinite(numMedia) && numMedia > 0 ? "inbound_mms" : "inbound_sms",
      estimatedCostUsd: estimateInboundTextCostUsd(body, Number.isFinite(numMedia) ? numMedia : 0),
      quantity: 1,
      metadata: {
        from: normalizePhone(from),
        mediaCount: Number.isFinite(numMedia) ? numMedia : 0,
        bodyLength: body.length,
      },
    });

    if (Number.isFinite(numMedia) && numMedia > 0) {
      if (!mediaUrl || !mediaContentType.toLowerCase().startsWith("image/")) {
        return twiml("I can only read image screenshots right now. Send an image and say 'add this to calendar'.");
      }

      try {
        const fileName = `calendar-screenshot.${extensionForImageContentType(mediaContentType)}`;
        const imageDataUrl = await fetchTwilioImageAsDataUrl(mediaUrl, mediaContentType);
        const { intent, clarification } = await parseCalendarScreenshotIntent(imageDataUrl, fileName, timezone, pref.user_id);
        if (clarification) {
          return twiml(clarification);
        }
        if (!intent) {
          return twiml("I couldn't pull one clear event from that screenshot. Try a tighter screenshot of the event details.");
        }

        const { document, context } = await loadSmsAssistantContext(supabase, pref.user_id);
        const result = await addCalendarEventBySms(supabase, pref.user_id, timezone, intent);
        await saveSmsAssistantContext(supabase, pref.user_id, document, {
          ...context,
          lastCalendarEvent: {
            eventId: result.eventId,
            title: intent.title,
            updatedAt: new Date().toISOString(),
          },
        });
        return twiml(result.reply);
      } catch (error) {
        console.error("sms screenshot calendar add failed:", error);
        const detail = describeUnknownError(error);
        return twiml(`I could not read that screenshot right now: ${detail}`);
      }
    }

    const waterIntent = parseWaterLogIntent(body);
    if (waterIntent) {
      try {
        const { document, fullName } = await loadProfileSettingsContext(supabase, pref.user_id);
        const profiles = macroProfilesFromDocument(document, { accountFullName: fullName });
        const person = resolvePersonByName(profiles, waterIntent.personName);
        if (!person) {
          return twiml(`I couldn't find ${waterIntent.personName}. Reply with the exact dashboard name, like Ken or Katie.`);
        }

        await addWaterLogBySms(supabase, pref.user_id, timezone, person.id, waterIntent.ounces);
        return twiml(`Logged ${waterIntent.ounces} oz of water for ${person.name}.`);
      } catch (error) {
        console.error("sms water log failed:", error);
        return twiml("I could not save that water log right now. Please try again in a moment.");
      }
    }

    const taskAddIntent = parseTaskAddIntent(body, timezone);
    if (taskAddIntent) {
      try {
        const reply = await addTaskBySms(supabase, pref.user_id, timezone, taskAddIntent);
        return twiml(reply);
      } catch (error) {
        console.error("sms task add failed:", error);
        return twiml("I could not add that task right now. Please try again in a moment.");
      }
    }

    const taskCompleteIntent = parseTaskCompleteIntent(body);
    if (taskCompleteIntent) {
      try {
        const reply = await completeTaskBySms(supabase, pref.user_id, taskCompleteIntent);
        return twiml(reply);
      } catch (error) {
        console.error("sms task complete failed:", error);
        return twiml("I could not update that task right now. Please try again in a moment.");
      }
    }

    if (asksForOpenTasks(body)) {
      try {
        const reply = await buildOpenTasksReply(supabase, pref.user_id, timezone);
        return twiml(reply);
      } catch (error) {
        console.error("sms task reply failed:", error);
        return twiml("I could not read your tasks right now. Please try again in a moment.");
      }
    }

    const mealLogIntents = parseNaturalMealLogIntents(body) || (() => {
      const singleIntent = parseMealLogIntent(body);
      return singleIntent ? [singleIntent] : null;
    })();
    if (mealLogIntents && mealLogIntents.length) {
      try {
        const { document, fullName } = await loadProfileSettingsContext(supabase, pref.user_id);
        const profiles = macroProfilesFromDocument(document, { accountFullName: fullName });
        const person = resolvePersonByName(profiles, mealLogIntents[0].personName);
        if (!person) {
          return twiml(`I couldn't find ${mealLogIntents[0].personName}. Reply with the exact dashboard name, like Ken or Katie.`);
        }

        const loggedLabels: string[] = [];
        let lastLoggedMealContext: SmsAssistantContext["lastMealLog"] = null;
        for (const mealLogIntent of mealLogIntents) {
          const { recipe, ambiguousMatches } = await findRecipeForMealLog(supabase, pref.user_id, mealLogIntent.recipeName);
          if (!recipe && ambiguousMatches.length > 0) {
            return twiml(`I found a few recipes that could match ${mealLogIntent.recipeName}: ${ambiguousMatches.join(", ")}. Reply with the exact recipe name to log it.`);
          }
          if (!recipe) {
            return twiml(`I couldn't find a saved recipe named ${mealLogIntent.recipeName}. It has to already be in your recipe library before I can log it.`);
          }

          const { logId } = await addMealLogBySms(supabase, pref.user_id, timezone, person.id, recipe, mealLogIntent.servings);
          const servingsLabel = mealLogIntent.servings === 1 ? "1 serving" : `${mealLogIntent.servings} servings`;
          loggedLabels.push(`${servingsLabel} of ${recipe.name}`);
          lastLoggedMealContext = {
            logId,
            title: recipe.name,
            personId: person.id,
            personName: person.name,
            servings: mealLogIntent.servings,
            updatedAt: new Date().toISOString(),
          };
        }

        if (lastLoggedMealContext) {
          const latestDocument = await loadProfileSettingsDocument(supabase, pref.user_id);
          await saveSmsAssistantContext(supabase, pref.user_id, latestDocument, {
            ...normalizeSmsAssistantContext(getDocumentValue(latestDocument, ["appPreferences", "smsAssistant"])),
            lastMealLog: lastLoggedMealContext,
          });
        }

        return twiml(`Logged ${loggedLabels.join(" and ")} for ${person.name}.`);
      } catch (error) {
        console.error("sms meal log failed:", error);
        return twiml("I could not save that meal log right now. Please try again in a moment.");
      }
    }

    const groceryRemoveIntent = parseGroceryRemoveIntent(body);
    if (groceryRemoveIntent) {
      try {
        const reply = await removeGroceryItemBySms(supabase, pref.user_id, timezone, groceryRemoveIntent);
        return twiml(reply);
      } catch (error) {
        console.error("sms grocery remove failed:", error);
        return twiml("I could not remove that grocery item right now. Please try again in a moment.");
      }
    }

    const groceryOrderAction = groceryOrderIntent(body);
    if (groceryOrderAction) {
      try {
        const reply = await updateGroceryOrderBySms(supabase, pref.user_id, timezone, groceryOrderAction);
        return twiml(reply);
      } catch (error) {
        console.error("sms grocery order update failed:", error);
        return twiml("I could not update your grocery order status right now. Please try again in a moment.");
      }
    }

    if (asksForGroceryList(body)) {
      try {
        const reply = await buildGroceryListReply(supabase, pref.user_id, timezone);
        return twiml(reply);
      } catch (error) {
        console.error("sms grocery list reply failed:", error);
        return twiml("I could not read your grocery list right now. Please try again in a moment.");
      }
    }

    const groceryIntent = parseGroceryAddIntent(body);
    if (groceryIntent) {
      try {
        const reply = await addGroceryItemBySms(supabase, pref.user_id, timezone, groceryIntent);
        return twiml(reply);
      } catch (error) {
        console.error("sms grocery add failed:", error);
        return twiml("I could not add that grocery item right now. Please try again in a moment.");
      }
    }

    const mealFollowUpIntent = parseMealFollowUpIntent(body);
    if (mealFollowUpIntent) {
      try {
        const { context } = await loadSmsAssistantContext(supabase, pref.user_id);
        const recentSubject = mostRecentAssistantSubject(context, timezone);
        if (!mealFollowUpIntent.genericDelete || recentSubject === "meal") {
          const reply = await updateRecentMealLogBySms(supabase, pref.user_id, timezone, context, mealFollowUpIntent);
          if (reply) {
            const latestDocument = await loadProfileSettingsDocument(supabase, pref.user_id);
            await saveSmsAssistantContext(supabase, pref.user_id, latestDocument, {
              ...context,
              lastMealLog: mealFollowUpIntent.deleteLog
                ? null
                : context.lastMealLog
                  ? {
                      ...context.lastMealLog,
                      servings: mealFollowUpIntent.servings ?? context.lastMealLog.servings,
                      updatedAt: new Date().toISOString(),
                    }
                  : null,
            });
            return twiml(reply);
          }
        }
      } catch (error) {
        console.error("sms meal follow-up failed:", error);
        return twiml("I could not update that meal log right now. Please try again in a moment.");
      }
    }

    const calendarIntent = parseCalendarAddIntent(body, timezone);
    if (calendarIntent) {
      try {
        const { document, context } = await loadSmsAssistantContext(supabase, pref.user_id);
        const result = await addCalendarEventBySms(supabase, pref.user_id, timezone, calendarIntent);
        await saveSmsAssistantContext(supabase, pref.user_id, document, {
          ...context,
          lastCalendarEvent: {
            eventId: result.eventId,
            title: calendarIntent.title,
            updatedAt: new Date().toISOString(),
          },
        });
        return twiml(result.reply);
      } catch (error) {
        console.error("sms calendar add failed:", error);
        const detail = describeUnknownError(error);
        return twiml(`I could not add that calendar event right now: ${detail}`);
      }
    }

    const followUpIntent = parseCalendarFollowUpIntent(body, timezone);
    if (followUpIntent) {
      try {
        const { document, context } = await loadSmsAssistantContext(supabase, pref.user_id);
        const recentSubject = mostRecentAssistantSubject(context, timezone);
        if (followUpIntent.deleteEvent && recentSubject === "meal") {
          return twiml("If you meant the meal you just logged, reply 'delete that meal'.");
        }
        const reply = await updateRecentCalendarEventBySms(supabase, pref.user_id, timezone, context, followUpIntent);
        if (!reply) {
          return twiml("I don't have a recent calendar event to update. Add or screenshot an event first, then send the follow-up change.");
        }
        await saveSmsAssistantContext(supabase, pref.user_id, document, {
          ...context,
          lastCalendarEvent: followUpIntent.deleteEvent
            ? null
            : context.lastCalendarEvent
              ? {
                  ...context.lastCalendarEvent,
                  updatedAt: new Date().toISOString(),
                }
              : null,
        });
        return twiml(reply);
      } catch (error) {
        console.error("sms calendar follow-up failed:", error);
        const detail = describeUnknownError(error);
        return twiml(`I could not update that calendar event right now: ${detail}`);
      }
    }

    const wantsTomorrow = hasAnyKeyword(body, ["tomorrow"]);
    const wantsToday = hasAnyKeyword(body, ["today"]);
    const wantsTonight = hasAnyKeyword(body, ["tonight"]);
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

    if (asksMeals && (wantsTonight || body.includes("for dinner"))) {
      const reply = await buildTonightDinnerReply(supabase, pref.user_id, timezone, preferredDinnerTime);
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
    const detail = describeUnknownError(error);
    return twiml(`I hit an error while processing that text: ${detail}`);
  }
});
