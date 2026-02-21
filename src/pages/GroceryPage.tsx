import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { GroceryCategory } from '@/types';
import { Copy, ExternalLink, ShoppingCart, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { fetchMealsForWeek, DbPlannedMeal } from '@/lib/api/meals';
import { getMealMultipliers } from '@/lib/mealPrefs';

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
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
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
    if (left && right) return [left, right];
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
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
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

function shouldSkipIngredientName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (!lower) return true;
  if (lower === '%' || lower === 'cont') return true;
  if (/back to table of contents?/.test(lower)) return true;
  if (/\btable of cont/.test(lower)) return true;
  if (/\(e\.g\.$/.test(lower)) return true;
  if (/(^|\\s)cont$/.test(lower)) return true;
  if (['red', 'green', 'yellow', 'orange'].includes(lower)) return true;
  return false;
}

function normalizeIngredientName(name: string): string {
  return name
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
        if (shouldSkipIngredientName(parsed.name)) continue;
        const key = normalizeIngredientName(parsed.name);
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
            name: parsed.name,
            quantity: '',
            category: categorizeIngredient(parsed.name),
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
  const { toast } = useToast();

  useEffect(() => {
    loadGroceryList();
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

  const openWalmartSearch = (itemName: string) => {
    const query = encodeURIComponent(itemName);
    window.open(`https://www.walmart.com/search?q=${query}`, '_blank');
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Grocery List" 
        subtitle={loading ? 'Loading...' : `${checkedCount} of ${totalCount} items checked`}
        action={
          <Button onClick={copyList} variant="outline" size="sm" disabled={totalCount === 0}>
            <Copy className="w-4 h-4 mr-2" />
            Copy List
          </Button>
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
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={() => openWalmartSearch(item.name)}
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
    </AppLayout>
  );
}
