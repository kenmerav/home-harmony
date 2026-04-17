export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';
const BILLING_EXEMPT_EMAILS = new Set(['kroberts035@gmail.com']);

export interface BillingSubscriptionLike {
  status?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
}

export function isBillingExemptEmail(email?: string | null): boolean {
  return Boolean(email && BILLING_EXEMPT_EMAILS.has(email.trim().toLowerCase()));
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getSubscriptionAccessEndDate(subscription?: BillingSubscriptionLike | null): Date | null {
  if (!subscription) return null;

  const dates = [toDate(subscription.currentPeriodEnd), toDate(subscription.trialEndsAt)].filter(
    (date): date is Date => Boolean(date),
  );
  if (!dates.length) return null;

  return dates.sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

export function hasSubscriptionAccess(subscription?: BillingSubscriptionLike | null): boolean {
  const status = String(subscription?.status || '').toLowerCase();
  if (status === 'active' || status === 'trialing') return true;

  if (status === 'canceled') {
    const accessEndDate = getSubscriptionAccessEndDate(subscription);
    return Boolean(accessEndDate && accessEndDate.getTime() > Date.now());
  }

  return false;
}

export function getPostAuthRoute(isSubscribed: boolean): string {
  if (!BILLING_ENABLED) return '/app';
  return isSubscribed ? '/app' : '/billing';
}
