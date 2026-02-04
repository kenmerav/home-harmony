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

export async function parseRecipesFromPdf(file: File): Promise<ParseCookbookResponse> {
  try {
    // Extract text from the PDF client-side for reliable parsing.
    const { text: pdfText, pageCount } = await extractPdfText(file);

    if (!pdfText || !pdfText.trim()) {
      return { 
        success: false, 
        error: 'Could not extract readable text from this PDF.' 
      };
    }

    console.log('Sending extracted PDF text to backend, chars:', pdfText.length, 'pages:', pageCount);

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
