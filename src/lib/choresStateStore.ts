import { loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { resolveSharedScopeUserId } from '@/lib/householdScope';

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayDateKey(): string {
  return formatDateKey(new Date());
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeCompletionDates(value: unknown, fallbackDate?: string): string[] {
  const normalized = Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item))
        .map((item) => item.trim())
    : [];
  const unique = [...new Set(normalized)];
  if (unique.length > 0) return unique;
  return fallbackDate ? [fallbackDate] : [];
}

function normalizeDailyChoreChecksForToday(state: Record<string, unknown>): Record<string, unknown> {
  const today = todayDateKey();
  const lastDailyResetDate = typeof state.lastDailyResetDate === 'string' ? state.lastDailyResetDate : '';
  const dailyFallbackDate = lastDailyResetDate === today ? today : undefined;
  const children = Array.isArray(state.children)
    ? state.children.map((child) => {
        if (!child || typeof child !== 'object' || Array.isArray(child)) return child;
        const childRecord = child as Record<string, unknown>;
        if (!Array.isArray(childRecord.dailyChores)) return child;

        return {
          ...childRecord,
          dailyChores: childRecord.dailyChores.map((chore) => {
            if (!chore || typeof chore !== 'object' || Array.isArray(chore)) return chore;
            const choreRecord = chore as Record<string, unknown>;
            const completionDates = normalizeCompletionDates(
              choreRecord.completionDates,
              choreRecord.isCompleted === true ? dailyFallbackDate : undefined,
            );

            return {
              ...choreRecord,
              isCompleted: completionDates.includes(today),
              completionDates,
            };
          }),
        };
      })
    : state.children;

  return {
    ...state,
    children,
    lastDailyResetDate: lastDailyResetDate === today ? state.lastDailyResetDate : today,
  };
}

function hasMeaningfulChoresState(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.children) || Array.isArray(record.availableExtraChores);
}

function updatedAtMs(value: unknown): number {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0;
  const updatedAt = (value as Record<string, unknown>).updatedAt;
  if (typeof updatedAt !== 'string') return 0;
  const parsed = new Date(updatedAt).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasTodayDailyCompletion(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const children = (value as Record<string, unknown>).children;
  if (!Array.isArray(children)) return false;
  const today = todayDateKey();
  return children.some((child) => {
    if (!child || typeof child !== 'object' || Array.isArray(child)) return false;
    const dailyChores = (child as Record<string, unknown>).dailyChores;
    if (!Array.isArray(dailyChores)) return false;
    return dailyChores.some((chore) => {
      if (!chore || typeof chore !== 'object' || Array.isArray(chore)) return false;
      const record = chore as Record<string, unknown>;
      return normalizeCompletionDates(record.completionDates, record.isCompleted === true ? today : undefined)
        .includes(today);
    });
  });
}

function chooseBestChoresState(
  remote: Record<string, unknown> | null,
  local: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!hasMeaningfulChoresState(remote)) return hasMeaningfulChoresState(local) ? local : null;
  if (!hasMeaningfulChoresState(local)) return remote;

  const remoteUpdatedAt = updatedAtMs(remote);
  const localUpdatedAt = updatedAtMs(local);
  if (localUpdatedAt > remoteUpdatedAt) return local;
  if (remoteUpdatedAt > localUpdatedAt) return remote;

  const today = todayDateKey();
  const remoteResetDate = typeof remote.lastDailyResetDate === 'string' ? remote.lastDailyResetDate : '';
  const localResetDate = typeof local.lastDailyResetDate === 'string' ? local.lastDailyResetDate : '';
  if (localResetDate === today && remoteResetDate !== today) return local;
  if (hasTodayDailyCompletion(local) && !hasTodayDailyCompletion(remote)) return local;

  return remote;
}

export function choresStateStorageKey(userId?: string | null): string {
  return `${CHORES_STATE_KEY_PREFIX}:${resolveSharedScopeUserId(userId) || 'anon'}`;
}

export function readStoredChoresState(userId?: string | null): Record<string, unknown> | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(choresStateStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return normalizeDailyChoreChecksForToday(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function writeStoredChoresState(state: Record<string, unknown>, userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(choresStateStorageKey(userId), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent('homehub:chores-state-updated'));
}

export async function hydrateChoresStateFromAccount(userId?: string | null): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId);
  if (!scopedUserId) return;

  const document = await loadProfileSettingsDocument(scopedUserId);
  const stored = document?.shared_preferences;
  const chores =
    stored && typeof stored === 'object' && !Array.isArray(stored)
      ? (stored as Record<string, unknown>).chores
      : null;
  const remoteChores = chores && typeof chores === 'object' && !Array.isArray(chores)
    ? chores as Record<string, unknown>
    : null;
  const localFallback = readStoredChoresState(scopedUserId);
  const bestState = chooseBestChoresState(remoteChores, localFallback);

  if (hasMeaningfulChoresState(bestState)) {
    writeStoredChoresState(bestState, scopedUserId);
    if (bestState === localFallback && bestState !== remoteChores) {
      await updateProfileSettingsValue(scopedUserId, ['shared_preferences', 'chores'], bestState);
    }
    return;
  }
}

export async function persistChoresStateToAccount(
  userId: string | null | undefined,
  state: Record<string, unknown>,
): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId);
  if (!scopedUserId) return;
  await updateProfileSettingsValue(scopedUserId, ['shared_preferences', 'chores'], state);
}
