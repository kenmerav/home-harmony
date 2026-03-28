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
