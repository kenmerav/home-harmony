import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { mockGroceryItems } from '@/data/mockData';
import { GroceryItem, GroceryCategory } from '@/types';
import { Copy, ExternalLink, ShoppingCart, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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

export default function GroceryPage() {
  const [items, setItems] = useState(mockGroceryItems);
  const { toast } = useToast();

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
        subtitle={`${checkedCount} of ${totalCount} items checked`}
        action={
          <Button onClick={copyList} variant="outline" size="sm">
            <Copy className="w-4 h-4 mr-2" />
            Copy List
          </Button>
        }
      />

      {/* Progress */}
      <div className="mb-6">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(checkedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <SectionCard key={category} noPadding>
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
                      {item.quantity} • {item.sourceRecipes.join(', ')}
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
          </SectionCard>
        ))}
      </div>

      {totalCount === 0 && (
        <div className="text-center py-12">
          <ShoppingCart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No items on your list</p>
          <p className="text-sm text-muted-foreground mt-1">
            Items will appear based on your meal plan
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
