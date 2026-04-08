import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { isValidE164, normalizePhone, sendTwilioSms } from "../_shared/twilio.ts";

type Action = "get" | "save" | "send_test";
type SmsReminderModule = "meals" | "manual" | "tasks" | "chores" | "workouts" | "reminders";
const SMS_REMINDER_MODULES: SmsReminderModule[] = ["meals", "manual", "tasks", "workouts", "reminders"];

const DEFAULT_PREFS = {
  enabled: false,
  phone_e164: "",
  home_address: "",
  work_address: "",
  default_departure_source: "home",
  timezone: "America/New_York",
  morning_digest_enabled: true,
  morning_digest_time: "07:00",
  night_before_enabled: true,
  night_before_time: "20:00",
  grocery_reminder_enabled: true,
  grocery_reminder_day: "saturday",
  grocery_reminder_time: "20:00",
  event_reminders_enabled: true,
  reminder_offsets_minutes: [0],
  preferred_dinner_time: "18:00",
  dinner_times_by_day: {
    monday: "18:00",
    tuesday: "18:00",
    wednesday: "18:00",
    thursday: "18:00",
    friday: "18:00",
    saturday: "18:00",
    sunday: "18:00",
  },
  include_modules: ["meals", "manual", "tasks", "workouts", "reminders"],
  module_recipients: {
    meals: [],
    manual: [],
    tasks: [],
    chores: [],
    workouts: [],
    reminders: [],
  } as Record<SmsReminderModule, string[]>,
  quiet_hours_start: null as string | null,
  quiet_hours_end: null as string | null,
};

function validTime(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.slice(0, 5);
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : fallback;
}

function normalizeDinnerTimesByDay(input: unknown, fallbackTime: string): Record<string, string> {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    monday: validTime(raw.monday, fallbackTime),
    tuesday: validTime(raw.tuesday, fallbackTime),
    wednesday: validTime(raw.wednesday, fallbackTime),
    thursday: validTime(raw.thursday, fallbackTime),
    friday: validTime(raw.friday, fallbackTime),
    saturday: validTime(raw.saturday, fallbackTime),
    sunday: validTime(raw.sunday, fallbackTime),
  };
}

function validTz(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return fallback;
  }
}

function validWeekday(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "monday"
    || normalized === "tuesday"
    || normalized === "wednesday"
    || normalized === "thursday"
    || normalized === "friday"
    || normalized === "saturday"
    || normalized === "sunday"
  ) {
    return normalized;
  }
  return fallback;
}

function normalizeOffsets(input: unknown): number[] {
  if (!Array.isArray(input)) return [0];
  const cleaned = [...new Set(
    input
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .map((item) => Math.round(item))
      .filter((item) => item >= 0 && item <= 720),
  )].sort((a, b) => b - a);
  return cleaned.length ? cleaned : [0];
}

function normalizeModules(input: unknown): string[] {
  const allowed = new Set(SMS_REMINDER_MODULES);
  if (!Array.isArray(input)) return [...DEFAULT_PREFS.include_modules];
  const cleaned = [...new Set(
    input
      .filter((item) => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => allowed.has(item)),
  )];
  return cleaned.length ? cleaned : [...DEFAULT_PREFS.include_modules];
}

function normalizeModuleRecipients(input: unknown): Record<SmsReminderModule, string[]> {
  const normalized: Record<SmsReminderModule, string[]> = {
    meals: [],
    manual: [],
    tasks: [],
    chores: [],
    workouts: [],
    reminders: [],
  };
  if (!input || typeof input !== "object") return normalized;
  const map = input as Record<string, unknown>;
  for (const moduleName of SMS_REMINDER_MODULES) {
    const rawList = map[moduleName];
    if (!Array.isArray(rawList)) continue;
    normalized[moduleName] = [...new Set(
      rawList
        .map((value) => normalizePhoneInput(value))
        .filter((value): value is string => Boolean(value)),
    )];
  }
  return normalized;
}

