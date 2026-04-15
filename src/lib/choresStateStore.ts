import { loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { resolveSharedScopeUserId } from '@/lib/householdScope';

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function hasMeaningfulChoresState(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.children) || Array.isArray(record.availableExtraChores);
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
    return parsed as Record<string, unknown>;
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

  if (hasMeaningfulChoresState(chores)) {
    writeStoredChoresState(chores, scopedUserId);
    return;
  }

  const localFallback = readStoredChoresState(scopedUserId);
  if (hasMeaningfulChoresState(localFallback)) {
    await updateProfileSettingsValue(scopedUserId, ['shared_preferences', 'chores'], localFallback);
    writeStoredChoresState(localFallback, scopedUserId);
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
