import { supabase } from '@/integrations/supabase/client';
import { extractPdfText } from '@/lib/pdfParser';
import { isDemoModeEnabled } from '@/lib/demoMode';
import { getDemoRecipes, setDemoRecipes } from '@/lib/demoStore';
import { normalizeRecipeIngredients, normalizeRecipeInstructions, normalizeRecipeName } from '@/lib/recipeText';
import {
  buildPersonalizedStarterRecipes,
  buildStarterDinnerRecipes,
  type StarterRecipeProfile,
} from '@/data/starterDinnerRecipes';

export interface ExtractedRecipe {
  name: string;
  servings: number;
  macrosPerServing: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g?: number;
  };
  ingredients: string[];
  ingredientsRaw: string;
  instructions: string;
}

interface ParseCookbookResponse {
  success: boolean;
  error?: string;
  recipes?: ExtractedRecipe[];
}

interface ParsePdfOptions {
  onProgress?: (message: string) => void;
}

interface ExtractPinterestBoardLinksResponse {
  success: boolean;
  error?: string;
  boardUrl?: string;
  boardTitle?: string;
  links?: string[];
}

export interface PinterestBoardLinksResult {
  success: boolean;
  error?: string;
  boardUrl?: string;
  boardTitle?: string;
  links?: string[];
}

interface ExtractRecipePageLinksResponse {
  success: boolean;
  error?: string;
  pageUrl?: string;
  pageTitle?: string;
  links?: Array<{ url: string; title?: string }>;
}

export interface RecipePageLink {
  url: string;
  title: string;
}

export interface RecipePageLinksResult {
  success: boolean;
  error?: string;
  pageUrl?: string;
  pageTitle?: string;
  links?: RecipePageLink[];
}

