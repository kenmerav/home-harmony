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

export interface KidsFinanceEarningAdjustment {
  eventId: string;
  amount?: number;
  sourceName?: string;
  dateKey?: string;
  deleted?: boolean;
  updatedAt?: string;
}

export interface KidsFinanceChildSettings {
  childId: string;
  allocation: KidsFinanceAllocation;
}

export interface KidsSpendingGoal {
  childId: string;
  title: string;
  targetAmount: number;
  updatedAt?: string;
}

export interface KidsFinanceTransfer {
  id: string;
  childId: string;
  createdAt: string;
  amount: number;
  from: 'remaining';
  to: 'tithing' | 'investing';
}

export type KidsFinanceResetBucket = 'tithing' | 'taxes' | 'remaining';

export interface KidsFinanceBalanceReset {
  id: string;
  childId: string;
  createdAt: string;
  amount: number;
  bucket: KidsFinanceResetBucket;
}

export type KidsSeedFundEntryType = 'contribution' | 'gift';

export interface KidsSeedFundEntry {
  id: string;
  createdAt: string;
  amount: number;
  type: KidsSeedFundEntryType;
  note?: string;
}

export interface KidsSeedFundGoal {
  title: string;
  targetAmount: number;
  updatedAt?: string;
}

export interface KidsFinanceState {
  childSettings: KidsFinanceChildSettings[];
  investmentLots: KidsInvestmentLot[];
  cashOuts: KidsInvestmentCashOut[];
  earningAdjustments: KidsFinanceEarningAdjustment[];
  spendingGoals: KidsSpendingGoal[];
  transfers: KidsFinanceTransfer[];
  balanceResets: KidsFinanceBalanceReset[];
  seedEntries: KidsSeedFundEntry[];
  seedGoal: KidsSeedFundGoal;
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
    earningAdjustments: Array.isArray(record.earningAdjustments)
      ? record.earningAdjustments
          .map((item) => {
            const adjustment = item as Partial<KidsFinanceEarningAdjustment>;
            const amount = adjustment.amount === undefined ? undefined : normalizeMoney(adjustment.amount);
            return {
              eventId: String(adjustment.eventId || '').trim(),
              amount,
              sourceName: typeof adjustment.sourceName === 'string' ? adjustment.sourceName.trim() : undefined,
              dateKey: typeof adjustment.dateKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(adjustment.dateKey)
                ? adjustment.dateKey
                : undefined,
              deleted: Boolean(adjustment.deleted),
              updatedAt: typeof adjustment.updatedAt === 'string' ? adjustment.updatedAt : undefined,
            };
          })
          .filter((item) => item.eventId.length > 0)
      : [],
    spendingGoals: Array.isArray(record.spendingGoals)
      ? record.spendingGoals
          .map((item) => {
            const goal = item as Partial<KidsSpendingGoal>;
            return {
              childId: String(goal.childId || '').trim(),
              title: typeof goal.title === 'string' ? goal.title.trim() : '',
              targetAmount: normalizeMoney(goal.targetAmount),
              updatedAt: typeof goal.updatedAt === 'string' ? goal.updatedAt : undefined,
            };
          })
          .filter((item) => item.childId.length > 0)
      : [],
    transfers: Array.isArray(record.transfers)
      ? record.transfers
          .map((item) => {
            const transfer = item as Partial<KidsFinanceTransfer>;
            return {
              id: String(transfer.id || '').trim(),
              childId: String(transfer.childId || '').trim(),
              createdAt: typeof transfer.createdAt === 'string' ? transfer.createdAt : new Date().toISOString(),
              amount: normalizeMoney(transfer.amount),
              from: 'remaining' as const,
              to: transfer.to === 'investing' ? 'investing' as const : 'tithing' as const,
            };
          })
          .filter((item) => item.id && item.childId && item.amount > 0)
      : [],
    balanceResets: Array.isArray(record.balanceResets)
      ? record.balanceResets
          .map((item) => {
            const reset = item as Partial<KidsFinanceBalanceReset>;
            const bucket = reset.bucket === 'taxes' || reset.bucket === 'remaining' ? reset.bucket : 'tithing';
            return {
              id: String(reset.id || '').trim(),
              childId: String(reset.childId || '').trim(),
              createdAt: typeof reset.createdAt === 'string' ? reset.createdAt : new Date().toISOString(),
              amount: normalizeMoney(reset.amount),
              bucket,
            };
          })
          .filter((item) => item.id && item.childId && item.amount > 0)
      : [],
    seedEntries: Array.isArray(record.seedEntries)
      ? record.seedEntries
          .map((item) => {
            const entry = item as Partial<KidsSeedFundEntry>;
            return {
              id: String(entry.id || '').trim(),
              createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
              amount: normalizeMoney(entry.amount),
              type: entry.type === 'gift' ? 'gift' as const : 'contribution' as const,
              note: typeof entry.note === 'string' ? entry.note.trim().slice(0, 120) : undefined,
            };
          })
          .filter((item) => item.id && item.amount > 0)
      : [],
    seedGoal: (() => {
      const goal = record.seedGoal && typeof record.seedGoal === 'object' && !Array.isArray(record.seedGoal)
        ? record.seedGoal as Partial<KidsSeedFundGoal>
        : {};
      return {
        title: typeof goal.title === 'string' ? goal.title.trim() : '',
        targetAmount: normalizeMoney(goal.targetAmount),
        updatedAt: typeof goal.updatedAt === 'string' ? goal.updatedAt : undefined,
      };
    })(),
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
    || normalized.earningAdjustments.length > 0
    || normalized.spendingGoals.length > 0
    || normalized.transfers.length > 0
    || normalized.balanceResets.length > 0
    || normalized.seedEntries.length > 0
    || normalized.seedGoal.targetAmount > 0
    || normalized.seedGoal.title.length > 0
  ) {
    writeStoredKidsFinanceState(normalized, scopedUserId);
    return;
  }

  const local = readStoredKidsFinanceState(scopedUserId);
  if (
    local.childSettings.length > 0
    || local.investmentLots.length > 0
    || local.cashOuts.length > 0
    || local.earningAdjustments.length > 0
    || local.spendingGoals.length > 0
    || local.transfers.length > 0
    || local.balanceResets.length > 0
    || local.seedEntries.length > 0
    || local.seedGoal.targetAmount > 0
    || local.seedGoal.title.length > 0
  ) {
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

export function spendingGoalForChild(state: KidsFinanceState, childId: string): KidsSpendingGoal {
  return state.spendingGoals.find((item) => item.childId === childId) || {
    childId,
    title: '',
    targetAmount: 0,
  };
}

export function setSpendingGoalForChild(
  state: KidsFinanceState,
  childId: string,
  title: string,
  targetAmount: number,
): KidsFinanceState {
  const current = state.spendingGoals.filter((item) => item.childId !== childId);
  return {
    ...state,
    spendingGoals: [
      ...current,
      {
        childId,
        title: title.trim(),
        targetAmount: normalizeMoney(targetAmount),
        updatedAt: new Date().toISOString(),
      },
    ],
  };
}
