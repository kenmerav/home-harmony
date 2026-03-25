import { supabase } from '@/integrations/supabase/client';

export type ProfileSettingsDocument = Record<string, unknown>;

function normalizeProfileSettingsDocument(input: unknown): ProfileSettingsDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return { ...(input as Record<string, unknown>) };
}

export async function loadProfileSettingsDocument(userId?: string | null): Promise<ProfileSettingsDocument> {
  if (!userId) return {};

  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_settings')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeProfileSettingsDocument(data?.onboarding_settings);
}

export function getProfileSettingsValue(document: ProfileSettingsDocument, path: string[]): unknown {
  let current: unknown = document;
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function setProfileSettingsValue(
  document: ProfileSettingsDocument,
  path: string[],
  value: unknown,
): ProfileSettingsDocument {
  if (path.length === 0) {
    return normalizeProfileSettingsDocument(value);
  }

  const root = normalizeProfileSettingsDocument(document);
  const next: ProfileSettingsDocument = { ...root };
  let cursor: ProfileSettingsDocument = next;

  path.forEach((segment, index) => {
    const isLeaf = index === path.length - 1;
    if (isLeaf) {
      cursor[segment] = value;
      return;
    }

    const existing = normalizeProfileSettingsDocument(cursor[segment]);
    const cloned = { ...existing };
    cursor[segment] = cloned;
    cursor = cloned;
  });

  return next;
}

export async function updateProfileSettingsValue(
  userId: string | null | undefined,
  path: string[],
  value: unknown,
): Promise<ProfileSettingsDocument> {
  if (!userId) {
    return setProfileSettingsValue({}, path, value);
  }

  const current = await loadProfileSettingsDocument(userId);
  const next = setProfileSettingsValue(current, path, value);

  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_settings: next })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  return next;
}