export interface CookbookImportJob {
  id: string;
  user_id: string;
  file_name: string;
  page_count: number | null;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'canceled';
  progress_current: number;
  progress_total: number;
  recipes_found: number;
  recipes_saved: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CookbookImportFunctionResponse {
  success: boolean;
  error?: string;
  job?: CookbookImportJob | null;
  jobs?: CookbookImportJob[];
}

// Conservative defaults for stability across model limits and noisy PDFs.
const MAX_CHUNK_CHARS = 25000;
const MIN_RETRY_CHUNK_CHARS = 6000;
const MAX_CHUNK_RETRY_DEPTH = 3;

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableChunkError(message: string): boolean {
  const value = message.toLowerCase();
  return (
    value.includes('context_length_exceeded') ||
    value.includes('maximum context length') ||
    value.includes('timed out') ||
    value.includes('timeout') ||
    value.includes('rate limit') ||
    value.includes('429') ||
    value.includes('5xx') ||
    value.includes('server error')
  );
}

function isRateLimitError(message: string): boolean {
  const value = message.toLowerCase();
  return value.includes('rate limit') || value.includes('429');
}

async function invokeParseCookbook(body: Record<string, unknown>, timeoutMessage: string) {
  return withTimeout(
    supabase.functions.invoke('parse-cookbook', { body }),
    120000,
    timeoutMessage,
  );
}

async function invokeCookbookImport(body: Record<string, unknown>) {
  return withTimeout(
    supabase.functions.invoke('cookbook-import', { body }),
    120000,
    'Cookbook import request timed out.',
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export async function enqueueCookbookImportFromPdf(
  file: File,
  options: ParsePdfOptions = {},
): Promise<{ success: boolean; error?: string; job?: CookbookImportJob }> {
  try {
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`Queueing PDF import: ${file.name}, size: ${fileSizeMB.toFixed(1)}MB`);
    options.onProgress?.('Extracting text from PDF...');

    const { text: pdfText, pageCount } = await extractPdfText(file);
    if (!pdfText || !pdfText.trim()) {
      return { success: false, error: 'Could not extract readable text from this PDF.' };
    }

    options.onProgress?.('Queueing background import...');
    const { data, error } = await invokeCookbookImport({
      action: 'enqueue',
      pdfText,
      pageCount,
      fileName: file.name,
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to queue import.' };
    }

    const response = data as CookbookImportFunctionResponse;
    if (!response.success || !response.job) {
      return { success: false, error: response.error || 'Failed to queue import.' };
    }

    return { success: true, job: response.job };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error while queueing import.',
    };
  }
}

export async function fetchCookbookImportJobs(limit = 15): Promise<CookbookImportJob[]> {
  if (isDemoModeEnabled()) return [];

  const { data, error } = await invokeCookbookImport({ action: 'list', limit });
  if (error) {
    throw new Error(error.message || 'Failed to load import jobs.');
  }

  const response = data as CookbookImportFunctionResponse;
  if (!response.success) {
    throw new Error(response.error || 'Failed to load import jobs.');
  }

  return response.jobs || [];
}

export async function cancelCookbookImportJob(jobId: string): Promise<CookbookImportJob> {
  if (!jobId) throw new Error('jobId is required');

  const { data, error } = await invokeCookbookImport({ action: 'cancel', jobId });
  if (error) {
    throw new Error(error.message || 'Failed to cancel import.');
  }

  const response = data as CookbookImportFunctionResponse;
  if (!response.success || !response.job) {
    throw new Error(response.error || 'Failed to cancel import.');
  }

  return response.job;
}

export async function parseRecipesFromPdf(file: File, options: ParsePdfOptions = {}): Promise<ParseCookbookResponse> {
  try {
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`Processing PDF: ${file.name}, size: ${fileSizeMB.toFixed(1)}MB`);
    options.onProgress?.('Extracting text from PDF...');

    const { text: pdfText, pageCount } = await extractPdfText(file);

    if (!pdfText || !pdfText.trim()) {
      return { 
        success: false, 
        error: 'Could not extract readable text from this PDF.' 
      };
    }

    console.log('Extracted PDF text, chars:', pdfText.length, 'pages:', pageCount);
    options.onProgress?.(`Extracted ${pageCount} pages. Preparing chunks...`);

    if (pdfText.length > MAX_CHUNK_CHARS) {
      return await processLargePdf(pdfText, pageCount, file.name, options);
    }

    options.onProgress?.('Analyzing chunk 1/1...');
    const { data, error } = await withTimeout(
      supabase.functions.invoke('parse-cookbook', {
        body: { 
          pdfText,
          pageCount,
          fileName: file.name,
        },
      }),
      120000,
      'PDF processing timed out while analyzing chunk 1/1.',
    );

    if (error) {
      console.error('Edge function error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to process cookbook' 
      };
    }

    return data as ParseCookbookResponse;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
}

export async function parseRecipesFromImage(file: File): Promise<ParseCookbookResponse> {
  try {
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Please upload an image file.' };
    }

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 12) {
      return { success: false, error: 'Image is too large. Use an image under 12MB.' };
    }

    const imageDataUrl = await fileToDataUrl(file);
    const { data, error } = await supabase.functions.invoke('parse-recipe-photo', {
      body: {
        fileName: file.name,
        imageDataUrl,
      },
    });

    if (error) {
      console.error('Edge function error (parse-recipe-photo):', error);
      return {
        success: false,
        error: error.message || 'Failed to process recipe image',
      };
    }

    return data as ParseCookbookResponse;
  } catch (error) {
    console.error('Error parsing recipe photo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function parseRecipesFromUrl(url: string): Promise<ParseCookbookResponse> {
  try {
    const trimmed = url.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter a link.' };
    }

    let normalizedUrl = trimmed;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsed = new URL(normalizedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, error: 'Only http/https links are supported.' };
    }

    const { data, error } = await supabase.functions.invoke('parse-recipe-url', {
      body: {
        url: parsed.toString(),
      },
    });

    if (error) {
      console.error('Edge function error (parse-recipe-url):', error);
      return {
        success: false,
        error: error.message || 'Failed to process recipe link',
      };
    }

    return data as ParseCookbookResponse;
  } catch (error) {
    console.error('Error parsing recipe URL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function extractPinterestBoardLinks(
  url: string,
  limit = 40,
): Promise<PinterestBoardLinksResult> {
  try {
    const trimmed = url.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter a Pinterest board URL.' };
    }

    let normalizedUrl = trimmed;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsed = new URL(normalizedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, error: 'Only http/https links are supported.' };
    }

    const { data, error } = await supabase.functions.invoke('extract-pinterest-board-links', {
      body: {
        url: parsed.toString(),
        limit,
      },
    });

    if (error) {
      console.error('Edge function error (extract-pinterest-board-links):', error);
      return {
        success: false,
        error: error.message || 'Failed to load Pinterest board links',
      };
    }

    const response = data as ExtractPinterestBoardLinksResponse;
    return {
      success: !!response.success,
      error: response.error,
      boardUrl: response.boardUrl,
      boardTitle: response.boardTitle,
      links: response.links || [],
    };
  } catch (error) {
    console.error('Error extracting Pinterest board links:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

export async function extractRecipePageLinks(
  url: string,
  limit = 40,
): Promise<RecipePageLinksResult> {
  try {
    const trimmed = url.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter a recipe page URL.' };
    }

    let normalizedUrl = trimmed;
    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const parsed = new URL(normalizedUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { success: false, error: 'Only http/https links are supported.' };
    }

    const { data, error } = await supabase.functions.invoke('extract-recipe-page-links', {
      body: {
        url: parsed.toString(),
        limit,
      },
    });

    if (error) {
      console.error('Edge function error (extract-recipe-page-links):', error);
      return {
        success: false,
        error: error.message || 'Failed to load recipe links',
      };
    }

    const response = data as ExtractRecipePageLinksResponse;
    return {
      success: !!response.success,
      error: response.error,
      pageUrl: response.pageUrl,
      pageTitle: response.pageTitle,
      links: (response.links || []).map((item) => ({
        url: String(item.url || '').trim(),
        title: String(item.title || '').trim() || 'Recipe Link',
      })),
    };
  } catch (error) {
    console.error('Error extracting recipe page links:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function processLargePdf(
  fullText: string, 
  pageCount: number, 
  fileName: string,
  options: ParsePdfOptions = {},
): Promise<ParseCookbookResponse> {
  const pagePattern = /----- PAGE (\d+) \/ \d+ -----/g;
  const pages: { pageNum: number; text: string }[] = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = pagePattern.exec(fullText)) !== null) {
    if (lastIndex > 0) {
      const prevPageEnd = match.index;
      const prevMatch = fullText.substring(0, lastIndex).match(/----- PAGE (\d+)/g);
      if (prevMatch) {
        const pageNumMatch = prevMatch[prevMatch.length - 1].match(/\d+/);
        const pageNum = pageNumMatch ? parseInt(pageNumMatch[0]) : pages.length + 1;
        pages.push({
          pageNum,
          text: fullText.substring(lastIndex, prevPageEnd).trim()
        });
      }
    }
    lastIndex = match.index;
  }
  
  if (lastIndex > 0) {
    const pageNumMatch = fullText.substring(lastIndex).match(/----- PAGE (\d+)/);
    const pageNum = pageNumMatch ? parseInt(pageNumMatch[1]) : pageCount;
    pages.push({
      pageNum,
      text: fullText.substring(lastIndex).trim()
    });
  }
  
  if (pages.length === 0) {
    const chunks = splitTextIntoChunks(fullText, MAX_CHUNK_CHARS);
    return await processChunks(chunks, pageCount, fileName);
  }

  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const page of pages) {
    if ((currentChunk + page.text).length > MAX_CHUNK_CHARS) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = page.text;
    } else {
      currentChunk += '\n\n' + page.text;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }

  console.log(`Split PDF into ${chunks.length} chunks for processing`);
  options.onProgress?.(`Split into ${chunks.length} chunks...`);
  
  return await processChunks(chunks, pageCount, fileName, options);
}

function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChars;
    
