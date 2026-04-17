export type BillingInterval = 'monthly' | 'yearly';

export const HOME_HARMONY_PRICING = {
  trialDays: 14,
  monthly: 9.97,
  yearly: 79.97,
} as const;

export function formatUsd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function yearlySavingsAmount(): number {
  return Number((HOME_HARMONY_PRICING.monthly * 12 - HOME_HARMONY_PRICING.yearly).toFixed(2));
}

export function yearlyEquivalentMonthly(): number {
  return Number((HOME_HARMONY_PRICING.yearly / 12).toFixed(2));
}

export function pricingLabel(interval: BillingInterval): string {
  return interval === 'monthly'
    ? `${formatUsd(HOME_HARMONY_PRICING.monthly)}/month`
    : `${formatUsd(HOME_HARMONY_PRICING.yearly)}/year`;
}

export function inferBillingIntervalFromPriceId(priceId?: string | null): BillingInterval | null {
  if (!priceId) return null;

  const normalizedPriceId = priceId.trim().toLowerCase();
  if (!normalizedPriceId) return null;

  const monthlyEnv = String(import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY || '').trim().toLowerCase();
  const yearlyEnv = String(import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY || '').trim().toLowerCase();
  const defaultEnv = String(import.meta.env.VITE_STRIPE_PRICE_ID || '').trim().toLowerCase();

  if (monthlyEnv && normalizedPriceId === monthlyEnv) return 'monthly';
  if (yearlyEnv && normalizedPriceId === yearlyEnv) return 'yearly';
  if (defaultEnv && normalizedPriceId === defaultEnv) {
    if (yearlyEnv && !monthlyEnv) return 'yearly';
    if (monthlyEnv && !yearlyEnv) return 'monthly';
  }

  if (
    normalizedPriceId.includes('year') ||
    normalizedPriceId.includes('annual') ||
    normalizedPriceId.includes('annually')
  ) {
    return 'yearly';
  }

  if (
    normalizedPriceId.includes('month') ||
    normalizedPriceId.includes('monthly')
  ) {
    return 'monthly';
  }

  return null;
}

export function amountForBillingInterval(interval: BillingInterval | null): number | null {
  if (!interval) return null;
  return interval === 'monthly' ? HOME_HARMONY_PRICING.monthly : HOME_HARMONY_PRICING.yearly;
}
