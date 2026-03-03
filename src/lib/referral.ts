const PENDING_REFERRAL_KEY = 'homehub.pendingReferralCode.v1';

export function stashPendingReferralCode(code: string) {
  if (typeof window === 'undefined') return;
  const normalized = code.trim().toLowerCase();
  if (!normalized) return;
  window.localStorage.setItem(PENDING_REFERRAL_KEY, normalized);
}

export function readPendingReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(PENDING_REFERRAL_KEY);
  return value ? value.trim().toLowerCase() : null;
}

export function clearPendingReferralCode() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PENDING_REFERRAL_KEY);
}
