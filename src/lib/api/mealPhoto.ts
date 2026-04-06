import { supabase } from '@/integrations/supabase/client';

export interface EstimatedMealFromPhoto {
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  assumptions?: string;
}

interface EstimateMealPhotoResponse {
  success: boolean;
  error?: string;
  meal?: EstimatedMealFromPhoto;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export async function estimateMealFromPhoto(
  file: File,
  note?: string,
): Promise<{ success: boolean; error?: string; meal?: EstimatedMealFromPhoto }> {
  try {
    if (!file.type.startsWith('image/')) {
      return { success: false, error: 'Please upload an image file.' };
    }

    if (file.size > 12 * 1024 * 1024) {
      return { success: false, error: 'Image is too large. Use an image under 12MB.' };
    }

    const imageDataUrl = await fileToDataUrl(file);
    const { data, error } = await supabase.functions.invoke('estimate-meal-photo', {
      body: {
        imageDataUrl,
        fileName: file.name,
        note: note?.trim() || '',
      },
    });

    if (error) {
      console.error('Edge function error (estimate-meal-photo):', error);
      return {
        success: false,
        error: error.message || 'Failed to estimate meal photo',
      };
    }

    const result = data as EstimateMealPhotoResponse;
    if (!result?.success || !result.meal) {
      return {
        success: false,
        error: result?.error || 'Could not estimate that meal from the photo.',
      };
    }

    return { success: true, meal: result.meal };
  } catch (error) {
    console.error('Error estimating meal from photo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to estimate meal photo.',
    };
  }
}

export async function estimateMealFromDescription(
  note: string,
): Promise<{ success: boolean; error?: string; meal?: EstimatedMealFromPhoto }> {
  try {
    const trimmedNote = note.trim();
    if (!trimmedNote) {
      return { success: false, error: 'Describe what you ate first.' };
    }

    const { data, error } = await supabase.functions.invoke('estimate-meal-photo', {
      body: {
        note: trimmedNote,
      },
    });

    if (error) {
      console.error('Edge function error (estimate-meal-photo):', error);
      return {
        success: false,
        error: error.message || 'Failed to estimate meal photo',
      };
    }

    const result = data as EstimateMealPhotoResponse;
    if (!result?.success || !result.meal) {
      return {
        success: false,
        error: result?.error || 'Could not estimate that meal from the description.',
      };
    }

    return { success: true, meal: result.meal };
  } catch (error) {
    console.error('Error estimating meal from description:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to estimate meal description.',
    };
  }
}
