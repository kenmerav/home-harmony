import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime } from "npm:luxon@3.6.1";
import { corsHeaders, json } from "../_shared/cors.ts";
import { fetchGoogleDriveTrafficEstimate } from "../_shared/traffic.ts";
import { normalizePhone, sendTwilioSms } from "../_shared/twilio.ts";

type CalendarEvent = {
  id: string;
  title: string;
  module: SmsReminderModule;
  locationText?: string | null;
  eventReminderEnabled?: boolean;
  eventReminderLeadMinutes?: number | null;
  travelFromAddress?: string | null;
  travelDurationMinutes?: number | null;
  trafficDurationMinutes?: number | null;
  leaveReminderEnabled?: boolean;
  leaveReminderLeadMinutes?: number | null;
  startsAtUtc: DateTime;
  startsAtLocal: DateTime;
};

type SmsReminderModule = "meals" | "manual" | "tasks" | "chores" | "workouts" | "reminders";
const SMS_REMINDER_MODULES: SmsReminderModule[] = ["meals", "manual", "tasks", "chores", "workouts", "reminders"];
const DIGEST_MODULES: SmsReminderModule[] = [...SMS_REMINDER_MODULES];

type SmsPreferenceRow = {
  user_id: string;
  enabled: boolean;
  phone_e164: string | null;
  home_address: string | null;
  timezone: string;
  morning_digest_enabled: boolean;
  morning_digest_time: string;
  night_before_enabled: boolean;
  night_before_time: string;
  grocery_reminder_enabled: boolean;
  grocery_reminder_day: string;
  grocery_reminder_time: string;
  event_reminders_enabled: boolean;
  reminder_offsets_minutes: number[];
  preferred_dinner_time: string;
  include_modules: string[];
  module_recipients: Record<string, unknown> | null;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  updated_at?: string | null;
};

const DAY_NAME_BY_WEEKDAY: Record<number, string> = {
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
  7: "sunday",
};

const WEEKDAY_BY_NAME: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
};

function parseTimeToMinutes(timeValue: string): number {
  const normalized = String(timeValue).slice(0, 5);
  const [hoursRaw, minutesRaw] = normalized.split(":");
  const hours = Number.parseInt(hoursRaw || "0", 10);
  const minutes = Number.parseInt(minutesRaw || "0", 10);
  return hours * 60 + minutes;
}

function normalizeLeadMinutes(value: unknown, fallback = 10): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(120, Math.round(parsed)));
}

