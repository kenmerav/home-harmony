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

// Maximum payload size for edge functions (~5MB to be safe)
const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024;
// Maximum text characters to send in a single request
const MAX_CHUNK_CHARS = 400000;

export async function parseRecipesFromPdf(file: File): Promise<ParseCookbookResponse> {
  try {
    // Check file size - warn user if very large
    const fileSizeMB = file.size / (1024 * 1024);
    console.log(`Processing PDF: ${file.name}, size: ${fileSizeMB.toFixed(1)}MB`);

    // Extract text from the PDF client-side for reliable parsing.
    const { text: pdfText, pageCount } = await extractPdfText(file);

    if (!pdfText || !pdfText.trim()) {
      return { 
        success: false, 
        error: 'Could not extract readable text from this PDF.' 
      };
    }

    console.log('Extracted PDF text, chars:', pdfText.length, 'pages:', pageCount);

    // If text is too large, we need to process in chunks
    if (pdfText.length > MAX_CHUNK_CHARS) {
      return await processLargePdf(pdfText, pageCount, file.name);
    }

    // Send to edge function for AI processing
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

/**
 * Process a large PDF by splitting it into chunks and combining results.
 */
async function processLargePdf(
  fullText: string, 
  pageCount: number, 
  fileName: string
): Promise<ParseCookbookResponse> {
  // Split by page markers to keep recipes together
  const pagePattern = /----- PAGE (\d+) \/ \d+ -----/g;
  const pages: { pageNum: number; text: string }[] = [];
  
  let lastIndex = 0;
  let match;
  
  while ((match = pagePattern.exec(fullText)) !== null) {
    if (lastIndex > 0) {
      // Save previous page
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
  
  // Add the last page
  if (lastIndex > 0) {
    const pageNumMatch = fullText.substring(lastIndex).match(/----- PAGE (\d+)/);
    const pageNum = pageNumMatch ? parseInt(pageNumMatch[1]) : pageCount;
    pages.push({
      pageNum,
      text: fullText.substring(lastIndex).trim()
    });
  }
  
  // If we couldn't parse pages, fall back to simple chunking
  if (pages.length === 0) {
    const chunks = splitTextIntoChunks(fullText, MAX_CHUNK_CHARS);
    return await processChunks(chunks, pageCount, fileName);
  }

  // Group pages into chunks that fit within the limit
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

/**
 * Simple text splitting for fallback
 */
function splitTextIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChars;
    
    // Try to break at a paragraph boundary
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

/**
 * Process multiple chunks and combine results
 */
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

  // Deduplicate recipes by name
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
