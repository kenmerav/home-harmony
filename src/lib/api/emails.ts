import { supabase } from '@/integrations/supabase/client';

interface EmailInvokeResponse {
  success?: boolean;
  error?: string;
}

async function invokeEmail(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('transactional-email', { body: payload });
  if (error) throw new Error(error.message || 'Failed to send email.');
  const response = (data || {}) as EmailInvokeResponse;
  if (response.error) throw new Error(response.error);
  return response;
}

export async function sendWelcomeEmail(appUrl?: string) {
  return invokeEmail({
    action: 'send_welcome',
    appUrl:
      appUrl ||
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  });
}

export async function sendWelcomePreviewEmail(payload: {
  email: string;
  userName?: string;
  appUrl?: string;
}) {
  return invokeEmail({
    action: 'send_welcome_preview',
    email: payload.email,
    userName: payload.userName,
    appUrl:
      payload.appUrl ||
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  });
}

export async function sendLifecyclePreviewEmail(payload: {
  email: string;
  userName?: string;
  templateKey:
    | 'welcome'
    | 'plan_meals'
    | 'review_grocery'
    | 'invite_household'
    | 'set_reminders'
    | 'calendar_setup'
    | 'power_up';
  appUrl?: string;
}) {
  return invokeEmail({
    action: 'send_email_preview',
    email: payload.email,
    userName: payload.userName,
    templateKey: payload.templateKey,
    appUrl:
      payload.appUrl ||
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  });
}

export async function sendFamilyInviteEmail(payload: {
  email: string;
  role: 'spouse' | 'kid';
  inviteLink: string;
  householdName?: string | null;
  appUrl?: string;
}) {
  return invokeEmail({
    action: 'send_family_invite',
    email: payload.email,
    role: payload.role,
    inviteLink: payload.inviteLink,
    householdName: payload.householdName || null,
    appUrl:
      payload.appUrl ||
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  });
}

export async function sendAdminNewUserNotice(payload: {
  email: string;
  userName?: string;
  roleLabel?: string;
  onboardingMode?: string;
  householdName?: string | null;
  appUrl?: string;
}) {
  return invokeEmail({
    action: 'send_admin_new_user_notice',
    email: payload.email,
    userName: payload.userName,
    roleLabel: payload.roleLabel,
    onboardingMode: payload.onboardingMode,
    householdName: payload.householdName || null,
    appUrl:
      payload.appUrl ||
      (typeof window !== 'undefined' ? window.location.origin : undefined),
  });
}
