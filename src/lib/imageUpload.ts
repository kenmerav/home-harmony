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
    const sourceWidth = image.naturalWidth || image.width || 1;
    const sourceHeight = image.naturalHeight || image.height || 1;
    const longestSide = Math.max(sourceWidth, sourceHeight) || 1;
    const baseScale = Math.min(1, maxDimension / longestSide);
    const baseWidth = Math.max(1, Math.round(sourceWidth * baseScale));
    const baseHeight = Math.max(1, Math.round(sourceHeight * baseScale));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return originalDataUrl;

    const qualitySteps = [preferredQuality, 0.86, 0.78, 0.7, 0.62, 0.55, 0.48];
    let bestCandidate = originalDataUrl;

    const renderCandidate = (width: number, height: number, quality: number) => {
      canvas.width = width;
      canvas.height = height;
      context.clearRect(0, 0, width, height);
      // Fill white first so screenshots and recipe cards stay legible when encoded as JPEG.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    };

    let width = baseWidth;
    let height = baseHeight;
    while (Math.max(width, height) >= 700 && Math.min(width, height) >= 400) {
      for (const quality of qualitySteps) {
        const candidate = renderCandidate(width, height, quality);
        if (candidate.length < bestCandidate.length) {
          bestCandidate = candidate;
        }
        if (candidate.length <= maxDataUrlLength) {
          return candidate;
        }
      }

      width = Math.max(400, Math.round(width * 0.82));
      height = Math.max(400, Math.round(height * 0.82));
      if (Math.max(width, height) <= 700 && Math.min(width, height) <= 400) {
        break;
      }
    }

    return bestCandidate;
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
