import { supabase } from '@/integrations/supabase/client';
import { fileToBase64 } from '@/lib/pdfParser';

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
    // Convert PDF to base64 for sending to edge function
    const pdfBase64 = await fileToBase64(file);
    
    if (!pdfBase64) {
      return { 
        success: false, 
        error: 'Could not read PDF file.' 
      };
    }

    console.log('Sending PDF to edge function, size:', pdfBase64.length);

    // Send to edge function for AI processing
    const { data, error } = await supabase.functions.invoke('parse-cookbook', {
      body: { 
        pdfBase64,
        fileName: file.name 
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
