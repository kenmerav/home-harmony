import { useEffect, useMemo, useRef, useState } from 'react';
import { addWeeks, format, startOfWeek } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GroceryCategory, Recipe } from '@/types';
import { Copy, ExternalLink, ShoppingCart, Check, Settings2, Bell, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentDate } from '@/hooks/useCurrentDate';
import { useAccountGroceryListState } from '@/hooks/useAccountGroceryListState';
import { fetchMealsForWeek, DbPlannedMeal } from '@/lib/api/meals';
import { getMealMultipliers } from '@/lib/mealPrefs';
import {
  WEEKLY_AD_STORES,
  GROCERY_STORES,
  GroceryOrderReminderSettings,
  buildWeeklyAdUrl,
  buildStoreSearchUrl,
  getItemStoreOverrides,
  getLastOrderCompletedAt,
  getOrderReminderSettings,
  getPreferredGroceryStoreId,
  getWeeklyAdStoreIds,
  getWeeklyAdZip,
  getStoreIdForItem,
  isGroceryOrderReminderDue,
  markGroceryOrderCompleted,
  setOrderReminderSettings,
  setPreferredGroceryStoreId,
  setWeeklyAdPrefs,
  setStoreIdForItem,
  toIngredientKey,
} from '@/lib/groceryPrefs';
import {
  defaultGroceryWeekState,
  GroceryListManualItem,
} from '@/lib/groceryListStateStore';
import { loadSmsPreferences, saveSmsPreferences } from '@/lib/api/sms';
import { getNextWeekOf, setWeeklyGroceriesOrdered } from '@/lib/api/weeklyPlanningStatus';
import { ViewRecipeDialog } from '@/components/recipes/ViewRecipeDialog';
import { getRecipeImageUrl } from '@/data/recipeImages';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface GroceryItem {
  id: string;
  key: string;
  name: string;
  quantity: string;
  category: GroceryCategory;
  isChecked: boolean;
  sourceRecipes: Array<{
    label: string;
    recipe: DbPlannedMeal['recipes'] | null;
  }>;
  manualItemIds: string[];
  recurringItemIds: string[];
}

interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

const EXCLUDE_PREPPED_MEAL_PREP_KEY = 'homehub.grocery.exclude-prepped-meal-prep.v1';
const GROCERY_SCROLL_POSITION_KEY = 'homehub.grocery.scroll-position.v1';
const GROCERY_SCROLL_ITEM_KEY = 'homehub.grocery.scroll-item.v1';

function loadExcludePreppedMealPrepPreference(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(EXCLUDE_PREPPED_MEAL_PREP_KEY);
  if (raw === 'false') return false;
  return true;
}

function saveExcludePreppedMealPrepPreference(value: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EXCLUDE_PREPPED_MEAL_PREP_KEY, String(value));
}

