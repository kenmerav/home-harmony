import { supabase } from '@/integrations/supabase/client';

export const SMS_REMINDER_MODULES = ['meals', 'manual', 'tasks', 'chores', 'workouts', 'reminders'] as const;
export type SmsReminderModule = (typeof SMS_REMINDER_MODULES)[number];

type ModuleRecipientsMap = Record<SmsReminderModule, string[]>;

export interface SmsPreferences {
  enabled: boolean;
  phone_e164: string;
  home_address: string;
  work_address: string;
  default_departure_source: 'home' | 'work' | 'custom';
  timezone: string;
  morning_digest_enabled: boolean;
  morning_digest_time: string;
  night_before_enabled: boolean;
  night_before_time: string;
  grocery_reminder_enabled: boolean;
  grocery_reminder_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  grocery_reminder_time: string;
  event_reminders_enabled: boolean;
  reminder_offsets_minutes: number[];
  preferred_dinner_time: string;
  include_modules: string[];
  module_recipients: ModuleRecipientsMap;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const emptyModuleRecipients = (): ModuleRecipientsMap => ({
  meals: [],
  manual: [],
  tasks: [],
  chores: [],
  workouts: [],
  reminders: [],
});

const DEFAULT_SMS_PREFERENCES: SmsPreferences = {
  enabled: false,
  phone_e164: '',
  home_address: '',
  work_address: '',
  default_departure_source: 'home',
  timezone: 'America/New_York',
  morning_digest_enabled: true,
  morning_digest_time: '07:00',
  night_before_enabled: true,
  night_before_time: '20:00',
  grocery_reminder_enabled: true,
  grocery_reminder_day: 'saturday',
  grocery_reminder_time: '20:00',
  event_reminders_enabled: true,
  reminder_offsets_minutes: [60, 30],
  preferred_dinner_time: '18:00',
  include_modules: ['meals', 'manual'],
  module_recipients: emptyModuleRecipients(),
  quiet_hours_start: null,
  quiet_hours_end: null,
};

async function invokeSmsPreferences(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke('sms-preferences', { body });
  if (error) {
    const invokeError = error as Error & { context?: Response };
    if (invokeError.context) {
      const response = invokeError.context;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const payload = (await response.clone().json().catch(() => null)) as Record<string, unknown> | null;
        if (payload && typeof payload.error === 'string' && payload.error.trim()) {
          throw new Error(payload.error);
        }
      } else {
        const text = await response.clone().text().catch(() => '');
        if (text.trim()) throw new Error(text.trim());
      }
      throw new Error(`SMS request failed (${response.status}).`);
    }
    if (invokeError.message?.trim()) throw new Error(invokeError.message);
    throw new Error('SMS request failed.');
  }
  return (data || {}) as Record<string, unknown>;
}

