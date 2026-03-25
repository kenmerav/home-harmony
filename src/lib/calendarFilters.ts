import { CalendarEventModule } from '@/lib/calendarStore';

const CALENDAR_FILTERS_KEY = 'homehub.calendar.filters.v1';
const CALENDAR_FILTER_PRESETS_KEY = 'homehub.calendar.filter-presets.v1';
const CALENDAR_MODULE_FILTER_SETTINGS_KEY = 'homehub.calendar.module-filter-settings.v1';
export const DEFAULT_CALENDAR_FILTER_PRESET_COLOR = '#5A8F72';

export type CalendarModuleFilters = Record<CalendarEventModule, boolean>;
export type CalendarFilterPresetColor = string;
export type ModuleLabelOverrides = Partial<Record<CalendarEventModule, string>>;
export interface CalendarModuleFilterSettings {
  labelOverrides: ModuleLabelOverrides;
}

const CALENDAR_MODULES: CalendarEventModule[] = ['manual', 'meals', 'tasks', 'chores', 'workouts', 'reminders'];

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

export function normalizeCalendarModuleFilters(input: Partial<CalendarModuleFilters> | undefined): CalendarModuleFilters {
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
    return normalizeCalendarModuleFilters(JSON.parse(raw) as Partial<CalendarModuleFilters>);
  } catch {
    return fallback;
  }
}

export function saveStoredCalendarFilters(filters: CalendarModuleFilters, userId?: string | null): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    scopedKey(CALENDAR_FILTERS_KEY, userId),
    JSON.stringify(normalizeCalendarModuleFilters(filters)),
  );
}

function normalizeFilterPresetName(input: string): string {
  const collapsed = input.replace(/\s+/g, ' ').trim();
  return collapsed || 'Saved filter';
}

function defaultPresetName(existingCount: number): string {
  return `Filter ${existingCount + 1}`;
}

function normalizeCalendarFilterKey(input: string | null | undefined): string {
  const compact = typeof input === 'string' ? input.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  if (!compact || compact === 'manual') return 'family';
  return compact.replace(/[\s_-]+/g, '-');
}

export function normalizeCalendarFilterPreset(input: unknown, index: number): CalendarFilterPreset | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as { id?: unknown; name?: unknown; modules?: unknown; color?: unknown };
  const id = typeof row.id === 'string' && row.id.trim() ? row.id : `filter-${index + 1}`;
  const name =
    typeof row.name === 'string' && row.name.trim()
      ? normalizeFilterPresetName(row.name)
      : defaultPresetName(index);
  const modules =
    row.modules && typeof row.modules === 'object'
      ? normalizeCalendarModuleFilters(row.modules as Partial<CalendarModuleFilters>)
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

export function normalizeCalendarFilterPresets(input: unknown): CalendarFilterPreset[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  return input
    .map((preset, index) => normalizeCalendarFilterPreset(preset, index))
    .filter((preset): preset is CalendarFilterPreset => preset !== null)
    .filter((preset) => {
      const key = normalizeCalendarFilterKey(preset.name);
      if (key === 'family') return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function loadStoredCalendarFilterPresets(userId?: string | null): CalendarFilterPreset[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(CALENDAR_FILTER_PRESETS_KEY, userId));
    if (!raw) return [];
    return normalizeCalendarFilterPresets(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveStoredCalendarFilterPresets(
  presets: CalendarFilterPreset[],
  userId?: string | null,
): void {
  if (!canUseStorage()) return;
  const normalized = normalizeCalendarFilterPresets(presets);
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
    modules: normalizeCalendarModuleFilters(modules),
    reminderRecipients: reminderRecipients.map((value) => value.trim()).filter((value) => value.length > 0),
    color: normalizePresetColor(color),
    enabled: false,
  };
}

export function normalizeCalendarFilterName(name: string): string {
  return normalizeFilterPresetName(name);
}

export function formatCalendarLayerLabel(value: string | null | undefined): string {
  const compact = typeof value === 'string' ? value.trim() : '';
  if (!compact || compact.toLowerCase() === 'manual') return 'Family';

  return compact
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeCalendarModuleFilterSettings(input: unknown): CalendarModuleFilterSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { labelOverrides: {} };
  }

  const labelOverridesRaw = (input as { labelOverrides?: unknown }).labelOverrides;
  const normalized: ModuleLabelOverrides = {};
  if (labelOverridesRaw && typeof labelOverridesRaw === 'object' && !Array.isArray(labelOverridesRaw)) {
    CALENDAR_MODULES.forEach((module) => {
      const value = (labelOverridesRaw as Record<string, unknown>)[module];
      if (typeof value !== 'string') return;
      const trimmed = value.trim().replace(/\s+/g, ' ');
      if (!trimmed) return;
      normalized[module] = trimmed;
    });
  }

  return { labelOverrides: normalized };
}

export function loadStoredCalendarModuleFilterSettings(userId?: string | null): CalendarModuleFilterSettings {
  if (!canUseStorage()) return { labelOverrides: {} };
  try {
    const raw = window.localStorage.getItem(scopedKey(CALENDAR_MODULE_FILTER_SETTINGS_KEY, userId));
    if (!raw) return { labelOverrides: {} };
    return normalizeCalendarModuleFilterSettings(JSON.parse(raw));
  } catch {
    return { labelOverrides: {} };
  }
}

export function saveStoredCalendarModuleFilterSettings(
  settings: CalendarModuleFilterSettings,
  userId?: string | null,
): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(
    scopedKey(CALENDAR_MODULE_FILTER_SETTINGS_KEY, userId),
    JSON.stringify(normalizeCalendarModuleFilterSettings(settings)),
  );
}