function splitCompositeIngredients(raw: string): string[] {
  let text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return [];
  text = text.replace(/^[A-Za-z][A-Za-z\s&/+-]{1,40}:\s*/g, '').trim();
  if (!text) return [];
  const nested: string[] = [];
  const canSplitCommas = !/[()]/.test(text) && !/\be\.g\./i.test(text);
  const commaParts = canSplitCommas ? text.split(',').map((part) => part.trim()).filter(Boolean) : [text];
  const simpleCommaList = commaParts.length > 1 && commaParts.length <= 3
    && commaParts.every((part) => part.split(/\s+/).length <= 4);
  if (simpleCommaList) {
    for (const part of commaParts) nested.push(...splitCompositeIngredients(part));
    return nested;
  }

  const quantityMatch = text.match(/\s(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s+/);
  if (quantityMatch && quantityMatch.index !== undefined && quantityMatch.index > 2) {
    const left = text.slice(0, quantityMatch.index).trim();
    const right = text.slice(quantityMatch.index + 1).trim();
    const leftLooksLikeLeadingQuantityOnly = /^(?:\d+(?:\.\d+)?(?:\s+\d+\/\d+)?\s*(?:lb|lbs|pound|pounds|oz|ounce|ounces|g|gram|grams|kg|cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons))$/i.test(left);
    const rightLooksLikeLeanRatioMeat = /^\d{2,3}\/\d{1,2}\s+(ground\s+)?(beef|turkey|chicken|pork)\b/i.test(right);
    const rightLooksLikeIngredientContinuation = /^[\dA-Za-z][^,]{2,}$/i.test(right);
    if (leftLooksLikeLeadingQuantityOnly && rightLooksLikeLeanRatioMeat) {
      return [text];
    }
    if (leftLooksLikeLeadingQuantityOnly && rightLooksLikeIngredientContinuation) {
      return [text];
    }
    if (left && right) return [...splitCompositeIngredients(left), ...splitCompositeIngredients(right)];
  }

  return [text];
}

const categoryOrder: GroceryCategory[] = ['produce', 'meat', 'dairy', 'pantry', 'other'];

const categoryLabels: Record<GroceryCategory, string> = {
  produce: '🥬 Produce',
  meat: '🥩 Meat & Protein',
  dairy: '🧀 Dairy',
  pantry: '🥫 Pantry',
  other: '📦 Other',
};

const categoryColors: Record<GroceryCategory, string> = {
  produce: 'border-l-produce',
  meat: 'border-l-meat',
  dairy: 'border-l-dairy',
  pantry: 'border-l-pantry',
  other: 'border-l-muted-foreground',
};

// Simple ingredient categorization
function categorizeIngredient(name: string): GroceryCategory {
  const lower = name.toLowerCase();
  const produce = ['lettuce', 'tomato', 'onion', 'garlic', 'pepper', 'broccoli', 'carrot', 'potato', 'lemon', 'lime', 'herb', 'thyme', 'rosemary', 'sage', 'basil', 'cilantro', 'asparagus', 'peas', 'snap pea', 'ginger', 'vegetable', 'mushroom', 'spinach', 'celery', 'cucumber', 'avocado', 'zucchini'];
  const meat = ['chicken', 'beef', 'pork', 'salmon', 'fish', 'steak', 'sausage', 'turkey', 'shrimp', 'bacon', 'pepperoni', 'ribeye', 'flank'];
  const dairy = ['cheese', 'milk', 'cream', 'butter', 'yogurt', 'egg', 'mozzarella', 'sour cream'];
  const pantry = ['sauce', 'oil', 'salt', 'pepper', 'seasoning', 'flour', 'sugar', 'rice', 'pasta', 'soy', 'honey', 'vinegar', 'dough', 'shell', 'taco', 'spice', 'broth', 'stock'];
  
  if (produce.some(p => lower.includes(p))) return 'produce';
  if (meat.some(m => lower.includes(m))) return 'meat';
  if (dairy.some(d => lower.includes(d))) return 'dairy';
  if (pantry.some(p => lower.includes(p))) return 'pantry';
  return 'other';
}

const fractionMap: Record<string, string> = {
  '¼': ' 1/4 ',
  '½': ' 1/2 ',
  '¾': ' 3/4 ',
  '⅓': ' 1/3 ',
  '⅔': ' 2/3 ',
  '⅛': ' 1/8 ',
  '⅜': ' 3/8 ',
  '⅝': ' 5/8 ',
  '⅞': ' 7/8 ',
};

const unitAliases: Record<string, string> = {
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tblspn: 'tbsp',
  tblspns: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tspn: 'tsp',
  tspns: 'tsp',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  clove: 'clove',
  cloves: 'clove',
  can: 'can',
  cans: 'can',
  package: 'package',
  packages: 'package',
  packet: 'packet',
  packets: 'packet',
  slice: 'slice',
  slices: 'slice',
  bunch: 'bunch',
  bunches: 'bunch',
};

const displayUnit = (unit: string, amount: number): string => {
  if (unit === 'tbsp' || unit === 'tsp' || unit === 'oz' || unit === 'lb' || unit === 'g' || unit === 'kg' || unit === 'ml' || unit === 'l') {
    return unit;
  }
  if (Math.abs(amount - 1) < 0.001) return unit;
  if (unit.endsWith('ch')) return `${unit}es`;
  return `${unit}s`;
};

const parseFraction = (token: string): number | null => {
  if (!token) return null;
  if (token.includes('/')) {
    const [a, b] = token.split('/').map(Number);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
    return null;
  }
  const n = Number(token);
  return Number.isFinite(n) ? n : null;
};

function parseIngredient(raw: string): ParsedIngredient {
  let text = raw;
  for (const [char, replacement] of Object.entries(fractionMap)) {
    text = text.replaceAll(char, replacement);
  }
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/^[-•\u2022]+/, '').trim();

  // Treat lean ratios like "93/7 ground beef" as part of the ingredient name,
  // not as a quantity that should become "93 items".
  if (/^\d{2,3}\/\d{1,2}\s+(ground\s+)?(beef|turkey|chicken|pork)\b/i.test(text)) {
    return { name: text, quantity: null, unit: null };
  }

  const match = text.match(/^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*([\p{L}%]+)?\s*(.*)$/u);
  if (!match) return { name: text, quantity: null, unit: null };

  const quantityToken = match[1];
  const maybeUnit = (match[2] || '').toLowerCase();
  const rest = (match[3] || '').replace(/^of\s+/i, '').trim();

  let quantity: number | null = null;
  if (quantityToken.includes(' ')) {
    const [whole, frac] = quantityToken.split(' ');
    const wholeNum = parseFraction(whole);
    const fracNum = parseFraction(frac);
    if (wholeNum !== null && fracNum !== null) quantity = wholeNum + fracNum;
  } else {
    quantity = parseFraction(quantityToken);
  }

  if (quantity === null) return { name: text, quantity: null, unit: null };

  const unit = unitAliases[maybeUnit] || null;
  const name = rest || text;
  if (!unit) {
    const hasPercentDescriptor = maybeUnit.includes('%') || rest.startsWith('%');
    if (hasPercentDescriptor) {
      const pct = `${quantityToken}${maybeUnit}`.replace(/\s+/g, '');
      const pctRest = rest.replace(/^%+\s*/, '').trim();
      return { name: `${pct} ${pctRest}`.trim(), quantity: null, unit: null };
    }
    const expandedName = [maybeUnit || '', rest || ''].join(' ').trim() || name;
    return { name: expandedName, quantity, unit: 'item' };
  }
  return { name, quantity, unit };
}

