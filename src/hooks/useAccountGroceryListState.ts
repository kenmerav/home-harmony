import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  hasMeaningfulGroceryListState,
  loadAccountGroceryListState,
  loadLocalGroceryListState,
  normalizeStoredGroceryListState,
  saveAccountGroceryListState,
  saveLocalGroceryListState,
  StoredGroceryListState,
} from '@/lib/groceryListStateStore';

function applyStateAction<T>(value: SetStateAction<T>, previous: T): T {
  return typeof value === 'function' ? (value as (current: T) => T)(previous) : value;
}

function serializeState(state: StoredGroceryListState): string {
  return JSON.stringify(normalizeStoredGroceryListState(state));
}

interface UseAccountGroceryListStateResult {
  groceryListState: StoredGroceryListState;
  setGroceryListState: Dispatch<SetStateAction<StoredGroceryListState>>;
}

export function useAccountGroceryListState(userId?: string | null): UseAccountGroceryListStateResult {
  const scopeKey = userId || 'anon';
  const [groceryListState, setInternalState] = useState<StoredGroceryListState>(() =>
    loadLocalGroceryListState(userId),
  );
  const activeScopeRef = useRef<string | null>(null);
  const persistedSnapshotRef = useRef<string | null>(null);
  const latestStateRef = useRef(groceryListState);

  useEffect(() => {
    latestStateRef.current = groceryListState;
  }, [groceryListState]);

  useEffect(() => {
    let cancelled = false;
    activeScopeRef.current = null;

    const localState = loadLocalGroceryListState(userId);
    const localSnapshot = serializeState(localState);
    latestStateRef.current = localState;
    setInternalState(localState);

    const finishHydration = (next: StoredGroceryListState) => {
      if (cancelled) return;
      const normalized = normalizeStoredGroceryListState(next);
      const snapshot = serializeState(normalized);
      saveLocalGroceryListState(normalized, userId);
      latestStateRef.current = normalized;
      persistedSnapshotRef.current = snapshot;
      activeScopeRef.current = scopeKey;
      setInternalState(normalized);
    };

    if (!userId) {
      finishHydration(localState);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      try {
        const remoteState = await loadAccountGroceryListState(userId);
        if (cancelled) return;

        const currentSnapshot = serializeState(latestStateRef.current);
        const localChangedDuringLoad = currentSnapshot !== localSnapshot;

        if (localChangedDuringLoad) {
          const currentState = normalizeStoredGroceryListState(latestStateRef.current);
          await saveAccountGroceryListState(userId, currentState);
          finishHydration(currentState);
          return;
        }

        if (remoteState) {
          finishHydration(remoteState);
          return;
        }

        if (hasMeaningfulGroceryListState(localState)) {
          await saveAccountGroceryListState(userId, localState);
        }

        finishHydration(localState);
      } catch (error) {
        console.error('Failed to hydrate grocery list state:', error);
        finishHydration(latestStateRef.current);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [scopeKey, userId]);

  useEffect(() => {
    if (activeScopeRef.current !== scopeKey) return;

    const normalized = normalizeStoredGroceryListState(groceryListState);
    const snapshot = serializeState(normalized);
    if (snapshot === persistedSnapshotRef.current) return;

    saveLocalGroceryListState(normalized, userId);
    if (!userId) {
      persistedSnapshotRef.current = snapshot;
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void saveAccountGroceryListState(userId, normalized)
        .then(() => {
          if (cancelled) return;
          persistedSnapshotRef.current = snapshot;
        })
        .catch((error) => {
          console.error('Failed to save grocery list state:', error);
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [groceryListState, scopeKey, userId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const refreshFromAccount = async () => {
      if (activeScopeRef.current !== scopeKey) return;

      const currentSnapshot = serializeState(latestStateRef.current);
      if (persistedSnapshotRef.current && currentSnapshot !== persistedSnapshotRef.current) {
        return;
      }

      try {
        const remoteState = await loadAccountGroceryListState(userId);
        if (cancelled || !remoteState) return;

        const normalized = normalizeStoredGroceryListState(remoteState);
        const remoteSnapshot = serializeState(normalized);
        if (remoteSnapshot === serializeState(latestStateRef.current)) return;

        saveLocalGroceryListState(normalized, userId);
        latestStateRef.current = normalized;
        persistedSnapshotRef.current = remoteSnapshot;
        setInternalState(normalized);
      } catch (error) {
        console.error('Failed to refresh grocery list state:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshFromAccount();
      }
    };

    const handleFocus = () => {
      void refreshFromAccount();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scopeKey, userId]);

  const setGroceryListState = useCallback<Dispatch<SetStateAction<StoredGroceryListState>>>((value) => {
    setInternalState((previous) => {
      const next = normalizeStoredGroceryListState(applyStateAction(value, previous));
      saveLocalGroceryListState(next, userId);
      return next;
    });
  }, [userId]);

  return useMemo(
    () => ({
      groceryListState,
      setGroceryListState,
    }),
    [groceryListState, setGroceryListState],
  );
}
