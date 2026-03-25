import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarFilterPreset,
  CalendarModuleFilterSettings,
  CalendarModuleFilters,
  normalizeCalendarFilterPresets,
  normalizeCalendarModuleFilters,
  normalizeCalendarModuleFilterSettings,
} from '@/lib/calendarFilters';
import {
  hasMeaningfulCalendarPreferences,
  loadAccountCalendarPreferences,
  loadLocalCalendarPreferences,
  normalizeStoredCalendarPreferences,
  saveAccountCalendarPreferences,
  saveLocalCalendarPreferences,
  StoredCalendarPreferences,
} from '@/lib/calendarPreferenceStore';

function applyStateAction<T>(value: SetStateAction<T>, previous: T): T {
  return typeof value === 'function' ? (value as (current: T) => T)(previous) : value;
}

function serializeCalendarPreferences(preferences: StoredCalendarPreferences): string {
  return JSON.stringify(normalizeStoredCalendarPreferences(preferences));
}

interface AccountCalendarPreferencesResult {
  filters: CalendarModuleFilters;
  setFilters: Dispatch<SetStateAction<CalendarModuleFilters>>;
  filterPresets: CalendarFilterPreset[];
  setFilterPresets: Dispatch<SetStateAction<CalendarFilterPreset[]>>;
  moduleFilterSettings: CalendarModuleFilterSettings;
  setModuleFilterSettings: Dispatch<SetStateAction<CalendarModuleFilterSettings>>;
}

export function useAccountCalendarPreferences(userId?: string | null): AccountCalendarPreferencesResult {
  const scopeKey = userId || 'anon';
  const [preferences, setPreferences] = useState<StoredCalendarPreferences>(() => loadLocalCalendarPreferences(userId));
  const activeScopeRef = useRef<string | null>(null);
  const persistedSnapshotRef = useRef<string | null>(null);
  const latestPreferencesRef = useRef(preferences);

  useEffect(() => {
    latestPreferencesRef.current = preferences;
  }, [preferences]);

  useEffect(() => {
    let cancelled = false;
    activeScopeRef.current = null;

    const localPreferences = loadLocalCalendarPreferences(userId);
    const localSnapshot = serializeCalendarPreferences(localPreferences);
    latestPreferencesRef.current = localPreferences;
    setPreferences(localPreferences);

    const finishHydration = (next: StoredCalendarPreferences) => {
      if (cancelled) return;
      const normalized = normalizeStoredCalendarPreferences(next);
      const snapshot = serializeCalendarPreferences(normalized);
      saveLocalCalendarPreferences(normalized, userId);
      latestPreferencesRef.current = normalized;
      persistedSnapshotRef.current = snapshot;
      activeScopeRef.current = scopeKey;
      setPreferences(normalized);
    };

    if (!userId) {
      finishHydration(localPreferences);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const remotePreferences = await loadAccountCalendarPreferences(userId);
        if (cancelled) return;

        const currentSnapshot = serializeCalendarPreferences(latestPreferencesRef.current);
        const localChangedDuringLoad = currentSnapshot !== localSnapshot;

        if (localChangedDuringLoad) {
          const currentPreferences = normalizeStoredCalendarPreferences(latestPreferencesRef.current);
          await saveAccountCalendarPreferences(userId, currentPreferences);
          finishHydration(currentPreferences);
          return;
        }

        if (remotePreferences) {
          finishHydration(remotePreferences);
          return;
        }

        if (hasMeaningfulCalendarPreferences(localPreferences)) {
          await saveAccountCalendarPreferences(userId, localPreferences);
        }

        finishHydration(localPreferences);
      } catch (error) {
        console.error('Failed to hydrate calendar preferences:', error);
        finishHydration(latestPreferencesRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scopeKey, userId]);

  useEffect(() => {
    if (activeScopeRef.current !== scopeKey) return;

    const normalized = normalizeStoredCalendarPreferences(preferences);
    const snapshot = serializeCalendarPreferences(normalized);
    if (snapshot === persistedSnapshotRef.current) return;

    saveLocalCalendarPreferences(normalized, userId);
    if (!userId) {
      persistedSnapshotRef.current = snapshot;
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void saveAccountCalendarPreferences(userId, normalized)
        .then(() => {
          if (cancelled) return;
          persistedSnapshotRef.current = snapshot;
        })
        .catch((error) => {
          console.error('Failed to save calendar preferences:', error);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [preferences, scopeKey, userId]);

  const setFilters = useCallback<Dispatch<SetStateAction<CalendarModuleFilters>>>((value) => {
    setPreferences((previous) => ({
      ...previous,
      filters: normalizeCalendarModuleFilters(applyStateAction(value, previous.filters)),
    }));
  }, []);

  const setFilterPresets = useCallback<Dispatch<SetStateAction<CalendarFilterPreset[]>>>((value) => {
    setPreferences((previous) => ({
      ...previous,
      filterPresets: normalizeCalendarFilterPresets(applyStateAction(value, previous.filterPresets)),
    }));
  }, []);

  const setModuleFilterSettings = useCallback<Dispatch<SetStateAction<CalendarModuleFilterSettings>>>((value) => {
    setPreferences((previous) => ({
      ...previous,
      moduleFilterSettings: normalizeCalendarModuleFilterSettings(
        applyStateAction(value, previous.moduleFilterSettings),
      ),
    }));
  }, []);

  return useMemo(
    () => ({
      filters: preferences.filters,
      setFilters,
      filterPresets: preferences.filterPresets,
      setFilterPresets,
      moduleFilterSettings: preferences.moduleFilterSettings,
      setModuleFilterSettings,
    }),
    [preferences.filterPresets, preferences.filters, preferences.moduleFilterSettings, setFilterPresets, setFilters, setModuleFilterSettings],
  );
}