function normalizePrefs(raw: Partial<SmsPreferences> | null | undefined): SmsPreferences {
  if (!raw) {
    return {
      ...DEFAULT_SMS_PREFERENCES,
      module_recipients: emptyModuleRecipients(),
    };
  }
  const includeModules =
    Array.isArray(raw.include_modules) && raw.include_modules.length > 0
      ? raw.include_modules.filter((value): value is SmsReminderModule =>
          SMS_REMINDER_MODULES.includes(value as SmsReminderModule),
        )
      : DEFAULT_SMS_PREFERENCES.include_modules;
  const moduleRecipientsRaw =
    raw.module_recipients && typeof raw.module_recipients === 'object'
      ? (raw.module_recipients as Partial<Record<SmsReminderModule, unknown>>)
      : {};
  const moduleRecipients = emptyModuleRecipients();
  SMS_REMINDER_MODULES.forEach((moduleName) => {
    const value = moduleRecipientsRaw[moduleName];
    moduleRecipients[moduleName] = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  });

  return {
    enabled: !!raw.enabled,
    phone_e164: raw.phone_e164 || '',
    home_address: raw.home_address || '',
    work_address: raw.work_address || '',
    default_departure_source:
      raw.default_departure_source === 'work' || raw.default_departure_source === 'custom'
        ? raw.default_departure_source
        : 'home',
    timezone: raw.timezone || DEFAULT_SMS_PREFERENCES.timezone,
    morning_digest_enabled: raw.morning_digest_enabled ?? DEFAULT_SMS_PREFERENCES.morning_digest_enabled,
    morning_digest_time: raw.morning_digest_time || DEFAULT_SMS_PREFERENCES.morning_digest_time,
    night_before_enabled: raw.night_before_enabled ?? DEFAULT_SMS_PREFERENCES.night_before_enabled,
    night_before_time: raw.night_before_time || DEFAULT_SMS_PREFERENCES.night_before_time,
    grocery_reminder_enabled:
      raw.grocery_reminder_enabled ?? DEFAULT_SMS_PREFERENCES.grocery_reminder_enabled,
    grocery_reminder_day:
      raw.grocery_reminder_day === 'monday'
      || raw.grocery_reminder_day === 'tuesday'
      || raw.grocery_reminder_day === 'wednesday'
      || raw.grocery_reminder_day === 'thursday'
      || raw.grocery_reminder_day === 'friday'
      || raw.grocery_reminder_day === 'saturday'
      || raw.grocery_reminder_day === 'sunday'
        ? raw.grocery_reminder_day
        : DEFAULT_SMS_PREFERENCES.grocery_reminder_day,
    grocery_reminder_time: raw.grocery_reminder_time || DEFAULT_SMS_PREFERENCES.grocery_reminder_time,
    event_reminders_enabled: raw.event_reminders_enabled ?? DEFAULT_SMS_PREFERENCES.event_reminders_enabled,
    reminder_offsets_minutes:
      Array.isArray(raw.reminder_offsets_minutes) && raw.reminder_offsets_minutes.length > 0
        ? raw.reminder_offsets_minutes
        : DEFAULT_SMS_PREFERENCES.reminder_offsets_minutes,
    preferred_dinner_time: raw.preferred_dinner_time || DEFAULT_SMS_PREFERENCES.preferred_dinner_time,
    include_modules: includeModules.length > 0 ? includeModules : DEFAULT_SMS_PREFERENCES.include_modules,
    module_recipients: moduleRecipients,
    quiet_hours_start: raw.quiet_hours_start || null,
    quiet_hours_end: raw.quiet_hours_end || null,
  };
}

export async function loadSmsPreferences(): Promise<SmsPreferences> {
  const data = await invokeSmsPreferences({ action: 'get' });
  if (typeof data.error === 'string' && data.error) throw new Error(data.error);
  const prefs = normalizePrefs((data.preferences || null) as Partial<SmsPreferences> | null);
  const browserTz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
  if (
    !prefs.phone_e164 &&
    browserTz &&
    prefs.timezone === 'America/New_York' &&
    browserTz !== 'America/New_York'
  ) {
    return { ...prefs, timezone: browserTz };
  }
  return prefs;
}

export async function saveSmsPreferences(prefs: SmsPreferences): Promise<SmsPreferences> {
  const data = await invokeSmsPreferences({
    action: 'save',
    ...prefs,
  });
  if (typeof data.error === 'string' && data.error) throw new Error(data.error);
  return normalizePrefs((data.preferences || null) as Partial<SmsPreferences> | null);
}

export async function sendSmsTestMessage(): Promise<{ sid: string; status: string }> {
  const data = await invokeSmsPreferences({ action: 'send_test' });
  if (typeof data.error === 'string' && data.error) throw new Error(data.error);
  return {
    sid: String(data.sid || ''),
    status: String(data.status || ''),
  };
}

export function defaultSmsPreferences(timezoneGuess?: string): SmsPreferences {
  return {
    ...DEFAULT_SMS_PREFERENCES,
    timezone: timezoneGuess || DEFAULT_SMS_PREFERENCES.timezone,
    module_recipients: emptyModuleRecipients(),
  };
}
