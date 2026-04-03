import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime } from "npm:luxon@3.6.1";
import { normalizePhone, verifyTwilioSignature } from "../_shared/twilio.ts";

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

type MacroProfile = {
  id: string;
  name: string;
  memberType?: string;
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
};

type GroceryAddIntent = {
  name: string;
  quantity: string;
  weekly: boolean;
};

type WaterLogIntent = {
  personName: string;
  ounces: number;
};

type MealLogIntent = {
  personName: string;
  recipeName: string;
  servings: number;
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

function macroProfilesFromDocument(document: Record<string, unknown>): MacroProfile[] {
  const raw = getDocumentValue(document, ["appPreferences", "macroGame", "profiles"]);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];

  return Object.entries(raw as Record<string, unknown>)
    .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
    .map(([id, value]) => {
      const row = value as Record<string, unknown>;
      return {
        id,
        name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : titleCaseWords(id),
        memberType: typeof row.memberType === "string" ? row.memberType : undefined,
      };
    });
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
    };
    return weeks;
  }, {});

  return {
    recurringItems,
    weekStates,
  };
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

function parseCalendarAddIntent(body: string, timezone: string): CalendarAddIntent | null {
  const normalized = trimTrailingPunctuation(body);
  const patterns = [
    /^add\s+(.+?)\s+for\s+(.+?)\s+at\s+(.+?)\s+on\s+(.+)$/i,
    /^add\s+(.+?)\s+for\s+(.+?)\s+on\s+(.+?)\s+at\s+(.+)$/i,
    /^add\s+(.+?)\s+for\s+(.+?)\s+(today|tomorrow)\s+at\s+(.+)$/i,
    /^add\s+(.+?)\s+for\s+(.+?)\s+on\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) continue;

    const title = trimTrailingPunctuation(match[1] || "");
    const layer = normalizeCalendarLayerName(match[2] || "");
    const third = trimTrailingPunctuation(match[3] || "");
    const fourth = trimTrailingPunctuation(match[4] || "");
    if (!title || !layer) return null;

    let dateText = third;
    let timeText = fourth;
    if (pattern === patterns[0] || pattern === patterns[2]) {
      dateText = fourth;
      timeText = third;
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
  if (!/^add\s+/i.test(normalized) || !/\bto\s+(?:the\s+)?grocery(?:\s+list)?\b/i.test(normalized)) {
    return null;
  }

  const weekly = /\b(?:every week|weekly)\b/i.test(normalized);
  const name = normalized
    .replace(/^add\s+/i, "")
    .replace(/\b(?:every week|weekly)\b/gi, "")
    .replace(/\s+to\s+(?:the\s+)?grocery(?:\s+list)?$/i, "")
    .trim()
    .replace(/\s+/g, " ");

  if (!name) return null;
  return {
    name,
    quantity: "1x",
    weekly,
  };
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

function resolvePersonByName(
  profiles: MacroProfile[],
  requestedName: string,
): MacroProfile | null {
  const normalized = normalizeEntityName(requestedName);
  if (!normalized) return null;

  const direct = profiles.find((profile) => normalizeEntityName(profile.name) === normalized || normalizeEntityName(profile.id) === normalized);
  if (direct) return direct;

  const fuzzy = profiles.filter((profile) => {
    const profileName = normalizeEntityName(profile.name);
    const profileId = normalizeEntityName(profile.id);
    return profileName.includes(normalized) || normalized.includes(profileName) || profileId.includes(normalized);
  });

  return fuzzy.length === 1 ? fuzzy[0] : null;
}

async function addCalendarEventBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  intent: CalendarAddIntent,
): Promise<string> {
  const payload: Record<string, unknown> = {
    id: crypto.randomUUID(),
    owner_id: userId,
    title: intent.title,
    description: null,
    location_text: null,
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

  const { error } = await supabase.from("calendar_events").insert(payload);
  if (error) throw error;

  const localStart = DateTime.fromISO(intent.startsAt, { zone: "utc" }).setZone(timezone);
  const whenText = intent.allDay ? localStart.toFormat("LLL d") : localStart.toFormat("LLL d 'at' h:mm a");
  return `Added ${intent.title} to ${intent.layer} for ${whenText}.`;
}

async function addGroceryItemBySms(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  intent: GroceryAddIntent,
): Promise<string> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const groceryState = normalizeGroceryState(getDocumentValue(document, ["appPreferences", "groceryList"]));
  const item: GroceryManualItem = {
    id: crypto.randomUUID(),
    name: intent.name,
    quantity: intent.quantity,
    category: guessGroceryCategory(intent.name),
    createdAt: new Date().toISOString(),
  };

  if (intent.weekly) {
    groceryState.recurringItems = [...groceryState.recurringItems, item];
  } else {
    const weekOf = startOfWeekIso(DateTime.now().setZone(timezone).startOf("day"));
    const currentWeek = groceryState.weekStates[weekOf] || { checkedKeys: [], manualItems: [] };
    groceryState.weekStates[weekOf] = {
      ...currentWeek,
      manualItems: [...currentWeek.manualItems, item],
    };
  }

  const nextDocument = setDocumentValue(document, ["appPreferences", "groceryList"], groceryState);
  await saveProfileSettingsDocument(supabase, userId, nextDocument);

  return intent.weekly
    ? `${intent.name} will now show up on your grocery list every week.`
    : `${intent.name} is now on this week’s grocery list.`;
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
): Promise<void> {
  const document = await loadProfileSettingsDocument(supabase, userId);
  const activity = normalizeMacroActivityState(getDocumentValue(document, ["appPreferences", "macroGame", "activity"]));
  const dateKey = DateTime.now().setZone(timezone).toISODate() || "";
  activity.mealLogs.push({
    id: crypto.randomUUID(),
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

  const { data: directData, error: directError } = await supabase
    .from("sms_preferences")
    .select("user_id,enabled,timezone,preferred_dinner_time,include_modules,module_recipients,phone_e164")
    .eq("phone_e164", normalizedFrom)
    .maybeSingle();
  if (directError) throw directError;
  if (directData) return directData as InboundSmsPreferenceRow;

  const { data: candidates, error: candidateError } = await supabase
    .from("sms_preferences")
    .select("user_id,enabled,timezone,preferred_dinner_time,include_modules,module_recipients,phone_e164")
    .eq("enabled", true);
  if (candidateError) throw candidateError;

  const matches = ((candidates || []) as InboundSmsPreferenceRow[]).filter((row) => {
    const primary = normalizePhone(String(row.phone_e164 || ""));
    if (primary === normalizedFrom) return true;
    const moduleRecipients = normalizeRecipientMap(row.module_recipients);
    return Object.values(moduleRecipients).some((numbers) => numbers.includes(normalizedFrom));
  });

  if (matches.length === 1) return matches[0];
  return null;
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
        "Home Harmony commands:\n- add dentist appt for family at 9:00 AM on 4/6\n- add milk to grocery list\n- add water log to ken drank 32 oz\n- log air fryer orange chicken for ken\n- What do I have tomorrow?\n- What meals do we have this week?\n- Run meals for next week\nReply STOP to pause or START to resume.",
      );
    }

    const timezone = String(pref.timezone || "America/New_York");
    const includeModules = Array.isArray(pref.include_modules)
      ? pref.include_modules.map((value: unknown) => String(value).toLowerCase())
      : ["meals", "manual"];
    const preferredDinnerTime = String(pref.preferred_dinner_time || "18:00").slice(0, 5);

    const waterIntent = parseWaterLogIntent(body);
    if (waterIntent) {
      try {
        const document = await loadProfileSettingsDocument(supabase, pref.user_id);
        const profiles = macroProfilesFromDocument(document);
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

    const mealLogIntent = parseMealLogIntent(body);
    if (mealLogIntent) {
      try {
        const document = await loadProfileSettingsDocument(supabase, pref.user_id);
        const profiles = macroProfilesFromDocument(document);
        const person = resolvePersonByName(profiles, mealLogIntent.personName);
        if (!person) {
          return twiml(`I couldn't find ${mealLogIntent.personName}. Reply with the exact dashboard name, like Ken or Katie.`);
        }

        const { recipe, ambiguousMatches } = await findRecipeForMealLog(supabase, pref.user_id, mealLogIntent.recipeName);
        if (!recipe && ambiguousMatches.length > 0) {
          return twiml(`I found a few recipes that could match: ${ambiguousMatches.join(", ")}. Reply with the exact recipe name to log it.`);
        }
        if (!recipe) {
          return twiml(`I couldn't find a saved recipe named ${mealLogIntent.recipeName}. It has to already be in your recipe library before I can log it.`);
        }

        await addMealLogBySms(supabase, pref.user_id, timezone, person.id, recipe, mealLogIntent.servings);
        const servingsLabel = mealLogIntent.servings === 1 ? "1 serving" : `${mealLogIntent.servings} servings`;
        return twiml(`Logged ${servingsLabel} of ${recipe.name} for ${person.name}.`);
      } catch (error) {
        console.error("sms meal log failed:", error);
        return twiml("I could not save that meal log right now. Please try again in a moment.");
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

    const calendarIntent = parseCalendarAddIntent(body, timezone);
    if (calendarIntent) {
      try {
        const reply = await addCalendarEventBySms(supabase, pref.user_id, timezone, calendarIntent);
        return twiml(reply);
      } catch (error) {
        console.error("sms calendar add failed:", error);
        return twiml("I could not add that calendar event right now. Please check the date and time format and try again.");
      }
    }

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
    return twiml("I hit an error while processing that text. Please try again in a moment.");
  }
});
