import { supabase } from '@/integrations/supabase/client';

export interface StoredOnboardingResult {
  completedAt: string;
  onboarding: Record<string, unknown>;
  personalizedPlan: Record<string, unknown>;
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function resultKey(userId?: string | null): string {
  return `homehub.onboardingResult.v1:${userId || 'anon'}`;
}

function draftKey(userId?: string | null): string {
  return `homehub.onboardingDraft.v1:${userId || 'anon'}`;
}

function readLocalResult(userId?: string | null): StoredOnboardingResult | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(resultKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as StoredOnboardingResult;
  } catch {
    return null;
  }
}

function writeLocalResult(userId: string | null | undefined, payload: StoredOnboardingResult) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(resultKey(userId), JSON.stringify(payload));
}

export async function loadOnboardingResult(userId?: string | null): Promise<StoredOnboardingResult | null> {
  if (!userId) return readLocalResult(null);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_settings,onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;

    const settings = data?.onboarding_settings;
    const completedAt = data?.onboarding_completed_at || null;

    if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
      const record = settings as Record<string, unknown>;
      const onboarding = record.onboarding;
      const personalizedPlan = record.personalizedPlan;

      if (
        onboarding &&
        typeof onboarding === 'object' &&
        !Array.isArray(onboarding) &&
        personalizedPlan &&
        typeof personalizedPlan === 'object' &&
        !Array.isArray(personalizedPlan)
      ) {
        const payload: StoredOnboardingResult = {
          completedAt: typeof completedAt === 'string' ? completedAt : new Date().toISOString(),
          onboarding: onboarding as Record<string, unknown>,
          personalizedPlan: personalizedPlan as Record<string, unknown>,
        };
        writeLocalResult(userId, payload);
        return payload;
      }
    }
  } catch (error) {
    console.error('Failed to load onboarding settings from profile:', error);
  }

  return readLocalResult(userId);
}

export async function saveOnboardingResult(
  userId: string | null | undefined,
  payload: StoredOnboardingResult,
): Promise<void> {
  writeLocalResult(userId, payload);

  if (!userId) return;

  const { error } = await supabase
    .from('profiles')
    .update({
      onboarding_settings: {
        onboarding: payload.onboarding,
        personalizedPlan: payload.personalizedPlan,
      },
      onboarding_completed_at: payload.completedAt,
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export function loadOnboardingDraft(userId?: string | null): { onboarding: Record<string, unknown>; stepId: string } | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<{ onboarding: Record<string, unknown>; stepId: string }>;
    if (!parsed.onboarding || !parsed.stepId) return null;
    return { onboarding: parsed.onboarding, stepId: parsed.stepId };
  } catch {
    return null;
  }
}

export function saveOnboardingDraft(
  userId: string | null | undefined,
  payload: { onboarding: Record<string, unknown>; stepId: string },
) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(draftKey(userId), JSON.stringify(payload));
}

export function clearOnboardingDraft(userId?: string | null) {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(draftKey(userId));
}
