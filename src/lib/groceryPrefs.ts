import { DayOfWeek } from '@/types';

const GROCERY_PREFS_KEY = 'homehub.groceryPrefs';

export interface GroceryStoreOption {
  id: string;
  label: string;
  searchUrl: string;
}

export const GROCERY_STORES: GroceryStoreOption[] = [
  { id: 'walmart', label: 'Walmart', searchUrl: 'https://www.walmart.com/search?q=' },
  { id: 'target', label: 'Target', searchUrl: 'https://www.target.com/s?searchTerm=' },
  { id: 'frys', label: "Fry's", searchUrl: 'https://www.frysfood.com/search?query=' },
  { id: 'kroger', label: 'Kroger', searchUrl: 'https://www.kroger.com/search?query=' },
  { id: 'costco', label: 'Costco', searchUrl: 'https://www.costco.com/CatalogSearch?keyword=' },
  { id: 'whole-foods', label: 'Whole Foods', searchUrl: 'https://www.amazon.com/s?k=' },
  { id: 'sprouts', label: 'Sprouts', searchUrl: 'https://shop.sprouts.com/search?search_term=' },
  { id: 'trader-joes', label: "Trader Joe's", searchUrl: 'https://www.traderjoes.com/home/search?q=' },
  { id: 'instacart', label: 'Instacart', searchUrl: 'https://www.instacart.com/store/search_v3/' },
  { id: 'aldi', label: 'ALDI', searchUrl: 'https://new.aldi.us/results?q=' },
];

export interface WeeklyAdStoreOption {
  id: string;
  label: string;
}

export const WEEKLY_AD_STORES: WeeklyAdStoreOption[] = [
  { id: 'frys', label: "Fry's" },
  { id: 'safeway', label: 'Safeway' },
  { id: 'whole-foods', label: 'Whole Foods' },
  { id: 'kroger', label: 'Kroger' },
  { id: 'sprouts', label: 'Sprouts' },
  { id: 'target', label: 'Target' },
  { id: 'walmart', label: 'Walmart' },
  { id: 'aldi', label: 'ALDI' },
];

export interface GroceryOrderReminderSettings {
  enabled: boolean;
  day: DayOfWeek;
  time: string;
}

interface GroceryPrefsState {
  preferredStoreId: string;
  itemStoreOverrides: Record<string, string>;
  orderReminder: GroceryOrderReminderSettings;
  lastOrderCompletedAt: string | null;
  weeklyAdZip: string;
  weeklyAdStoreIds: string[];
}

