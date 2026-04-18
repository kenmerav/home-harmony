function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

export async function imageFileToUploadDataUrl(
  file: File,
  options: {
    maxDimension?: number;
    preferredQuality?: number;
    maxDataUrlLength?: number;
  } = {},
): Promise<string> {
  const {
    maxDimension = 1800,
    preferredQuality = 0.92,
    maxDataUrlLength = 3_500_000,
  } = options;

  const originalDataUrl = await fileToDataUrl(file);
  if (
    typeof window === 'undefined' ||
    !file.type.startsWith('image/') ||
    (file.size <= 2.5 * 1024 * 1024 && originalDataUrl.length <= maxDataUrlLength)
  ) {
    return originalDataUrl;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height) || 1;
    const scale = Math.min(1, maxDimension / longestSide);
    const targetWidth = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const targetHeight = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return originalDataUrl;
    }

    // Fill white first so screenshots and recipe cards stay legible when encoded as JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, targetWidth, targetHeight);
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const qualitySteps = [preferredQuality, 0.86, 0.78, 0.7, 0.62];
    for (const quality of qualitySteps) {
      const candidate = canvas.toDataURL('image/jpeg', quality);
      if (candidate.length <= maxDataUrlLength) {
        return candidate;
      }
    }

    return canvas.toDataURL('image/jpeg', 0.55);
  } catch {
    return originalDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function isEdgeTransportFailureMessage(errorMessage?: string): boolean {
  const value = String(errorMessage || '').toLowerCase();
  return (
    value.includes('failed to send a request to the edge function') ||
    value.includes('failed to fetch') ||
    value.includes('networkerror') ||
    value.includes('fetch failed') ||
    value.includes('non-2xx') ||
    value.includes('status code')
  );
}
