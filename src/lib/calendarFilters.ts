import { CalendarEventModule } from '@/lib/calendarStore';

const CALENDAR_FILTERS_KEY = 'homehub.calendar.filters.v1';
const CALENDAR_FILTER_PRESETS_KEY = 'homehub.calendar.filter-presets.v1';
export const DEFAULT_CALENDAR_FILTER_PRESET_COLOR = '#5A8F72';

export type CalendarModuleFilters = Record<CalendarEventModule, boolean>;
export type CalendarFilterPresetColor = string;

const LEGACY_PRESET_COLOR_MAP: Record<string, string> = {
  family: '#8A78E8',
  meals: '#54B888',
  tasks: '#4D86E5',
  chores: '#C98A2E',
  workouts: '#D35F82',
  reminders: '#7D8FA8',
};

function normalizeHexColor(input: string): string | null {
  const compact = input.trim();
  if (!compact) return null;

  const withHash = compact.startsWith('#') ? compact : `#${compact}`;
  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    const [r, g, b] = withHash.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
    return withHash.toUpperCase();
  }
  return null;
}

function normalizePresetColor(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_CALENDAR_FILTER_PRESET_COLOR;
  const lowered = value.trim().toLowerCase();
  if (LEGACY_PRESET_COLOR_MAP[lowered]) return LEGACY_PRESET_COLOR_MAP[lowered];
  return normalizeHexColor(value) || DEFAULT_CALENDAR_FILTER_PRESET_COLOR;
}

export interface CalendarFilterPreset {
  id: string;
  name: string;
  modules: CalendarModuleFilters;
  reminderRecipients: string[];
  color: CalendarFilterPresetColor;
  enabled: boolean;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function scopedKey(baseKey: string, userId?: string | null): string {
  return `${baseKey}:${userId || 'anon'}`;
}

export function moduleDefaultFilters(): CalendarModuleFilters {
  return {
    manual: true,
    meals: true,
    tasks: true,
    chores: true,
    workouts: true,
    reminders: true,
  };
}

function normalizeModules(input: Partial<CalendarModuleFilters> | undefined): CalendarModuleFilters {
  const fallback = moduleDefaultFilters();
  return {
    manual: input?.manual ?? fallback.manual,
    meals: input?.meals ?? fallback.meals,
    tasks: input?.tasks ?? fallback.tasks,
    chores: input?.chores ?? fallback.chores,
    workouts: input?.workouts ?? fallback.workouts,
    reminders: input?.reminders ?? fallback.reminders,
  };
}

export function loadStoredCalendarFilters(userId?: string | null): CalendarModuleFilters {
  const fallback = moduleDefaultFilters();
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(scopedKey(CALENDAR_FILTERS_KEY, userId));
    if (!raw) return fallback;
    return normalizeModules(JSON.parse(raw) as Partial<CalendarModuleFilters>);
  } catch {
    return fallback;
  }
}

export function saveStoredCalendarFilters(filters: CalendarModuleFilters, userId?: string | null): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    scopedKey(CALENDAR_FILTERS_KEY, userId),
    JSON.stringify(normalizeModules(filters)),
  );
}

function normalizeFilterPresetName(input: string): string {
  const collapsed = input.replace(/\s+/g, ' ').trim();
  return collapsed || 'Saved filter';
}

function defaultPresetName(existingCount: number): string {
  return `Filter ${existingCount + 1}`;
}

function normalizePreset(input: unknown, index: number): CalendarFilterPreset | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as { id?: unknown; name?: unknown; modules?: unknown; color?: unknown };
  const id = typeof row.id === 'string' && row.id.trim() ? row.id : `filter-${index + 1}`;
  const name =
    typeof row.name === 'string' && row.name.trim()
      ? normalizeFilterPresetName(row.name)
      : defaultPresetName(index);
  const modules =
    row.modules && typeof row.modules === 'object'
      ? normalizeModules(row.modules as Partial<CalendarModuleFilters>)
      : moduleDefaultFilters();
  const reminderRecipients = Array.isArray((row as { reminderRecipients?: unknown }).reminderRecipients)
    ? ((row as { reminderRecipients?: unknown[] }).reminderRecipients || [])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
  const color = normalizePresetColor(row.color);
  const enabled = !!(row as { enabled?: unknown }).enabled;
  return { id, name, modules, reminderRecipients, color, enabled };
}

export function loadStoredCalendarFilterPresets(userId?: string | null): CalendarFilterPreset[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(CALENDAR_FILTER_PRESETS_KEY, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((preset, index) => normalizePreset(preset, index))
      .filter((preset): preset is CalendarFilterPreset => preset !== null);
  } catch {
    return [];
  }
}

export function saveStoredCalendarFilterPresets(
  presets: CalendarFilterPreset[],
  userId?: string | null,
): void {
  if (!canUseStorage()) return;
  const normalized = presets.map((preset, index) => ({
    id: preset.id,
    name: normalizeFilterPresetName(preset.name || defaultPresetName(index)),
    modules: normalizeModules(preset.modules),
    reminderRecipients: Array.isArray(preset.reminderRecipients)
      ? preset.reminderRecipients.map((value) => value.trim()).filter((value) => value.length > 0)
      : [],
    color: normalizePresetColor(preset.color),
    enabled: !!preset.enabled,
  }));
  window.localStorage.setItem(scopedKey(CALENDAR_FILTER_PRESETS_KEY, userId), JSON.stringify(normalized));
}

export function filtersEqual(a: CalendarModuleFilters, b: CalendarModuleFilters): boolean {
  return (
    a.manual === b.manual &&
    a.meals === b.meals &&
    a.tasks === b.tasks &&
    a.chores === b.chores &&
    a.workouts === b.workouts &&
    a.reminders === b.reminders
  );
}

export function createCalendarFilterPreset(
  name: string,
  modules: CalendarModuleFilters,
  existingCount: number,
  reminderRecipients: string[] = [],
  color: CalendarFilterPresetColor = DEFAULT_CALENDAR_FILTER_PRESET_COLOR,
): CalendarFilterPreset {
  const trimmed = normalizeFilterPresetName(name || defaultPresetName(existingCount));
  return {
    id: `filter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmed,
    modules: normalizeModules(modules),
    reminderRecipients: reminderRecipients.map((value) => value.trim()).filter((value) => value.length > 0),
    color: normalizePresetColor(color),
    enabled: false,
  };
}

export function normalizeCalendarFilterName(name: string): string {
  return normalizeFilterPresetName(name);
}
