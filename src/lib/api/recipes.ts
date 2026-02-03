import { supabase } from '@/integrations/supabase/client';
import { extractTextFromPdf } from '@/lib/pdfParser';

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
    // Extract text from PDF on the client side
    const pdfContent = await extractTextFromPdf(file);
    
    if (!pdfContent || pdfContent.trim().length < 50) {
      return { 
        success: false, 
        error: 'Could not extract text from PDF. The file may be image-based or corrupted.' 
      };
    }

    // Send to edge function for AI processing
    const { data, error } = await supabase.functions.invoke('parse-cookbook', {
      body: { pdfContent },
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
