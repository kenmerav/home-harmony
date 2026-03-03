import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DateTime } from "npm:luxon@3.6.1";
import { corsHeaders, json } from "../_shared/cors.ts";
import { sendTwilioSms } from "../_shared/twilio.ts";

type CalendarEvent = {
  id: string;
  title: string;
  startsAtUtc: DateTime;
  startsAtLocal: DateTime;
};

type SmsPreferenceRow = {
  user_id: string;
  enabled: boolean;
  phone_e164: string | null;
  timezone: string;
  morning_digest_enabled: boolean;
  morning_digest_time: string;
  night_before_enabled: boolean;
  night_before_time: string;
  event_reminders_enabled: boolean;
  reminder_offsets_minutes: number[];
  preferred_dinner_time: string;
  include_modules: string[];
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
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

function parseTimeToMinutes(timeValue: string): number {
  const normalized = String(timeValue).slice(0, 5);
  const [hoursRaw, minutesRaw] = normalized.split(":");
  const hours = Number.parseInt(hoursRaw || "0", 10);
  const minutes = Number.parseInt(minutesRaw || "0", 10);
  return hours * 60 + minutes;
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

function isDueAt(localNow: DateTime, hhmm: string, windowMinutes: number): boolean {
  const targetMinutes = parseTimeToMinutes(hhmm);
  const nowMinutes = localNow.hour * 60 + localNow.minute;
  return nowMinutes >= targetMinutes && nowMinutes < targetMinutes + windowMinutes;
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

async function fetchDailyEvents(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  timezone: string,
  localDate: DateTime,
  includeModules: string[],
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
        startsAtLocal: startLocal,
        startsAtUtc: startLocal.toUTC(),
      });
    }
  }

  if (includeModules.includes("manual")) {
    const dayStartUtc = localDate.startOf("day").toUTC().toISO();
    const dayEndUtc = localDate.plus({ days: 1 }).startOf("day").toUTC().toISO();
    const { data } = await supabase
      .from("calendar_events")
      .select("id,title,starts_at")
      .eq("owner_id", userId)
      .eq("is_deleted", false)
      .gte("starts_at", dayStartUtc)
      .lt("starts_at", dayEndUtc);

    for (const row of data || []) {
      const startsAtUtc = DateTime.fromISO(String(row.starts_at), { zone: "utc" });
      if (!isUsableDateTime(startsAtUtc)) continue;
      events.push({
        id: `manual-${row.id}`,
        title: String(row.title || "Event"),
        startsAtUtc,
        startsAtLocal: startsAtUtc.setZone(timezone),
      });
    }
  }

  return events.sort((a, b) => a.startsAtUtc.toMillis() - b.startsAtUtc.toMillis());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const dispatchKey = Deno.env.get("SMS_DISPATCH_API_KEY");
    if (dispatchKey) {
      const provided = req.headers.get("x-sms-dispatch-key");
      if (provided !== dispatchKey) return json({ error: "Unauthorized." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) return json({ error: "Missing Supabase env vars." }, 500);
    const supabase = createClient(supabaseUrl, serviceRole);

    const windowMinutes = Number.parseInt(Deno.env.get("SMS_DISPATCH_WINDOW_MINUTES") || "5", 10) || 5;
    const lateGraceMinutes = Number.parseInt(Deno.env.get("SMS_REMINDER_LATE_GRACE_MINUTES") || "10", 10) || 10;
    const nowUtc = DateTime.utc();

    const { data: prefs, error } = await supabase
      .from("sms_preferences")
      .select("*")
      .eq("enabled", true)
      .not("phone_e164", "is", null);
    if (error) return json({ error: error.message }, 500);

    let usersProcessed = 0;
    let messagesSent = 0;
    const errors: string[] = [];
    let failedUsers = 0;

    for (const row of (prefs || []) as SmsPreferenceRow[]) {
      try {
        usersProcessed += 1;
        const timezone = row.timezone || "America/New_York";
        const phone = row.phone_e164 || "";
        if (!phone) continue;

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
          row.include_modules || ["meals", "manual"],
          String(row.preferred_dinner_time || "18:00").slice(0, 5),
        );
        const tomorrowEvents = await fetchDailyEvents(
          supabase,
          row.user_id,
          timezone,
          tomorrowLocal,
          row.include_modules || ["meals", "manual"],
          String(row.preferred_dinner_time || "18:00").slice(0, 5),
        );

        if (row.morning_digest_enabled && isDueAt(localNow, String(row.morning_digest_time || "07:00"), windowMinutes)) {
          const dedupeKey = `morning:${row.user_id}:${todayLocal.toISODate()}`;
          const logId = await insertDedupeLog(
            supabase,
            row.user_id,
            dedupeKey,
            "morning_digest",
            nowUtc.toISO(),
            { timezone, day: todayLocal.toISODate() },
          );
          if (logId) {
            try {
              const body = renderDigestText("today", todayLocal, todayEvents, timezone);
              const result = await sendTwilioSms(phone, body);
              messagesSent += 1;
              await markLogStatus(supabase, logId, "sent", result.sid, { timezone, eventCount: todayEvents.length });
            } catch (sendError) {
              errors.push(`morning:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
              await markLogStatus(supabase, logId, "failed", null, { error: String(sendError) });
            }
          }
        }

        if (row.night_before_enabled && isDueAt(localNow, String(row.night_before_time || "20:00"), windowMinutes)) {
          const dedupeKey = `night:${row.user_id}:${tomorrowLocal.toISODate()}`;
          const logId = await insertDedupeLog(
            supabase,
            row.user_id,
            dedupeKey,
            "night_before_digest",
            nowUtc.toISO(),
            { timezone, day: tomorrowLocal.toISODate() },
          );
          if (logId) {
            try {
              const body = renderDigestText("tomorrow", tomorrowLocal, tomorrowEvents, timezone);
              const result = await sendTwilioSms(phone, body);
              messagesSent += 1;
              await markLogStatus(supabase, logId, "sent", result.sid, { timezone, eventCount: tomorrowEvents.length });
            } catch (sendError) {
              errors.push(`night:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
              await markLogStatus(supabase, logId, "failed", null, { error: String(sendError) });
            }
          }
        }

        if (row.event_reminders_enabled) {
          const offsets = Array.isArray(row.reminder_offsets_minutes) ? row.reminder_offsets_minutes : [60, 30];
          const events = [...todayEvents, ...tomorrowEvents];
          for (const event of events) {
            if (!isUsableDateTime(event.startsAtLocal) || !isUsableDateTime(event.startsAtUtc)) continue;

            for (const offset of offsets) {
              const leadMinutes = Number(offset);
              if (!Number.isFinite(leadMinutes) || leadMinutes < 5) continue;
              const sendAt = event.startsAtLocal.minus({ minutes: leadMinutes });
              if (!isUsableDateTime(sendAt)) continue;

              const closeAt = sendAt.plus({ minutes: windowMinutes + lateGraceMinutes });
              if (!isUsableDateTime(closeAt)) continue;
              if (localNow < sendAt || localNow >= closeAt) continue;

              const sendAtUtc = sendAt.toUTC();
              if (!isUsableDateTime(sendAtUtc)) continue;
              const sendAtIso = sendAtUtc.toISO();
              if (!sendAtIso) continue;

              const dedupeKey = `event:${row.user_id}:${event.id}:${leadMinutes}:${event.startsAtUtc.toISO()}`;
              const logId = await insertDedupeLog(
                supabase,
                row.user_id,
                dedupeKey,
                "event_reminder",
                sendAtIso,
                { timezone, eventId: event.id, offsetMinutes: leadMinutes },
              );
              if (!logId) continue;

              try {
                const eventTime = event.startsAtLocal.toFormat("h:mm a");
                const body = `Home Harmony reminder: ${event.title} starts at ${eventTime} (${leadMinutes} min).`;
                const result = await sendTwilioSms(phone, body);
                messagesSent += 1;
                await markLogStatus(supabase, logId, "sent", result.sid, {
                  timezone,
                  eventId: event.id,
                  eventStart: event.startsAtLocal.toISO(),
                });
              } catch (sendError) {
                errors.push(`event:${row.user_id}:${sendError instanceof Error ? sendError.message : "send failed"}`);
                await markLogStatus(supabase, logId, "failed", null, { error: String(sendError) });
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
    });
  } catch (error) {
    console.error("sms-dispatch error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
