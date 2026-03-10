const COMMON_DEPARTURE_ADDRESSES_KEY = 'homehub.commonDepartureAddresses.v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function scopedKey(userId?: string | null): string {
  return `${COMMON_DEPARTURE_ADDRESSES_KEY}:${userId || 'anon'}`;
}

function normalizeAddress(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

function dedupeAddresses(addresses: string[]): string[] {
  const byNormalized = new Map<string, string>();
  addresses.forEach((item) => {
    const normalized = normalizeAddress(item);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (!byNormalized.has(key)) byNormalized.set(key, normalized);
  });
  return Array.from(byNormalized.values());
}

export function loadCommonDepartureAddresses(userId?: string | null): string[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(scopedKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeAddresses(parsed.map((item) => String(item || '')));
  } catch {
    return [];
  }
}

export function saveCommonDepartureAddresses(addresses: string[], userId?: string | null): string[] {
  const cleaned = dedupeAddresses(addresses);
  if (canUseStorage()) {
    window.localStorage.setItem(scopedKey(userId), JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent('homehub:departure-addresses-updated'));
  }
  return cleaned;
}

