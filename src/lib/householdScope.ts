let currentAuthUserId: string | null = null;
let sharedHouseholdOwnerId: string | null = null;

export function setSharedHouseholdScope(currentUserId?: string | null, ownerUserId?: string | null) {
  currentAuthUserId = currentUserId || null;
  sharedHouseholdOwnerId = ownerUserId || currentUserId || null;
}

export function clearSharedHouseholdScope() {
  currentAuthUserId = null;
  sharedHouseholdOwnerId = null;
}

export function getSharedHouseholdOwnerId(): string | null {
  return sharedHouseholdOwnerId || currentAuthUserId || null;
}

export function getCurrentAuthUserId(): string | null {
  return currentAuthUserId;
}

export function normalizeAdultScopeIdForRead(value?: string | null): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  if (normalized === 'me') {
    if (currentAuthUserId && sharedHouseholdOwnerId && currentAuthUserId === sharedHouseholdOwnerId) {
      return 'me';
    }
    return sharedHouseholdOwnerId || currentAuthUserId || 'me';
  }
  if (currentAuthUserId && normalized === currentAuthUserId) {
    return 'me';
  }
  return normalized;
}

export function normalizeAdultScopeIdForWrite(value?: string | null): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return null;
  if (normalized === 'me') {
    return currentAuthUserId || sharedHouseholdOwnerId || 'me';
  }
  return normalized;
}

export function resolveSharedScopeUserId(userId?: string | null): string | null {
  if (!userId || userId === 'scope') {
    return sharedHouseholdOwnerId || currentAuthUserId || null;
  }
  if (currentAuthUserId && userId === currentAuthUserId) {
    return sharedHouseholdOwnerId || currentAuthUserId;
  }
  return userId;
}