function uniqueFallbackRecipients(
  moduleRecipients: Record<SmsReminderModule, string[]>,
  fallbackPhone: string | null,
): Record<SmsReminderModule, string[]> {
  if (!fallbackPhone) return moduleRecipients;
  const next = { ...moduleRecipients };
  for (const moduleName of SMS_REMINDER_MODULES) {
    if (next[moduleName].length === 0) next[moduleName] = [fallbackPhone];
  }
  return next;
}

function normalizePhoneInput(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const stripped = normalizePhone(input);
  const digitsOnly = stripped.replace(/\D/g, "");

  let normalized = stripped;
  if (!normalized.startsWith("+")) {
    // Assume US numbers when users enter local formats like 615-653-3367.
    if (digitsOnly.length === 10) {
      normalized = `+1${digitsOnly}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
      normalized = `+${digitsOnly}`;
    }
  }

  return isValidE164(normalized) ? normalized : null;
}

function normalizeAddressInput(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, 240);
}

function normalizeDepartureSource(input: unknown): "home" | "work" | "custom" {
  if (typeof input !== "string") return "home";
  const normalized = input.trim().toLowerCase();
  if (normalized === "work" || normalized === "custom") return normalized;
  return "home";
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

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !authData.user) return json({ error: "Unauthorized." }, 401);
    const userId = authData.user.id;

    const payload = await req.json().catch(() => ({}));
    const action = (payload?.action || "get") as Action;

    if (action === "get") {
      const { data, error } = await supabase
        .from("sms_preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);

      if (!data) {
        return json({ preferences: { ...DEFAULT_PREFS } });
      }

      return json({
        preferences: {
          enabled: !!data.enabled,
          phone_e164: data.phone_e164 || "",
          home_address: typeof data.home_address === "string" ? data.home_address : "",
          work_address: typeof data.work_address === "string" ? data.work_address : "",
          default_departure_source: normalizeDepartureSource(data.default_departure_source),
          timezone: data.timezone || DEFAULT_PREFS.timezone,
          morning_digest_enabled: !!data.morning_digest_enabled,
          morning_digest_time: String(data.morning_digest_time || DEFAULT_PREFS.morning_digest_time).slice(0, 5),
          night_before_enabled: !!data.night_before_enabled,
          night_before_time: String(data.night_before_time || DEFAULT_PREFS.night_before_time).slice(0, 5),
          grocery_reminder_enabled:
            data.grocery_reminder_enabled ?? DEFAULT_PREFS.grocery_reminder_enabled,
          grocery_reminder_day: validWeekday(
            data.grocery_reminder_day,
            DEFAULT_PREFS.grocery_reminder_day,
          ),
          grocery_reminder_time: String(
            data.grocery_reminder_time || DEFAULT_PREFS.grocery_reminder_time,
          ).slice(0, 5),
          event_reminders_enabled: !!data.event_reminders_enabled,
          reminder_offsets_minutes: Array.isArray(data.reminder_offsets_minutes)
            ? data.reminder_offsets_minutes
            : DEFAULT_PREFS.reminder_offsets_minutes,
          preferred_dinner_time: String(data.preferred_dinner_time || DEFAULT_PREFS.preferred_dinner_time).slice(0, 5),
          dinner_times_by_day: normalizeDinnerTimesByDay(
            data.dinner_times_by_day,
            String(data.preferred_dinner_time || DEFAULT_PREFS.preferred_dinner_time).slice(0, 5),
          ),
          include_modules: normalizeModules(data.include_modules),
          module_recipients: normalizeModuleRecipients(data.module_recipients),
          quiet_hours_start: data.quiet_hours_start ? String(data.quiet_hours_start).slice(0, 5) : null,
          quiet_hours_end: data.quiet_hours_end ? String(data.quiet_hours_end).slice(0, 5) : null,
        },
      });
    }

    if (action === "save") {
      const normalizedPhone = normalizePhoneInput(payload?.phone_e164);
      if (payload?.phone_e164 && !normalizedPhone) {
        return json({ error: "Phone number must be E.164 format like +15551234567." });
      }
      const includeModules = normalizeModules(payload?.include_modules);
      const moduleRecipients = uniqueFallbackRecipients(
        normalizeModuleRecipients(payload?.module_recipients),
        normalizedPhone,
      );

      const next = {
        user_id: userId,
        enabled: !!payload?.enabled,
        phone_e164: normalizedPhone,
        home_address: normalizeAddressInput(payload?.home_address),
        work_address: normalizeAddressInput(payload?.work_address),
        default_departure_source: normalizeDepartureSource(payload?.default_departure_source),
        timezone: validTz(payload?.timezone, DEFAULT_PREFS.timezone),
        morning_digest_enabled: !!payload?.morning_digest_enabled,
        morning_digest_time: validTime(payload?.morning_digest_time, DEFAULT_PREFS.morning_digest_time),
        night_before_enabled: !!payload?.night_before_enabled,
        night_before_time: validTime(payload?.night_before_time, DEFAULT_PREFS.night_before_time),
        grocery_reminder_enabled: payload?.grocery_reminder_enabled ?? DEFAULT_PREFS.grocery_reminder_enabled,
        grocery_reminder_day: validWeekday(payload?.grocery_reminder_day, DEFAULT_PREFS.grocery_reminder_day),
        grocery_reminder_time: validTime(payload?.grocery_reminder_time, DEFAULT_PREFS.grocery_reminder_time),
        event_reminders_enabled: !!payload?.event_reminders_enabled,
        reminder_offsets_minutes: normalizeOffsets(payload?.reminder_offsets_minutes),
        preferred_dinner_time: validTime(payload?.preferred_dinner_time, DEFAULT_PREFS.preferred_dinner_time),
        dinner_times_by_day: normalizeDinnerTimesByDay(
          payload?.dinner_times_by_day,
          validTime(payload?.preferred_dinner_time, DEFAULT_PREFS.preferred_dinner_time),
        ),
        include_modules: includeModules,
        module_recipients: moduleRecipients,
        quiet_hours_start: payload?.quiet_hours_start
          ? validTime(payload?.quiet_hours_start, DEFAULT_PREFS.night_before_time)
          : null,
        quiet_hours_end: payload?.quiet_hours_end
          ? validTime(payload?.quiet_hours_end, DEFAULT_PREFS.morning_digest_time)
          : null,
        last_opt_in_at: payload?.enabled ? new Date().toISOString() : null,
        last_opt_out_at: payload?.enabled ? null : new Date().toISOString(),
      };

      const { error } = await supabase
        .from("sms_preferences")
        .upsert(next, { onConflict: "user_id" });
      if (error) return json({ error: error.message }, 500);

      return json({ success: true, preferences: next });
    }

    if (action === "send_test") {
      const { data, error } = await supabase
        .from("sms_preferences")
        .select("phone_e164,timezone,module_recipients")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);

      const recipients = normalizeModuleRecipients(data?.module_recipients);
      const to = SMS_REMINDER_MODULES.flatMap((moduleName) => recipients[moduleName] || [])[0] || data?.phone_e164;
      if (!to) return json({ error: "Save a phone number first." });

      const tz = data?.timezone || DEFAULT_PREFS.timezone;
      const nowText = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
        month: "short",
        day: "numeric",
      }).format(new Date());
      const testBody = `Home Harmony test: SMS updates are connected. Current local time: ${nowText}.`;
      try {
        const result = await sendTwilioSms(to, testBody);
        return json({ success: true, sid: result.sid, status: result.status });
      } catch (sendError) {
        return json({
          error: sendError instanceof Error ? sendError.message : "Failed to send test SMS.",
        });
      }
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("sms-preferences error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
