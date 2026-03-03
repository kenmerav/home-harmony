export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';

export function getPostAuthRoute(isSubscribed: boolean): string {
  if (!BILLING_ENABLED) return '/app';
  return isSubscribed ? '/app' : '/billing';
}
