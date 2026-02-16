import { supabase } from '@/integrations/supabase/client';
import { extractPdfText } from '@/lib/pdfParser';

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

// Maximum text characters to send in a single request
const MAX_CHUNK_CHARS = 400000;

export async function parseRecipesFromPdf(file: File): Promise<ParseCookbookResponse> {
  try {
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`Processing PDF: ${file.name}, size: ${fileSizeMB.toFixed(1)}MB`);

    const { text: pdfText, pageCount } = await extractPdfText(file);

    if (!pdfText || !pdfText.trim()) {
      return { 
        success: false, 
        error: 'Could not extract readable text from this PDF.' 
      };
    }

    console.log('Extracted PDF text, chars:', pdfText.length, 'pages:', pageCount);

    if (pdfText.length > MAX_CHUNK_CHARS) {
      return await processLargePdf(pdfText, pageCount, file.name);
    }

    const { data, error } = await supabase.functions.invoke('parse-cookbook', {
      body: { 
        pdfText,
        pageCount,
        fileName: file.name,
      },
    });

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

async function processLargePdf(
  fullText: string, 
  pageCount: number, 
  fileName: string
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
  
  return await processChunks(chunks, pageCount, fileName);
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
  fileName: string
): Promise<ParseCookbookResponse> {
  const allRecipes: ExtractedRecipe[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}/${chunks.length}, chars: ${chunks[i].length}`);
    
    try {
      const { data, error } = await supabase.functions.invoke('parse-cookbook', {
        body: { 
          pdfText: chunks[i],
          pageCount,
          fileName,
          chunkInfo: { current: i + 1, total: chunks.length }
        },
      });

      if (error) {
        console.error(`Chunk ${i + 1} error:`, error);
        errors.push(`Chunk ${i + 1}: ${error.message}`);
        continue;
      }

      const response = data as ParseCookbookResponse;
      if (response.success && response.recipes) {
        allRecipes.push(...response.recipes);
        console.log(`Chunk ${i + 1} found ${response.recipes.length} recipes`);
      } else if (response.error) {
        errors.push(`Chunk ${i + 1}: ${response.error}`);
      }
    } catch (err) {
      console.error(`Chunk ${i + 1} exception:`, err);
      errors.push(`Chunk ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
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

export async function fetchRecipes(): Promise<DbRecipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching recipes:', error);
    throw error;
  }

  return data || [];
}

export async function parseRecipesFromJson(file: File): Promise<{ success: boolean; error?: string; recipes?: ExtractedRecipe[] }> {
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    
    const rawRecipes: any[] = Array.isArray(json) ? json : [json];
    
    const recipes: ExtractedRecipe[] = rawRecipes.map((r: any) => ({
      name: r.name || r.title || 'Untitled Recipe',
      servings: r.servings || r.serving_size || 4,
      macrosPerServing: {
        calories: r.macrosPerServing?.calories || r.calories || r.nutrition?.calories || 0,
        protein_g: r.macrosPerServing?.protein_g || r.protein_g || r.nutrition?.protein_g || r.nutrition?.protein || 0,
        carbs_g: r.macrosPerServing?.carbs_g || r.carbs_g || r.nutrition?.carbs_g || r.nutrition?.carbs || 0,
        fat_g: r.macrosPerServing?.fat_g || r.fat_g || r.nutrition?.fat_g || r.nutrition?.fat || 0,
        fiber_g: r.macrosPerServing?.fiber_g || r.fiber_g || r.nutrition?.fiber_g || undefined,
      },
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      ingredientsRaw: r.ingredientsRaw || r.ingredients_raw || (Array.isArray(r.ingredients) ? r.ingredients.join('\n') : ''),
      instructions: r.instructions || r.directions || (Array.isArray(r.steps) ? r.steps.join('\n') : '') || '',
    }));

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
  const rows = recipes.map((r) => ({
    name: r.name || 'Untitled Recipe',
    servings: r.servings || 4,
    ingredients: r.ingredients || [],
    ingredients_raw: r.ingredientsRaw || null,
    instructions: r.instructions || null,
    calories: r.macrosPerServing?.calories || 0,
    protein_g: r.macrosPerServing?.protein_g || 0,
    carbs_g: r.macrosPerServing?.carbs_g || 0,
    fat_g: r.macrosPerServing?.fat_g || 0,
    fiber_g: r.macrosPerServing?.fiber_g || null,
    meal_type: 'dinner',
    is_anchored: false,
  }));

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
  const { data, error } = await supabase
    .from('recipes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating recipe:', error);
    throw error;
  }

  return data;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase
    .from('recipes')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting recipe:', error);
    throw error;
  }
}
