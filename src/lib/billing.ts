export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';
const BILLING_EXEMPT_EMAILS = new Set(['kroberts035@gmail.com']);

export function isBillingExemptEmail(email?: string | null): boolean {
  return Boolean(email && BILLING_EXEMPT_EMAILS.has(email.trim().toLowerCase()));
}

export function getPostAuthRoute(isSubscribed: boolean): string {
  if (!BILLING_ENABLED) return '/app';
  return isSubscribed ? '/app' : '/billing';
}
