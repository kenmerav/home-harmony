import { useState, useRef, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Recipe, DayOfWeek } from '@/types';
import { Search, Upload, UtensilsCrossed, Anchor, Calendar, FileText, Check, Link2, WandSparkles, ExternalLink } from 'lucide-react';
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  enqueueCookbookImportFromPdf,
  parseRecipesFromPdf,
  parseRecipesFromJson,
  parseRecipesFromImage,
  parseRecipesFromUrl,
  extractPinterestBoardLinks,
  extractRecipePageLinks,
  fetchCookbookImportJobs,
  cancelCookbookImportJob,
  CookbookImportJob,
  ExtractedRecipe,
  fetchRecipes,
  saveRecipes,
  cleanUpRecipeLibrary,
  DbRecipe,
} from '@/lib/api/recipes';
import { ViewRecipeDialog } from '@/components/recipes/ViewRecipeDialog';
import { EditRecipeDialog } from '@/components/recipes/EditRecipeDialog';
import { estimateCookMinutes, formatCookTime } from '@/lib/recipeTime';
import { normalizeRecipeInstructions } from '@/lib/recipeText';
import { getRecipeImageUrl } from '@/data/recipeImages';
import { getFavoriteIds, getKidFriendlyOverrides, setFavorite, setKidFriendly } from '@/lib/mealPrefs';
import { inferKidFriendly } from '@/lib/kidFriendly';
import { isDemoModeEnabled } from '@/lib/demoMode';

function isEdgeTransportFailure(errorMessage?: string): boolean {
  const value = String(errorMessage || '').toLowerCase();
  return (
    value.includes('failed to send a request to the edge function') ||
    value.includes('failed to fetch') ||
    value.includes('networkerror') ||
    value.includes('fetch failed')
  );
}

const dayLabels: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

type RecipeInspirationStyle =
  | 'all'
  | 'healthy-easy'
  | 'high-protein'
  | 'kid-friendly'
  | 'budget'
  | 'vegetarian'
  | 'gluten-free'
  | 'slow-cooker';

interface PinterestBoardRecommendation {
  title: string;
  href: string;
  description: string;
  styles: RecipeInspirationStyle[];
}

const RECIPE_STYLE_FILTERS: Array<{ id: RecipeInspirationStyle; label: string }> = [
  { id: 'all', label: 'All styles' },
  { id: 'healthy-easy', label: 'Healthy + easy' },
  { id: 'high-protein', label: 'High protein' },
  { id: 'kid-friendly', label: 'Kid friendly' },
  { id: 'budget', label: 'Budget meals' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'gluten-free', label: 'Gluten free' },
  { id: 'slow-cooker', label: 'Slow cooker' },
];

const PINTEREST_BOARD_RECOMMENDATIONS: PinterestBoardRecommendation[] = [
  {
    title: 'Healthy Easy Dinners',
    href: 'https://www.pinterest.com/jennasuedesign/dinner/',
    description: 'Great starter board for healthy, practical weeknight meals.',
    styles: ['healthy-easy'],
  },
  {
    title: 'High Protein',
    href: 'https://www.pinterest.com/shelleyharland/high-protein/',
    description: 'Protein-forward meal ideas that fit macro-focused households.',
    styles: ['high-protein', 'healthy-easy'],
  },
  {
    title: 'Kid-Friendly Recipes',
    href: 'https://www.pinterest.com/yummly/kid-friendly-recipes/',
    description: 'Kid-approved meal ideas that are easier to get on the table.',
    styles: ['kid-friendly'],
  },
  {
    title: 'Budget Meals',
    href: 'https://www.pinterest.com/thelazydish/budget-meals/',
    description: 'Lower-cost meal inspiration for families watching grocery spend.',
    styles: ['budget', 'kid-friendly'],
  },
  {
    title: 'Vegetarian Meals',
    href: 'https://www.pinterest.com/lauriepadron/vegetarian-meals/',
    description: 'Vegetarian dinner ideas with good variety for weekly planning.',
    styles: ['vegetarian', 'healthy-easy'],
  },
  {
    title: 'Gluten Free Dinner Ideas',
    href: 'https://www.pinterest.com/cottercrunch/gluten-free-dinner-ideas/',
    description: 'Large gluten-free dinner board for households with restrictions.',
    styles: ['gluten-free', 'healthy-easy'],
  },
  {
    title: 'Slow Cooker Meals',
    href: 'https://www.pinterest.com/angie681/slow-cooker-meals/',
    description: 'Set-and-forget meal options for busy weeknights.',
    styles: ['slow-cooker', 'kid-friendly', 'budget'],
  },
];

const MAX_BULK_URLS = 25;

type LinkPreviewStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface LinkPreviewRecord {
  title: string;
  status: LinkPreviewStatus;
  recipes?: ExtractedRecipe[];
}

