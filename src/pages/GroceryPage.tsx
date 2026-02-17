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

interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: GroceryCategory;
  isChecked: boolean;
  sourceRecipes: string[];
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

function buildGroceryList(meals: DbPlannedMeal[]): GroceryItem[] {
  const itemMap = new Map<string, GroceryItem>();
  
  for (const meal of meals) {
    if (meal.is_skipped) continue;
    const recipe = meal.recipes as any;
    if (!recipe?.ingredients) continue;
    
    for (const ingredient of recipe.ingredients as string[]) {
      const key = ingredient.toLowerCase().trim();
      if (!key) continue;
      
      if (itemMap.has(key)) {
        const existing = itemMap.get(key)!;
        if (!existing.sourceRecipes.includes(recipe.name)) {
          existing.sourceRecipes.push(recipe.name);
        }
      } else {
        itemMap.set(key, {
          id: `grocery-${itemMap.size}`,
          name: ingredient,
          quantity: '1',
          category: categorizeIngredient(ingredient),
          isChecked: false,
          sourceRecipes: [recipe.name],
        });
      }
    }
  }
  
  return Array.from(itemMap.values());
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
      setItems(buildGroceryList(meals));
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
      .map(i => `${i.name}`)
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
                        {item.name}
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
