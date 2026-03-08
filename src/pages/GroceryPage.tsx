import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GroceryCategory } from '@/types';
import { Copy, ExternalLink, ShoppingCart, Check, Settings2, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
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
  getNextWeekOf,
  loadWeeklyPlanningStatus,
  setWeeklyGroceriesOrdered,
  WeeklyPlanningStatus,
} from '@/lib/api/weeklyPlanningStatus';
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
  name: string;
  quantity: string;
  category: GroceryCategory;
  isChecked: boolean;
  sourceRecipes: string[];
}

interface ParsedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
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

  return name;
}

function shouldSkipIngredientName(name: string): boolean {
  const lower = cleanIngredientName(name).toLowerCase().trim();
  if (!lower) return true;
  if (lower === '%' || lower === 'cont') return true;
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

function buildGroceryList(meals: DbPlannedMeal[], multipliers: Record<string, number>): GroceryItem[] {
  const itemMap = new Map<string, GroceryItem & { qtyByUnit: Map<string, number>; countNoQty: number }>();
  
  for (const meal of meals) {
    if (meal.is_skipped) continue;
    const recipe = meal.recipes;
    if (!recipe?.ingredients) continue;
    const mealMultiplier = multipliers[meal.id] === 2 ? 2 : 1;
    
    for (const ingredient of recipe.ingredients as string[]) {
      for (const split of splitCompositeIngredients(ingredient)) {
        const parsed = parseIngredient(split);
        const cleanedName = cleanIngredientName(parsed.name);
        if (shouldSkipIngredientName(cleanedName)) continue;
        const key = normalizeIngredientName(cleanedName);
        if (!key || key.length < 2) continue;
        
        if (itemMap.has(key)) {
          const existing = itemMap.get(key)!;
          if (!existing.sourceRecipes.includes(recipe.name)) {
            existing.sourceRecipes.push(mealMultiplier === 2 ? `${recipe.name} (2x)` : recipe.name);
          }
          if (parsed.quantity !== null && parsed.unit) {
            existing.qtyByUnit.set(parsed.unit, (existing.qtyByUnit.get(parsed.unit) || 0) + (parsed.quantity * mealMultiplier));
          } else {
            existing.countNoQty += mealMultiplier;
          }
        } else {
          itemMap.set(key, {
            id: `grocery-${itemMap.size}`,
            name: cleanedName,
            quantity: '',
            category: categorizeIngredient(cleanedName),
            isChecked: false,
            sourceRecipes: [mealMultiplier === 2 ? `${recipe.name} (2x)` : recipe.name],
            qtyByUnit: new Map(parsed.quantity !== null && parsed.unit ? [[parsed.unit, parsed.quantity * mealMultiplier]] : []),
            countNoQty: parsed.quantity !== null && parsed.unit ? 0 : mealMultiplier,
          });
        }
      }
    }
  }
  
  return Array.from(itemMap.values()).map((item) => ({
    id: item.id,
    name: item.name,
    quantity: formatQuantity(item.qtyByUnit, item.countNoQty),
    category: item.category,
    isChecked: item.isChecked,
    sourceRecipes: item.sourceRecipes,
  }));
}

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [prefsOpen, setPrefsOpen] = useState(false);
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
  const [nextWeekStatus, setNextWeekStatus] = useState<WeeklyPlanningStatus | null>(null);
  const [updatingNextWeekStatus, setUpdatingNextWeekStatus] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPreferredStoreIdState(getPreferredGroceryStoreId());
    setItemStoreOverrides(getItemStoreOverrides());
    setOrderReminder(getOrderReminderSettings());
    setLastOrderCompletedAt(getLastOrderCompletedAt());
    setWeeklyAdZipState(getWeeklyAdZip());
    setWeeklyAdStoreIdsState(getWeeklyAdStoreIds());
    loadGroceryList();
    void loadNextWeekStatus();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLastOrderCompletedAt(getLastOrderCompletedAt());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadGroceryList = async () => {
    try {
      setLoading(true);
      const meals = await fetchMealsForWeek(0);
      setItems(buildGroceryList(meals, getMealMultipliers()));
    } catch (err) {
      console.error('Failed to load grocery list:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNextWeekStatus = async () => {
    try {
      const status = await loadWeeklyPlanningStatus(getNextWeekOf());
      setNextWeekStatus(status);
    } catch (error) {
      console.error('Failed to load next-week grocery order status:', error);
    }
  };

  const toggleItem = (itemId: string) => {
    setItems(prev => prev.map(item =>
      item.id === itemId ? { ...item, isChecked: !item.isChecked } : item
    ));
  };

  const groupedItems = categoryOrder.reduce((acc, category) => {
    const categoryItems = items.filter(item => item.category === category);
    if (categoryItems.length > 0) {
      acc[category] = categoryItems;
    }
    return acc;
  }, {} as Record<GroceryCategory, GroceryItem[]>);

  const checkedCount = items.filter(i => i.isChecked).length;
  const totalCount = items.length;

  const copyList = () => {
    const uncheckedItems = items
      .filter(i => !i.isChecked)
      .map(i => `${i.name} (${i.quantity})`)
      .join('\n');
    
    navigator.clipboard.writeText(uncheckedItems);
    toast({
      title: "Copied to clipboard",
      description: `${items.length - checkedCount} items copied`,
    });
  };

  const openStoreSearch = (itemName: string) => {
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

  const saveGroceryPrefs = () => {
    setPreferredGroceryStoreId(preferredStoreId);
    setOrderReminderSettings(orderReminder);
    setPrefsOpen(false);
    toast({ title: 'Grocery settings saved' });
  };

  const markOrderDone = () => {
    const now = new Date().toISOString();
    markGroceryOrderCompleted(now);
    setLastOrderCompletedAt(now);
    toast({ title: 'Order marked complete', description: 'Reminder will wait until next scheduled window.' });
  };

  const toggleNextWeekOrdered = async (ordered: boolean) => {
    try {
      setUpdatingNextWeekStatus(true);
      const status = await setWeeklyGroceriesOrdered(getNextWeekOf(), ordered);
      setNextWeekStatus(status);
      toast({
        title: ordered ? 'Marked next week as ordered' : 'Cleared ordered status',
        description: ordered
          ? 'SMS reminders will stop for next week grocery ordering.'
          : 'You can mark it ordered again after checkout.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update order status.';
      toast({
        title: 'Could not update status',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingNextWeekStatus(false);
    }
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
                      onClick={() => window.open(buildWeeklyAdUrl(store.id, weeklyAdZip), '_blank')}
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
            <p className="text-sm font-semibold">Next week grocery order</p>
            <p className="text-xs text-muted-foreground">
              Mark this once you place checkout so SMS reminders know groceries are handled.
            </p>
            {nextWeekStatus?.groceries_ordered_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                Marked ordered: {new Date(nextWeekStatus.groceries_ordered_at).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant={nextWeekStatus?.groceries_ordered ? 'outline' : 'default'}
            onClick={() => void toggleNextWeekOrdered(!nextWeekStatus?.groceries_ordered)}
            disabled={updatingNextWeekStatus}
          >
            {updatingNextWeekStatus
              ? 'Saving...'
              : nextWeekStatus?.groceries_ordered
              ? 'Mark as Not Ordered'
              : 'Mark Ordered'}
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
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 border-l-4 transition-gentle",
                      categoryColors[item.category],
                      item.isChecked && "bg-muted/30"
                    )}
                  >
                    <Checkbox 
                      checked={item.isChecked}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-sm transition-gentle",
                        item.isChecked && "line-through text-muted-foreground"
                      )}>
                        {item.name} <span className="text-muted-foreground">({item.quantity})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.sourceRecipes.join(', ')}
                      </p>
                    </div>
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
                      onClick={() => openStoreSearch(item.name)}
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
            Generate a meal plan first, then ingredients will appear here
          </p>
        </div>
      )}

      {checkedCount === totalCount && totalCount > 0 && (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="w-8 h-8 text-primary" />
          </div>
          <p className="font-display text-xl font-semibold">All done!</p>
          <p className="text-muted-foreground">Your shopping is complete</p>
        </div>
      )}

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
    </AppLayout>
  );
}