const defaultState: GroceryPrefsState = {
  preferredStoreId: 'walmart',
  itemStoreOverrides: {},
  orderReminder: {
    enabled: false,
    day: 'saturday',
    time: '10:00',
  },
  lastOrderCompletedAt: null,
  weeklyAdZip: '',
  weeklyAdStoreIds: ['frys', 'safeway', 'whole-foods'],
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readState(): GroceryPrefsState {
  if (!canUseStorage()) return defaultState;
  try {
    const raw = window.localStorage.getItem(GROCERY_PREFS_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<GroceryPrefsState>;

    return {
      preferredStoreId:
        typeof parsed.preferredStoreId === 'string' && parsed.preferredStoreId.trim()
          ? parsed.preferredStoreId
          : defaultState.preferredStoreId,
      itemStoreOverrides:
        parsed.itemStoreOverrides && typeof parsed.itemStoreOverrides === 'object'
          ? (parsed.itemStoreOverrides as Record<string, string>)
          : {},
      orderReminder: {
        enabled: !!parsed.orderReminder?.enabled,
        day: (parsed.orderReminder?.day || defaultState.orderReminder.day) as DayOfWeek,
        time:
          typeof parsed.orderReminder?.time === 'string' && /^\d{2}:\d{2}$/.test(parsed.orderReminder.time)
            ? parsed.orderReminder.time
            : defaultState.orderReminder.time,
      },
      lastOrderCompletedAt:
        typeof parsed.lastOrderCompletedAt === 'string' ? parsed.lastOrderCompletedAt : null,
      weeklyAdZip:
        typeof parsed.weeklyAdZip === 'string'
          ? parsed.weeklyAdZip.replace(/[^\d]/g, '').slice(0, 5)
          : '',
      weeklyAdStoreIds:
        Array.isArray(parsed.weeklyAdStoreIds)
          ? parsed.weeklyAdStoreIds.filter(
              (value): value is string =>
                typeof value === 'string' && WEEKLY_AD_STORES.some((store) => store.id === value),
            )
          : defaultState.weeklyAdStoreIds,
    };
  } catch {
    return defaultState;
  }
}

function writeState(next: GroceryPrefsState) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(GROCERY_PREFS_KEY, JSON.stringify(next));
}

function updateState(updater: (current: GroceryPrefsState) => GroceryPrefsState) {
  const current = readState();
  writeState(updater(current));
}

export function toIngredientKey(itemName: string): string {
  return itemName.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getPreferredGroceryStoreId(): string {
  return readState().preferredStoreId;
}

export function setPreferredGroceryStoreId(storeId: string) {
  updateState((current) => ({ ...current, preferredStoreId: storeId || defaultState.preferredStoreId }));
}

export function getItemStoreOverrides(): Record<string, string> {
  return readState().itemStoreOverrides;
}

export function getStoreIdForItem(itemName: string): string {
  const state = readState();
  const key = toIngredientKey(itemName);
  return state.itemStoreOverrides[key] || state.preferredStoreId;
}

export function setStoreIdForItem(itemName: string, storeId: string | null) {
  const key = toIngredientKey(itemName);
  updateState((current) => {
    const nextOverrides = { ...current.itemStoreOverrides };
    if (!storeId) delete nextOverrides[key];
    else nextOverrides[key] = storeId;
    return { ...current, itemStoreOverrides: nextOverrides };
  });
}

export function getOrderReminderSettings(): GroceryOrderReminderSettings {
  return readState().orderReminder;
}

export function setOrderReminderSettings(settings: GroceryOrderReminderSettings) {
  updateState((current) => ({
    ...current,
    orderReminder: {
      enabled: !!settings.enabled,
      day: settings.day,
      time: settings.time,
    },
  }));
}

export function markGroceryOrderCompleted(atIso = new Date().toISOString()) {
  updateState((current) => ({ ...current, lastOrderCompletedAt: atIso }));
}

export function getLastOrderCompletedAt(): string | null {
  return readState().lastOrderCompletedAt;
}

export function getWeeklyAdZip(): string {
  return readState().weeklyAdZip;
}

export function getWeeklyAdStoreIds(): string[] {
  return readState().weeklyAdStoreIds;
}

export function setWeeklyAdPrefs(zip: string, storeIds: string[]) {
  const cleanedZip = String(zip || '').replace(/[^\d]/g, '').slice(0, 5);
  const allowedIds = new Set(WEEKLY_AD_STORES.map((store) => store.id));
  const cleanedStoreIds = Array.from(
    new Set(storeIds.filter((id) => typeof id === 'string' && allowedIds.has(id))),
  );
  updateState((current) => ({
    ...current,
    weeklyAdZip: cleanedZip,
    weeklyAdStoreIds: cleanedStoreIds,
  }));
}

function dayIndex(day: DayOfWeek): number {
  switch (day) {
    case 'sunday':
      return 0;
    case 'monday':
      return 1;
    case 'tuesday':
      return 2;
    case 'wednesday':
      return 3;
    case 'thursday':
      return 4;
    case 'friday':
      return 5;
    case 'saturday':
      return 6;
    default:
      return 0;
  }
}

export function getScheduledDateThisWeek(day: DayOfWeek, time: string, now = new Date()): Date {
  const [hourStr, minuteStr] = time.split(':');
  const target = new Date(now);
  const currentDay = now.getDay();
  const targetDay = dayIndex(day);
  const delta = targetDay - currentDay;
  target.setDate(now.getDate() + delta);
  target.setHours(Number.parseInt(hourStr, 10) || 0, Number.parseInt(minuteStr, 10) || 0, 0, 0);
  return target;
}

export function isGroceryOrderReminderDue(now = new Date()): boolean {
  const state = readState();
  if (!state.orderReminder.enabled) return false;
  const scheduled = getScheduledDateThisWeek(state.orderReminder.day, state.orderReminder.time, now);
  if (now < scheduled) return false;
  if (!state.lastOrderCompletedAt) return true;
  return new Date(state.lastOrderCompletedAt) < scheduled;
}

export function buildStoreSearchUrl(storeId: string, itemName: string): string {
  const store = GROCERY_STORES.find((s) => s.id === storeId) || GROCERY_STORES[0];
  return `${store.searchUrl}${encodeURIComponent(itemName)}`;
}

export function buildWeeklyAdUrl(storeId: string, zipCode: string): string {
  const zip = String(zipCode || '').replace(/[^\d]/g, '').slice(0, 5);
  const encodedZip = encodeURIComponent(zip);

  switch (storeId) {
    case 'frys':
      return zip
        ? `https://www.frysfood.com/weeklyad?zipCode=${encodedZip}`
        : 'https://www.frysfood.com/weeklyad';
    case 'safeway':
      return zip
        ? `https://www.safeway.com/weeklyad?zipcode=${encodedZip}`
        : 'https://www.safeway.com/weeklyad';
    case 'whole-foods':
      return zip
        ? `https://www.wholefoodsmarket.com/sales-flyer?zip=${encodedZip}`
        : 'https://www.wholefoodsmarket.com/sales-flyer';
    case 'kroger':
      return zip
        ? `https://www.kroger.com/savings/weeklyad?zipCode=${encodedZip}`
        : 'https://www.kroger.com/savings/weeklyad';
    case 'sprouts':
      return 'https://www.sprouts.com/weekly-ad/';
    case 'target':
      return zip
        ? `https://www.target.com/c/weekly-ad/-/N-4x0oc?zipcode=${encodedZip}`
        : 'https://www.target.com/c/weekly-ad/-/N-4x0oc';
    case 'walmart':
      return zip
        ? `https://www.walmart.com/shop/deals?zipcode=${encodedZip}`
        : 'https://www.walmart.com/shop/deals';
    case 'aldi':
      return zip
        ? `https://new.aldi.us/weekly-specials?zip=${encodedZip}`
        : 'https://new.aldi.us/weekly-specials';
    default:
      return 'https://www.google.com';
  }
}
