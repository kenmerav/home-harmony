import { useState, useEffect } from 'react';
import { Recipe, DayOfWeek } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { updateRecipe, deleteRecipe, DbRecipe } from '@/lib/api/recipes';
import { Trash2 } from 'lucide-react';
import { normalizeRecipeIngredients } from '@/lib/recipeText';

interface EditRecipeDialogProps {
  recipe: Recipe | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updated: DbRecipe) => void;
  onDeleted: (id: string) => void;
}

export function EditRecipeDialog({ recipe, open, onOpenChange, onSaved, onDeleted }: EditRecipeDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState('');
  const [servings, setServings] = useState('4');
  const [mealType, setMealType] = useState('dinner');
  const [dishType, setDishType] = useState<'main' | 'side' | 'dessert'>('main');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isMealPrep, setIsMealPrep] = useState(false);

  const normalizeIntegerInput = (value: string) => {
    const digits = value.replace(/[^\d]/g, '');
    if (!digits) return '';
    const normalized = digits.replace(/^0+(?=\d)/, '');
    return normalized || '0';
  };

  useEffect(() => {
    if (recipe) {
      setName(recipe.name);
      setServings(String(recipe.servings || 4));
      setMealType(recipe.mealType);
      setDishType(recipe.dishType || 'main');
      setCalories(String(recipe.macrosPerServing.calories ?? 0));
      setProtein(String(recipe.macrosPerServing.protein_g ?? 0));
      setCarbs(String(recipe.macrosPerServing.carbs_g ?? 0));
      setFat(String(recipe.macrosPerServing.fat_g ?? 0));
      setIngredientsText(normalizeRecipeIngredients(recipe.ingredients).join('\n'));
      setInstructions(recipe.instructions || '');
      setIsMealPrep(!!recipe.isMealPrep);
    }
  }, [recipe]);

  if (!recipe) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ingredients = normalizeRecipeIngredients(ingredientsText.split('\n'));
      const parsedServings = Number.parseInt(servings, 10);
      const parsedCalories = Number.parseInt(calories, 10);
      const parsedProtein = Number.parseInt(protein, 10);
      const parsedCarbs = Number.parseInt(carbs, 10);
      const parsedFat = Number.parseInt(fat, 10);
      const updated = await updateRecipe(recipe.id, {
        name,
        servings: Number.isFinite(parsedServings) && parsedServings > 0 ? parsedServings : 1,
        meal_type: mealType,
        course_type: dishType,
        calories: Number.isFinite(parsedCalories) ? Math.max(0, parsedCalories) : 0,
        protein_g: Number.isFinite(parsedProtein) ? Math.max(0, parsedProtein) : 0,
        carbs_g: Number.isFinite(parsedCarbs) ? Math.max(0, parsedCarbs) : 0,
        fat_g: Number.isFinite(parsedFat) ? Math.max(0, parsedFat) : 0,
        is_meal_prep: isMealPrep,
        ingredients,
        ingredients_raw: ingredientsText,
        instructions: instructions || null,
      });
      onSaved(updated);
      onOpenChange(false);
      toast({ title: 'Recipe updated' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save changes',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this recipe permanently?')) return;
    setIsSaving(true);
    try {
      await deleteRecipe(recipe.id);
      onDeleted(recipe.id);
      onOpenChange(false);
      toast({ title: 'Recipe deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete recipe', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Recipe</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="recipe-name">Name</Label>
            <Input id="recipe-name" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <Label htmlFor="recipe-servings">Servings</Label>
              <Input
                id="recipe-servings"
                type="number"
                min={1}
                inputMode="numeric"
                value={servings}
                onChange={e => setServings(normalizeIntegerInput(e.target.value))}
              />
            </div>
            <div>
              <Label>Meal Type</Label>
              <Select value={mealType} onValueChange={setMealType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                  <SelectItem value="snack">Snack</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dish Type</Label>
              <Select value={dishType} onValueChange={(value) => setDishType(value as 'main' | 'side' | 'dessert')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">Main dish</SelectItem>
                  <SelectItem value="side">Side dish</SelectItem>
                  <SelectItem value="dessert">Dessert</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
            <Checkbox
              checked={isMealPrep}
              onCheckedChange={(checked) => setIsMealPrep(Boolean(checked))}
            />
            <span className="text-sm">Meal prep recipe (can be excluded from grocery list once prepped)</span>
          </label>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Macros per Serving</Label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              <div>
                <Label htmlFor="cal" className="text-xs">Cal</Label>
                <Input id="cal" type="number" min={0} inputMode="numeric" value={calories} onChange={e => setCalories(normalizeIntegerInput(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="prot" className="text-xs">Protein (g)</Label>
                <Input id="prot" type="number" min={0} inputMode="numeric" value={protein} onChange={e => setProtein(normalizeIntegerInput(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="carb" className="text-xs">Carbs (g)</Label>
                <Input id="carb" type="number" min={0} inputMode="numeric" value={carbs} onChange={e => setCarbs(normalizeIntegerInput(e.target.value))} />
              </div>
              <div>
                <Label htmlFor="fatt" className="text-xs">Fat (g)</Label>
                <Input id="fatt" type="number" min={0} inputMode="numeric" value={fat} onChange={e => setFat(normalizeIntegerInput(e.target.value))} />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="ingredients">Ingredients (one per line)</Label>
            <Textarea id="ingredients" rows={5} value={ingredientsText} onChange={e => setIngredientsText(e.target.value)} />
          </div>

          <div>
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea id="instructions" rows={5} value={instructions} onChange={e => setInstructions(e.target.value)} />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isSaving}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving}>Save Changes</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