function parseBulkUrlInput(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const unique = new Set<string>();

  for (const line of lines) {
    const parts = line.split(/\s+/).map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      if (!part) continue;
      if (/^(https?:\/\/|www\.|[a-z0-9.-]+\.[a-z]{2,}\/)/i.test(part)) {
        unique.add(part.replace(/[),.;]+$/, ''));
      }
    }
  }

  return Array.from(unique);
}

function dedupeExtractedRecipes(recipes: ExtractedRecipe[]): ExtractedRecipe[] {
  const seen = new Set<string>();
  const deduped: ExtractedRecipe[] = [];

  for (const recipe of recipes) {
    const key = `${(recipe.name || '').trim().toLowerCase()}::${(recipe.ingredientsRaw || '').trim().toLowerCase().slice(0, 80)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(recipe);
  }

  return deduped;
}

function titleCaseWords(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function guessRecipeTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./i, '');
    const pinMatch = parsed.pathname.match(/\/pin\/(\d+)/i);
    if (hostname.includes('pinterest.com') && pinMatch?.[1]) {
      return `Pinterest Pin ${pinMatch[1]}`;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    const tail = segments[segments.length - 1] || '';
    const cleanedTail = decodeURIComponent(tail)
      .replace(/\.(html?|php|aspx?)$/i, '')
      .replace(/[-_+]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanedTail && /[a-z]/i.test(cleanedTail)) {
      return titleCaseWords(cleanedTail);
    }

    const hostLabel = hostname.split('.')[0] || 'Recipe';
    return `${titleCaseWords(hostLabel)} Recipe`;
  } catch {
    return 'Recipe Link';
  }
}

// Convert DB recipe to display format
function dbRecipeToDisplayRecipe(
  dbRecipe: DbRecipe,
  favoriteIds: Set<string> = new Set(),
  kidFriendlyOverrides: Record<string, boolean> = {},
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
  const [urlInput, setUrlInput] = useState('');
  const [bulkUrlsInput, setBulkUrlsInput] = useState('');
  const [bulkFailedUrls, setBulkFailedUrls] = useState<string[]>([]);
  const [recipeStyleFilter, setRecipeStyleFilter] = useState<RecipeInspirationStyle>('all');
  const [pinterestBoardUrl, setPinterestBoardUrl] = useState('');
  const [pinterestBoardTitle, setPinterestBoardTitle] = useState('');
  const [pinterestPinLinks, setPinterestPinLinks] = useState<string[]>([]);
  const [selectedPinterestPins, setSelectedPinterestPins] = useState<Set<string>>(new Set());
  const [isLoadingPinterestBoard, setIsLoadingPinterestBoard] = useState(false);
  const [recipeCollectionUrl, setRecipeCollectionUrl] = useState('');
  const [recipeCollectionTitle, setRecipeCollectionTitle] = useState('');
  const [recipeCollectionLinks, setRecipeCollectionLinks] = useState<Array<{ url: string; title: string }>>([]);
  const [selectedRecipeCollectionLinks, setSelectedRecipeCollectionLinks] = useState<Set<string>>(new Set());
  const [isLoadingRecipeCollection, setIsLoadingRecipeCollection] = useState(false);
  const [isResolvingLinkTitles, setIsResolvingLinkTitles] = useState(false);
  const [linkPreviewByUrl, setLinkPreviewByUrl] = useState<Record<string, LinkPreviewRecord>>({});
  const [currentImportUrl, setCurrentImportUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [viewingRecipe, setViewingRecipe] = useState<Recipe | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [kidFriendlyOverrides, setKidFriendlyOverrides] = useState<Record<string, boolean>>({});
  const [isCleaningRecipes, setIsCleaningRecipes] = useState(false);
  const [importJobs, setImportJobs] = useState<CookbookImportJob[]>([]);
  const [cancelingJobId, setCancelingJobId] = useState<string | null>(null);
  const importStatusRef = useRef<Record<string, CookbookImportJob['status']>>({});
  const hasLoadedImportJobsRef = useRef(false);

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

  const loadImportJobs = useCallback(async () => {
    if (isDemoModeEnabled()) {
      setImportJobs([]);
      return;
    }

    try {
      const jobs = await fetchCookbookImportJobs(12);
      setImportJobs(jobs);
    } catch (error) {
      console.error('Failed to load import jobs:', error);
    }
  }, []);

  // Load recipes from database on mount
  useEffect(() => {
    setFavoriteIds(getFavoriteIds());
    setKidFriendlyOverrides(getKidFriendlyOverrides());
    void loadRecipes();
  }, [loadRecipes]);

  useEffect(() => {
    if (isDemoModeEnabled()) return;

    void loadImportJobs();
    const timer = window.setInterval(() => {
      void loadImportJobs();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [loadImportJobs]);

  useEffect(() => {
    if (!importJobs.length) {
      importStatusRef.current = {};
      return;
    }

    const previous = importStatusRef.current;
    const next: Record<string, CookbookImportJob['status']> = {};

    for (const job of importJobs) {
      next[job.id] = job.status;
      const prevStatus = previous[job.id];
      if (!hasLoadedImportJobsRef.current || !prevStatus || prevStatus === job.status) continue;

      if (job.status === 'completed') {
        toast({
          title: 'Recipe import complete',
          description: `${job.recipes_saved} recipe${job.recipes_saved === 1 ? '' : 's'} added from ${job.file_name}.`,
        });
        void loadRecipes();
      } else if (job.status === 'failed') {
        toast({
          title: 'Recipe import failed',
          description: job.error_message || `We couldn't process ${job.file_name}.`,
          variant: 'destructive',
        });
      } else if (job.status === 'canceled') {
        toast({
          title: 'Recipe import canceled',
          description: `${job.file_name} was canceled.`,
        });
      }
    }

    importStatusRef.current = next;
    hasLoadedImportJobsRef.current = true;
  }, [importJobs, loadRecipes, toast]);

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

  const runRecipeCleanup = async () => {
    try {
      setIsCleaningRecipes(true);
      const result = await cleanUpRecipeLibrary();
      await loadRecipes();
      toast({
        title: 'Recipe cleanup complete',
        description: `Checked ${result.scanned} recipe${result.scanned === 1 ? '' : 's'}, updated ${result.updated}.`,
      });
    } catch (error) {
      console.error('Failed to clean recipe library:', error);
      toast({
        title: 'Cleanup failed',
        description: error instanceof Error ? error.message : 'Could not clean your recipes.',
        variant: 'destructive',
      });
    } finally {
      setIsCleaningRecipes(false);
    }
  };

  const cancelImport = async (job: CookbookImportJob) => {
    try {
      setCancelingJobId(job.id);
      await cancelCookbookImportJob(job.id);
      toast({
        title: 'Import canceled',
        description: `${job.file_name} has been canceled.`,
      });
      await loadImportJobs();
    } catch (error) {
      console.error('Failed to cancel import:', error);
      toast({
        title: 'Could not cancel import',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCancelingJobId(null);
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFavorite = !favoritesOnly || !!recipe.isFavorite;
    const matchesKidFriendly = !kidFriendlyOnly || !!recipe.isKidFriendly;
    return matchesSearch && matchesFavorite && matchesKidFriendly;
  });
  const filteredBoardRecommendations = PINTEREST_BOARD_RECOMMENDATIONS.filter(
    (board) => recipeStyleFilter === 'all' || board.styles.includes(recipeStyleFilter),
  );
  const activeImportJobs = importJobs.filter((job) => job.status === 'queued' || job.status === 'processing');
  const bulkParsedUrls = parseBulkUrlInput(bulkUrlsInput);
  const bulkUrlCount = bulkParsedUrls.length;
  const selectedPinterestLinks = pinterestPinLinks.filter((link) => selectedPinterestPins.has(link));
  const selectedPinterestPinCount = selectedPinterestPins.size;
  const selectedRecipeCollectionUrlList = recipeCollectionLinks
    .map((item) => item.url)
    .filter((url) => selectedRecipeCollectionLinks.has(url));
  const selectedRecipeCollectionCount = selectedRecipeCollectionUrlList.length;
  const getPreviewForLink = (url: string): LinkPreviewRecord => {
    const existing = linkPreviewByUrl[url];
    if (existing) return existing;
    return {
      title: guessRecipeTitleFromUrl(url),
      status: 'idle',
      recipes: [],
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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
      
      if (!result.success || !result.recipes || result.recipes.length === 0) {
        toast({
          title: "Failed to parse JSON",
          description: result.error || "No recipes were found in the JSON file",
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

    if (isDemoModeEnabled()) {
      toast({
        title: 'Demo mode limitation',
        description: 'PDF background import is only available for signed-in accounts.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      return;
    }
    
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

    setProcessingStatus(fileSizeMB > 20
      ? `Large file (${fileSizeMB.toFixed(0)}MB) - extracting text...`
      : 'Extracting text from PDF...',
    );

    try {
      const result = await enqueueCookbookImportFromPdf(file, {
        onProgress: (message) => setProcessingStatus(message),
      });

      if (result.success && result.job) {
        setUploadModalOpen(false);
        setUploadStep('upload');
        setExtractedRecipes([]);
        setSelectedRecipes(new Set());
        setUrlInput('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        toast({
          title: 'Import started',
          description: 'You can leave this page. We will keep processing in the background.',
        });
        void loadImportJobs();
        return;
      }

      // If background queue endpoint is unreachable, fall back to direct parsing.
      if (isEdgeTransportFailure(result.error)) {
        setProcessingStatus('Background upload unavailable. Processing PDF directly...');
        const fallback = await parseRecipesFromPdf(file, {
          onProgress: (message) => setProcessingStatus(message),
        });

        if (!fallback.success || !fallback.recipes || fallback.recipes.length === 0) {
          toast({
            title: 'Failed to process PDF',
            description:
              fallback.error ||
              result.error ||
              'No recipes were found in the PDF. If scanned, try clearer pages.',
            variant: 'destructive',
          });
          setIsProcessing(false);
          setProcessingStatus('');
          return;
        }

        setExtractedRecipes(fallback.recipes);
        setSelectedRecipes(new Set(fallback.recipes.map((_, i) => i)));
        setUploadStep('review');
        toast({
          title: 'PDF processed (direct mode)',
          description: `Found ${fallback.recipes.length} recipes. You can still import now.`,
        });
        return;
      }

      if (!result.success || !result.job) {
        toast({
          title: 'Failed to queue PDF import',
          description: result.error || 'Could not start import for this PDF.',
          variant: "destructive",
        });
        setIsProcessing(false);
        setProcessingStatus('');
        return;
      }

    } catch (error) {
      console.error('Error processing PDF:', error);
      toast({
        title: "Error",
        description: "Failed to queue the PDF import",
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

      if (!result.success || !result.recipes || result.recipes.length === 0) {
        toast({
          title: 'Failed to process photo',
          description: result.error || 'No recipe could be extracted from the image',
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

  const processUrl = async () => {
    const input = urlInput.trim();
    if (!input) {
      toast({
        title: 'Add a link first',
        description: 'Paste a website or public social post link.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Reading recipe link...');

    try {
      const result = await parseRecipesFromUrl(input);

      if (!result.success || !result.recipes || result.recipes.length === 0) {
        toast({
          title: 'Failed to process link',
          description: result.error || 'No recipes were found at that link',
          variant: 'destructive',
        });
        return;
      }

      setExtractedRecipes(result.recipes);
      setSelectedRecipes(new Set(result.recipes.map((_, i) => i)));
      setUploadStep('review');

      toast({
        title: 'Link processed',
        description: `Found ${result.recipes.length} recipe${result.recipes.length !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      console.error('Error processing recipe link:', error);
      toast({
        title: 'Error',
        description: 'Failed to process recipe link',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const resolveLinkPreviews = async (urls: string[]) => {
    const uniqueUrls = Array.from(new Set(urls.map((value) => value.trim()).filter(Boolean)));
    if (!uniqueUrls.length) {
      toast({
        title: 'No links selected',
        description: 'Select at least one link first.',
        variant: 'destructive',
      });
      return;
    }

    setIsResolvingLinkTitles(true);
    setCurrentImportUrl(uniqueUrls[0] || '');
    setProcessingStatus(`Loading recipe title 1/${uniqueUrls.length}...`);

    let successCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < uniqueUrls.length; i += 1) {
        const url = uniqueUrls[i];
        setCurrentImportUrl(url);
        setProcessingStatus(`Loading recipe title ${i + 1}/${uniqueUrls.length}...`);

        setLinkPreviewByUrl((prev) => ({
          ...prev,
          [url]: {
            title: prev[url]?.title || guessRecipeTitleFromUrl(url),
            status: 'loading',
            recipes: prev[url]?.recipes || [],
          },
        }));

        const result = await parseRecipesFromUrl(url);
        if (result.success && result.recipes?.length) {
          const deduped = dedupeExtractedRecipes(result.recipes);
          if (deduped.length > 0) {
            const title = deduped[0]?.name?.trim() || guessRecipeTitleFromUrl(url);
            setLinkPreviewByUrl((prev) => ({
              ...prev,
              [url]: {
                title,
                status: 'ready',
                recipes: deduped,
              },
            }));
            successCount += 1;
            continue;
          }
        }

        setLinkPreviewByUrl((prev) => ({
          ...prev,
          [url]: {
            title: prev[url]?.title || guessRecipeTitleFromUrl(url),
            status: 'failed',
            recipes: [],
          },
        }));
        failedCount += 1;
      }

      toast({
        title: 'Link titles loaded',
        description:
          failedCount > 0
            ? `${successCount} link${successCount === 1 ? '' : 's'} ready, ${failedCount} failed.`
            : `${successCount} link${successCount === 1 ? '' : 's'} ready to import.`,
      });
    } catch (error) {
      console.error('Error loading link previews:', error);
      toast({
        title: 'Could not load link titles',
        description: 'Try again or import directly.',
        variant: 'destructive',
      });
    } finally {
      setIsResolvingLinkTitles(false);
      setProcessingStatus('');
      setCurrentImportUrl('');
    }
  };

  const processUrlList = async (urls: string[]) => {
    if (!urls.length) {
      toast({
        title: 'Add links first',
        description: 'Paste one recipe URL per line.',
        variant: 'destructive',
      });
      return;
    }

    if (urls.length > MAX_BULK_URLS) {
      toast({
        title: 'Too many links',
        description: `Please import up to ${MAX_BULK_URLS} links at a time.`,
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    setBulkFailedUrls([]);
    setProcessingStatus(`Reading link 1/${urls.length}...`);
    setCurrentImportUrl(urls[0] || '');

    const extracted: ExtractedRecipe[] = [];
    const failed: string[] = [];

    try {
      for (let i = 0; i < urls.length; i += 1) {
        const url = urls[i];
        setCurrentImportUrl(url);
        setProcessingStatus(`Reading link ${i + 1}/${urls.length}...`);
        const cachedPreview = linkPreviewByUrl[url];
        if (cachedPreview?.status === 'ready' && cachedPreview.recipes?.length) {
          extracted.push(...cachedPreview.recipes);
          continue;
        }

        const result = await parseRecipesFromUrl(url);
        if (result.success && result.recipes?.length) {
          const dedupedFromUrl = dedupeExtractedRecipes(result.recipes);
          if (dedupedFromUrl.length > 0) {
            extracted.push(...dedupedFromUrl);
            setLinkPreviewByUrl((prev) => ({
              ...prev,
              [url]: {
                title: dedupedFromUrl[0]?.name?.trim() || prev[url]?.title || guessRecipeTitleFromUrl(url),
                status: 'ready',
                recipes: dedupedFromUrl,
              },
            }));
            continue;
          }
        }

        failed.push(url);
        setLinkPreviewByUrl((prev) => ({
          ...prev,
          [url]: {
            title: prev[url]?.title || guessRecipeTitleFromUrl(url),
            status: 'failed',
            recipes: [],
          },
        }));
      }

      const deduped = dedupeExtractedRecipes(extracted);
      if (!deduped.length) {
        setBulkFailedUrls(failed);
        toast({
          title: 'No recipes found',
          description: 'We could not extract recipes from those links. Try direct recipe page URLs.',
          variant: 'destructive',
        });
        return;
      }

      setExtractedRecipes(deduped);
      setSelectedRecipes(new Set(deduped.map((_, i) => i)));
      setBulkFailedUrls(failed);
      setUploadStep('review');

      toast({
        title: 'Bulk link import ready',
        description: `${deduped.length} recipes found from ${urls.length - failed.length}/${urls.length} links.`,
      });
    } catch (error) {
      console.error('Error processing bulk links:', error);
      toast({
        title: 'Bulk link import failed',
        description: 'Something went wrong while importing those links.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
      setCurrentImportUrl('');
    }
  };

  const processBulkUrls = async () => {
    const urls = parseBulkUrlInput(bulkUrlsInput);
    await processUrlList(urls);
  };

  const loadPinterestBoardPins = async () => {
    const input = pinterestBoardUrl.trim();
    if (!input) {
      toast({
        title: 'Add board URL first',
        description: 'Paste a Pinterest board URL.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingPinterestBoard(true);
    setPinterestPinLinks([]);
    setSelectedPinterestPins(new Set());
    setPinterestBoardTitle('');

    try {
      const result = await extractPinterestBoardLinks(input, MAX_BULK_URLS);
      if (!result.success || !result.links?.length) {
        toast({
          title: 'Could not load board pins',
          description: result.error || 'No pins found for that board.',
          variant: 'destructive',
        });
        return;
      }

      const nextLinks = result.links.slice(0, MAX_BULK_URLS);
      setPinterestPinLinks(nextLinks);
      setSelectedPinterestPins(new Set(nextLinks));
      setPinterestBoardTitle(result.boardTitle || '');
      setBulkUrlsInput(nextLinks.join('\n'));
      setLinkPreviewByUrl((prev) => {
        const next = { ...prev };
        for (const link of nextLinks) {
          if (!next[link]) {
            next[link] = {
              title: guessRecipeTitleFromUrl(link),
              status: 'idle',
              recipes: [],
            };
          }
        }
        return next;
      });

      toast({
        title: 'Board loaded',
        description: `Found ${nextLinks.length} pin link${nextLinks.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      console.error('Failed to load Pinterest board pins:', error);
      toast({
        title: 'Could not load board pins',
        description: 'Try another board URL or paste links manually.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingPinterestBoard(false);
    }
  };

  const togglePinterestPinSelection = (link: string) => {
    setSelectedPinterestPins((prev) => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link);
      else next.add(link);
      return next;
    });
  };

  const selectAllPinterestPins = () => setSelectedPinterestPins(new Set(pinterestPinLinks));
  const clearPinterestPinSelection = () => setSelectedPinterestPins(new Set());

  const processSelectedPinterestPins = async () => {
    const selected = pinterestPinLinks.filter((link) => selectedPinterestPins.has(link));
    await processUrlList(selected);
  };

  const loadRecipeCollectionLinks = async () => {
    const input = recipeCollectionUrl.trim();
    if (!input) {
      toast({
        title: 'Add page URL first',
        description: 'Paste a recipe category or recipe list page URL.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoadingRecipeCollection(true);
    setRecipeCollectionLinks([]);
    setSelectedRecipeCollectionLinks(new Set());
    setRecipeCollectionTitle('');

    try {
      const result = await extractRecipePageLinks(input, MAX_BULK_URLS);
      if (!result.success || !result.links?.length) {
        toast({
          title: 'Could not load recipes from that page',
          description: result.error || 'No recipe links found for that page.',
          variant: 'destructive',
        });
        return;
      }

      const nextLinks = result.links.slice(0, MAX_BULK_URLS);
      setRecipeCollectionLinks(nextLinks);
      setSelectedRecipeCollectionLinks(new Set(nextLinks.map((item) => item.url)));
      setRecipeCollectionTitle(result.pageTitle || '');
      setBulkUrlsInput(nextLinks.map((item) => item.url).join('\n'));
      setLinkPreviewByUrl((prev) => {
        const next = { ...prev };
        for (const item of nextLinks) {
          if (!next[item.url]) {
            next[item.url] = {
              title: item.title || guessRecipeTitleFromUrl(item.url),
              status: 'idle',
              recipes: [],
            };
          } else if (!next[item.url].title || next[item.url].title === 'Recipe Link') {
            next[item.url] = {
              ...next[item.url],
              title: item.title || next[item.url].title,
            };
          }
        }
        return next;
      });

      toast({
        title: 'Recipe links loaded',
        description: `Found ${nextLinks.length} recipe link${nextLinks.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      console.error('Failed to load recipe collection links:', error);
      toast({
        title: 'Could not load recipe links',
        description: 'Try another page URL or paste links manually.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRecipeCollection(false);
    }
  };

  const toggleRecipeCollectionSelection = (url: string) => {
    setSelectedRecipeCollectionLinks((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAllRecipeCollectionLinks = () =>
    setSelectedRecipeCollectionLinks(new Set(recipeCollectionLinks.map((item) => item.url)));
  const clearRecipeCollectionSelection = () => setSelectedRecipeCollectionLinks(new Set());

  const processSelectedRecipeCollectionLinks = async () => {
    await processUrlList(selectedRecipeCollectionUrlList);
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
      const displayRecipes = savedRecipes.map((recipe) =>
        dbRecipeToDisplayRecipe(recipe, favoriteIds, kidFriendlyOverrides),
      );
      
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
      const message = error instanceof Error ? error.message : 'Failed to save recipes. Please try again.';
      toast({
        title: "Error",
        description: message,
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
    setUrlInput('');
    setBulkUrlsInput('');
    setBulkFailedUrls([]);
    setPinterestBoardUrl('');
    setPinterestBoardTitle('');
    setPinterestPinLinks([]);
    setSelectedPinterestPins(new Set());
    setRecipeCollectionUrl('');
    setRecipeCollectionTitle('');
    setRecipeCollectionLinks([]);
    setSelectedRecipeCollectionLinks(new Set());
    setIsResolvingLinkTitles(false);
    setLinkPreviewByUrl({});
    setCurrentImportUrl('');
    setProcessingStatus('');
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => void runRecipeCleanup()}
              disabled={isCleaningRecipes}
            >
              <WandSparkles className="w-4 h-4 mr-2" />
              {isCleaningRecipes ? 'Cleaning...' : 'Clean Up Recipes'}
            </Button>
            <Button onClick={() => setUploadModalOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Recipes
            </Button>
          </div>
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

      <Accordion type="single" collapsible className="mb-6 rounded-xl border border-border bg-card px-4">
        <AccordionItem value="recipe-ideas" className="border-none">
          <AccordionTrigger className="py-4 text-left hover:no-underline">
            <span className="text-sm font-semibold">Need recipe ideas fast?</span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Open a board that matches your style, pick pins you like, then paste those links in bulk import.
              </p>
              <Button size="sm" variant="outline" onClick={() => setUploadModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Import Links
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {RECIPE_STYLE_FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  size="sm"
                  variant={recipeStyleFilter === filter.id ? 'default' : 'outline'}
                  onClick={() => setRecipeStyleFilter(filter.id)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {filteredBoardRecommendations.map((board) => (
                <div key={board.href} className="rounded-lg border border-border/80 bg-background p-3">
                  <p className="font-medium">{board.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{board.description}</p>
                  <a
                    href={board.href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center text-sm font-medium text-primary hover:underline"
                  >
                    Open Pinterest board
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {activeImportJobs.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Background recipe imports</p>
            <Button variant="outline" size="sm" onClick={() => void loadImportJobs()}>
              Refresh
            </Button>
          </div>

          <div className="space-y-2">
            {activeImportJobs.map((job) => {
              const total = Math.max(job.progress_total, 1);
              const pct = Math.min(100, Math.round((job.progress_current / total) * 100));
              const isCanceling = cancelingJobId === job.id;
              return (
                <div key={job.id} className="rounded-lg border border-border/80 p-3">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium truncate pr-2">{job.file_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{job.status === 'queued' ? 'Queued' : `${pct}%`}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void cancelImport(job)}
                        disabled={isCanceling}
                      >
                        {isCanceling ? 'Canceling...' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                  {job.error_message && (
                    <p className="mb-2 text-xs text-muted-foreground">{job.error_message}</p>
                  )}
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {uploadStep === 'upload' ? 'Upload Recipes' : 'Review Extracted Recipes'}
            </DialogTitle>
            <DialogDescription>
              {uploadStep === 'upload' 
                ? 'Upload JSON/PDF/photo, import one URL, or bulk import many links. PDF imports run in the background.'
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

              <div className="rounded-lg border border-border/70 bg-card p-4">
                <p className="font-medium mb-2">Or paste a recipe link</p>
                <div className="flex gap-2">
                  <Input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/recipe or public social post URL"
                    disabled={isProcessing || isResolvingLinkTitles}
                  />
                  <Button
                    onClick={() => void processUrl()}
                    disabled={isProcessing || isResolvingLinkTitles || !urlInput.trim()}
                    variant="outline"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    Import Link
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Best with recipe websites and public posts. Private or blocked social posts may need a screenshot upload instead.
                </p>
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-4">
                <p className="font-medium mb-2">Bulk import links (great for Pinterest)</p>
                <Textarea
                  value={bulkUrlsInput}
                  onChange={(e) => setBulkUrlsInput(e.target.value)}
                  placeholder={'Paste one link per line:\nhttps://www.pinterest.com/pin/...\nhttps://example.com/recipe'}
                  disabled={isProcessing || isResolvingLinkTitles}
                  rows={5}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {bulkUrlCount} link{bulkUrlCount === 1 ? '' : 's'} detected (max {MAX_BULK_URLS} per run)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void resolveLinkPreviews(bulkParsedUrls)}
                      disabled={isProcessing || isResolvingLinkTitles || bulkUrlCount === 0}
                      variant="outline"
                    >
                      {isResolvingLinkTitles ? 'Loading Titles...' : 'Preview Titles'}
                    </Button>
                    <Button
                      onClick={() => void processBulkUrls()}
                      disabled={isProcessing || isResolvingLinkTitles || bulkUrlCount === 0}
                      variant="outline"
                    >
                      <Link2 className="mr-2 h-4 w-4" />
                      Process Bulk Links
                    </Button>
                  </div>
                </div>
                {bulkUrlCount > 0 && (
                  <div className="mt-3 rounded-md border border-border/70 bg-background p-2">
                    <p className="text-xs font-medium text-foreground">
                      Links queued for "Process Bulk Links" ({bulkUrlCount})
                    </p>
                    <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded border border-border/60 p-2">
                      {bulkParsedUrls.map((link) => {
                        const preview = getPreviewForLink(link);
                        return (
                          <div key={link} className="rounded border border-border/40 bg-card px-2 py-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-medium text-foreground">{preview.title}</p>
                              <span className="text-[10px] text-muted-foreground">
                                {preview.status === 'ready'
                                  ? 'Ready'
                                  : preview.status === 'loading'
                                    ? 'Loading...'
                                    : preview.status === 'failed'
                                      ? 'Failed'
                                      : 'Pending'}
                              </span>
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">{link}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-4">
                <p className="font-medium mb-2">Load a Pinterest board, then choose pins</p>
                <div className="flex gap-2">
                  <Input
                    value={pinterestBoardUrl}
                    onChange={(e) => setPinterestBoardUrl(e.target.value)}
                    placeholder="https://www.pinterest.com/<user>/<board>/"
                    disabled={isProcessing || isResolvingLinkTitles || isLoadingPinterestBoard}
                  />
                  <Button
                    onClick={() => void loadPinterestBoardPins()}
                    disabled={isProcessing || isResolvingLinkTitles || isLoadingPinterestBoard || !pinterestBoardUrl.trim()}
                    variant="outline"
                  >
                    {isLoadingPinterestBoard ? 'Loading...' : 'Load Board'}
                  </Button>
                </div>

                {pinterestPinLinks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {pinterestBoardTitle ? `${pinterestBoardTitle} · ` : ''}
                        {pinterestPinLinks.length} pin link{pinterestPinLinks.length === 1 ? '' : 's'} found
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void resolveLinkPreviews(selectedPinterestLinks)}
                          disabled={isProcessing || isResolvingLinkTitles || selectedPinterestPinCount === 0}
                        >
                          {isResolvingLinkTitles ? 'Loading Titles...' : 'Preview selected titles'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={selectAllPinterestPins}>
                          Select all
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearPinterestPinSelection}>
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
                      {pinterestPinLinks.map((link) => (
                        <label
                          key={link}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={selectedPinterestPins.has(link)}
                            onCheckedChange={() => togglePinterestPinSelection(link)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">
                              {getPreviewForLink(link).title}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">{link}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {getPreviewForLink(link).status === 'ready'
                              ? 'Ready'
                              : getPreviewForLink(link).status === 'loading'
                                ? 'Loading...'
                                : getPreviewForLink(link).status === 'failed'
                                  ? 'Failed'
                                  : 'Pending'}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        {selectedPinterestPinCount} selected
                      </p>
                      <Button
                        onClick={() => void processSelectedPinterestPins()}
                        disabled={isProcessing || isResolvingLinkTitles || selectedPinterestPinCount === 0}
                        variant="outline"
                        size="sm"
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        Process Selected Pins
                      </Button>
                    </div>
                    {selectedPinterestPinCount > 0 && (
                      <div className="rounded-md border border-border/70 bg-background p-2">
                        <p className="text-xs font-medium text-foreground">
                          Links queued for "Process Selected Pins" ({selectedPinterestPinCount})
                        </p>
                        <div className="mt-2 max-h-32 space-y-1 overflow-y-auto rounded border border-border/60 p-2">
                          {selectedPinterestLinks.map((link) => (
                            <div key={link} className="rounded border border-border/40 bg-card px-2 py-1">
                              <p className="truncate text-xs font-medium text-foreground">
                                {getPreviewForLink(link).title}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">{link}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/70 bg-card p-4">
                <p className="font-medium mb-2">Load all recipes from one category/list page</p>
                <div className="flex gap-2">
                  <Input
                    value={recipeCollectionUrl}
                    onChange={(e) => setRecipeCollectionUrl(e.target.value)}
                    placeholder="https://masonfit.com/category/recipes/"
                    disabled={isProcessing || isResolvingLinkTitles || isLoadingRecipeCollection}
                  />
                  <Button
                    onClick={() => void loadRecipeCollectionLinks()}
                    disabled={
                      isProcessing ||
                      isResolvingLinkTitles ||
                      isLoadingRecipeCollection ||
                      !recipeCollectionUrl.trim()
                    }
                    variant="outline"
                  >
                    {isLoadingRecipeCollection ? 'Loading...' : 'Load Recipe Page'}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Great for recipe blogs and category pages. We will pull likely recipe post links so you can pick exactly what to import.
                </p>

                {recipeCollectionLinks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {recipeCollectionTitle ? `${recipeCollectionTitle} · ` : ''}
                        {recipeCollectionLinks.length} recipe link{recipeCollectionLinks.length === 1 ? '' : 's'} found
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllRecipeCollectionLinks}>
                          Select all
                        </Button>
                        <Button variant="outline" size="sm" onClick={clearRecipeCollectionSelection}>
                          Clear
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void resolveLinkPreviews(selectedRecipeCollectionUrlList)}
                          disabled={isProcessing || isResolvingLinkTitles || selectedRecipeCollectionCount === 0}
                        >
                          {isResolvingLinkTitles ? 'Loading Titles...' : 'Preview selected titles'}
                        </Button>
                      </div>
                    </div>

                    <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border/70 p-2">
                      {recipeCollectionLinks.map((item) => (
                        <label
                          key={item.url}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/40"
                        >
                          <Checkbox
                            checked={selectedRecipeCollectionLinks.has(item.url)}
                            onCheckedChange={() => toggleRecipeCollectionSelection(item.url)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground">
                              {getPreviewForLink(item.url).title || item.title}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">{item.url}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">{selectedRecipeCollectionCount} selected</p>
                      <Button
                        onClick={() => void processSelectedRecipeCollectionLinks()}
                        disabled={isProcessing || isResolvingLinkTitles || selectedRecipeCollectionCount === 0}
                        variant="outline"
                        size="sm"
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        Process Selected Recipe Links
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {(isProcessing || isResolvingLinkTitles) && currentImportUrl ? (
                <p className="rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {isResolvingLinkTitles ? 'Checking link now:' : 'Importing now:'}{' '}
                  <span className="font-medium text-foreground">{currentImportUrl}</span>
                </p>
              ) : null}
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

              {bulkFailedUrls.length > 0 && (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 text-xs text-amber-900">
                  Could not parse {bulkFailedUrls.length} link{bulkFailedUrls.length === 1 ? '' : 's'} in this run.
                  Try opening those links and copying the direct recipe page URL instead.
                </div>
              )}

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
        onEdit={(recipe) => {
          setViewingRecipe(null);
          setEditingRecipe(recipe);
        }}
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
