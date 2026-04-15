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

export function resolveSharedScopeUserId(userId?: string | null): string | null {
  if (!userId || userId === 'scope') {
    return sharedHouseholdOwnerId || currentAuthUserId || null;
  }
  if (currentAuthUserId && userId === currentAuthUserId) {
    return sharedHouseholdOwnerId || currentAuthUserId;
  }
  return userId;
}
