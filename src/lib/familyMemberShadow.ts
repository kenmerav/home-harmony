import {
  getProfileSettingsValue,
  loadProfileSettingsDocument,
  updateProfileSettingsValue,
} from '@/lib/profileSettingsStore';

const FAMILY_MEMBER_SHADOW_SETTINGS_PATH = ['shared_preferences', 'family_members'];

export type SharedFamilyMemberRole = 'owner' | 'spouse' | 'kid';

export interface SharedFamilyMemberShadow {
  userId: string;
  email: string | null;
  fullName: string | null;
  role: SharedFamilyMemberRole;
  status: 'active';
  createdAt: string;
}

function normalizeShadowRole(value: unknown): SharedFamilyMemberRole {
  return value === 'spouse' || value === 'kid' ? value : 'owner';
}

function normalizeFamilyMemberShadows(input: unknown): SharedFamilyMemberShadow[] {
  if (!Array.isArray(input)) return [];

  const seen = new Set<string>();
  const normalized: SharedFamilyMemberShadow[] = [];

  input.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return;
    const record = item as Partial<SharedFamilyMemberShadow>;
    const userId = typeof record.userId === 'string' ? record.userId.trim() : '';
    if (!userId || seen.has(userId)) return;
    seen.add(userId);
    normalized.push({
      userId,
      email: typeof record.email === 'string' && record.email.trim() ? record.email.trim().toLowerCase() : null,
      fullName: typeof record.fullName === 'string' && record.fullName.trim() ? record.fullName.trim() : null,
      role: normalizeShadowRole(record.role),
      status: 'active',
      createdAt:
        typeof record.createdAt === 'string' && record.createdAt.trim()
          ? record.createdAt
          : new Date().toISOString(),
    });
  });

  return normalized;
}

export async function loadFamilyMemberShadowsFromAccount(
  scopedUserId?: string | null,
): Promise<SharedFamilyMemberShadow[]> {
  if (!scopedUserId) return [];
  try {
    const document = await loadProfileSettingsDocument(scopedUserId);
    return normalizeFamilyMemberShadows(
      getProfileSettingsValue(document, FAMILY_MEMBER_SHADOW_SETTINGS_PATH),
    );
  } catch (error) {
    console.error('Failed loading family member shadows:', error);
    return [];
  }
}

export async function upsertFamilyMemberShadow(
  scopedUserId: string | null | undefined,
  member: Omit<SharedFamilyMemberShadow, 'status'> & { status?: 'active' },
): Promise<void> {
  if (!scopedUserId || !member.userId) return;
  const current = await loadFamilyMemberShadowsFromAccount(scopedUserId);
  const next = normalizeFamilyMemberShadows([
    ...current.filter((entry) => entry.userId !== member.userId),
    {
      userId: member.userId,
      email: member.email ?? null,
      fullName: member.fullName ?? null,
      role: member.role,
      status: 'active',
      createdAt: member.createdAt || new Date().toISOString(),
    },
  ]);
  await updateProfileSettingsValue(scopedUserId, FAMILY_MEMBER_SHADOW_SETTINGS_PATH, next);
}
