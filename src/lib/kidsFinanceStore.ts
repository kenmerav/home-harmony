import { loadProfileSettingsDocument, updateProfileSettingsValue } from '@/lib/profileSettingsStore';
import { resolveSharedScopeUserId } from '@/lib/householdScope';

const KIDS_FINANCE_KEY_PREFIX = 'homehub.kidsFinanceState.v1';

export interface KidsFinanceAllocation {
  tithing: number;
  investing: number;
  taxes: number;
  remaining: number;
}

export interface KidsInvestmentLot {
  id: string;
  childId: string;
  createdAt: string;
  amount: number;
  shares: number;
  pricePerShare: number;
  symbol: 'VOO';
  source: 'auto_allocation' | 'manual_adjustment';
}

export interface KidsInvestmentCashOut {
  id: string;
  childId: string;
  createdAt: string;
  amount: number;
  shares: number;
  pricePerShare: number;
  symbol: 'VOO';
}

export interface KidsFinanceChildSettings {
  childId: string;
  allocation: KidsFinanceAllocation;
}

export interface KidsFinanceState {
  childSettings: KidsFinanceChildSettings[];
  investmentLots: KidsInvestmentLot[];
  cashOuts: KidsInvestmentCashOut[];
  updatedAt?: string;
}

export interface VooQuote {
  symbol: 'VOO';
  price: number;
  asOf: string;
  source: string;
}

export const DEFAULT_KIDS_FINANCE_ALLOCATION: KidsFinanceAllocation = {
  tithing: 10,
  investing: 10,
  taxes: 10,
  remaining: 70,
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizePercent(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, Math.round(numeric * 100) / 100));
}

export function normalizeAllocation(value: unknown): KidsFinanceAllocation {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<KidsFinanceAllocation>
    : {};
  const tithing = normalizePercent(record.tithing ?? DEFAULT_KIDS_FINANCE_ALLOCATION.tithing);
  const investing = normalizePercent(record.investing ?? DEFAULT_KIDS_FINANCE_ALLOCATION.investing);
  const taxes = normalizePercent(record.taxes ?? DEFAULT_KIDS_FINANCE_ALLOCATION.taxes);
  const providedRemaining = record.remaining;
  const remaining = providedRemaining === undefined
    ? Math.max(0, Math.round((100 - tithing - investing - taxes) * 100) / 100)
    : normalizePercent(providedRemaining);
  return { tithing, investing, taxes, remaining };
}

function normalizeMoney(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * 100) / 100);
}

function normalizeShares(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
}

function normalizeFinanceState(input: unknown): KidsFinanceState {
  const record = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Partial<KidsFinanceState>
    : {};

  return {
    childSettings: Array.isArray(record.childSettings)
      ? record.childSettings
          .map((item) => ({
            childId: String((item as Partial<KidsFinanceChildSettings>).childId || '').trim(),
            allocation: normalizeAllocation((item as Partial<KidsFinanceChildSettings>).allocation),
          }))
          .filter((item) => item.childId.length > 0)
      : [],
    investmentLots: Array.isArray(record.investmentLots)
      ? record.investmentLots
          .map((item) => {
            const lot = item as Partial<KidsInvestmentLot>;
            return {
              id: String(lot.id || '').trim(),
              childId: String(lot.childId || '').trim(),
              createdAt: typeof lot.createdAt === 'string' ? lot.createdAt : new Date().toISOString(),
              amount: normalizeMoney(lot.amount),
              shares: normalizeShares(lot.shares),
              pricePerShare: normalizeMoney(lot.pricePerShare),
              symbol: 'VOO' as const,
              source: lot.source === 'manual_adjustment' ? 'manual_adjustment' as const : 'auto_allocation' as const,
            };
          })
          .filter((item) => item.id && item.childId && item.amount > 0 && item.shares > 0)
      : [],
    cashOuts: Array.isArray(record.cashOuts)
      ? record.cashOuts
          .map((item) => {
            const cashOut = item as Partial<KidsInvestmentCashOut>;
            return {
              id: String(cashOut.id || '').trim(),
              childId: String(cashOut.childId || '').trim(),
              createdAt: typeof cashOut.createdAt === 'string' ? cashOut.createdAt : new Date().toISOString(),
              amount: normalizeMoney(cashOut.amount),
              shares: normalizeShares(cashOut.shares),
              pricePerShare: normalizeMoney(cashOut.pricePerShare),
              symbol: 'VOO' as const,
            };
          })
          .filter((item) => item.id && item.childId && item.amount > 0 && item.shares > 0)
      : [],
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
  };
}

export function kidsFinanceStorageKey(userId?: string | null): string {
  return `${KIDS_FINANCE_KEY_PREFIX}:${resolveSharedScopeUserId(userId) || 'anon'}`;
}

export function readStoredKidsFinanceState(userId?: string | null): KidsFinanceState {
  if (!canUseStorage()) return normalizeFinanceState(null);
  try {
    const raw = window.localStorage.getItem(kidsFinanceStorageKey(userId));
    return normalizeFinanceState(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeFinanceState(null);
  }
}

export function writeStoredKidsFinanceState(state: KidsFinanceState, userId?: string | null) {
  if (!canUseStorage()) return;
  const normalized = normalizeFinanceState(state);
  window.localStorage.setItem(kidsFinanceStorageKey(userId), JSON.stringify(normalized));
}

export async function hydrateKidsFinanceStateFromAccount(userId?: string | null): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId);
  if (!scopedUserId) return;

  const document = await loadProfileSettingsDocument(scopedUserId);
  const shared = document?.shared_preferences;
  const stored = shared && typeof shared === 'object' && !Array.isArray(shared)
    ? (shared as Record<string, unknown>).kidsFinance
    : null;

  const normalized = normalizeFinanceState(stored);
  if (
    normalized.childSettings.length > 0
    || normalized.investmentLots.length > 0
    || normalized.cashOuts.length > 0
  ) {
    writeStoredKidsFinanceState(normalized, scopedUserId);
    return;
  }

  const local = readStoredKidsFinanceState(scopedUserId);
  if (local.childSettings.length > 0 || local.investmentLots.length > 0 || local.cashOuts.length > 0) {
    await updateProfileSettingsValue(scopedUserId, ['shared_preferences', 'kidsFinance'], local);
    writeStoredKidsFinanceState(local, scopedUserId);
  }
}

export async function persistKidsFinanceStateToAccount(
  userId: string | null | undefined,
  state: KidsFinanceState,
): Promise<void> {
  const scopedUserId = resolveSharedScopeUserId(userId);
  if (!scopedUserId) return;
  const normalized = normalizeFinanceState({ ...state, updatedAt: new Date().toISOString() });
  await updateProfileSettingsValue(scopedUserId, ['shared_preferences', 'kidsFinance'], normalized);
}

export function allocationForChild(state: KidsFinanceState, childId: string): KidsFinanceAllocation {
  return normalizeAllocation(state.childSettings.find((item) => item.childId === childId)?.allocation);
}

export function setAllocationForChild(
  state: KidsFinanceState,
  childId: string,
  allocation: KidsFinanceAllocation,
): KidsFinanceState {
  const normalized = normalizeAllocation(allocation);
  const current = state.childSettings.filter((item) => item.childId !== childId);
  return {
    ...state,
    childSettings: [...current, { childId, allocation: normalized }],
  };
}
