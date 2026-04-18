import { supabase } from '@/integrations/supabase/client';
import { imageFileToUploadDataUrl, isEdgeTransportFailureMessage } from '@/lib/imageUpload';

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

    const imageDataUrl = await imageFileToUploadDataUrl(file, {
      maxDimension: 1800,
      preferredQuality: 0.9,
      maxDataUrlLength: 3_500_000,
    });
    const { data, error } = await supabase.functions.invoke('estimate-meal-photo', {
      body: {
        imageDataUrl,
        fileName: file.name,
        note: note?.trim() || '',
      },
    });

    if (error) {
      console.error('Edge function error (estimate-meal-photo):', error);
      if (isEdgeTransportFailureMessage(error.message)) {
        return {
          success: false,
          error: 'I could not send that image cleanly. Home Harmony already compressed it, but a tighter crop usually works best.',
        };
      }
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