function inQuietHours(nowMinutes: number, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (startMinutes === endMinutes) return false;
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function isDueAt(
  localNow: DateTime,
  hhmm: string,
  windowMinutes: number,
  catchupMinutes = windowMinutes,
): boolean {
  const targetMinutes = parseTimeToMinutes(hhmm);
  const nowMinutes = localNow.hour * 60 + localNow.minute;
  const effectiveWindow = Math.max(1, Math.min(windowMinutes, catchupMinutes));
  return nowMinutes >= targetMinutes && nowMinutes < targetMinutes + effectiveWindow;
}

function isDueOnWeekdayAt(
  localNow: DateTime,
  weekdayName: string,
  hhmm: string,
  windowMinutes: number,
  catchupMinutes = windowMinutes,
): boolean {
  const weekday = WEEKDAY_BY_NAME[String(weekdayName || "").trim().toLowerCase()];
  if (!weekday) return false;
  if (localNow.weekday !== weekday) return false;
  return isDueAt(localNow, hhmm, windowMinutes, catchupMinutes);
}

async function insertDedupeLog(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  dedupeKey: string,
  notificationType: string,
  scheduledFor: string,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("sms_notification_log")
    .insert({
      user_id: userId,
      dedupe_key: dedupeKey,
      notification_type: notificationType,
      scheduled_for: scheduledFor,
      status: "pending",
      payload,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return null;
    throw error;
  }
  return data?.id || null;
}

async function markLogStatus(
  supabase: ReturnType<typeof createClient>,
  id: string,
  status: "sent" | "failed" | "skipped",
  providerSid: string | null,
  payloadPatch: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("sms_notification_log")
    .update({
      status,
      provider_message_sid: providerSid,
      payload: payloadPatch,
    })
    .eq("id", id);
  if (error) console.error("Failed to update sms_notification_log:", error.message);
}

function renderDigestText(
  heading: string,
  scheduleDate: DateTime,
  events: CalendarEvent[],
  tz: string,
): string {
  const prefix = `${heading} (${scheduleDate.toFormat("EEE, LLL d")}):`;
  if (!events.length) return `Home Harmony ${prefix} no scheduled events.`;

  const lines = events.slice(0, 6).map((event) => {
    const timeLabel = event.startsAtLocal.toFormat("h:mm a");
    return `- ${timeLabel} ${event.title}`;
  });
  const extraCount = Math.max(0, events.length - lines.length);
  const extra = extraCount > 0 ? `\n+${extraCount} more` : "";
  return `Home Harmony ${prefix}\n${lines.join("\n")}${extra}\n${DateTime.now().setZone(tz).toFormat("ZZZZ")}`;
}

function isUsableDateTime(value: DateTime): boolean {
  return value.isValid && Number.isFinite(value.toMillis());
}

function normalizeIncludeModules(input: unknown): SmsReminderModule[] {
  if (!Array.isArray(input)) return [...SMS_REMINDER_MODULES];
  const allowed = new Set(SMS_REMINDER_MODULES);
  const cleaned = [...new Set(
    input
      .filter((item) => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => allowed.has(item as SmsReminderModule)),
  )] as SmsReminderModule[];
  return cleaned.length ? cleaned : [...SMS_REMINDER_MODULES];
}

function normalizeRecipientMap(input: unknown): Record<SmsReminderModule, string[]> {
  const map: Record<SmsReminderModule, string[]> = {
    meals: [],
    manual: [],
    tasks: [],
    chores: [],
    workouts: [],
    reminders: [],
  };
  if (!input || typeof input !== "object") return map;
  const raw = input as Record<string, unknown>;
  for (const moduleName of SMS_REMINDER_MODULES) {
    const value = raw[moduleName];
    if (!Array.isArray(value)) continue;
    map[moduleName] = [...new Set(
      value
        .filter((entry) => typeof entry === "string")
        .map((entry) => String(entry).trim())
        .filter((entry) => entry.length > 0),
    )];
  }
  return map;
}

function recipientListForModules(
  includeModules: SmsReminderModule[],
  moduleRecipients: Record<SmsReminderModule, string[]>,
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

function recipientListForModule(
  moduleName: SmsReminderModule,
  moduleRecipients: Record<SmsReminderModule, string[]>,
  fallbackRecipients: string[],
): string[] {
  const moduleSpecific = moduleRecipients[moduleName] || [];
  return Array.from(new Set([...moduleSpecific, ...fallbackRecipients]));
}

function buildRecipientOwnershipMap(rows: SmsPreferenceRow[]): Map<string, string> {
  const ownership = new Map<string, { userId: string; updatedAt: number }>();

  for (const row of rows) {
    const updatedAt = DateTime.fromISO(String(row.updated_at || "")).toMillis();
    const sortValue = Number.isFinite(updatedAt) ? updatedAt : 0;
    const recipients = recipientListForModules(
      normalizeIncludeModules(row.include_modules),
      normalizeRecipientMap(row.module_recipients),
      row.phone_e164 || null,
    )
      .map((item) => normalizePhone(String(item || "")))
      .filter((item) => item.length > 0);

    for (const recipient of recipients) {
      const existing = ownership.get(recipient);
      if (!existing || sortValue >= existing.updatedAt) {
        ownership.set(recipient, { userId: row.user_id, updatedAt: sortValue });
      }
    }
  }

  return new Map(Array.from(ownership.entries()).map(([phone, value]) => [phone, value.userId]));
}

function filterRecipientsForOwner(recipients: string[], userId: string, ownership: Map<string, string>): string[] {
  return Array.from(
    new Set(
      recipients.filter((recipient) => {
        const normalized = normalizePhone(String(recipient || ""));
        if (!normalized) return false;
        return ownership.get(normalized) === userId;
      }),
    ),
  );
}

type OnboardingHealthSnapshot = {
  healthTrackingFocus: string[];
  wellnessGoals: string[];
  waterTarget: string | null;
  stepTarget: string | null;
  alcoholTarget: string | null;
  wakeUpTime: string | null;
  sleepDurationTarget: string | null;
};

function parseOnboardingHealthSnapshot(value: unknown): OnboardingHealthSnapshot {
  const settings = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const onboardingRaw =
    settings.onboarding && typeof settings.onboarding === "object"
      ? (settings.onboarding as Record<string, unknown>)
      : settings;
  const listFrom = (field: string): string[] => {
    const raw = onboardingRaw[field];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((entry) => typeof entry === "string")
      .map((entry) => String(entry).trim())
      .filter((entry) => entry.length > 0);
  };
  const textFrom = (field: string): string | null => {
    const raw = onboardingRaw[field];
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  return {
    healthTrackingFocus: listFrom("healthTrackingFocus"),
    wellnessGoals: listFrom("wellnessGoals"),
    waterTarget: textFrom("waterTarget"),
    stepTarget: textFrom("stepTarget"),
    alcoholTarget: textFrom("alcoholTarget"),
    wakeUpTime: textFrom("wakeUpTime"),
    sleepDurationTarget: textFrom("sleepDurationTarget"),
  };
}

function parseSleepDurationHours(value: string | null): number {
  if (!value) return 8;
  const match = value.match(/(\d+)/);
  const parsed = Number.parseInt(match?.[1] || "", 10);
  if (!Number.isFinite(parsed)) return 8;
  return Math.max(6, Math.min(10, parsed));
}

function formatMinutesLocal(value: number): string {
  const normalized = ((Math.round(value) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

function workoutCountThisWeek(state: unknown, timezone: string, localNow: DateTime): number {
  if (!state || typeof state !== "object") return 0;
  const workouts = Array.isArray((state as { workouts?: unknown[] }).workouts)
    ? ((state as { workouts?: unknown[] }).workouts as unknown[])
    : [];
  const weekStart = localNow.startOf("week");
  const weekEnd = weekStart.plus({ days: 7 });
  let count = 0;

  for (const raw of workouts) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    let workoutAt: DateTime | null = null;

    if (typeof row.date === "string" && row.date.trim()) {
      const fromDate = DateTime.fromISO(`${row.date}T00:00:00`, { zone: timezone });
      if (fromDate.isValid) workoutAt = fromDate;
    }

    if (!workoutAt && Number.isFinite(Number(row.startTime))) {
      const fromStart = DateTime.fromMillis(Number(row.startTime), { zone: "utc" }).setZone(timezone);
      if (fromStart.isValid) workoutAt = fromStart;
    }

    if (!workoutAt) continue;
    if (workoutAt >= weekStart && workoutAt < weekEnd) count += 1;
  }

  return count;
}

function buildWellnessNudgeMessage(input: {
  snapshot: OnboardingHealthSnapshot;
  workoutCountWeek: number;
}): string | null {
  const { snapshot, workoutCountWeek } = input;
  const lines: string[] = [];

  const wantsWorkoutTracking =
    snapshot.healthTrackingFocus.includes("Workout tracking") ||
    snapshot.healthTrackingFocus.includes("Goal tracking (water, steps, alcohol)");

  if (wantsWorkoutTracking && workoutCountWeek === 0) {
    lines.push("You have not logged a workout yet this week. A 20-minute session still counts and keeps momentum going.");
  }

  const wantsWater = snapshot.wellnessGoals.includes("Increase water intake");
  if (wantsWater && snapshot.waterTarget && snapshot.waterTarget !== "No target right now") {
    lines.push(`Water check: your target is ${snapshot.waterTarget} today.`);
  }

  const wantsSteps = snapshot.wellnessGoals.includes("Hit a daily step goal");
  if (wantsSteps && snapshot.stepTarget && snapshot.stepTarget !== "No target right now") {
    lines.push(`Step target reminder: aim for ${snapshot.stepTarget} today.`);
  }

  const wantsAlcohol = snapshot.wellnessGoals.includes("Limit alcohol");
  if (wantsAlcohol && snapshot.alcoholTarget && snapshot.alcoholTarget !== "Not tracking") {
    lines.push(`Alcohol goal: ${snapshot.alcoholTarget}.`);
  }

  if (snapshot.wellnessGoals.includes("Improve sleep consistency")) {
    const sleepHours = parseSleepDurationHours(snapshot.sleepDurationTarget);
    if (snapshot.wakeUpTime && /^\d{2}:\d{2}$/.test(snapshot.wakeUpTime)) {
      const wakeMinutes = parseTimeToMinutes(snapshot.wakeUpTime);
      const bedtimeMinutes = wakeMinutes - sleepHours * 60;
      const windDownMinutes = bedtimeMinutes - 60;
      lines.push(
        `Sleep plan: wake at ${formatMinutesLocal(wakeMinutes)}, target bedtime ${formatMinutesLocal(
          bedtimeMinutes,
        )}, wind down by ${formatMinutesLocal(windDownMinutes)}.`,
      );
    } else {
      lines.push("Sleep consistency win: set a wind-down reminder 60 minutes before bed tonight.");
    }
  }

  if (lines.length === 0) return null;
  return `Home Harmony goal check-in: ${lines.slice(0, 3).join(" ")}`;
}

async function fetchDailyEvents(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  localDate: DateTime,
  includeModules: SmsReminderModule[],
  preferredDinnerTime: string,
): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  const dateIso = localDate.toISODate();

  if (includeModules.includes("meals")) {
    const weekOf = localDate.minus({ days: localDate.weekday - 1 }).toISODate();
    const dayName = DAY_NAME_BY_WEEKDAY[localDate.weekday];
    const { data } = await supabase
      .from("planned_meals")
      .select("id, recipes(name)")
      .eq("owner_id", userId)
      .eq("week_of", weekOf)
      .eq("day", dayName)
      .eq("is_skipped", false);

    const [dinnerHour, dinnerMinute] = preferredDinnerTime.slice(0, 5).split(":").map((value) => Number.parseInt(value || "0", 10));
    for (const row of data || []) {
      const mealName =
        typeof row.recipes === "object" && row.recipes && "name" in row.recipes
          ? String((row.recipes as { name?: string }).name || "Dinner")
          : "Dinner";
      const startLocal = DateTime.fromISO(`${dateIso}T00:00:00`, { zone: timezone }).set({
        hour: dinnerHour,
        minute: dinnerMinute,
      });
      events.push({
        id: `meal-${row.id}`,
        title: mealName,
        module: "meals",
        startsAtLocal: startLocal,
        startsAtUtc: startLocal.toUTC(),
      });
    }
  }

  const calendarModules = includeModules.filter((moduleName) => moduleName !== "meals");
  if (calendarModules.length > 0) {
    const dayStartUtc = localDate.startOf("day").toUTC().toISO();
    const dayEndUtc = localDate.plus({ days: 1 }).startOf("day").toUTC().toISO();
    const { data } = await supabase
      .from("calendar_events")
      .select("id,title,module,starts_at,location_text,event_reminder_enabled,event_reminder_lead_minutes,travel_from_address,travel_duration_minutes,traffic_duration_minutes,leave_reminder_enabled,leave_reminder_lead_minutes")
      .eq("owner_id", userId)
      .eq("is_deleted", false)
      .gte("starts_at", dayStartUtc)
      .lt("starts_at", dayEndUtc)
      .in("module", calendarModules);

    for (const row of data || []) {
      const startsAtUtc = DateTime.fromISO(String(row.starts_at), { zone: "utc" });
      if (!isUsableDateTime(startsAtUtc)) continue;
      const moduleName = String(row.module || "manual").trim().toLowerCase();
      const eventModule = SMS_REMINDER_MODULES.includes(moduleName as SmsReminderModule)
        ? (moduleName as SmsReminderModule)
        : "manual";
      events.push({
        id: `${eventModule}-${row.id}`,
        title: String(row.title || "Event"),
        module: eventModule,
        locationText: typeof row.location_text === "string" ? row.location_text : null,
        eventReminderEnabled: !!row.event_reminder_enabled,
        eventReminderLeadMinutes: normalizeLeadMinutes(row.event_reminder_lead_minutes, 0),
        travelFromAddress: typeof row.travel_from_address === "string" ? row.travel_from_address : null,
        travelDurationMinutes:
          Number.isFinite(Number(row.travel_duration_minutes)) ? Number(row.travel_duration_minutes) : null,
        trafficDurationMinutes:
          Number.isFinite(Number(row.traffic_duration_minutes)) ? Number(row.traffic_duration_minutes) : null,
        leaveReminderEnabled: !!row.leave_reminder_enabled,
        leaveReminderLeadMinutes: normalizeLeadMinutes(row.leave_reminder_lead_minutes, 10),
        startsAtUtc,
        startsAtLocal: startsAtUtc.setZone(timezone),
      });
    }
  }

  return events.sort((a, b) => a.startsAtUtc.toMillis() - b.startsAtUtc.toMillis());
}

async function resolveTrafficMinutesForEvent(
  event: CalendarEvent,
  cache: Map<string, { trafficMinutes: number | null; baseMinutes: number | null }>,
): Promise<{
  trafficMinutes: number | null;
  baseMinutes: number | null;
}> {
  const fallbackBaseMinutes = Number.isFinite(Number(event.travelDurationMinutes))
    ? Math.max(1, Math.round(Number(event.travelDurationMinutes)))
    : null;
  const fallbackTrafficMinutes = Number.isFinite(Number(event.trafficDurationMinutes))
    ? Math.max(1, Math.round(Number(event.trafficDurationMinutes)))
    : fallbackBaseMinutes;

  const origin = String(event.travelFromAddress || "").trim();
  const destination = String(event.locationText || "").trim();
  if (!origin || !destination) {
    return {
      trafficMinutes: fallbackTrafficMinutes,
      baseMinutes: fallbackBaseMinutes,
    };
  }

  const departureEpochSeconds = Math.max(
    Math.floor(event.startsAtUtc.toSeconds()),
    Math.floor(Date.now() / 1000),
  );
  const cacheKey = `${origin}||${destination}||${departureEpochSeconds}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const estimate = await fetchGoogleDriveTrafficEstimate({
      origin,
      destination,
      departureEpochSeconds,
    });
    const resolved = {
      trafficMinutes: estimate.trafficDurationMinutes,
      baseMinutes: estimate.durationMinutes,
    };
    cache.set(cacheKey, resolved);
    return resolved;
  } catch (error) {
    console.error("Traffic lookup failed in sms-dispatch:", error instanceof Error ? error.message : error);
    const fallbackResolved = {
      trafficMinutes: fallbackTrafficMinutes,
      baseMinutes: fallbackBaseMinutes,
    };
    cache.set(cacheKey, fallbackResolved);
    return fallbackResolved;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const dispatchKey = Deno.env.get("SMS_DISPATCH_API_KEY");
    const providedDispatchKey = req.headers.get("x-sms-dispatch-key");
    const schedulerSource = req.headers.get("x-scheduler-source");
    const authorization = req.headers.get("authorization") || req.headers.get("Authorization");
    const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const isServiceRoleCaller = !!bearerToken && !!serviceRoleKey && bearerToken === serviceRoleKey;
    const isDispatchKeyCaller = !!dispatchKey && !!providedDispatchKey && providedDispatchKey === dispatchKey;
    const isInternalSchedulerCaller = schedulerSource === "supabase-cron";
    if (dispatchKey && !isDispatchKeyCaller && !isServiceRoleCaller && !isInternalSchedulerCaller) {
      return json({ error: "Unauthorized." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return json({ error: "Missing Supabase env vars." }, 500);
    const supabase = createClient(supabaseUrl, serviceRole);

    const windowMinutes = 1;
    const digestCatchupMinutes = Math.max(
      1,
      Number.parseInt(Deno.env.get("SMS_DIGEST_CATCHUP_MINUTES") || "120", 10) || 120,
    );
    const weeklyCatchupMinutes = Math.max(
      1,
      Number.parseInt(Deno.env.get("SMS_WEEKLY_NUDGE_CATCHUP_MINUTES") || "120", 10) || 120,
    );
    const lateGraceMinutes = 0;
    const eventCatchupMinutes = Math.max(
      1,
      Number.parseInt(Deno.env.get("SMS_EVENT_CATCHUP_MINUTES") || "5", 10) || 5,
    );
    const wellnessNudgeEnabled = String(Deno.env.get("SMS_WELLNESS_NUDGE_ENABLED") || "true").toLowerCase() === "true";
    const wellnessNudgeTime = String(Deno.env.get("SMS_WELLNESS_NUDGE_TIME") || "12:00").slice(0, 5);
    const nowUtc = DateTime.utc();
    const trafficLookupCache = new Map<string, { trafficMinutes: number | null; baseMinutes: number | null }>();

    const { data: prefs, error } = await supabase
      .from("sms_preferences")
      .select("*")
      .eq("enabled", true);
    if (error) return json({ error: error.message }, 500);

    const preferenceRows = (prefs || []) as SmsPreferenceRow[];
    const recipientOwnership = buildRecipientOwnershipMap(preferenceRows);

    let usersProcessed = 0;
    let messagesSent = 0;
    const errors: string[] = [];
    let failedUsers = 0;

    for (const row of preferenceRows) {
      try {
        usersProcessed += 1;
        const timezone = row.timezone || "America/New_York";
        const phone = String(row.phone_e164 || "").trim();
        const includeModules = normalizeIncludeModules(row.include_modules);
        const moduleRecipients = normalizeRecipientMap(row.module_recipients);
        const digestRecipients = filterRecipientsForOwner(
          recipientListForModules(includeModules, moduleRecipients, phone || null)
            .map((item) => String(item || "").trim())
            .filter((item) => item.length > 0),
          row.user_id,
          recipientOwnership,
        );
        if (digestRecipients.length === 0) continue;

        const localNow = nowUtc.setZone(timezone);
        if (!localNow.isValid) continue;

        const nowMinutes = localNow.hour * 60 + localNow.minute;
        if (inQuietHours(nowMinutes, row.quiet_hours_start, row.quiet_hours_end)) continue;

        const todayLocal = localNow.startOf("day");
        const tomorrowLocal = todayLocal.plus({ days: 1 });

        const todayEvents = await fetchDailyEvents(
          supabase,
          row.user_id,
          timezone,
          todayLocal,
          DIGEST_MODULES,
          String(row.preferred_dinner_time || "18:00").slice(0, 5),
        );
        const tomorrowEvents = await fetchDailyEvents(
          supabase,
          row.user_id,
          timezone,
          tomorrowLocal,
          DIGEST_MODULES,
          String(row.preferred_dinner_time || "18:00").slice(0, 5),
        );

        if (
          row.morning_digest_enabled &&
          isDueAt(localNow, String(row.morning_digest_time || "07:00"), windowMinutes, digestCatchupMinutes)
        ) {
          for (const recipient of digestRecipients) {
            const dedupeKey = `morning:${row.user_id}:${todayLocal.toISODate()}:${recipient}`;
            const logId = await insertDedupeLog(
              supabase,
              row.user_id,
              dedupeKey,
              "morning_digest",
              nowUtc.toISO(),
              { timezone, day: todayLocal.toISODate(), to: recipient },
            );
            if (logId) {
              try {
                const body = renderDigestText("today", todayLocal, todayEvents, timezone);
                const result = await sendTwilioSms(recipient, body);
                messagesSent += 1;
                await markLogStatus(supabase, logId, "sent", result.sid, {
                  timezone,
                  eventCount: todayEvents.length,
                  to: recipient,
                });
              } catch (sendError) {
                errors.push(`morning:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                await markLogStatus(supabase, logId, "failed", null, { error: String(sendError), to: recipient });
              }
            }
          }
        }

        if (
          row.night_before_enabled &&
          isDueAt(localNow, String(row.night_before_time || "20:00"), windowMinutes, digestCatchupMinutes)
        ) {
          for (const recipient of digestRecipients) {
            const dedupeKey = `night:${row.user_id}:${tomorrowLocal.toISODate()}:${recipient}`;
            const logId = await insertDedupeLog(
              supabase,
              row.user_id,
              dedupeKey,
              "night_before_digest",
              nowUtc.toISO(),
              { timezone, day: tomorrowLocal.toISODate(), to: recipient },
            );
            if (logId) {
              try {
                const body = renderDigestText("tomorrow", tomorrowLocal, tomorrowEvents, timezone);
                const result = await sendTwilioSms(recipient, body);
                messagesSent += 1;
                await markLogStatus(supabase, logId, "sent", result.sid, {
                  timezone,
                  eventCount: tomorrowEvents.length,
                  to: recipient,
                });
              } catch (sendError) {
                errors.push(`night:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                await markLogStatus(supabase, logId, "failed", null, { error: String(sendError), to: recipient });
              }
            }
          }
        }

        const groceryReminderDay = String(row.grocery_reminder_day || "saturday").trim().toLowerCase();
        const groceryReminderTime = String(
          row.grocery_reminder_time || row.night_before_time || "20:00",
        ).slice(0, 5);
        const groceryReminderEnabled = row.grocery_reminder_enabled ?? true;

        const shouldSendWeeklyPlanningNudge = groceryReminderEnabled && isDueOnWeekdayAt(
          localNow,
          groceryReminderDay,
          groceryReminderTime,
          windowMinutes,
          weeklyCatchupMinutes,
        );

        if (shouldSendWeeklyPlanningNudge) {
          const nextWeekLocal = localNow.plus({ weeks: 1 }).startOf("week");
          const nextWeekOf = nextWeekLocal.toISODate();

          if (nextWeekOf) {
            const { count: nextWeekMealCount, error: mealCountError } = await supabase
              .from("planned_meals")
              .select("id", { head: true, count: "exact" })
              .eq("owner_id", row.user_id)
              .eq("week_of", nextWeekOf)
              .eq("is_skipped", false);
            if (mealCountError) throw mealCountError;

            const { data: planningStatus, error: planningStatusError } = await supabase
              .from("weekly_planning_status")
              .select("groceries_ordered")
              .eq("user_id", row.user_id)
              .eq("week_of", nextWeekOf)
              .maybeSingle();
            if (planningStatusError) throw planningStatusError;

            const mealsPlanned = Number(nextWeekMealCount || 0) > 0;
            const groceriesOrdered = !!planningStatus?.groceries_ordered;

            if (!mealsPlanned || !groceriesOrdered) {
              const dedupeKey = `weekly-plan:${row.user_id}:${nextWeekOf}`;
              const logId = await insertDedupeLog(
                supabase,
                row.user_id,
                dedupeKey,
                "weekly_planning_nudge",
                nowUtc.toISO(),
                {
                  timezone,
                  weekOf: nextWeekOf,
                  mealsPlanned,
                  groceriesOrdered,
                },
              );

              if (logId) {
                try {
                  const missingParts: string[] = [];
                  if (!mealsPlanned) missingParts.push("planned meals");
                  if (!groceriesOrdered) missingParts.push("marked groceries ordered");
                  const body = `Home Harmony: We noticed you have not ${missingParts.join(
                    " and ",
                  )} for next week. Reply YES and we will auto-generate your meals and prep your grocery list.`;
                  for (const recipient of digestRecipients) {
                    const recipientDedupeKey = `${dedupeKey}:${recipient}`;
                    const recipientLogId = await insertDedupeLog(
                      supabase,
                      row.user_id,
                      recipientDedupeKey,
                      "weekly_planning_nudge",
                      nowUtc.toISO(),
                      {
                        timezone,
                        weekOf: nextWeekOf,
                        mealsPlanned,
                        groceriesOrdered,
                        to: recipient,
                      },
                    );
                    if (!recipientLogId) continue;
                    try {
                      const result = await sendTwilioSms(recipient, body);
                      messagesSent += 1;
                      await markLogStatus(supabase, recipientLogId, "sent", result.sid, {
                        timezone,
                        weekOf: nextWeekOf,
                        mealsPlanned,
                        groceriesOrdered,
                        to: recipient,
                      });
                    } catch (recipientError) {
                      errors.push(`weekly-plan:${row.user_id}:${recipientError instanceof Error ? recipientError.message : "send failed"}`);
                      await markLogStatus(supabase, recipientLogId, "failed", null, {
                        error: String(recipientError),
                        to: recipient,
                      });
                    }
                  }
                  await markLogStatus(supabase, logId, "skipped", null, {
                    reason: "per-recipient log entries created",
                    recipients: digestRecipients.length,
                  });
                } catch (sendError) {
                  errors.push(`weekly-plan:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                  await markLogStatus(supabase, logId, "failed", null, { error: String(sendError) });
                }
              }
            }
          }
        }

        const shouldSendWellnessNudge = wellnessNudgeEnabled && isDueAt(
          localNow,
          wellnessNudgeTime,
          windowMinutes,
          digestCatchupMinutes,
        );

        if (shouldSendWellnessNudge) {
          const { data: profileRow, error: profileError } = await supabase
            .from("profiles")
            .select("onboarding_settings")
            .eq("id", row.user_id)
            .maybeSingle();
          if (profileError) throw profileError;

          const snapshot = parseOnboardingHealthSnapshot(profileRow?.onboarding_settings || null);
          let workoutCountWeek = 0;

          if (
            snapshot.healthTrackingFocus.includes("Workout tracking") ||
            snapshot.healthTrackingFocus.includes("Goal tracking (water, steps, alcohol)")
          ) {
            const { data: workoutStateRow, error: workoutError } = await supabase
              .from("workout_state")
              .select("state")
              .eq("user_id", row.user_id)
              .maybeSingle();
            if (workoutError) {
              console.error("Failed to read workout_state for SMS nudge:", workoutError.message);
            } else {
              workoutCountWeek = workoutCountThisWeek(workoutStateRow?.state, timezone, localNow);
            }
          }

          const body = buildWellnessNudgeMessage({ snapshot, workoutCountWeek });
          if (body) {
            for (const recipient of digestRecipients) {
              const dedupeKey = `wellness:${row.user_id}:${todayLocal.toISODate()}:${recipient}`;
              const logId = await insertDedupeLog(
                supabase,
                row.user_id,
                dedupeKey,
                "wellness_nudge",
                nowUtc.toISO(),
                { timezone, to: recipient },
              );
              if (!logId) continue;
              try {
                const result = await sendTwilioSms(recipient, body);
                messagesSent += 1;
                await markLogStatus(supabase, logId, "sent", result.sid, {
                  timezone,
                  to: recipient,
                });
              } catch (sendError) {
                errors.push(`wellness:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                await markLogStatus(supabase, logId, "failed", null, { error: String(sendError), to: recipient });
              }
            }
          }
        }

        if (row.event_reminders_enabled) {
          const offsets = [...new Set(
            Array.isArray(row.reminder_offsets_minutes)
              ? row.reminder_offsets_minutes
                  .map((value) => Number(value))
                  .filter((value) => Number.isFinite(value) && value >= 0 && value <= 720)
              : [],
          )].sort((a, b) => b - a);
          const normalizedOffsets = offsets.length > 0 ? offsets : [0];
          const events = [...todayEvents, ...tomorrowEvents];
          for (const event of events) {
            if (!isUsableDateTime(event.startsAtLocal) || !isUsableDateTime(event.startsAtUtc)) continue;
            const manualUsesStartReminder = event.module === "manual" && !!event.eventReminderEnabled;
            const manualUsesLeaveReminder = event.module === "manual" && !!event.leaveReminderEnabled;
            const shouldUseGlobalOffsets = !(event.module === "manual" && (manualUsesStartReminder || manualUsesLeaveReminder));

            if (shouldUseGlobalOffsets) {
              for (const offset of normalizedOffsets) {
                const leadMinutes = Number(offset);
                if (!Number.isFinite(leadMinutes) || leadMinutes < 0) continue;
                const sendAt = event.startsAtLocal.minus({ minutes: leadMinutes });
                if (!isUsableDateTime(sendAt)) continue;

                const closeAt = sendAt.plus({ minutes: Math.max(windowMinutes + lateGraceMinutes, eventCatchupMinutes) });
                if (!isUsableDateTime(closeAt)) continue;
                if (localNow < sendAt || localNow >= closeAt) continue;

                const sendAtUtc = sendAt.toUTC();
                if (!isUsableDateTime(sendAtUtc)) continue;
                const sendAtIso = sendAtUtc.toISO();
                if (!sendAtIso) continue;

                const dedupeKey = `event:${row.user_id}:${event.id}:${leadMinutes}:${event.startsAtUtc.toISO()}`;
                const eventRecipients = filterRecipientsForOwner(
                  recipientListForModule(event.module, moduleRecipients, digestRecipients),
                  row.user_id,
                  recipientOwnership,
                );
                if (eventRecipients.length === 0) continue;

                for (const recipient of eventRecipients) {
                  const recipientDedupeKey = `${dedupeKey}:${recipient}`;
                  const logId = await insertDedupeLog(
                    supabase,
                    row.user_id,
                    recipientDedupeKey,
                    "event_reminder",
                    sendAtIso,
                    { timezone, eventId: event.id, offsetMinutes: leadMinutes, to: recipient },
                  );
                  if (!logId) continue;

                  try {
                    const eventTime = event.startsAtLocal.toFormat("h:mm a");
                    const body =
                      leadMinutes <= 0
                        ? `Home Harmony reminder: ${event.title} starts now (${eventTime}).`
                        : `Home Harmony reminder: ${event.title} starts at ${eventTime} (${leadMinutes} min).`;
                    const result = await sendTwilioSms(recipient, body);
                    messagesSent += 1;
                    await markLogStatus(supabase, logId, "sent", result.sid, {
                      timezone,
                      eventId: event.id,
                      eventStart: event.startsAtLocal.toISO(),
                      to: recipient,
                    });
                  } catch (sendError) {
                    errors.push(`event:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                    await markLogStatus(supabase, logId, "failed", null, { error: String(sendError), to: recipient });
                  }
                }
              }
            }

            if (event.module === "manual" && manualUsesStartReminder) {
              const leadMinutes = normalizeLeadMinutes(event.eventReminderLeadMinutes, 0);
              const sendAt = event.startsAtLocal.minus({ minutes: leadMinutes });
              if (!isUsableDateTime(sendAt)) continue;
              const closeAt = sendAt.plus({ minutes: Math.max(windowMinutes + lateGraceMinutes, eventCatchupMinutes) });
              if (!isUsableDateTime(closeAt)) continue;
              if (localNow < sendAt || localNow >= closeAt) continue;

              const sendAtUtc = sendAt.toUTC();
              if (!isUsableDateTime(sendAtUtc)) continue;
              const sendAtIso = sendAtUtc.toISO();
              if (!sendAtIso) continue;

              const recipients = filterRecipientsForOwner(
                recipientListForModule("manual", moduleRecipients, digestRecipients),
                row.user_id,
                recipientOwnership,
              );
              if (!recipients.length) continue;
              for (const recipient of recipients) {
                const dedupeKey = `manual-start:${row.user_id}:${event.id}:${event.startsAtUtc.toISO()}:${leadMinutes}:${recipient}`;
                const logId = await insertDedupeLog(
                  supabase,
                  row.user_id,
                  dedupeKey,
                  "manual_event_start_reminder",
                  sendAtIso,
                  {
                    timezone,
                    eventId: event.id,
                    to: recipient,
                    leadMinutes,
                  },
                );
                if (!logId) continue;

                try {
                  const eventTime = event.startsAtLocal.toFormat("h:mm a");
                  const body =
                    leadMinutes <= 0
                      ? `Home Harmony reminder: ${event.title} starts now (${eventTime}).`
                      : `Home Harmony reminder: ${event.title} starts at ${eventTime} (${leadMinutes} min).`;
                  const result = await sendTwilioSms(recipient, body);
                  messagesSent += 1;
                  await markLogStatus(supabase, logId, "sent", result.sid, {
                    timezone,
                    eventId: event.id,
                    to: recipient,
                    eventStart: event.startsAtLocal.toISO(),
                    leadMinutes,
                  });
                } catch (sendError) {
                  errors.push(`manual-start:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                  await markLogStatus(supabase, logId, "failed", null, { error: String(sendError), to: recipient });
                }
              }
            }

            if (event.module === "manual" && manualUsesLeaveReminder) {
              const leadMinutes = normalizeLeadMinutes(event.leaveReminderLeadMinutes, 10);
              const recipients = filterRecipientsForOwner(
                recipientListForModule("manual", moduleRecipients, digestRecipients),
                row.user_id,
                recipientOwnership,
              );
              if (!recipients.length) continue;

              const hasCommuteRouting = Boolean(
                String(event.travelFromAddress || "").trim() && String(event.locationText || "").trim(),
              );

              if (!hasCommuteRouting) {
                if (manualUsesStartReminder) continue;
                const sendAt = event.startsAtLocal.minus({ minutes: leadMinutes });
                if (!isUsableDateTime(sendAt)) continue;
                const closeAt = sendAt.plus({ minutes: windowMinutes + lateGraceMinutes });
                if (!isUsableDateTime(closeAt)) continue;
                if (localNow < sendAt || localNow >= closeAt) continue;

                const sendAtUtc = sendAt.toUTC();
                if (!isUsableDateTime(sendAtUtc)) continue;
                const sendAtIso = sendAtUtc.toISO();
                if (!sendAtIso) continue;

                for (const recipient of recipients) {
                  const dedupeKey = `manual-leave-fallback:${row.user_id}:${event.id}:${event.startsAtUtc.toISO()}:${leadMinutes}:${recipient}`;
                  const logId = await insertDedupeLog(
                    supabase,
                    row.user_id,
                    dedupeKey,
                    "manual_event_leave_fallback_reminder",
                    sendAtIso,
                    {
                      timezone,
                      eventId: event.id,
                      to: recipient,
                      leadMinutes,
                    },
                  );
                  if (!logId) continue;

                  try {
                    const eventTime = event.startsAtLocal.toFormat("h:mm a");
                    const body = `Home Harmony reminder: ${event.title} starts at ${eventTime} (${leadMinutes} min).`;
                    const result = await sendTwilioSms(recipient, body);
                    messagesSent += 1;
                    await markLogStatus(supabase, logId, "sent", result.sid, {
                      timezone,
                      eventId: event.id,
                      to: recipient,
                      eventStart: event.startsAtLocal.toISO(),
                      leadMinutes,
                    });
                  } catch (sendError) {
                    errors.push(`manual-start:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                    await markLogStatus(supabase, logId, "failed", null, { error: String(sendError), to: recipient });
                  }
                }
                continue;
              }

              if (event.startsAtLocal <= localNow) continue;
              const baselineTravelMinutes = Number.isFinite(Number(event.trafficDurationMinutes))
                ? Math.max(1, Math.round(Number(event.trafficDurationMinutes)))
                : Number.isFinite(Number(event.travelDurationMinutes))
                ? Math.max(1, Math.round(Number(event.travelDurationMinutes)))
                : 30;
              const baselineSendAt = event.startsAtLocal.minus({ minutes: baselineTravelMinutes + leadMinutes });
              if (localNow < baselineSendAt.minus({ minutes: 90 })) continue;

              const travel = await resolveTrafficMinutesForEvent(event, trafficLookupCache);
              if (!travel.trafficMinutes || travel.trafficMinutes < 1) continue;

              const leaveAt = event.startsAtLocal.minus({ minutes: travel.trafficMinutes });
              const sendAt = leaveAt.minus({ minutes: leadMinutes });
              if (!isUsableDateTime(sendAt)) continue;
              const closeAt = sendAt.plus({ minutes: windowMinutes + lateGraceMinutes });
              if (!isUsableDateTime(closeAt)) continue;
              if (localNow < sendAt || localNow >= closeAt) continue;

              const sendAtUtc = sendAt.toUTC();
              if (!isUsableDateTime(sendAtUtc)) continue;
              const sendAtIso = sendAtUtc.toISO();
              if (!sendAtIso) continue;

              const delayMinutes =
                Number.isFinite(Number(travel.baseMinutes)) && Number.isFinite(Number(travel.trafficMinutes))
                  ? Math.max(0, Number(travel.trafficMinutes) - Number(travel.baseMinutes))
                  : 0;
              for (const recipient of recipients) {
                const dedupeKey = `leave:${row.user_id}:${event.id}:${event.startsAtUtc.toISO()}:${recipient}`;
                const logId = await insertDedupeLog(
                  supabase,
                  row.user_id,
                  dedupeKey,
                  "leave_reminder",
                  sendAtIso,
                  {
                    timezone,
                    eventId: event.id,
                    to: recipient,
                    leaveAt: leaveAt.toISO(),
                  },
                );
                if (!logId) continue;

                try {
                  const locationSuffix = event.locationText ? ` for ${event.locationText}` : "";
                  const delayText = delayMinutes > 0 ? ` Traffic is running about ${delayMinutes} min slower than normal.` : "";
                  const body = `Home Harmony traffic alert: Leave by ${leaveAt.toFormat("h:mm a")} for ${event.title}${locationSuffix}.${delayText}`;
                  const result = await sendTwilioSms(recipient, body);
                  messagesSent += 1;
                  await markLogStatus(supabase, logId, "sent", result.sid, {
                    timezone,
                    eventId: event.id,
                    to: recipient,
                    leaveAt: leaveAt.toISO(),
                    trafficMinutes: travel.trafficMinutes,
                    delayMinutes,
                  });
                } catch (sendError) {
                  errors.push(`leave:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                  await markLogStatus(supabase, logId, "failed", null, { error: String(sendError), to: recipient });
                }
              }
            }
          }
        }
      } catch (userError) {
        failedUsers += 1;
        errors.push(`user:${row.user_id}:${userError instanceof Error ? userError.message : "unknown error"}`);
      }
    }

    return json({
      success: true,
      usersProcessed,
      failedUsers,
      messagesSent,
      errors,
      nowUtc: nowUtc.toISO(),
      dispatchWindowMinutes: windowMinutes,
      digestCatchupMinutes,
      weeklyCatchupMinutes,
      reminderLateGraceMinutes: lateGraceMinutes,
      eventCatchupMinutes,
      wellnessNudgeEnabled,
      wellnessNudgeTime,
    });
  } catch (error) {
    console.error("sms-dispatch error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