function cleanIngredientName(raw: string): string {
  let name = String(raw || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return '';

  name = name
    .replace(/\bback to table of contents?\b.*$/i, '')
    .replace(/\(e\.g\.[^)]*\)?/gi, '')
    .replace(/\b(as needed|if needed|to taste|for garnish|optional|dry weight)\b.*$/i, '')
    .replace(/\s+\(\s*$/, '')
    .replace(/\s+-\s*$/, '')
    .replace(/^%+\s*/, '')
    .replace(/\bcont\.?$/i, '')
    .replace(/[()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (/^\d*%?\s*plain greek$/i.test(name) || /^\d*%?\s*greek$/i.test(name)) {
    return 'Greek yogurt';
  }
  if (/^%+\s*milk$/i.test(name)) {
    return 'Milk';
  }
  if (/^\d{2,3}\/\d{1,2}\s+ground\s+beef$/i.test(name)) {
    return 'Ground beef';
  }
  if (/^\d{2,3}\/\d{1,2}\s+ground\s+turkey$/i.test(name)) {
    return 'Ground turkey';
  }
  if (/^\d{2,3}\/\d{1,2}\s+ground\s+chicken$/i.test(name)) {
    return 'Ground chicken';
  }
  if (/^\d{2,3}\/\d{1,2}\s+ground\s+pork$/i.test(name)) {
    return 'Ground pork';
  }

  return name;
}

function shouldSkipIngredientName(name: string): boolean {
  const lower = cleanIngredientName(name).toLowerCase().trim();
  if (!lower) return true;
  if (lower === '%' || lower === 'cont') return true;
  if (/^\d+(?:\.\d+)?\s*(oz|lb|lbs|g|kg|cup|cups|tbsp|tsp)$/.test(lower)) return true;
  if (/^[a-z][a-z\s&/+-]{1,40}:\s*[a-z\s&/+-]*:?$/i.test(lower)) return true;
  if (/back to table of contents?/.test(lower)) return true;
  if (/\btable of cont/.test(lower)) return true;
  if (/\(e\.g\.$/.test(lower)) return true;
  if (/(^|\s)cont$/.test(lower)) return true;
  if (['red', 'green', 'yellow', 'orange', 'ground', 'plain'].includes(lower)) return true;
  if (/^(small|medium|large)$/.test(lower)) return true;
  return false;
}

function normalizeIngredientName(name: string): string {
  return cleanIngredientName(name)
    .toLowerCase()
    .replace(/%/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatQuantity(qtyByUnit: Map<string, number>, countNoQty: number): string {
  const parts: string[] = [];
  for (const [unit, amount] of qtyByUnit.entries()) {
    const rounded = Math.round(amount * 100) / 100;
    parts.push(`${rounded} ${displayUnit(unit, rounded)}`);
  }
  if (countNoQty > 0) {
    parts.push(`${countNoQty}x`);
  }
  return parts.join(' + ') || '1x';
}

function buildGroceryList(
  meals: DbPlannedMeal[],
  multipliers: Record<string, number>,
  options?: {
    excludeMealPrep?: boolean;
    checkedKeys?: Set<string>;
    manualItems?: GroceryListManualItem[];
    recurringItems?: GroceryListManualItem[];
  },
): GroceryItem[] {
  const itemMap = new Map<
    string,
    GroceryItem & {
      qtyByUnit: Map<string, number>;
      countNoQty: number;
      customQuantities: string[];
    }
  >();
  const excludeMealPrep = options?.excludeMealPrep ?? true;
  const checkedKeys = options?.checkedKeys || new Set<string>();

  const getOrCreateItem = (key: string, name: string, category: GroceryCategory) => {
    const existing = itemMap.get(key);
    if (existing) return existing;

    const created: GroceryItem & {
      qtyByUnit: Map<string, number>;
      countNoQty: number;
      customQuantities: string[];
    } = {
      id: key,
      key,
      name,
      quantity: '',
      category,
      isChecked: checkedKeys.has(key),
      sourceRecipes: [],
      manualItemIds: [],
      recurringItemIds: [],
      qtyByUnit: new Map(),
      countNoQty: 0,
      customQuantities: [],
    };
    itemMap.set(key, created);
    return created;
  };

  const appendSource = (item: GroceryItem, label: string, recipe?: DbPlannedMeal['recipes'] | null) => {
    if (!item.sourceRecipes.some((entry) => entry.label === label)) {
      item.sourceRecipes.push({
        label,
        recipe: recipe || null,
      });
    }
  };
  
  for (const meal of meals) {
    if (meal.is_skipped) continue;
    const recipe = meal.recipes;
    if (!recipe?.ingredients) continue;
    if (excludeMealPrep && recipe.is_meal_prep) continue;
    const mealMultiplier = multipliers[meal.id] === 2 ? 2 : 1;
    
    for (const ingredient of recipe.ingredients as string[]) {
      for (const split of splitCompositeIngredients(ingredient)) {
        const parsed = parseIngredient(split);
        const cleanedName = cleanIngredientName(parsed.name);
        if (shouldSkipIngredientName(cleanedName)) continue;
        const key = normalizeIngredientName(cleanedName);
        if (!key || key.length < 2) continue;
        
        const existing = getOrCreateItem(key, cleanedName, categorizeIngredient(cleanedName));
        if (existing.category === 'other') {
          existing.category = categorizeIngredient(cleanedName);
        }
        appendSource(existing, mealMultiplier === 2 ? `${recipe.name} (2x)` : recipe.name, recipe);
        if (parsed.quantity !== null && parsed.unit) {
          existing.qtyByUnit.set(parsed.unit, (existing.qtyByUnit.get(parsed.unit) || 0) + (parsed.quantity * mealMultiplier));
        } else {
          existing.countNoQty += mealMultiplier;
        }
      }
    }
  }

  const mergeCustomItems = (customItems: GroceryListManualItem[], kind: 'manual' | 'recurring') => {
    customItems.forEach((customItem) => {
      const key = toIngredientKey(customItem.name);
      if (!key) return;
      const existing = getOrCreateItem(key, customItem.name, customItem.category);
      existing.name = existing.name || customItem.name;
      if (existing.category === 'other' && customItem.category !== 'other') {
        existing.category = customItem.category;
      }
      if (customItem.quantity && !existing.customQuantities.includes(customItem.quantity)) {
        existing.customQuantities.push(customItem.quantity);
      }
      appendSource(existing, kind === 'recurring' ? 'Weekly staple' : 'Manual item');
      if (kind === 'recurring') {
        if (!existing.recurringItemIds.includes(customItem.id)) {
          existing.recurringItemIds.push(customItem.id);
        }
      } else if (!existing.manualItemIds.includes(customItem.id)) {
        existing.manualItemIds.push(customItem.id);
      }
    });
  };

  mergeCustomItems(options?.manualItems || [], 'manual');
  mergeCustomItems(options?.recurringItems || [], 'recurring');
  
  return Array.from(itemMap.values()).map((item) => ({
    id: item.id,
    key: item.key,
    name: item.name,
    quantity: [
      item.qtyByUnit.size > 0 || item.countNoQty > 0 ? formatQuantity(item.qtyByUnit, item.countNoQty) : '',
      ...item.customQuantities,
    ]
      .map((part) => part.trim())
      .filter((part, index, list) => !!part && list.findIndex((candidate) => candidate.toLowerCase() === part.toLowerCase()) === index)
      .join(' + ') || '1x',
    category: item.category,
    isChecked: checkedKeys.has(item.key),
    sourceRecipes: item.sourceRecipes,
    manualItemIds: item.manualItemIds,
    recurringItemIds: item.recurringItemIds,
  }));
}

export default function GroceryPage() {
  const { user } = useAuth();
  const currentDate = useCurrentDate();
  const currentWeekOf = format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const nextWeekOf = format(addWeeks(startOfWeek(currentDate, { weekStartsOn: 1 }), 1), 'yyyy-MM-dd');
  const { groceryListState, setGroceryListState } = useAccountGroceryListState(user?.id);
  const [plannedMealsByWeek, setPlannedMealsByWeek] = useState<Record<string, DbPlannedMeal[]>>({});
  const [loading, setLoading] = useState(true);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [preferredStoreId, setPreferredStoreIdState] = useState('walmart');
  const [itemStoreOverrides, setItemStoreOverrides] = useState<Record<string, string>>({});
  const [orderReminder, setOrderReminder] = useState<GroceryOrderReminderSettings>({
    enabled: false,
    day: 'saturday',
    time: '10:00',
  });
  const [lastOrderCompletedAt, setLastOrderCompletedAt] = useState<string | null>(null);
  const [weeklyAdZip, setWeeklyAdZipState] = useState('');
  const [weeklyAdStoreIds, setWeeklyAdStoreIdsState] = useState<string[]>([]);
  const [excludePreppedMealPrep, setExcludePreppedMealPrep] = useState<boolean>(true);
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState('');
  const [manualItemCategory, setManualItemCategory] = useState<GroceryCategory>('other');
  const [manualItemRepeatsWeekly, setManualItemRepeatsWeekly] = useState(false);
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const restoredScrollRef = useRef(false);
  const { toast } = useToast();
  const canUseRemoteSms = Boolean(user?.id && user.id !== 'demo-user');
  const currentWeekState = useMemo(
    () => groceryListState.weekStates[currentWeekOf] || defaultGroceryWeekState(),
    [currentWeekOf, groceryListState.weekStates],
  );
  const currentWeekOrderedAt = currentWeekState.orderedAt;
  const activeWeekOf = currentWeekOrderedAt ? nextWeekOf : currentWeekOf;
  const activeWeekState = useMemo(
    () => groceryListState.weekStates[activeWeekOf] || defaultGroceryWeekState(),
    [activeWeekOf, groceryListState.weekStates],
  );
  const activePlannedMeals = plannedMealsByWeek[activeWeekOf] || [];

  useEffect(() => {
    setPreferredStoreIdState(getPreferredGroceryStoreId());
    setItemStoreOverrides(getItemStoreOverrides());
    const localOrderReminder = getOrderReminderSettings();
    setOrderReminder(localOrderReminder);
    setLastOrderCompletedAt(getLastOrderCompletedAt());
    setWeeklyAdZipState(getWeeklyAdZip());
    setWeeklyAdStoreIdsState(getWeeklyAdStoreIds());
    const excludeMealPrep = loadExcludePreppedMealPrepPreference();
    setExcludePreppedMealPrep(excludeMealPrep);
    if (canUseRemoteSms) {
      void (async () => {
        try {
          const sms = await loadSmsPreferences();
          const syncedReminder: GroceryOrderReminderSettings = {
            enabled: sms.grocery_reminder_enabled,
            day: sms.grocery_reminder_day,
            time: sms.grocery_reminder_time,
          };
          setOrderReminder(syncedReminder);
          setOrderReminderSettings(syncedReminder);
        } catch (error) {
          console.error('Could not sync grocery reminder schedule from SMS settings:', error);
        }
      })();
    }
  }, [canUseRemoteSms, user?.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLastOrderCompletedAt(getLastOrderCompletedAt());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const restoreGroceryScrollPosition = () => {
    if (typeof window === 'undefined') return;
    const itemKey = window.sessionStorage.getItem(GROCERY_SCROLL_ITEM_KEY);
    if (itemKey) {
      const selector = `[data-grocery-item-key="${CSS.escape(itemKey)}"]`;
      const anchor = document.querySelector<HTMLElement>(selector);
      if (anchor) {
        anchor.scrollIntoView({ block: 'center', behavior: 'auto' });
        window.requestAnimationFrame(() => {
          anchor.scrollIntoView({ block: 'center', behavior: 'auto' });
        });
        window.setTimeout(() => {
          anchor.scrollIntoView({ block: 'center', behavior: 'auto' });
        }, 150);
        return;
      }
    }

    const raw = window.sessionStorage.getItem(GROCERY_SCROLL_POSITION_KEY);
    if (!raw) return;
    const scrollTop = Number.parseInt(raw, 10);
    if (!Number.isFinite(scrollTop) || scrollTop < 0) return;

    const restore = () => window.scrollTo({ top: scrollTop, behavior: 'auto' });
    restore();
    window.requestAnimationFrame(restore);
    window.setTimeout(restore, 150);
  };

  useEffect(() => {
    restoreGroceryScrollPosition();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (restoredScrollRef.current) return;
    restoredScrollRef.current = true;
    restoreGroceryScrollPosition();
  }, [loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saveScrollPosition = () => {
      window.sessionStorage.setItem(GROCERY_SCROLL_POSITION_KEY, String(window.scrollY || 0));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveScrollPosition();
      } else {
        restoreGroceryScrollPosition();
      }
    };

    const handlePageShow = () => restoreGroceryScrollPosition();

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', saveScrollPosition);
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', saveScrollPosition);
    };
  }, []);

  const loadGroceryList = async () => {
    try {
      setLoading(true);
      const [currentMeals, nextMeals] = await Promise.all([
        fetchMealsForWeek(0),
        fetchMealsForWeek(1),
      ]);
      setPlannedMealsByWeek({
        [currentWeekOf]: currentMeals,
        [nextWeekOf]: nextMeals,
      });
    } catch (err) {
      console.error('Failed to load grocery list:', err);
      setPlannedMealsByWeek({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    saveExcludePreppedMealPrepPreference(excludePreppedMealPrep);
    void loadGroceryList();
  }, [excludePreppedMealPrep, user?.id]);

  const items = useMemo(
    () =>
      buildGroceryList(activePlannedMeals, getMealMultipliers(), {
        excludeMealPrep: excludePreppedMealPrep,
        checkedKeys: new Set(activeWeekState.checkedKeys),
        manualItems: activeWeekState.manualItems,
        recurringItems: groceryListState.recurringItems,
      }),
    [
      activePlannedMeals,
      activeWeekState.checkedKeys,
      activeWeekState.manualItems,
      excludePreppedMealPrep,
      groceryListState.recurringItems,
    ],
  );

  const updateCurrentWeekState = (
    weekOf: string,
    updater: (weekState: ReturnType<typeof defaultGroceryWeekState>) => ReturnType<typeof defaultGroceryWeekState>,
  ) => {
    setGroceryListState((previous) => {
      const current = previous.weekStates[weekOf] || defaultGroceryWeekState();
      const nextWeekState = updater(current);
      const nextWeekStates = { ...previous.weekStates };
      if (nextWeekState.checkedKeys.length === 0 && nextWeekState.manualItems.length === 0 && !nextWeekState.orderedAt) {
        delete nextWeekStates[weekOf];
      } else {
        nextWeekStates[weekOf] = nextWeekState;
      }
      return {
        ...previous,
        weekStates: nextWeekStates,
      };
    });
  };

  const toggleItem = (itemKey: string) => {
    updateCurrentWeekState(activeWeekOf, (weekState) => {
      const checkedKeys = new Set(weekState.checkedKeys);
      if (checkedKeys.has(itemKey)) {
        checkedKeys.delete(itemKey);
      } else {
        checkedKeys.add(itemKey);
      }
      return {
        ...weekState,
        checkedKeys: Array.from(checkedKeys),
      };
    });
  };

  const checkAllItems = () => {
    updateCurrentWeekState(activeWeekOf, (weekState) => ({
      ...weekState,
      checkedKeys: Array.from(new Set(items.map((item) => item.key))),
    }));
  };

  const syncNextWeekReminderHandled = async (handled: boolean) => {
    try {
      await setWeeklyGroceriesOrdered(getNextWeekOf(), handled);
    } catch (error) {
      console.error('Could not sync grocery reminder state', error);
      toast({
        title: handled ? 'Ordered locally' : 'Reminder resumed locally',
        description: handled
          ? 'Your grocery list was cleared, but the reminder sync did not finish yet.'
          : 'Your grocery list was restored, but the reminder sync did not finish yet.',
        variant: 'destructive',
      });
    }
  };

  const markCurrentWeekNotOrdered = async () => {
    updateCurrentWeekState(currentWeekOf, (weekState) => ({
      ...weekState,
      checkedKeys: [],
      orderedAt: null,
    }));
    await syncNextWeekReminderHandled(false);
    toast({
      title: 'Marked this week as not ordered',
      description: 'This week’s grocery list is visible again and unchecked so you can use it normally.',
    });
  };

  const resetAddItemDialog = () => {
    setManualItemName('');
    setManualItemQuantity('');
    setManualItemCategory('other');
    setManualItemRepeatsWeekly(false);
  };

  const addManualItem = () => {
    const name = manualItemName.trim().replace(/\s+/g, ' ');
    if (!name) {
      toast({ title: 'Add an item name first', variant: 'destructive' });
      return;
    }

    const nextItem: GroceryListManualItem = {
      id: crypto.randomUUID(),
      name,
      quantity: manualItemQuantity.trim().replace(/\s+/g, ' ') || '1x',
      category: manualItemCategory === 'other' ? categorizeIngredient(name) : manualItemCategory,
      createdAt: new Date().toISOString(),
    };
    const duplicateMatches = (item: GroceryListManualItem) =>
      toIngredientKey(item.name) === toIngredientKey(nextItem.name)
      && item.quantity.trim().toLowerCase() === nextItem.quantity.trim().toLowerCase()
      && item.category === nextItem.category;

    if (manualItemRepeatsWeekly && groceryListState.recurringItems.some(duplicateMatches)) {
      toast({ title: 'That weekly staple is already on your list' });
      return;
    }

    if (!manualItemRepeatsWeekly && activeWeekState.manualItems.some(duplicateMatches)) {
      toast({ title: 'That manual grocery item is already on this grocery order' });
      return;
    }

    setGroceryListState((previous) => {
      if (manualItemRepeatsWeekly) {
        return {
          ...previous,
          recurringItems: [...previous.recurringItems, nextItem],
        };
      }

      const targetWeekOf = manualItemRepeatsWeekly ? currentWeekOf : activeWeekOf;
      const targetWeekState = previous.weekStates[targetWeekOf] || defaultGroceryWeekState();
      return {
        ...previous,
        weekStates: {
          ...previous.weekStates,
          [targetWeekOf]: {
            ...targetWeekState,
            orderedAt: targetWeekState.orderedAt,
            manualItems: [...targetWeekState.manualItems, nextItem],
          },
        },
      };
    });

    setAddItemOpen(false);
    resetAddItemDialog();
    toast({
      title: manualItemRepeatsWeekly ? 'Weekly grocery staple added' : 'Grocery item added',
      description: manualItemRepeatsWeekly
        ? `${name} will appear every week.`
        : `${name} is now on your current grocery order.`,
    });
  };

  const removeCustomItemAttachments = (item: GroceryItem) => {
    if (item.manualItemIds.length === 0 && item.recurringItemIds.length === 0) return;

    setGroceryListState((previous) => {
      const weekState = previous.weekStates[activeWeekOf] || defaultGroceryWeekState();
      const nextManualItems = weekState.manualItems.filter(
        (manualItem) => !item.manualItemIds.includes(manualItem.id),
      );
      const nextRecurringItems = previous.recurringItems.filter(
        (recurringItem) => !item.recurringItemIds.includes(recurringItem.id),
      );
      const nextCheckedKeys = weekState.checkedKeys.filter((key) => key !== item.key);
      const nextWeekStates = { ...previous.weekStates };

      if (nextManualItems.length === 0 && nextCheckedKeys.length === 0) {
        if (weekState.orderedAt) {
          nextWeekStates[activeWeekOf] = {
            ...weekState,
            manualItems: nextManualItems,
            checkedKeys: nextCheckedKeys,
          };
        } else {
          delete nextWeekStates[activeWeekOf];
        }
      } else {
        nextWeekStates[activeWeekOf] = {
          ...weekState,
          manualItems: nextManualItems,
          checkedKeys: nextCheckedKeys,
        };
      }

      return {
        ...previous,
        recurringItems: nextRecurringItems,
        weekStates: nextWeekStates,
      };
    });

    toast({
      title: 'Added grocery item removed',
      description: item.recurringItemIds.length > 0
        ? 'Weekly staple removed from future lists.'
        : 'Manual item removed from this week.',
    });
  };

  // Keep checked items visible while the current order is active so the shopping
  // flow still feels satisfying. Once the order is marked complete, the page
  // rolls forward to the next order and the old checked items disappear there.
  const visibleItems = items;

  const groupedItems = categoryOrder.reduce((acc, category) => {
    const categoryItems = visibleItems.filter(item => item.category === category);
    if (categoryItems.length > 0) {
      acc[category] = categoryItems;
    }
    return acc;
  }, {} as Record<GroceryCategory, GroceryItem[]>);

  const openRecipeFromGrocerySource = (recipe: NonNullable<DbPlannedMeal['recipes']>) => {
    setViewingRecipe({
      id: recipe.id,
      name: recipe.name,
      servings: recipe.servings,
      estimatedCookMinutes: undefined,
      imageUrl: getRecipeImageUrl(recipe.name),
      isFavorite: false,
      isKidFriendly: false,
      isMealPrep: recipe.is_meal_prep,
      ingredients: recipe.ingredients || [],
      ingredientsRaw: recipe.ingredients_raw || (recipe.ingredients || []).join('\n'),
      instructions: recipe.instructions || '',
      macrosPerServing: {
        calories: recipe.calories || 0,
        protein_g: recipe.protein_g || 0,
        carbs_g: recipe.carbs_g || 0,
        fat_g: recipe.fat_g || 0,
        ...(recipe.fiber_g !== null && recipe.fiber_g !== undefined ? { fiber_g: recipe.fiber_g } : {}),
      },
      defaultDay: (recipe.default_day as Recipe['defaultDay']) || undefined,
      mealType: (recipe.meal_type as Recipe['mealType']) || 'dinner',
      dishType: (recipe.course_type as Recipe['dishType']) || 'main',
      isAnchored: !!recipe.is_anchored,
      createdAt: new Date(recipe.created_at),
    });
  };

  const checkedCount = items.filter((i) => i.isChecked).length;
  const totalCount = items.length;
  const remainingItems = items.filter((item) => !item.isChecked);

  const copyList = () => {
    const uncheckedItems = remainingItems
      .map(i => `${i.name} (${i.quantity})`)
      .join('\n');
    
    navigator.clipboard.writeText(uncheckedItems);
    toast({
      title: "Copied to clipboard",
      description: `${items.length - checkedCount} items copied`,
    });
  };

  const saveGroceryScrollPosition = () => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(GROCERY_SCROLL_POSITION_KEY, String(window.scrollY || 0));
  };

  const openStoreSearch = (itemName: string, itemKey?: string) => {
    saveGroceryScrollPosition();
    if (typeof window !== 'undefined') {
      if (itemKey) {
        window.sessionStorage.setItem(GROCERY_SCROLL_ITEM_KEY, itemKey);
      } else {
        window.sessionStorage.removeItem(GROCERY_SCROLL_ITEM_KEY);
      }
    }
    const storeId = getStoreIdForItem(itemName);
    window.open(buildStoreSearchUrl(storeId, itemName), '_blank');
  };

  const handleStoreOverrideChange = (itemName: string, storeId: string) => {
    if (storeId === preferredStoreId) {
      setStoreIdForItem(itemName, null);
    } else {
      setStoreIdForItem(itemName, storeId);
    }
    setItemStoreOverrides(getItemStoreOverrides());
  };

  const saveGroceryPrefs = async () => {
    setPreferredGroceryStoreId(preferredStoreId);
    setOrderReminderSettings(orderReminder);
    if (canUseRemoteSms) {
      try {
        const sms = await loadSmsPreferences();
        await saveSmsPreferences({
          ...sms,
          grocery_reminder_enabled: orderReminder.enabled,
          grocery_reminder_day: orderReminder.day,
          grocery_reminder_time: orderReminder.time,
        });
      } catch (error) {
        toast({
          title: 'Saved locally',
          description:
            error instanceof Error
              ? `Could not sync SMS schedule yet: ${error.message}`
              : 'Could not sync SMS schedule yet.',
          variant: 'destructive',
        });
      }
    }
    setPrefsOpen(false);
    toast({ title: 'Grocery settings saved' });
  };

  const markOrderDone = async () => {
    const now = new Date().toISOString();
    markGroceryOrderCompleted(now);
    setLastOrderCompletedAt(now);
    updateCurrentWeekState(currentWeekOf, (weekState) => ({
      ...weekState,
      checkedKeys: [],
      manualItems: [],
      orderedAt: now,
    }));
    await syncNextWeekReminderHandled(true);
    toast({
      title: 'Order marked complete',
      description: 'This order is cleared out, and grocery reminders are considered handled until you reopen it.',
    });
  };

  const toggleWeeklyAdStore = (storeId: string) => {
    setWeeklyAdStoreIdsState((prev) => {
      const next = prev.includes(storeId)
        ? prev.filter((id) => id !== storeId)
        : [...prev, storeId];
      setWeeklyAdPrefs(weeklyAdZip, next);
      return next;
    });
  };

  const saveWeeklyAdPreferences = () => {
    const cleanedZip = weeklyAdZip.replace(/[^\d]/g, '').slice(0, 5);
    setWeeklyAdZipState(cleanedZip);
    setWeeklyAdPrefs(cleanedZip, weeklyAdStoreIds);
    toast({
      title: 'Weekly ad links updated',
      description: cleanedZip
        ? `Using ZIP ${cleanedZip} for selected stores.`
        : 'Saved selected stores. Add a ZIP anytime.',
    });
  };

  const selectedWeeklyAdStores = WEEKLY_AD_STORES.filter((store) => weeklyAdStoreIds.includes(store.id));

  const reminderDue = isGroceryOrderReminderDue();

  return (
    <AppLayout>
      <PageHeader 
        title="Grocery List" 
        subtitle={loading ? 'Loading...' : `${checkedCount} of ${totalCount} items checked`}
        action={
          <div className="flex gap-2">
            <Button onClick={() => setAddItemOpen(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
            <Button onClick={() => setPrefsOpen(true)} variant="outline" size="sm">
              <Settings2 className="w-4 h-4 mr-2" />
              Preferences
            </Button>
            <Button onClick={copyList} variant="outline" size="sm" disabled={totalCount === 0}>
              <Copy className="w-4 h-4 mr-2" />
              Copy List
            </Button>
          </div>
        }
      />

      {/* Progress */}
      {totalCount > 0 && (
        <div className="mb-6">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {excludePreppedMealPrep && (
        <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Meal prep recipes marked as already prepped are excluded from this grocery rollup.
        </div>
      )}

      {groceryListState.recurringItems.length > 0 && (
        <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          {groceryListState.recurringItems.length} weekly staple
          {groceryListState.recurringItems.length === 1 ? '' : 's'} will be added automatically each week.
        </div>
      )}

      <Accordion type="single" collapsible className="mb-6 rounded-xl border border-border bg-card px-4">
        <AccordionItem value="weekly-ads" className="border-none">
          <AccordionTrigger className="py-4 text-left hover:no-underline">
            <span className="font-medium">Weekly ad links</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Set your ZIP and stores once. Preferences are saved automatically.
              </p>
              <Button size="sm" variant="outline" onClick={saveWeeklyAdPreferences}>
                Save now
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">ZIP code</p>
                <Input
                  placeholder="85340"
                  inputMode="numeric"
                  maxLength={5}
                  value={weeklyAdZip}
                  onChange={(event) => {
                    const cleanedZip = event.target.value.replace(/[^\d]/g, '').slice(0, 5);
                    setWeeklyAdZipState(cleanedZip);
                    setWeeklyAdPrefs(cleanedZip, weeklyAdStoreIds);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">Stores</p>
                <div className="grid grid-cols-2 gap-2">
                  {WEEKLY_AD_STORES.map((store) => (
                    <label
                      key={store.id}
                      className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-xs"
                    >
                      <Checkbox
                        checked={weeklyAdStoreIds.includes(store.id)}
                        onCheckedChange={() => toggleWeeklyAdStore(store.id)}
                      />
                      <span>{store.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {selectedWeeklyAdStores.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {selectedWeeklyAdStores.map((store) => (
                    <Button
                      key={store.id}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        saveGroceryScrollPosition();
                        window.open(buildWeeklyAdUrl(store.id, weeklyAdZip), '_blank');
                      }}
                    >
                      {store.label} ad
                      <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Links include your ZIP in the weekly-ad URL.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Choose at least one store to show ad links.</p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="mb-6 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              {currentWeekOrderedAt ? 'Next grocery order' : 'This week grocery order'}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentWeekOrderedAt
                ? 'You marked the last order complete. If you are still working on that same order, reopen it below. Otherwise, new planned meals, staples, and new items now build the next grocery order automatically.'
                : 'Check items off as you add them to your cart, then mark this week ordered when checkout is done.'}
            </p>
            {currentWeekOrderedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Marked ordered: {new Date(currentWeekOrderedAt).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant={currentWeekOrderedAt ? 'outline' : 'default'}
            onClick={currentWeekOrderedAt ? markCurrentWeekNotOrdered : markOrderDone}
          >
            {currentWeekOrderedAt ? 'Reopen This Order' : 'Mark Ordered'}
          </Button>
        </div>
      </div>

      {reminderDue && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Bell className="w-4 h-4 mt-0.5 text-primary" />
              <div>
                <p className="text-sm font-medium">Grocery order reminder</p>
                <p className="text-xs text-muted-foreground">
                  Your scheduled order window is due. Mark complete once you finish checkout.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={markOrderDone}>
              Mark Complete
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-xl border border-border p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category} className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/30">
                <h2 className="font-medium">{categoryLabels[category as GroceryCategory]}</h2>
              </div>
              <div className="divide-y divide-border">
                {categoryItems.map(item => (
                  <div 
                    key={item.id}
                    data-grocery-item-key={item.key}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 border-l-4 transition-gentle",
                      categoryColors[item.category],
                      item.isChecked && "bg-muted/30"
                    )}
                  >
                    <Checkbox 
                      checked={item.isChecked}
                      onCheckedChange={() => toggleItem(item.key)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-sm transition-gentle",
                        item.isChecked && "line-through text-muted-foreground"
                      )}>
                        {item.name} <span className="text-muted-foreground">({item.quantity})</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {item.sourceRecipes.map((source, index) => (
                          <span key={`${item.id}-source-${source.label}`} className="inline-flex items-center gap-1.5">
                            {source.recipe ? (
                              <button
                                type="button"
                                className="underline decoration-dotted underline-offset-2 hover:text-foreground"
                                onClick={() => openRecipeFromGrocerySource(source.recipe)}
                              >
                                {source.label}
                              </button>
                            ) : (
                              <span>{source.label}</span>
                            )}
                            {index < item.sourceRecipes.length - 1 ? <span>,</span> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                    {(item.manualItemIds.length > 0 || item.recurringItemIds.length > 0) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => removeCustomItemAttachments(item)}
                        title={
                          item.recurringItemIds.length > 0
                            ? 'Remove weekly staple'
                            : 'Remove manual item'
                        }
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    )}
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={
                        itemStoreOverrides[toIngredientKey(item.name)] ||
                        preferredStoreId
                      }
                      onChange={(e) => handleStoreOverrideChange(item.name, e.target.value)}
                      title="Store for this item"
                    >
                      {GROCERY_STORES.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.label}
                        </option>
                      ))}
                    </select>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => openStoreSearch(item.name, item.key)}
                    >
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && totalCount === 0 && (
        <div className="text-center py-12">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No items on your list</p>
          <p className="text-sm text-muted-foreground mt-1">
            {currentWeekOrderedAt
              ? 'Plan meals or add items, and your next grocery order will appear here.'
              : 'Generate a meal plan first, then ingredients will appear here'}
          </p>
        </div>
      )}

      {checkedCount === totalCount && totalCount > 0 && !currentWeekOrderedAt && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <p className="font-display text-xl font-semibold">All done!</p>
          <p className="text-muted-foreground">Your shopping is complete</p>
        </div>
      )}

      <Dialog
        open={addItemOpen}
        onOpenChange={(open) => {
          setAddItemOpen(open);
          if (!open) resetAddItemDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Add Grocery Item</DialogTitle>
            <DialogDescription>
              Add a one-time item for this week or save it as a weekly staple.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Item name</p>
              <Input
                value={manualItemName}
                onChange={(event) => setManualItemName(event.target.value)}
                placeholder="Milk"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Quantity</p>
                <Input
                  value={manualItemQuantity}
                  onChange={(event) => setManualItemQuantity(event.target.value)}
                  placeholder="1 gallon"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Category</p>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={manualItemCategory}
                  onChange={(event) => setManualItemCategory(event.target.value as GroceryCategory)}
                >
                  <option value="produce">Produce</option>
                  <option value="meat">Meat & Protein</option>
                  <option value="dairy">Dairy</option>
                  <option value="pantry">Pantry</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={manualItemRepeatsWeekly}
                onCheckedChange={(checked) => setManualItemRepeatsWeekly(Boolean(checked))}
              />
              <span className="text-sm">Add this item every week</span>
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddItemOpen(false)}>
                Cancel
              </Button>
              <Button onClick={addManualItem}>
                <Plus className="w-4 h-4 mr-2" />
                Add item
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Grocery Preferences</DialogTitle>
            <DialogDescription>
              Set your default store and reminder time for placing grocery orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Preferred grocery store</p>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={preferredStoreId}
                onChange={(e) => setPreferredStoreIdState(e.target.value)}
              >
                {GROCERY_STORES.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={orderReminder.enabled}
                onCheckedChange={(checked) =>
                  setOrderReminder((prev) => ({ ...prev, enabled: !!checked }))
                }
              />
              <span className="text-sm">Enable weekly grocery order reminder</span>
            </label>

            <label className="flex items-center gap-2">
              <Checkbox
                checked={excludePreppedMealPrep}
                onCheckedChange={(checked) => setExcludePreppedMealPrep(Boolean(checked))}
              />
              <span className="text-sm">Exclude meal-prep recipes already prepped</span>
            </label>

            {orderReminder.enabled && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Day</p>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={orderReminder.day}
                    onChange={(e) =>
                      setOrderReminder((prev) => ({
                        ...prev,
                        day: e.target.value as GroceryOrderReminderSettings['day'],
                      }))
                    }
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Time</p>
                  <Input
                    type="time"
                    value={orderReminder.time}
                    onChange={(e) =>
                      setOrderReminder((prev) => ({ ...prev, time: e.target.value || '10:00' }))
                    }
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Last marked complete: {lastOrderCompletedAt ? new Date(lastOrderCompletedAt).toLocaleString() : 'Never'}
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrefsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveGroceryPrefs}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ViewRecipeDialog
        recipe={viewingRecipe}
        open={!!viewingRecipe}
        onOpenChange={(open) => !open && setViewingRecipe(null)}
      />
    </AppLayout>
  );
}
