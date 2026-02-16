import { Recipe } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Anchor, Calendar } from 'lucide-react';

const dayLabels: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

interface ViewRecipeDialogProps {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewRecipeDialog({ recipe, open, onOpenChange }: ViewRecipeDialogProps) {
  if (!recipe) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            {recipe.name}
            {recipe.isAnchored && <Anchor className="w-4 h-4 text-primary" />}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{recipe.servings} servings</Badge>
            <Badge variant="outline">{recipe.mealType}</Badge>
            {recipe.defaultDay && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {dayLabels[recipe.defaultDay]}
              </Badge>
            )}
          </div>

          {/* Macros */}
          <div className="grid grid-cols-4 gap-3">
            <MacroBox label="Calories" value={recipe.macrosPerServing.calories} />
            <MacroBox label="Protein" value={recipe.macrosPerServing.protein_g} unit="g" />
            <MacroBox label="Carbs" value={recipe.macrosPerServing.carbs_g} unit="g" />
            <MacroBox label="Fat" value={recipe.macrosPerServing.fat_g} unit="g" />
          </div>

          {/* Ingredients */}
          {recipe.ingredients.length > 0 && (
            <section>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">Ingredients</h3>
              <ul className="space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-primary mt-1.5 w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                    {ing}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Instructions */}
          {recipe.instructions && (
            <section>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground uppercase tracking-wide">Instructions</h3>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                {recipe.instructions}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MacroBox({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{Math.round(value)}{unit}</p>
    </div>
  );
}
