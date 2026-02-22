import { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Recipe, DayOfWeek } from '@/types';
import { Search, Upload, UtensilsCrossed, Anchor, Calendar, FileText, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  parseRecipesFromPdf,
  parseRecipesFromJson,
  parseRecipesFromImage,
  ExtractedRecipe,
  fetchRecipes,
  saveRecipes,
  DbRecipe,
} from '@/lib/api/recipes';
import { ViewRecipeDialog } from '@/components/recipes/ViewRecipeDialog';
import { EditRecipeDialog } from '@/components/recipes/EditRecipeDialog';
import { estimateCookMinutes, formatCookTime } from '@/lib/recipeTime';
import { normalizeRecipeInstructions } from '@/lib/recipeText';
import { getRecipeImageUrl } from '@/data/recipeImages';
import { getFavoriteIds, getKidFriendlyOverrides, setFavorite, setKidFriendly } from '@/lib/mealPrefs';
import { inferKidFriendly } from '@/lib/kidFriendly';

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

// Convert DB recipe to display format
function dbRecipeToDisplayRecipe(
  dbRecipe: DbRecipe,
  favoriteIds: Set<string>,
  kidFriendlyOverrides: Record<string, boolean>,
): Recipe {
  const inferredKidFriendly = inferKidFriendly(dbRecipe);
  const isKidFriendly = kidFriendlyOverrides[dbRecipe.id] ?? inferredKidFriendly;

  return {
    id: dbRecipe.id,
    name: dbRecipe.name,
    servings: dbRecipe.servings,
    estimatedCookMinutes: estimateCookMinutes(dbRecipe.instructions),
    imageUrl: getRecipeImageUrl(dbRecipe.name),
    isFavorite: favoriteIds.has(dbRecipe.id),
    isKidFriendly,
    ingredients: dbRecipe.ingredients,
    ingredientsRaw: dbRecipe.ingredients_raw || '',
    instructions: normalizeRecipeInstructions(dbRecipe.instructions || ''),
    macrosPerServing: {
      calories: dbRecipe.calories,
      protein_g: dbRecipe.protein_g,
      carbs_g: dbRecipe.carbs_g,
      fat_g: dbRecipe.fat_g,
    },
    mealType: dbRecipe.meal_type as 'breakfast' | 'lunch' | 'dinner' | 'snack',
    isAnchored: dbRecipe.is_anchored,
    defaultDay: dbRecipe.default_day as DayOfWeek | undefined,
    createdAt: new Date(dbRecipe.created_at),
  };
}

