import { loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { resolveSharedScopeUserId } from '@/lib/householdScope';

const CHORES_STATE_KEY_PREFIX = 'homehub.choresEconomyState.v2';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return;
  const chores = (stored as Record<string, unknown>).chores;
  if (!chores || typeof chores !== 'object' || Array.isArray(chores)) return;

  writeStoredChoresState(chores as Record<string, unknown>, scopedUserId);
}

export async function persistChoresStateToAccount(
  userId: string | null | undefined,
  state: Record<string, unknown>,
): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId);
  if (!scopedUserId) return;
  await updateProfileSettingsValue(scopedUserId, ['shared_preferences', 'chores'], state);
}
