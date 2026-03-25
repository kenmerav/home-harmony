import {
  CalendarFilterPreset,
  CalendarModuleFilterSettings,
  CalendarModuleFilters,
  filtersEqual,
  loadStoredCalendarFilterPresets,
  loadStoredCalendarFilters,
  loadStoredCalendarModuleFilterSettings,
  moduleDefaultFilters,
  normalizeCalendarFilterPresets,
  normalizeCalendarModuleFilters,
  normalizeCalendarModuleFilterSettings,
  saveStoredCalendarFilterPresets,
  saveStoredCalendarFilters,
  saveStoredCalendarModuleFilterSettings,
} from '@/lib/calendarFilters';
import {
  getProfileSettingsValue,
  loadProfileSettingsDocument,
  updateProfileSettingsValue,
} from '@/lib/profileSettingsStore';

const CALENDAR_PREFERENCES_PATH = ['appPreferences', 'calendar'];

export interface StoredCalendarPreferences {
  filters: CalendarModuleFilters;
  filterPresets: CalendarFilterPreset[];
  moduleFilterSettings: CalendarModuleFilterSettings;
}

export function normalizeStoredCalendarPreferences(input: unknown): StoredCalendarPreferences {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {
      filters: moduleDefaultFilters(),
      filterPresets: [],
      moduleFilterSettings: { labelOverrides: {} },
    };
  }

  const record = input as Record<string, unknown>;
  return {
    filters: normalizeCalendarModuleFilters(record.filters as Partial<CalendarModuleFilters> | undefined),
    filterPresets: normalizeCalendarFilterPresets(record.filterPresets),
    moduleFilterSettings: normalizeCalendarModuleFilterSettings(record.moduleFilterSettings),
  };
}

export function loadLocalCalendarPreferences(userId?: string | null): StoredCalendarPreferences {
  return {
    filters: loadStoredCalendarFilters(userId),
    filterPresets: loadStoredCalendarFilterPresets(userId),
    moduleFilterSettings: loadStoredCalendarModuleFilterSettings(userId),
  };
}

export function saveLocalCalendarPreferences(
  preferences: StoredCalendarPreferences,
  userId?: string | null,
): void {
  const normalized = normalizeStoredCalendarPreferences(preferences);
  saveStoredCalendarFilters(normalized.filters, userId);
  saveStoredCalendarFilterPresets(normalized.filterPresets, userId);
  saveStoredCalendarModuleFilterSettings(normalized.moduleFilterSettings, userId);
}

export async function loadAccountCalendarPreferences(
  userId?: string | null,
): Promise<StoredCalendarPreferences | null> {
  if (!userId) return null;

  const document = await loadProfileSettingsDocument(userId);
  const value = getProfileSettingsValue(document, CALENDAR_PREFERENCES_PATH);
  if (typeof value === 'undefined') return null;
  return normalizeStoredCalendarPreferences(value);
}

export async function saveAccountCalendarPreferences(
  userId: string,
  preferences: StoredCalendarPreferences,
): Promise<void> {
  await updateProfileSettingsValue(
    userId,
    CALENDAR_PREFERENCES_PATH,
    normalizeStoredCalendarPreferences(preferences),
  );
}

export function hasMeaningfulCalendarPreferences(preferences: StoredCalendarPreferences): boolean {
  return (
    !filtersEqual(preferences.filters, moduleDefaultFilters()) ||
    preferences.filterPresets.length > 0 ||
    Object.keys(preferences.moduleFilterSettings.labelOverrides).length > 0
  );
}