    if (end < text.length) {
      const lastDoubleNewline = text.lastIndexOf('\n\n', end);
      if (lastDoubleNewline > start + maxChars / 2) {
        end = lastDoubleNewline;
      }
    }
    
    chunks.push(text.substring(start, end));
    start = end;
  }
  
  return chunks;
}

async function processChunks(
  chunks: string[], 
  pageCount: number, 
  fileName: string,
  options: ParsePdfOptions = {},
): Promise<ParseCookbookResponse> {
  const allRecipes: ExtractedRecipe[] = [];
  const errors: string[] = [];

  const processChunkWithFallback = async (
    chunkText: string,
    chunkLabel: string,
    depth = 0,
  ): Promise<ExtractedRecipe[]> => {
    const timeoutMessage = `PDF processing timed out on ${chunkLabel}.`;
    try {
      const { data, error } = await invokeParseCookbook(
        {
          pdfText: chunkText,
          pageCount,
          fileName,
          chunkInfo: { current: 1, total: 1 },
        },
        timeoutMessage,
      );

      if (error) {
        throw new Error(error.message || `Failed processing ${chunkLabel}`);
      }

      const response = data as ParseCookbookResponse;
      if (response.success && response.recipes) {
        return response.recipes;
      }

      const responseError = response.error || `No recipes extracted from ${chunkLabel}`;
      if (
        depth < MAX_CHUNK_RETRY_DEPTH &&
        chunkText.length > MIN_RETRY_CHUNK_CHARS &&
        isRetryableChunkError(responseError)
      ) {
        if (isRateLimitError(responseError)) {
          const waitMs = 2500 * (depth + 1);
          options.onProgress?.(`Rate limited on ${chunkLabel}; retrying in ${Math.ceil(waitMs / 1000)}s...`);
          await sleep(waitMs);
        }
        const targetSize = Math.max(MIN_RETRY_CHUNK_CHARS, Math.floor(chunkText.length / 2));
        const subChunks = splitTextIntoChunks(chunkText, targetSize);
        options.onProgress?.(
          `Retrying ${chunkLabel} in ${subChunks.length} smaller part${subChunks.length === 1 ? '' : 's'}...`,
        );
        const recovered: ExtractedRecipe[] = [];
        for (let i = 0; i < subChunks.length; i += 1) {
          const nextLabel = `${chunkLabel}.${i + 1}`;
          const rows = await processChunkWithFallback(subChunks[i], nextLabel, depth + 1);
          recovered.push(...rows);
        }
        return recovered;
      }

      errors.push(`${chunkLabel}: ${responseError}`);
      return [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown chunk error';
      if (
        depth < MAX_CHUNK_RETRY_DEPTH &&
        chunkText.length > MIN_RETRY_CHUNK_CHARS &&
        isRetryableChunkError(message)
      ) {
        if (isRateLimitError(message)) {
          const waitMs = 2500 * (depth + 1);
          options.onProgress?.(`Rate limited on ${chunkLabel}; retrying in ${Math.ceil(waitMs / 1000)}s...`);
          await sleep(waitMs);
        }
        const targetSize = Math.max(MIN_RETRY_CHUNK_CHARS, Math.floor(chunkText.length / 2));
        const subChunks = splitTextIntoChunks(chunkText, targetSize);
        options.onProgress?.(
          `Retrying ${chunkLabel} in ${subChunks.length} smaller part${subChunks.length === 1 ? '' : 's'}...`,
        );
        const recovered: ExtractedRecipe[] = [];
        for (let i = 0; i < subChunks.length; i += 1) {
          const nextLabel = `${chunkLabel}.${i + 1}`;
          const rows = await processChunkWithFallback(subChunks[i], nextLabel, depth + 1);
          recovered.push(...rows);
        }
        return recovered;
      }
      errors.push(`${chunkLabel}: ${message}`);
      return [];
    }
  };
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}, chars: ${chunks[i].length}`);
    options.onProgress?.(`Analyzing chunk ${i + 1}/${chunks.length}...`);

    const chunkLabel = `chunk ${i + 1}/${chunks.length}`;
    const recoveredRecipes = await processChunkWithFallback(chunks[i], chunkLabel, 0);
    if (recoveredRecipes.length > 0) {
      allRecipes.push(...recoveredRecipes);
      console.log(`${chunkLabel} recovered ${recoveredRecipes.length} recipes`);
    }
  }

  const seen = new Set<string>();
  const uniqueRecipes = allRecipes.filter(recipe => {
    const key = recipe.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`Total unique recipes found: ${uniqueRecipes.length}`);

  if (uniqueRecipes.length === 0 && errors.length > 0) {
    return { 
      success: false, 
      error: errors.join('; ') 
    };
  }

  if (errors.length > 0) {
    console.warn('PDF processing completed with chunk errors:', errors);
  }

  return { 
    success: true, 
    recipes: uniqueRecipes 
  };
}

export interface DbRecipe {
  id: string;
  name: string;
  servings: number;
  ingredients: string[];
  ingredients_raw: string | null;
  instructions: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  meal_type: string;
  is_anchored: boolean;
  default_day: string | null;
  created_at: string;
  updated_at: string;
}

function toInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function toOptionalInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

function sanitizeMacroValue(value: unknown): number {
  return Math.max(0, toInt(value, 0));
}

function sanitizeServings(value: unknown): number {
  const rounded = toInt(value, 4);
  if (!Number.isFinite(rounded)) return 4;
  return Math.max(1, Math.min(24, rounded));
}

function sanitizeInstructionText(value: unknown): string | null {
  const normalized = normalizeRecipeInstructions(typeof value === 'string' ? value : String(value || ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || null;
}

function buildCleanRecipePayload(recipe: {
  name?: unknown;
  servings?: unknown;
  ingredients?: unknown;
  ingredientsRaw?: unknown;
  ingredients_raw?: unknown;
  instructions?: unknown;
  calories?: unknown;
  protein_g?: unknown;
  carbs_g?: unknown;
  fat_g?: unknown;
  fiber_g?: unknown;
}): {
  name: string;
  servings: number;
  ingredients: string[];
  ingredients_raw: string | null;
  instructions: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
} {
  const ingredients = normalizeRecipeIngredients(
    recipe.ingredients ||
      recipe.ingredientsRaw ||
      recipe.ingredients_raw ||
      [],
  );

  return {
    name: normalizeRecipeName(String(recipe.name || 'Untitled Recipe')),
    servings: sanitizeServings(recipe.servings),
    ingredients,
    ingredients_raw:
      ingredients.join('\n') ||
      (typeof recipe.ingredientsRaw === 'string'
        ? recipe.ingredientsRaw
        : typeof recipe.ingredients_raw === 'string'
        ? recipe.ingredients_raw
        : null),
    instructions: sanitizeInstructionText(recipe.instructions),
    calories: sanitizeMacroValue(recipe.calories),
    protein_g: sanitizeMacroValue(recipe.protein_g),
    carbs_g: sanitizeMacroValue(recipe.carbs_g),
    fat_g: sanitizeMacroValue(recipe.fat_g),
    fiber_g: toOptionalInt(recipe.fiber_g),
  };
}

export async function fetchRecipes(): Promise<DbRecipe[]> {
  if (isDemoModeEnabled()) {
    return [...getDemoRecipes()]
      .map((r) => ({ ...r, ingredients: normalizeRecipeIngredients(r.ingredients) }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recipes:', error);
    throw error;
  }

  return (data || []).map((r) => ({ ...r, ingredients: normalizeRecipeIngredients(r.ingredients) }));
}

export async function parseRecipesFromJson(file: File): Promise<{ success: boolean; error?: string; recipes?: ExtractedRecipe[] }> {
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    const root = (typeof json === 'object' && json !== null) ? (json as Record<string, unknown>) : null;
    const nestedRecipes = root?.recipes;
    const rawRecipes: unknown[] = Array.isArray(json)
      ? json
      : Array.isArray(nestedRecipes)
      ? nestedRecipes
      : [json];
    const toRecord = (value: unknown): Record<string, unknown> =>
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    const toNumber = (value: unknown, fallback = 0): number => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      }
      return fallback;
    };

    const recipes: ExtractedRecipe[] = rawRecipes.map((rawRecipe) => {
      const recipe = toRecord(rawRecipe);
      const macros = toRecord(recipe.macrosPerServing);
      const nutrition = toRecord(recipe.nutrition);
      const ingredientsRaw = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.filter((item): item is string => typeof item === 'string')
        : [];
      const ingredients = normalizeRecipeIngredients(ingredientsRaw);
      const steps = Array.isArray(recipe.steps)
        ? recipe.steps.filter((item): item is string => typeof item === 'string')
        : [];

      return {
      name: String(recipe.name || recipe.title || 'Untitled Recipe'),
      servings: toNumber(recipe.servings ?? recipe.serving_size, 4),
      macrosPerServing: {
        calories: toNumber(macros.calories ?? recipe.calories ?? nutrition.calories, 0),
        protein_g: toNumber(macros.protein_g ?? recipe.protein_g ?? nutrition.protein_g ?? nutrition.protein, 0),
        carbs_g: toNumber(macros.carbs_g ?? recipe.carbs_g ?? nutrition.carbs_g ?? nutrition.carbs, 0),
        fat_g: toNumber(macros.fat_g ?? recipe.fat_g ?? nutrition.fat_g ?? nutrition.fat, 0),
        fiber_g: toNumber(macros.fiber_g ?? recipe.fiber_g ?? nutrition.fiber_g, 0) || undefined,
      },
      ingredients,
      ingredientsRaw: String(recipe.ingredientsRaw || recipe.ingredients_raw || ingredients.join('\n')),
      instructions: String(recipe.instructions || recipe.directions || steps.join('\n')),
    };
    });

    return { success: true, recipes };
  } catch (error) {
    console.error('Error parsing JSON:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Invalid JSON file' 
    };
  }
}

export async function saveRecipes(recipes: ExtractedRecipe[]): Promise<DbRecipe[]> {
  if (recipes.length === 0) return [];

  if (isDemoModeEnabled()) {
    const rows = recipes.map((r) => {
      const cleaned = buildCleanRecipePayload({
        ...r,
        calories: r.macrosPerServing?.calories,
        protein_g: r.macrosPerServing?.protein_g,
        carbs_g: r.macrosPerServing?.carbs_g,
        fat_g: r.macrosPerServing?.fat_g,
        fiber_g: r.macrosPerServing?.fiber_g,
      });
      return {
        ...cleaned,
        meal_type: 'dinner',
        is_anchored: false,
      };
    });

    const existing = getDemoRecipes();
    const now = new Date().toISOString();
    const inserted: DbRecipe[] = rows.map((row) => ({
      id: `demo-r-${crypto.randomUUID()}`,
      name: row.name,
      servings: row.servings,
      ingredients: row.ingredients,
      ingredients_raw: row.ingredients_raw,
      instructions: row.instructions,
      calories: row.calories,
      protein_g: row.protein_g,
      carbs_g: row.carbs_g,
      fat_g: row.fat_g,
      fiber_g: row.fiber_g,
      meal_type: row.meal_type,
      is_anchored: row.is_anchored,
      default_day: null,
      created_at: now,
      updated_at: now,
    }));
    setDemoRecipes([...inserted, ...existing]);
    return inserted;
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const ownerId = authData.user?.id;
  if (!ownerId) {
    throw new Error('Please sign in again, then retry importing your recipes.');
  }

  const rows = recipes.map((r) => {
    const cleaned = buildCleanRecipePayload({
      ...r,
      calories: r.macrosPerServing?.calories,
      protein_g: r.macrosPerServing?.protein_g,
      carbs_g: r.macrosPerServing?.carbs_g,
      fat_g: r.macrosPerServing?.fat_g,
      fiber_g: r.macrosPerServing?.fiber_g,
    });
    return {
      owner_id: ownerId,
      ...cleaned,
      meal_type: 'dinner',
      is_anchored: false,
    };
  });

  const { data, error } = await supabase
    .from('recipes')
    .insert(rows)
    .select();

  if (error) {
    console.error('Error saving recipes:', error);
    throw error;
  }

  return data || [];
}

export async function seedStarterRecipesIfEmpty(
  dietaryPreferences: string[] | StarterRecipeProfile = [],
  targetCount = 18,
): Promise<{ inserted: number; skipped: boolean }> {
  const existing = await fetchRecipes();
  if (existing.length > 0) {
    return { inserted: 0, skipped: true };
  }

  const starterRecipes = Array.isArray(dietaryPreferences)
    ? buildStarterDinnerRecipes(dietaryPreferences, targetCount)
    : buildPersonalizedStarterRecipes(dietaryPreferences, targetCount);

  const starters = starterRecipes.map((recipe) => ({
    name: recipe.name,
    servings: recipe.servings,
    ingredients: recipe.ingredients,
    ingredientsRaw: recipe.ingredients.join('\n'),
    instructions: recipe.instructions,
    macrosPerServing: recipe.macrosPerServing,
  }));

  const inserted = await saveRecipes(starters);
  return { inserted: inserted.length, skipped: false };
}

export async function updateRecipe(id: string, updates: {
  name?: string;
  servings?: number;
  ingredients?: string[];
  ingredients_raw?: string | null;
  instructions?: string | null;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  meal_type?: string;
  is_anchored?: boolean;
  default_day?: string | null;
}): Promise<DbRecipe> {
  const cleanedUpdates = { ...updates };
  if (typeof updates.name === 'string') {
    cleanedUpdates.name = normalizeRecipeName(updates.name);
  }
  if (updates.servings !== undefined) {
    cleanedUpdates.servings = sanitizeServings(updates.servings);
  }
  if (updates.ingredients) {
    cleanedUpdates.ingredients = normalizeRecipeIngredients(updates.ingredients);
    cleanedUpdates.ingredients_raw = cleanedUpdates.ingredients.join('\n');
  }
  if (updates.instructions !== undefined) {
    cleanedUpdates.instructions = sanitizeInstructionText(updates.instructions);
  }
  if (updates.calories !== undefined) cleanedUpdates.calories = sanitizeMacroValue(updates.calories);
  if (updates.protein_g !== undefined) cleanedUpdates.protein_g = sanitizeMacroValue(updates.protein_g);
  if (updates.carbs_g !== undefined) cleanedUpdates.carbs_g = sanitizeMacroValue(updates.carbs_g);
  if (updates.fat_g !== undefined) cleanedUpdates.fat_g = sanitizeMacroValue(updates.fat_g);

  if (isDemoModeEnabled()) {
    const recipes = getDemoRecipes();
    const idx = recipes.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Recipe not found');
    const next: DbRecipe = {
      ...recipes[idx],
      ...cleanedUpdates,
      updated_at: new Date().toISOString(),
    };
    recipes[idx] = next;
    setDemoRecipes(recipes);
    return next;
  }

  const { data, error } = await supabase
    .from('recipes')
    .update(cleanedUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating recipe:', error);
    throw error;
  }

  return { ...data, ingredients: normalizeRecipeIngredients(data.ingredients) };
}

export async function cleanUpRecipeLibrary(): Promise<{ scanned: number; updated: number }> {
  const scannedRecipes = await fetchRecipes();
  let updated = 0;

  if (isDemoModeEnabled()) {
    const next = scannedRecipes.map((recipe) => {
      const cleaned = buildCleanRecipePayload({
        ...recipe,
        ingredientsRaw: recipe.ingredients_raw,
      });

      const changed =
        cleaned.name !== recipe.name ||
        cleaned.servings !== recipe.servings ||
        cleaned.instructions !== recipe.instructions ||
        cleaned.calories !== recipe.calories ||
        cleaned.protein_g !== recipe.protein_g ||
        cleaned.carbs_g !== recipe.carbs_g ||
        cleaned.fat_g !== recipe.fat_g ||
        cleaned.fiber_g !== recipe.fiber_g ||
        cleaned.ingredients_raw !== recipe.ingredients_raw ||
        cleaned.ingredients.join('\n').toLowerCase() !== (recipe.ingredients || []).join('\n').toLowerCase();

      if (changed) updated += 1;
      return changed
        ? {
            ...recipe,
            ...cleaned,
            updated_at: new Date().toISOString(),
          }
        : recipe;
    });

    setDemoRecipes(next);
    return { scanned: scannedRecipes.length, updated };
  }

  for (const recipe of scannedRecipes) {
    const cleaned = buildCleanRecipePayload({
      ...recipe,
      ingredientsRaw: recipe.ingredients_raw,
    });

    const changed =
      cleaned.name !== recipe.name ||
      cleaned.servings !== recipe.servings ||
      cleaned.instructions !== recipe.instructions ||
      cleaned.calories !== recipe.calories ||
      cleaned.protein_g !== recipe.protein_g ||
      cleaned.carbs_g !== recipe.carbs_g ||
      cleaned.fat_g !== recipe.fat_g ||
      cleaned.fiber_g !== recipe.fiber_g ||
      cleaned.ingredients_raw !== recipe.ingredients_raw ||
      cleaned.ingredients.join('\n').toLowerCase() !== (recipe.ingredients || []).join('\n').toLowerCase();

    if (!changed) continue;

    const { error } = await supabase
      .from('recipes')
      .update(cleaned)
      .eq('id', recipe.id);

    if (error) {
      console.error('Failed cleanup update for recipe:', recipe.id, error);
      throw error;
    }
    updated += 1;
  }

  return { scanned: scannedRecipes.length, updated };
}

export async function deleteRecipe(id: string): Promise<void> {
  if (isDemoModeEnabled()) {
    const recipes = getDemoRecipes().filter((r) => r.id !== id);
    setDemoRecipes(recipes);
    return;
  }

  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting recipe:', error);
    throw error;
  }
}
