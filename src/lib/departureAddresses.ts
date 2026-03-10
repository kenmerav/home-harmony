const COMMON_DEPARTURE_ADDRESSES_KEY = 'homehub.commonDepartureAddresses.v1';
const DEPARTURE_ADDRESS_PROFILE_KEY = 'homehub.departureAddressProfile.v1';

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function scopedKey(userId?: string | null): string {
  return `${COMMON_DEPARTURE_ADDRESSES_KEY}:${userId || 'anon'}`;
}

function profileKey(userId?: string | null): string {
  return `${DEPARTURE_ADDRESS_PROFILE_KEY}:${userId || 'anon'}`;
}

function normalizeAddress(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeAddressForCompare(value: unknown): string {
  const normalized = normalizeAddress(value);
  if (!normalized) return '';
  return normalized
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeAddresses(addresses: string[]): string[] {
  const byNormalized = new Map<string, string>();
  addresses.forEach((item) => {
    const normalized = normalizeAddress(item);
    if (!normalized) return;
    const key = normalizeAddressForCompare(normalized);
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

export interface DepartureAddressProfile {
  homeAddress: string;
  workAddress: string;
}

const EMPTY_PROFILE: DepartureAddressProfile = {
  homeAddress: '',
  workAddress: '',
};

export function loadDepartureAddressProfile(userId?: string | null): DepartureAddressProfile {
  if (!canUseStorage()) return { ...EMPTY_PROFILE };
  try {
    const raw = window.localStorage.getItem(profileKey(userId));
    if (!raw) return { ...EMPTY_PROFILE };
    const parsed = JSON.parse(raw) as Partial<DepartureAddressProfile> | null;
    return {
      homeAddress: normalizeAddress(parsed?.homeAddress || ''),
      workAddress: normalizeAddress(parsed?.workAddress || ''),
    };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}

export function saveDepartureAddressProfile(
  profile: Partial<DepartureAddressProfile>,
  userId?: string | null,
): DepartureAddressProfile {
  const cleaned: DepartureAddressProfile = {
    homeAddress: normalizeAddress(profile.homeAddress || ''),
    workAddress: normalizeAddress(profile.workAddress || ''),
  };
  if (canUseStorage()) {
    window.localStorage.setItem(profileKey(userId), JSON.stringify(cleaned));
    window.dispatchEvent(new CustomEvent('homehub:departure-addresses-updated'));
  }
  return cleaned;
}