export default function RecipesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [kidFriendlyOnly, setKidFriendlyOnly] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadStep, setUploadStep] = useState<'upload' | 'review'>('upload');
  const [extractedRecipes, setExtractedRecipes] = useState<ExtractedRecipe[]>([]);
  const [selectedRecipes, setSelectedRecipes] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [kidFriendlyOverrides, setKidFriendlyOverrides] = useState<Record<string, boolean>>({});

  const loadRecipes = useCallback(async () => {
    try {
      setIsLoading(true);
      const nextFavorites = getFavoriteIds();
      const nextKidFriendlyOverrides = getKidFriendlyOverrides();
      setFavoriteIds(nextFavorites);
      setKidFriendlyOverrides(nextKidFriendlyOverrides);
      const dbRecipes = await fetchRecipes();
      setRecipes(dbRecipes.map((r) => dbRecipeToDisplayRecipe(r, nextFavorites, nextKidFriendlyOverrides)));
    } catch (error) {
      console.error('Failed to load recipes:', error);
      toast({
        title: "Error",
        description: "Failed to load recipes from database",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Load recipes from database on mount
  useEffect(() => {
    setFavoriteIds(getFavoriteIds());
    setKidFriendlyOverrides(getKidFriendlyOverrides());
    void loadRecipes();
  }, [loadRecipes]);

  const refreshRecipeTags = () => {
    const nextFavorites = getFavoriteIds();
    const nextKidFriendlyOverrides = getKidFriendlyOverrides();
    setFavoriteIds(nextFavorites);
    setKidFriendlyOverrides(nextKidFriendlyOverrides);
    setRecipes((prev) =>
      prev.map((r) => ({
        ...r,
        isFavorite: nextFavorites.has(r.id),
        isKidFriendly: nextKidFriendlyOverrides[r.id] ?? r.isKidFriendly ?? false,
      })),
    );
  };

  const toggleFavorite = (recipe: Recipe) => {
    setFavorite(recipe.id, !recipe.isFavorite);
    refreshRecipeTags();
  };

  const toggleKidFriendly = (recipe: Recipe) => {
    setKidFriendly(recipe.id, !recipe.isKidFriendly);
    refreshRecipeTags();
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFavorite = !favoritesOnly || !!recipe.isFavorite;
    const matchesKidFriendly = !kidFriendlyOnly || !!recipe.isKidFriendly;
    return matchesSearch && matchesFavorite && matchesKidFriendly;
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      processJson(file);
    } else if (file.type === 'application/pdf') {
      processPdf(file);
    } else if (file.type.startsWith('image/')) {
      processImage(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a JSON, PDF, or image file",
        variant: "destructive",
      });
    }
  };

  const processJson = async (file: File) => {
    setIsProcessing(true);
    setProcessingStatus('Parsing JSON file...');
    
    try {
      const result = await parseRecipesFromJson(file);
      
      if (!result.success || !result.recipes) {
        toast({
          title: "Failed to parse JSON",
          description: result.error || "Could not extract recipes from the JSON file",
          variant: "destructive",
        });
        setIsProcessing(false);
        setProcessingStatus('');
        return;
      }

      setExtractedRecipes(result.recipes);
      setSelectedRecipes(new Set(result.recipes.map((_, i) => i)));
      setUploadStep('review');
      
      toast({
        title: "JSON processed",
        description: `Found ${result.recipes.length} recipes`,
      });
    } catch (error) {
      console.error('Error processing JSON:', error);
      toast({
        title: "Error",
        description: "Failed to process the JSON file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const processPdf = async (file: File) => {
    setIsProcessing(true);
    
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > 100) {
      toast({
        title: "File too large",
        description: "Please upload a PDF smaller than 100MB",
        variant: "destructive",
      });
      setIsProcessing(false);
      return;
    }

    if (fileSizeMB > 20) {
      setProcessingStatus(`Large file (${fileSizeMB.toFixed(0)}MB) - extracting text...`);
    } else {
      setProcessingStatus('Extracting text from PDF...');
    }
    
    try {
      setProcessingStatus(fileSizeMB > 20 
        ? `Processing large cookbook (${fileSizeMB.toFixed(0)}MB)... this may take a minute`
        : 'Analyzing recipes with AI...'
      );
      
      const result = await parseRecipesFromPdf(file);
      
      if (!result.success || !result.recipes) {
        toast({
          title: "Failed to process PDF",
          description: result.error || "Could not extract recipes from the PDF",
          variant: "destructive",
        });
        setIsProcessing(false);
        setProcessingStatus('');
        return;
      }

      setExtractedRecipes(result.recipes);
      setSelectedRecipes(new Set(result.recipes.map((_, i) => i)));
      setUploadStep('review');
      
      toast({
        title: "PDF processed",
        description: `Found ${result.recipes.length} recipes`,
      });
    } catch (error) {
      console.error('Error processing PDF:', error);
      toast({
        title: "Error",
        description: "Failed to process the PDF file",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setProcessingStatus('Reading recipe photo...');

    try {
      setProcessingStatus('Analyzing recipe image with AI...');
      const result = await parseRecipesFromImage(file);

      if (!result.success || !result.recipes) {
        toast({
          title: 'Failed to process photo',
          description: result.error || 'Could not extract recipes from the image',
          variant: 'destructive',
        });
        return;
      }

      setExtractedRecipes(result.recipes);
      setSelectedRecipes(new Set(result.recipes.map((_, i) => i)));
      setUploadStep('review');

      toast({
        title: 'Recipe photo processed',
        description: `Found ${result.recipes.length} recipe${result.recipes.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error processing recipe photo:', error);
      toast({
        title: 'Error',
        description: 'Failed to process recipe image',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const toggleRecipeSelection = (index: number) => {
    const newSelected = new Set(selectedRecipes);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRecipes(newSelected);
  };

  const importSelectedRecipes = async () => {
    const selectedExtracted = extractedRecipes.filter((_, index) => selectedRecipes.has(index));
    
    if (selectedExtracted.length === 0) return;

    setIsProcessing(true);
    setProcessingStatus('Saving recipes to database...');

    try {
      const savedRecipes = await saveRecipes(selectedExtracted);
      const displayRecipes = savedRecipes.map(dbRecipeToDisplayRecipe);
      
      setRecipes(prev => [...displayRecipes, ...prev]);
      setUploadModalOpen(false);
      setUploadStep('upload');
      setExtractedRecipes([]);
      setSelectedRecipes(new Set());
      
      toast({
        title: "Recipes imported",
        description: `${savedRecipes.length} recipes saved to your library`,
      });
    } catch (error) {
      console.error('Failed to save recipes:', error);
      toast({
        title: "Error",
        description: "Failed to save recipes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const closeModal = () => {
    setUploadModalOpen(false);
    setUploadStep('upload');
    setExtractedRecipes([]);
    setSelectedRecipes(new Set());
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Recipes" 
        subtitle={`${recipes.length} recipes in your library`}
        action={
            <Button onClick={() => setUploadModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Recipes
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

      <div className="mb-6 flex flex-wrap gap-2">
        <Button
          variant={favoritesOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFavoritesOnly((v) => !v)}
        >
          {favoritesOnly ? 'Showing Favorites' : 'Favorites Only'}
        </Button>
        <Button
          variant={kidFriendlyOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setKidFriendlyOnly((v) => !v)}
        >
          {kidFriendlyOnly ? 'Showing Kid Friendly' : 'Kid Friendly Only'}
        </Button>
      </div>

      {/* Recipe Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
        {filteredRecipes.map(recipe => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            onView={() => setViewingRecipe(recipe)}
            onEdit={() => setEditingRecipe(recipe)}
            onToggleFavorite={() => toggleFavorite(recipe)}
            onToggleKidFriendly={() => toggleKidFriendly(recipe)}
          />
        ))}
      </div>

      {filteredRecipes.length === 0 && (
        <div className="text-center py-12">
          <UtensilsCrossed className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">No recipes found</p>
        </div>
      )}

      {/* Upload PDF Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {uploadStep === 'upload' ? 'Upload Recipes' : 'Review Extracted Recipes'}
            </DialogTitle>
            <DialogDescription>
              {uploadStep === 'upload' 
                ? 'Upload a JSON file, PDF cookbook, or recipe photo to import recipes'
                : `${extractedRecipes.length} recipes found. Select which ones to import.`
              }
            </DialogDescription>
          </DialogHeader>

          {uploadStep === 'upload' ? (
            <div className="space-y-4">
              <div 
                className={cn(
                  "border-2 border-dashed border-border rounded-xl p-8 text-center transition-gentle cursor-pointer",
                  "hover:border-primary/50 hover:bg-primary/5",
                  isProcessing && "pointer-events-none opacity-50"
                )}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.pdf,image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {isProcessing ? (
                  <>
                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <p className="font-medium">Processing upload...</p>
                    <p className="text-sm text-muted-foreground mt-1">{processingStatus || 'Extracting recipes'}</p>
                  </>
                ) : (
                  <>
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="font-medium">Click to upload JSON, PDF, or recipe photo</p>
                    <p className="text-sm text-muted-foreground mt-1">JSON is fastest; photos work for single recipes</p>
                  </>
                )}
              </div>

              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="font-medium mb-2">What we'll extract:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Recipe name and servings</li>
                  <li>• Ingredients list</li>
                  <li>• Cooking instructions</li>
                  <li>• Nutrition facts (calories, protein, carbs, fat)</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                {extractedRecipes.map((recipe, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "border border-border rounded-lg p-4 transition-gentle cursor-pointer",
                      selectedRecipes.has(index) && "border-primary bg-primary/5"
                    )}
                    onClick={() => toggleRecipeSelection(index)}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox 
                        checked={selectedRecipes.has(index)}
                        onCheckedChange={() => toggleRecipeSelection(index)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium">{recipe.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {recipe.servings} servings
                          {formatCookTime(estimateCookMinutes(recipe.instructions)) && (
                            <> • {formatCookTime(estimateCookMinutes(recipe.instructions))}</>
                          )}
                        </p>
                        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                          <span>{recipe.macrosPerServing?.calories} cal</span>
                          <span>{recipe.macrosPerServing?.protein_g}g protein</span>
                          <span>{recipe.macrosPerServing?.carbs_g}g carbs</span>
                          <span>{recipe.macrosPerServing?.fat_g}g fat</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {selectedRecipes.size} of {extractedRecipes.length} selected
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setUploadStep('upload')}>
                    Back
                  </Button>
                  <Button 
                    onClick={importSelectedRecipes}
                    disabled={selectedRecipes.size === 0}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Import {selectedRecipes.size} Recipe{selectedRecipes.size !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Recipe Dialog */}
      <ViewRecipeDialog
        recipe={viewingRecipe}
        open={!!viewingRecipe}
        onOpenChange={(open) => !open && setViewingRecipe(null)}
      />

      {/* Edit Recipe Dialog */}
      <EditRecipeDialog
        recipe={editingRecipe}
        open={!!editingRecipe}
        onOpenChange={(open) => !open && setEditingRecipe(null)}
        onSaved={(updated) => {
          setRecipes(prev => prev.map(r => r.id === updated.id ? dbRecipeToDisplayRecipe(updated, favoriteIds, kidFriendlyOverrides) : r));
        }}
        onDeleted={(id) => {
          setRecipes(prev => prev.filter(r => r.id !== id));
        }}
      />
    </AppLayout>
  );
}

function RecipeCard({
  recipe,
  onView,
  onEdit,
  onToggleFavorite,
  onToggleKidFriendly,
}: {
  recipe: Recipe;
  onView: () => void;
  onEdit: () => void;
  onToggleFavorite: () => void;
  onToggleKidFriendly: () => void;
}) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden card-hover">
      {recipe.imageUrl && (
        <div className="h-36 w-full bg-muted/40 overflow-hidden border-b border-border">
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-lg text-foreground truncate">
              {recipe.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {recipe.servings} servings
              {formatCookTime(recipe.estimatedCookMinutes) && (
                <> • {formatCookTime(recipe.estimatedCookMinutes)}</>
              )}
            </p>
          </div>
          {recipe.isAnchored && (
            <Anchor className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant={recipe.isFavorite ? 'default' : 'outline'} size="sm" onClick={onToggleFavorite}>
            {recipe.isFavorite ? 'Favorite' : 'Mark Favorite'}
          </Button>
          <Button variant={recipe.isKidFriendly ? 'default' : 'outline'} size="sm" onClick={onToggleKidFriendly}>
            {recipe.isKidFriendly ? 'Kid Friendly' : 'Mark Kid Friendly'}
          </Button>
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
        <Button variant="outline" size="sm" className="flex-1" onClick={onView}>
          View Recipe
        </Button>
        <Button variant="ghost" size="sm" onClick={onEdit}>
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
