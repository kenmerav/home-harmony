import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mockRecipes } from '@/data/mockData';
import { Recipe, DayOfWeek } from '@/types';
import { Plus, Search, Upload, UtensilsCrossed, Anchor, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [recipes] = useState(mockRecipes);

  const filteredRecipes = recipes.filter(recipe =>
    recipe.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout>
      <PageHeader 
        title="Recipes" 
        subtitle={`${recipes.length} recipes in your library`}
        action={
          <Button>
            <Upload className="w-4 h-4 mr-2" />
            Upload PDF
          </Button>
        }
      />

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search recipes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
        {filteredRecipes.map(recipe => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>

      {filteredRecipes.length === 0 && (
        <div className="text-center py-12">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No recipes found</p>
        </div>
      )}
    </AppLayout>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden card-hover">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-lg text-foreground truncate">
              {recipe.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {recipe.servings} servings
            </p>
          </div>
          {recipe.isAnchored && (
            <Anchor className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
          )}
        </div>
        
        {recipe.defaultDay && (
          <div className="flex items-center gap-1.5 mt-2">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Default: {dayLabels[recipe.defaultDay]}
            </span>
          </div>
        )}
      </div>

      {/* Macros */}
      <div className="grid grid-cols-4 divide-x divide-border bg-muted/30">
        <MacroStat label="Cal" value={recipe.macrosPerServing.calories} />
        <MacroStat label="Protein" value={recipe.macrosPerServing.protein_g} unit="g" />
        <MacroStat label="Carbs" value={recipe.macrosPerServing.carbs_g} unit="g" />
        <MacroStat label="Fat" value={recipe.macrosPerServing.fat_g} unit="g" />
      </div>

      {/* Actions */}
      <div className="p-3 flex gap-2">
        <Button variant="outline" size="sm" className="flex-1">
          View Recipe
        </Button>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </div>
    </div>
  );
}

function MacroStat({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="py-2 px-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">
        {Math.round(value)}{unit}
      </p>
    </div>
  );
}
